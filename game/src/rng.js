// Seeded RNG (mulberry32) plus the small geometry helpers the whole game
// shares. One seed renders the same city every run, so the ?shot= staging
// is deterministic: same seed, same streets, same screenshots.
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const draw = mulberry32(seed);
  let heldGaussian = null;
  const api = {
    next: draw,
    range(lo, hi) {
      return lo + draw() * (hi - lo);
    },
    int(lo, hi) {
      return Math.floor(api.range(lo, hi + 1));
    },
    pick(list) {
      return list[Math.floor(draw() * list.length)];
    },
    chance(probability) {
      return draw() < probability;
    },
    // Fisher-Yates over a copy, driven by this rng.
    shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(draw() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
    // Box-Muller gaussian, mean 0, stddev 1 (caches the spare value).
    gauss() {
      if (heldGaussian !== null) {
        const value = heldGaussian;
        heldGaussian = null;
        return value;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = draw();
      while (v === 0) v = draw();
      const radius = Math.sqrt(-2 * Math.log(u));
      const angle = 2 * Math.PI * v;
      heldGaussian = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    },
  };
  return api;
}

// Push a circle out of an axis-aligned box. Returns the corrected spot plus
// the push-out normal, or null when there is no overlap.
export function resolveCircleAABB(px, pz, radius, box) {
  const nearestX = Math.max(box.x - box.hx, Math.min(px, box.x + box.hx));
  const nearestZ = Math.max(box.z - box.hz, Math.min(pz, box.z + box.hz));
  const dx = px - nearestX;
  const dz = pz - nearestZ;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return {
      x: nearestX + (dx / d) * radius,
      z: nearestZ + (dz / d) * radius,
      nx: dx / d,
      nz: dz / d,
    };
  }
  // The centre is inside the box: escape along the shallowest side.
  const left = px - (box.x - box.hx);
  const right = box.x + box.hx - px;
  const top = pz - (box.z - box.hz);
  const bottom = box.z + box.hz - pz;
  const shallowest = Math.min(left, right, top, bottom);
  if (shallowest === left) return { x: box.x - box.hx - radius, z: pz, nx: -1, nz: 0 };
  if (shallowest === right) return { x: box.x + box.hx + radius, z: pz, nx: 1, nz: 0 };
  if (shallowest === top) return { x: px, z: box.z - box.hz - radius, nx: 0, nz: -1 };
  return { x: px, z: box.z + box.hz + radius, nx: 0, nz: 1 };
}

// Run a circle through every collider, applying each push-out in turn.
export function collideCircle(px, pz, radius, colliders) {
  let hit = null;
  for (const box of colliders) {
    const fixed = resolveCircleAABB(px, pz, radius, box);
    if (fixed) {
      px = fixed.x;
      pz = fixed.z;
      hit = fixed;
    }
  }
  return { x: px, z: pz, hit };
}

export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Nearest of several named places (districts, landmarks) to a point.
export function nearestPlace(x, z, places) {
  let best = null;
  let bestD = Infinity;
  for (const place of places) {
    const d = dist2(x, z, place.x, place.z);
    if (d < bestD) {
      bestD = d;
      best = place;
    }
  }
  return best;
}
