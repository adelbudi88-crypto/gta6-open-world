// Screenshot runner for Porto Azul II: serves game/ on a local port,
// loads each shot from shots.json in headless Chromium, waits for the
// staged pose to render, and saves the screenshot. Fails loudly on any
// console/page error or any screenshot over 256 KiB.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import('./node_modules/playwright/index.mjs');

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, '..'));
const gameRoot = resolve(join(root, 'game'));
const shotsPath = join(root, 'shots.json');
const shots = JSON.parse(readFileSync(shotsPath, 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = url.pathname;
  try { pathname = decodeURIComponent(pathname); } catch { res.writeHead(400).end('bad request'); return; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(gameRoot, normalize(pathname)));
  if (file !== gameRoot && !file.startsWith(gameRoot + sep)) { res.writeHead(403).end('forbidden'); return; }
  let data;
  try { data = readFileSync(file); } catch { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': data.length, 'cache-control': 'no-store' });
  res.end(data);
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const port = server.address().port;

const errors = [];
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

for (const shot of shots) {
  const outPath = join(root, 'screenshots', shot.name);
  await page.goto(`http://127.0.0.1:${port}/${shot.query}`, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
  } catch {
    errors.push(`shot ${shot.name}: __shotReady never became true`);
    continue;
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 82 });
  const size = statSync(outPath).size;
  console.log(`${shot.name}: ${size} bytes`);
  if (size > 262144) errors.push(`shot ${shot.name}: ${size} bytes exceeds 256 KiB`);
}

await browser.close();
server.close();

if (errors.length > 0) {
  console.log('CHECKS FAILED:');
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
