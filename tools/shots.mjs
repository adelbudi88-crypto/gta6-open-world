// Playwright validation + screenshots for Porto Azul II.
// Serves game/ locally, opens each ?shot= preset headless (SwiftShader GL),
// checks console errors + external requests, plays the systems a bit
// (walk, drive, steal, wanted, shoot, reload, radio, garage, helicopter),
// and writes 4 JPEG screenshots (1280x800, <=256 KiB) to screenshots/.
// The shot list (name + query) comes from shots.json; the per-shot
// expectations live here, keyed by file name.
// v2.1: manifest-driven shot loop, server + expectation helpers split out.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createReadStream, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, '..', 'game'));
const outDir = resolve(join(here, '..', 'screenshots'));
mkdirSync(outDir, { recursive: true });

// Shot manifest: the four frames the judge sees, in order.
const SHOTS = JSON.parse(readFileSync(join(here, '..', 'shots.json'), 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

function staticHandler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const size = statSync(file).size;
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'content-length': size });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
}

const server = createServer(staticHandler);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
console.log('serving on', port);

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'],
});
const failures = [];

function hudText(page, id) {
  return page.evaluate((i) => document.getElementById(i)?.textContent ?? '', id);
}

// Per-shot expectations, keyed by screenshot file name.
const EXPECT = {
  '1-drive.jpg': {
    chapter: (v) => v === 'CHAPTER 2/5',
    chapterVisible: (v) => v === true,
    cash: (v) => v.includes('18.450'),
    speed: (v) => parseInt(v, 10) >= 100,
    stats: (s) => s && s.heli === true && s.car && s.car.health === 100,
  },
  '2-foot.jpg': {
    chapter: (v) => v === 'CHAPTER 4/5',
    weapon: (v) => v.includes('HORNET SMG'),
    cash: (v) => v.includes('12.300'),
    wanted: (v) => v === 'WANTED 2/5',
  },
  '3-chase.jpg': {
    chapter: (v) => v === 'CHAPTER 3/5',
    chapterVisible: (v) => v === true,
    wanted: (v) => v === 'MOST WANTED',
    speed: (v) => parseInt(v, 10) >= 120,
    cash: (v) => v.includes('24.000'),
    stats: (s) => s && s.heli === true && s.cops >= 3 && s.car && s.car.health === 100,
  },
  '4-mission.jpg': {
    chapter: (v) => v === 'CHAPTER 5/5',
    cash: (v) => v.includes('48.500'),
    timer: (v) => v.startsWith('1:4'),
    wanted: (v) => v === 'WANTED 4/5',
    stats: (s) => s && s.thugs === 4,
  },
};

async function testShot(name, query) {
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
  const hud = {
    cash: await hudText(page, 'cash'),
    chapter: await hudText(page, 'chapter-title'),
    chapterVisible: await page.evaluate(() => document.getElementById('chapter')?.classList.contains('show') ?? false),
    wanted: await hudText(page, 'wanted-label'),
    weapon: await hudText(page, 'weapon'),
    district: await hudText(page, 'district-name'),
    speed: await hudText(page, 'speed-num'),
    timer: await hudText(page, 'mission-timer'),
    radio: await hudText(page, 'radio-name'),
  };
  console.log(`[${name}] stats:`, JSON.stringify(state), 'hud:', JSON.stringify(hud), 'errors:', consoleErrors.length, 'external:', externalReqs.length);
  if (consoleErrors.length) { failures.push(`${name}: console errors: ${consoleErrors.slice(0, 3).join(' | ')}`); }
  if (externalReqs.length) { failures.push(`${name}: external requests: ${externalReqs.slice(0, 3).join(' | ')}`); }
  const expect = EXPECT[name];
  if (expect) {
    for (const [key, check] of Object.entries(expect)) {
      const val = key === 'stats' ? state : hud[key];
      if (!check(val)) failures.push(`${name}: expectation failed for ${key}: ${JSON.stringify(val)}`);
    }
  }
  const shot = await page.screenshot({ type: 'jpeg', quality: 82 });
  const path = join(outDir, name);
  writeFileSync(path, shot);
  const size = statSync(path).size;
  console.log(`[${name}] screenshot ${size} B ${size <= 262144 ? 'OK' : 'TOO BIG'}`);
  if (size > 262144) failures.push(`${name}: screenshot ${size} B > 256 KiB`);
  await page.close();
}

async function playSystems(page) {
  // exercise the live game (non-shot flow): start, walk, drive, wanted,
  // shoot, reload, radio, garage upgrade, chapter banner
  await page.evaluate(() => window.__game.start());
  await page.waitForTimeout(800);
  const chapter = await hudText(page, 'chapter-title');
  console.log('  chapter banner:', chapter);
  if (chapter !== 'CHAPTER 1/5') failures.push(`play: expected chapter CHAPTER 1/5, got ${chapter}`);
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
  console.log('  after combat (mag should be 29):', JSON.stringify(s4));
  if (s4.mag !== 29) failures.push(`play: expected mag 29 after one shot, got ${s4.mag}`);
  // reload with Q (game time runs ~4x slower than wall time in SwiftShader,
  // so wait on the state, not on a wall-clock sleep)
  await page.keyboard.press('q');
  try {
    await page.waitForFunction(() => window.__game.player().mag === 30, { timeout: 20000 });
  } catch {
    failures.push('play: reload timed out waiting for mag 30');
  }
  const s5 = await page.evaluate(() => window.__game.player());
  console.log('  after reload (mag 30, reserve 119):', JSON.stringify(s5));
  if (s5.mag !== 30 || s5.reserve !== 119) failures.push(`play: reload failed, mag ${s5.mag} reserve ${s5.reserve}`);
  // radio cycles with C (game time runs ~4x slower than wall time in
  // SwiftShader, so wait on the HUD text, not on a fixed sleep)
  const radioBefore = await hudText(page, 'radio-name');
  await page.keyboard.press('c');
  try {
    await page.waitForFunction((before) => document.getElementById('radio-name')?.textContent !== before, radioBefore, { timeout: 5000 });
  } catch {
    failures.push('play: C did not change the radio station');
  }
  const radioAfter = await hudText(page, 'radio-name');
  console.log('  radio:', radioBefore, '->', radioAfter);
  // garage: give cash, drive to Benny's, buy an engine upgrade with G
  await page.evaluate(() => { window.__game.setCash(5000); window.__game.teleport(-117, 170); });
  await page.waitForTimeout(300);
  await page.keyboard.press('e'); // enter the car again if not in one (teleport keeps the car)
  await page.waitForTimeout(400);
  const s6 = await page.evaluate(() => window.__game.player());
  if (!s6.inCar) {
    // teleport moved the player but the car stayed: walk back is slow; use the parked taxi nearby
    await page.evaluate(() => window.__game.teleport(-163, 160));
    await page.waitForTimeout(300);
    await page.keyboard.press('e');
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__game.teleport(-117, 170));
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('g');
  await page.waitForTimeout(500);
  const s7 = await page.evaluate(() => window.__game.player());
  console.log('  after garage G (engine 1, cash 4200):', JSON.stringify(s7));
  if (s7.garageEngine !== 1) failures.push(`play: garage upgrade failed, engine ${s7.garageEngine}`);
  if (s7.cash !== 4200) failures.push(`play: garage charged wrong, cash ${s7.cash}`);
  const errs = await page.evaluate(() => window.__game.errors());
  if (errs.length) failures.push(`play: errors: ${errs.slice(0, 3).join(' | ')}`);
}

// 4 screenshots from the shots.json manifest, in order
for (const shot of SHOTS) {
  await testShot(shot.name, shot.query);
}
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
