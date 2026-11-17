// Procedural dusk city: a road grid drawn onto one ground canvas, instanced
// buildings with lit windows, lamps, palms and neon signs. No textures are
// loaded from disk — every canvas is painted at boot from a seeded stream.
import * as THREE from 'three';
import { clamp } from './rng.js';

export const PITCH = 54;      // block (40) + road (14)
export const HALF = 270;      // city extends -270..270 on both axes
export const ROAD_W = 14;

export const DISTRICTS = [
  { name: 'TORRE PLAZA', flavor: 'HEART OF THE CITY', test: (x, z) => Math.abs(x) < 108 },
  { name: 'THE MIRAGE STRIP', flavor: 'CASINO ROW — NEON NEVER SLEEPS', test: (x, z) => z < 0 },
  { name: 'PALMLINE BEACH', flavor: 'SUN, SAND AND BAD DECISIONS', test: (x, z) => z >= 108 },
  { name: 'THE DOCKS', flavor: 'CRANES AND CONTAINERS', test: (x, z) => x >= 108 },
  { name: 'HILLCREST', flavor: 'OLD MONEY, QUIET STREETS', test: () => true },
];

export const GARAGE_POS = { x: -162, z: 162 };
export const CASINO_POS = { x: 162, z: -162 };

export function streetLines() {
  const lines = [];
  for (let k = 0; k <= 10; k++) lines.push(-HALF + k * PITCH);
  return lines;
}

