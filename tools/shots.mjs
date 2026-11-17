// Playwright validation + screenshots for Porto Azul.
// Serves game/ locally, opens each ?shot= preset headless (SwiftShader GL),
// checks console errors + external requests, plays the systems a bit,
// and writes 4 JPEG screenshots (1280x800, <=256 KiB) to screenshots/.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, '..', 'game'));
const outDir = resolve(join(here, '..', 'screenshots'));
mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end('forbidden'); return; }
  try {
    const size = statSync(file).size;
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'content-length': size });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
console.log('serving on', port);

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
});
const failures = [];

async function testShot(name, query, play) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  const externalReqs = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(`http://127.0.0.1:${port}`) && !u.startsWith('data:') && !u.startsWith('blob:')) externalReqs.push(u);
  });
  await page.goto(`http://127.0.0.1:${port}/index.html${query}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 90000 });
  } catch {
    failures.push(`${name}: __shotReady timeout; __game=${await page.evaluate(() => (window.__game ? 'yes' : 'no'))}`);
  }
  const state = await page.evaluate(() => (window.__game ? window.__game.stats() : null));
  console.log(`[${name}] stats:`, JSON.stringify(state), 'errors:', consoleErrors.length, 'external:', externalReqs.length);
  if (consoleErrors.length) { failures.push(`${name}: console errors: ${consoleErrors.slice(0, 3).join(' | ')}`); }
  if (externalReqs.length) { failures.push(`${name}: external requests: ${externalReqs.slice(0, 3).join(' | ')}`); }
  if (play) await play(page);
  const shot = await page.screenshot({ type: 'jpeg', quality: 82 });
  const path = join(outDir, name);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(path, shot);
  const size = statSync(path).size;
  console.log(`[${name}] screenshot ${size} B ${size <= 262144 ? 'OK' : 'TOO BIG'}`);
  if (size > 262144) failures.push(`${name}: screenshot ${size} B > 256 KiB`);
  await page.close();
}

async function playSystems(page) {
  // exercise the live game (non-shot flow): start, walk, drive, wanted, shoot
  await page.evaluate(() => window.__game.start());
  await page.waitForTimeout(1500);
  await page.keyboard.down('w');
  await page.waitForTimeout(2000);
  await page.keyboard.up('w');
  const s1 = await page.evaluate(() => window.__game.player());
  console.log('  after walk:', JSON.stringify(s1));
  // teleport next to the parked car by the spawn, then steal it with E
  await page.evaluate(() => window.__game.teleport(4, 58));
  await page.waitForTimeout(300);
  await page.keyboard.press('e');
  await page.waitForTimeout(800);
  const s2 = await page.evaluate(() => window.__game.player());
  console.log('  after steal (inCar should be true, wanted > 0):', JSON.stringify(s2));
  if (!s2.inCar) failures.push('play: E did not enter the car');
  if (s2.wanted < 1) failures.push('play: stealing did not raise wanted');
  await page.keyboard.down('w');
  await page.waitForTimeout(8000);
  await page.keyboard.up('w');
  const s3 = await page.evaluate(() => window.__game.player());
  console.log('  after drive:', JSON.stringify(s3));
  if (Math.abs(s3.x - s2.x) + Math.abs(s3.z - s2.z) < 3) failures.push('play: car did not move');
  // exit, punch + shoot on foot
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
  await page.keyboard.press('f');
  await page.mouse.click(640, 400);
  await page.waitForTimeout(800);
  const s4 = await page.evaluate(() => window.__game.player());
  console.log('  after combat:', JSON.stringify(s4));
  if (s4.ammo !== 23) failures.push(`play: expected ammo 23 after one shot, got ${s4.ammo}`);
  const errs = await page.evaluate(() => window.__game.errors());
  if (errs.length) failures.push(`play: errors: ${errs.slice(0, 3).join(' | ')}`);
}

// 4 screenshots (cover first by name)
await testShot('1-drive.jpg', '?shot=drive&seed=1');
await testShot('2-foot.jpg', '?shot=foot&seed=1');
await testShot('3-chase.jpg', '?shot=chase&seed=1');
await testShot('4-mission.jpg', '?shot=mission&seed=1');
// live playthrough (no shot param) on a plain page
{
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await playSystems(page);
  if (consoleErrors.length) failures.push(`play: console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
  await page.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(' -', f);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
