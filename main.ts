// Porto Azul II entry point (Node 22, standard library only). The game is
// plain static files under game/ plus four screenshots; this program copies
// both into the output directory and writes the dossier the judge reads.
// It never deletes the output directory: in the grader it is a mount point.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

copyTree(join(root, 'game'), join(outDir, 'game'));
if (existsSync(join(root, 'screenshots'))) {
  copyTree(join(root, 'screenshots'), join(outDir, 'screenshots'));
} else {
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the rest refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all; a path under game/ over 1000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => /\.(jpe?g|png)$/i.test(f));
console.log(`dossier written: ${shots.length} screenshots, ${dossier.length} bytes`);
