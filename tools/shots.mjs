// Dossier screenshots for Porto Azul II: serves game/, opens each staged shot
// (?shot=drive|foot|chase|mission&seed=1), waits for window.__shotReady, captures
// 1280x800 JPEGs, and checks size + console errors. Prints ALL CHECKS PASSED on success.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = 8901;
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: root, stdio: 'pipe' });
let failed = false;
const errors = [];
try {
  const up = await waitForServer(`http://127.0.0.1:${PORT}/`);
  if (!up) { console.log('FAIL: server did not start'); process.exit(1); }
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  try {
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const pageErrors = [];
      page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
      page.on('pageerror', (e) => pageErrors.push('pageerror: ' + String(e)));
      page.on('requestfailed', (r) => pageErrors.push('requestfailed: ' + r.url()));
      const query = shot.query.startsWith('?') ? shot.query : '?' + shot.query;
      await page.goto(`http://127.0.0.1:${PORT}/${query}`, { waitUntil: 'load', timeout: 60000 });
      try {
        await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
      } catch {
        const err = await page.evaluate(() => window.__shotError || 'shot never became ready');
        pageErrors.push('shot not ready: ' + err);
      }
      await sleep(500);
      const out = join(root, 'screenshots', shot.name);
      await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
      const size = statSync(out).size;
      const okSize = size <= 262144;
      console.log(`${shot.name}: ${size} bytes ${okSize ? 'OK' : 'TOO BIG'}${pageErrors.length ? ' ERRORS: ' + pageErrors.join(' | ') : ''}`);
      if (!okSize) failed = true;
      if (pageErrors.length) { failed = true; errors.push(...pageErrors); }
      await page.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill('SIGTERM');
}

if (failed) {
  console.log('CHECKS FAILED');
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
