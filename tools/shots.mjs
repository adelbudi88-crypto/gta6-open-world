// Dossier screenshots for Porto Azul II v2.8.
// Serves game/ on a local port, loads each ?shot=N in headless Chromium
// (swiftshader WebGL), waits for the staged frame (window.__shotReady),
// captures it as JPEG, and verifies: 0 console errors, 0 page errors,
// all 4 screenshots present and <= 256 KiB each.
//   node tools/shots.mjs
// Prints ALL CHECKS PASSED and exits 0 on success, FAIL + details otherwise.
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const gameRoot = join(repo, 'game');
const shotsDir = join(repo, 'screenshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const SHOTS = [
  { n: 1, file: '1-drive.jpg' },
  { n: 2, file: '2-foot.jpg' },
  { n: 3, file: '3-chase.jpg' },
  { n: 4, file: '4-mission.jpg' },
];

function serve() {
  return new Promise((resolveServer) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = resolve(join(gameRoot, normalize(pathname)));
        if (file !== gameRoot && !file.startsWith(gameRoot + sep)) {
          res.writeHead(403).end('forbidden');
          return;
        }
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': data.length, 'cache-control': 'no-store' });
        res.end(data);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

const failures = [];
function check(ok, label) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + label);
  if (!ok) failures.push(label);
}

const server = await serve();
const port = server.address().port;
const exe = process.env.CHROME_PATH
  || (process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
let browser = null;
try {
  browser = await chromium.launch({
    executablePath: exe,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('requestfailed', (req) => consoleErrors.push('requestfailed: ' + req.url()));

  await mkdir(shotsDir, { recursive: true });

  for (const shot of SHOTS) {
    consoleErrors.length = 0;
    pageErrors.length = 0;
    await page.goto(`http://127.0.0.1:${port}/?shot=${shot.n}`, { waitUntil: 'load', timeout: 60000 });
    let ready = false;
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
      ready = true;
    } catch {
      ready = false;
    }
    check(ready, `shot ${shot.n} staged (window.__shotReady)`);
    const shotErr = await page.evaluate(() => window.__shotError || null);
    check(!shotErr, `shot ${shot.n} no staging error` + (shotErr ? ` (${shotErr})` : ''));
    await page.waitForTimeout(700);
    const outPath = join(shotsDir, shot.file);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 80 });
    const info = await stat(outPath);
    console.log(`shot ${shot.n}: ${shot.file} ${info.size} bytes`);
    check(info.size > 10000, `shot ${shot.n} screenshot non-empty`);
    check(info.size <= 262144, `shot ${shot.n} screenshot <= 256 KiB (${info.size} bytes)`);
    check(consoleErrors.length === 0, `shot ${shot.n} 0 console errors` + (consoleErrors.length ? ` (${consoleErrors.slice(0, 3).join(' | ')})` : ''));
    check(pageErrors.length === 0, `shot ${shot.n} 0 page errors` + (pageErrors.length ? ` (${pageErrors.slice(0, 3).join(' | ')})` : ''));
  }
} catch (err) {
  failures.push('browser run: ' + (err && err.message || err));
  console.log('FAIL browser run: ' + (err && err.message || err));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}

if (failures.length === 0) {
  console.log('ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log('FAILURES: ' + failures.length);
  process.exit(1);
}
