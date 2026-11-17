// Porto Azul II — screenshot runner. Serves game/ on a scratch port, opens
// each shot from shots.json in headless Chromium at 1280x720, waits for the
// game's window.__shotReady flag, and saves a JPEG into screenshots/.
// Then it checks every rule the dossier gate cares about: 4 shots, each a
// whole JPEG under 256 KiB, zero console errors and zero page errors.
// Usage: node tools/shots.mjs   (run from the repository root)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/home/hatch/workspace/makefun/best-game-01/node_modules/playwright'));
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const shotsDir = join(root, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
const PORT = 8901;

const failures = [];
const notes = [];

function fail(msg) { failures.push(msg); console.log('FAIL: ' + msg); }
function note(msg) { notes.push(msg); console.log('ok: ' + msg); }

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: root, stdio: 'pipe' });
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

try {
  const up = await waitForServer(`http://127.0.0.1:${PORT}/`);
  if (!up) { fail('serve.ts did not come up: ' + serverLog.slice(-500)); throw new Error('no server'); }
  note('serve.ts up on port ' + PORT);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
  });
  try {
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
      page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
      const url = `http://127.0.0.1:${PORT}/${shot.query}`;
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      try {
        await page.waitForFunction(() => window.__shotReady === true, { timeout: 90000 });
      } catch {
        fail(shot.name + ': __shotReady never set (game did not render)' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));
        await page.close();
        continue;
      }
      await page.waitForTimeout(400);
      const outPath = join(shotsDir, shot.name);
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 82 });
      await page.close();
      if (errors.length > 0) fail(shot.name + ': ' + errors.slice(0, 3).join(' | '));
      else note(shot.name + ': rendered, 0 console/page errors');
      const size = statSync(outPath).size;
      if (size > 262144) fail(shot.name + ': ' + size + ' bytes, over 256 KiB');
      else note(shot.name + ': ' + size + ' bytes');
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}

if (shots.length !== 4) fail('expected 4 shots, shots.json has ' + shots.length);
for (const shot of shots) {
  if (!existsSync(join(shotsDir, shot.name))) fail('missing screenshot ' + shot.name);
}

if (failures.length === 0) {
  console.log('ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log(failures.length + ' CHECK(S) FAILED');
  process.exit(1);
}
