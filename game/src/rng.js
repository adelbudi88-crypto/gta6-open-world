// Seeded RNG (mulberry32) + small helpers. Deterministic per seed so that
// ?shot=...&seed=N staging renders the same city every run.
// v2: adds shuffle + gaussian helpers used by the dusk city builder.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  let spare = null;
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    // Fisher-Yates shuffle of a copy, driven by this rng.
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    // Box-Muller gaussian, mean 0, stddev 1 (cached spare value).
    gauss() {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0, v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      const t = 2 * Math.PI * v;
      spare = r * Math.sin(t);
      return r * Math.cos(t);
    },
  };
}

// Circle vs axis-aligned box push-out. Returns corrected position.
export function resolveCircleAABB(px, pz, r, box) {
  const cx = Math.max(box.x - box.hx, Math.min(px, box.x + box.hx));
  const cz = Math.max(box.z - box.hz, Math.min(pz, box.z + box.hz));
  const dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, z: cz + (dz / d) * r, nx: dx / d, nz: dz / d };
  }
  // Center inside the box: push out along the smallest penetration axis.
  const pl = px - (box.x - box.hx), pr = (box.x + box.hx) - px;
  const pt = pz - (box.z - box.hz), pb = (box.z + box.hz) - pz;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.x - box.hx - r, z: pz, nx: -1, nz: 0 };
  if (m === pr) return { x: box.x + box.hx + r, z: pz, nx: 1, nz: 0 };
  if (m === pt) return { x: px, z: box.z - box.hz - r, nx: 0, nz: -1 };
  return { x: px, z: box.z + box.hz + r, nx: 0, nz: 1 };
}

export function collideCircle(px, pz, r, colliders) {
  let hit = null;
  for (const b of colliders) {
    const res = resolveCircleAABB(px, pz, r, b);
    if (res) { px = res.x; pz = res.z; hit = res; }
  }
  return { x: px, z: pz, hit };
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
// Distance from a point to the nearest of several named places.
export function nearestPlace(x, z, places) {
  let best = null, bestD = Infinity;
  for (const p of places) {
    const d = dist2(x, z, p.x, p.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
