// Seeded random numbers (mulberry32). One stream per purpose keeps the
// world, the traffic and the screenshots reproducible from a single seed.
export function makeRng(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(lo, hi) { return lo + next() * (hi - lo); },
    int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    // Deterministic shuffle that returns a new array.
    shuffled(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    },
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
// Shortest signed angle difference, for steering and camera yaw.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function fmtCash(n) {
  return '$' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
export function fmtClock(totalMin) {
  const h = Math.floor(totalMin / 60) % 24;
  const m = Math.floor(totalMin % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function fmtTimer(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
