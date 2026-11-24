// Six districts of Porto Azul. Each has a rectangle on the city grid, a flavor line,
// a map color, and a turf standing 0-5 that grows when missions / side jobs finish there.
export const DISTRICTS = [
  { name: 'TORRE PLAZA', flavor: 'PLAZA LIGHTS · HIGH STAKES', color: '#ff5fa2', x0: -280, z0: -280, x1: -95, z1: 0 },
  { name: 'THE MIRAGE STRIP', flavor: 'NEON · CASINOS · NO SLEEP', color: '#22e6ff', x0: -95, z0: -280, x1: 95, z1: 0 },
  { name: 'HARBOR EAST', flavor: 'DOCKS · CRATES · SMUGGLE RUNS', color: '#ffb020', x0: 95, z0: -280, x1: 280, z1: 0 },
  { name: 'PALMLINE BEACH', flavor: 'SUN, SAND AND BAD DECISIONS', color: '#7dff5e', x0: -280, z0: 0, x1: -95, z1: 280 },
  { name: 'OLD TOWN', flavor: 'OLD BRICKS · OLD SCORES', color: '#c9a86a', x0: -95, z0: 0, x1: 95, z1: 280 },
  { name: 'MARINA BAY', flavor: 'YACHTS · MONEY · TROUBLE', color: '#b78cff', x0: 95, z0: 0, x1: 280, z1: 280 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[0];
}

export function createTurf() {
  const standing = {};
  for (const d of DISTRICTS) standing[d.name] = 0;
  standing['TORRE PLAZA'] = 1; // Daz starts with a little plaza credit
  return {
    standing,
    gain(name) {
      if (standing[name] === undefined) return;
      standing[name] = Math.min(5, standing[name] + 1);
    },
    get(name) { return standing[name] ?? 0; },
    total() { return Object.values(standing).reduce((a, b) => a + b, 0); },
  };
}

export function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}
