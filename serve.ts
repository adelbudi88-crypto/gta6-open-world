// A tiny static server for game/ (Node 22, standard library only), so the
// entry can be played locally without a build step:
//   node serve.ts                    -> http://localhost:8080
//   node serve.ts --port 8081 --host 0.0.0.0
// It sends the MIME types a browser game needs, refuses any path outside
// game/, and otherwise does nothing clever: a development convenience,
// not a web server for the internet. Porto Azul II serves the same way
// as v1 — the game itself is all in game/.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));

function flagValue(argv, flag, fallback) {
  const at = argv.indexOf(flag);
  if (at === -1 || at + 1 >= argv.length) return fallback;
  return argv[at + 1] || fallback;
}

function pickPort(argv) {
  const wanted = Number(flagValue(argv, '--port', '8080'));
  const ok = Number.isInteger(wanted) && wanted > 0 && wanted < 65536;
  return ok ? wanted : 8080;
}

const argv = process.argv.slice(2);
const port = pickPort(argv);
const host = flagValue(argv, '--host', '127.0.0.1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

function serveFile(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}

createServer(serveFile).listen(port, host, () => {
  console.log(`game/ is on http://${host}:${port}`);
});