function paintGround(rng) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const S = 1024 / 620; // px per world unit, world spans -310..310
  const px = (v) => (v + 310) * S;
  g.fillStyle = '#14101d';
  g.fillRect(0, 0, 1024, 1024);
  // District tints.
  const tints = [
    [-310, -310, 620, 202, 'rgba(150,60,200,0.10)'], // strip, north
    [-310, 108, 620, 202, 'rgba(220,180,90,0.10)'],  // beach, south
    [108, -108, 202, 216, 'rgba(60,160,180,0.08)'],  // docks, east
    [-310, -108, 202, 216, 'rgba(90,200,120,0.07)'], // hillcrest, west
  ];
  for (const [x, y, w, h, col] of tints) { g.fillStyle = col; g.fillRect(px(x), px(y), w * S, h * S); }
  // Sidewalk slabs, one per block.
  g.fillStyle = '#241d33';
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      const bx = -243 + i * PITCH, bz = -243 + j * PITCH;
      g.fillRect(px(bx - 21), px(bz - 21), 42 * S, 42 * S);
    }
  }
  // Roads: dark strips along every street line.
  g.fillStyle = '#0d0a15';
  for (const L of streetLines()) {
    g.fillRect(px(L - ROAD_W / 2), 0, ROAD_W * S, 1024);
    g.fillRect(0, px(L - ROAD_W / 2), 1024, ROAD_W * S);
  }
  // Centre dashes.
  g.fillStyle = '#8a7a2a';
  for (const L of streetLines()) {
    for (let d = -270; d < 270; d += 18) {
      g.fillRect(px(d), px(L - 0.5), 9 * S, 1 * S);
      g.fillRect(px(L - 0.5), px(d), 1 * S, 9 * S);
    }
  }
  // Crosswalk stripes at every intersection.
  g.fillStyle = 'rgba(220,220,230,0.55)';
  for (const a of streetLines()) {
    for (const b of streetLines()) {
      for (let s = -5; s <= 5; s += 2.5) {
        g.fillRect(px(a + s - 0.7), px(b - 7), 1.4 * S, 3 * S);
        g.fillRect(px(a + s - 0.7), px(b + 4), 1.4 * S, 3 * S);
        g.fillRect(px(a - 7), px(b + s - 0.7), 3 * S, 1.4 * S);
        g.fillRect(px(a + 4), px(b + s - 0.7), 3 * S, 1.4 * S);
      }
    }
  }
  void rng;
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function paintWindows(rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#191426';
  g.fillRect(0, 0, 128, 256);
  const lit = ['#ffcf7d', '#ffd9a0', '#9fd4ff', '#ffb46b'];
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 6 + col * 15, y = 8 + row * 15;
      g.fillStyle = rng.chance(0.55) ? rng.pick(lit) : '#0a0812';
      g.fillRect(x, y, 10, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function paintSky() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#120c2e');
  grad.addColorStop(0.45, '#3a2060');
  grad.addColorStop(0.68, '#c65a3c');
  grad.addColorStop(0.78, '#ff8a3c');
  grad.addColorStop(0.86, '#2a1a3e');
  grad.addColorStop(1.0, '#160f26');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

function paintSign(text, color, sub) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0616';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = color;
  g.font = 'bold 56px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 52 : 64);
  if (sub) {
    g.font = 'bold 26px Arial, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText(sub, 256, 98);
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createCity(scene, rng) {
  const boxes = []; // {x0,z0,x1,z1} collision boxes

  // Sky dome, sun, fog and lights.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(780, 24, 16),
    new THREE.MeshBasicMaterial({ map: paintSky(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(30, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb347, fog: false }),
  );
  sun.position.set(-480, 70, -260);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  scene.fog = new THREE.Fog(0x2b1e50, 130, 720);
  scene.add(new THREE.HemisphereLight(0x8a7bd8, 0x1a1426, 0.85));
  const dusk = new THREE.DirectionalLight(0xff9a3c, 1.25);
  dusk.position.set(-180, 90, 60);
  scene.add(dusk);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 620),
    new THREE.MeshLambertMaterial({ map: paintGround(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Buildings, instanced, one draw call.
  const winTex = paintWindows(rng);
  const spots = [];
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      const cx = -243 + i * PITCH, cz = -243 + j * PITCH;
      const downtown = Math.abs(cx) < 108 && Math.abs(cz) < 108;
      const n = downtown ? rng.int(2, 3) : rng.int(1, 2);
      for (let k = 0; k < n; k++) {
        const w = rng.range(11, 24), d = rng.range(11, 24);
        const x = cx + rng.range(-9, 9) * (w < 18 ? 1 : 0.4);
        const z = cz + rng.range(-9, 9) * (d < 18 ? 1 : 0.4);
        const h = downtown ? rng.range(18, 68) : rng.range(9, 30);
        spots.push({ x, z, w, d, h });
      }
    }
  }
  // Landmarks replace whatever fell near them: casino + garage.
  const casino = { x: CASINO_POS.x, z: CASINO_POS.z, w: 36, d: 20, h: 24 };
  const garage = { x: GARAGE_POS.x, z: GARAGE_POS.z, w: 28, d: 16, h: 9 };
  for (const s of spots) {
    if (Math.hypot(s.x - casino.x, s.z - casino.z) < 34) { s.x += 40; }
    if (Math.hypot(s.x - garage.x, s.z - garage.z) < 30) { s.x += 36; }
  }
  spots.push(casino, garage);
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMat = new THREE.MeshLambertMaterial({ map: winTex });
  const inst = new THREE.InstancedMesh(bGeo, bMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();
  const tints = [0xffd9b0, 0xc9b8ff, 0xffb0a0, 0xa0c8ff, 0xd8d0c0, 0xffc890];
  spots.forEach((s, i) => {
    pos.set(s.x, 0, s.z);
    sc.set(s.w, s.h, s.d);
    m4.compose(pos, q, sc);
    inst.setMatrixAt(i, m4);
    col.setHex(rng.pick(tints));
    inst.setColorAt(i, col);
    boxes.push({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 });
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);

  // Street lamps: pole + warm head, both instanced.
  const lampPts = [];
  for (const L of streetLines()) {
    for (let d = -243; d <= 243; d += PITCH) {
      lampPts.push({ x: L + 8.5, z: d });
      lampPts.push({ x: d, z: L + 8.5 });
    }
  }
  const poleGeo = new THREE.BoxGeometry(0.28, 5.2, 0.28);
  poleGeo.translate(0, 2.6, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2c2c38 }), lampPts.length);
  const headGeo = new THREE.SphereGeometry(0.42, 8, 6);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lampPts.length);
  lampPts.forEach((p, i) => {
    pos.set(p.x, 0, p.z); sc.set(1, 1, 1);
    m4.compose(pos, q, sc);
    poles.setMatrixAt(i, m4);
    pos.set(p.x, 5.2, p.z);
    m4.compose(pos, q, sc);
    heads.setMatrixAt(i, m4);
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  scene.add(poles, heads);

  // Palms along the beach and a few plazas.
  const palmPts = [];
  for (let i = 0; i < 64; i++) {
    const x = rng.range(-260, 260);
    const z = rng.chance(0.6) ? rng.range(120, 258) : rng.range(-258, 258);
    if (Math.abs(x) < 108 && Math.abs(z) < 108 && rng.chance(0.7)) continue;
    palmPts.push({ x, z, s: rng.range(0.8, 1.3) });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4a2c }), palmPts.length);
  const crownGeo = new THREE.ConeGeometry(2.4, 3.2, 7);
  crownGeo.translate(0, 8.2, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0x1e5c2e }), palmPts.length);
  palmPts.forEach((p, i) => {
    pos.set(p.x, 0, p.z); sc.set(p.s, p.s, p.s);
    m4.compose(pos, q, sc);
    trunks.setMatrixAt(i, m4);
    crowns.setMatrixAt(i, m4);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  scene.add(trunks, crowns);

  // Neon signs.
  const signs = [];
  function addSign(text, color, sub, x, y, z, ry, w = 22, h = 5.5) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: paintSign(text, color, sub), transparent: true }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    scene.add(mesh);
    signs.push(mesh);
  }
  addSign('CASINO ROYALE', '#ff5ad0', 'SLOTS · TABLES · 24H', casino.x, 15, casino.z + casino.d / 2 + 0.4, 0, 26, 6.5);
  addSign("BENNY'S GARAGE", '#ff9a3c', 'UPGRADES · REPAIRS', garage.x, 7.5, garage.z - garage.d / 2 - 0.4, Math.PI, 24, 6);
  addSign('SOL FM', '#37e0ff', '95.4 · SYNTHWAVE', 40, 34, -40, Math.PI * 0.75, 16, 4);
  addSign('HOTEL MIRAGE', '#b07cff', 'VACANCY', 190, 26, -190, -Math.PI * 0.25, 20, 5);

  function districtAt(x, z) {
    for (const d of DISTRICTS) if (d.test(x, z)) return d;
    return DISTRICTS[DISTRICTS.length - 1];
  }

  return {
    districtAt,
    garage: { ...GARAGE_POS },
    casino: { ...CASINO_POS },
    streets: streetLines(),
    buildingCount: spots.length,
    collides(x, z, r) {
      for (const b of boxes) {
        if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) return true;
      }
      return false;
    },
    // Keep a point inside the playable city.
    clampToCity(x, z, margin = 6) {
      return {
        x: clamp(x, -HALF + margin, HALF - margin),
        z: clamp(z, -HALF + margin, HALF - margin),
      };
    },
    update(t) {
      // One sign breathes so the strip feels alive.
      signs[0].material.opacity = 0.86 + 0.14 * Math.sin(t * 2.2);
      signs[2].material.opacity = 0.86 + 0.14 * Math.sin(t * 3.1 + 2);
    },
  };
}
