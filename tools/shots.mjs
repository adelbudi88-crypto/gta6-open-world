// Screenshot runner for Porto Azul II — renders the 4 staged dossier shots
// with Playwright and checks them (size, console errors). Run once:
//   node tools/shots.mjs
// Exits 0 with ALL CHECKS PASSED, or 1 with the failures listed.
import { spawn } from 'node:child_process';
import { readFileSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire('/home/hatch/workspace/makefun/best-game-01/x.js');
const { chromium } = require('playwright');

const PORT = 8901;
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
mkdirSync(join(root, 'screenshots'), { recursive: true });

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: root, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = [];
const errors = [];

async function waitServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
      if (res.ok) return true;
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

try {
  if (!(await waitServer())) {
    console.log('FAIL: serve.ts did not come up');
    process.exitCode = 1;
  } else {
    const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`${msg.location()?.url ?? ''}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText ?? ''}`));

    for (const shot of shots) {
      const url = `http://127.0.0.1:${PORT}/${shot.query}`;
      console.log(`shot ${shot.name} <- ${shot.query}`);
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      try {
        await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
      } catch (e) {
        failures.push(`${shot.name}: __shotReady never became true`);
        continue;
      }
      await sleep(600);
      const out = join(root, 'screenshots', shot.name);
      await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
      const size = statSync(out).size;
      console.log(`  ${shot.name}: ${size} bytes`);
      if (size > 262144) failures.push(`${shot.name}: ${size} bytes > 256 KiB`);
      if (size < 10000) failures.push(`${shot.name}: suspiciously small (${size} bytes)`);
    }
    await browser.close();
  }
} finally {
  server.kill();
}

if (errors.length > 0) {
  console.log(`FAIL: ${errors.length} console/page error(s):`);
  for (const e of errors) console.log(`  ${e}`);
  failures.push(`${errors.length} console/page error(s)`);
}
if (failures.length > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log('ALL CHECKS PASSED');
}
