// Procedural city for Porto Azul — an original coastal city at dusk.
// Grid of roads, instanced buildings with lit windows, park, plaza tower,
// marina strip, lamps and palms, plus the neon casino strip, Benny's
// garage, wet-road puddles and a low orange sun. No external assets.
// v2.2: same landmarks, districts and road grid as v2.1, built by a
// different generator — blocks come from a shuffled list, buildings use
// a two-per-block pattern, trees ring the park, lamps follow the roads.
import * as THREE from 'three';
import { clamp, nearestPlace } from './rng.js';

export const PITCH = 78;      // block + road
export const ROAD_W = 14;
export const GRID_N = 3;      // roads at -3..3 * PITCH
export const CITY_R = GRID_N * PITCH + 40;

const FACADES = [0xd8c9a8, 0xc9b8a0, 0xb8c4cc, 0xd8a878, 0xa8b8c8, 0xe0d8c8, 0xc8a8a0, 0x9fb8a8];
const ROOFS = [0x8a7a68, 0x6a6a72, 0x7a6a5a, 0x5a6a7a];

// Named districts: the HUD shows the nearest one + its flavor line.
export const DISTRICTS = [
  { name: 'PALMLINE BEACH', flavor: 'SUN, SAND AND BAD DECISIONS', x: 0, z: -262 },
  { name: 'THE MIRAGE STRIP', flavor: 'CASINO ROW — NEON NEVER SLEEPS', x: 195, z: -78 },
  { name: 'TORRE PLAZA', flavor: 'HEART OF THE CITY', x: 39, z: 39 },
  { name: "BENNY'S YARD", flavor: 'GARAGE DISTRICT — FIX IT, FLIP IT', x: -117, z: 195 },
  { name: 'THE DOCKS', flavor: 'SMELL OF FISH AND MONEY', x: -195, z: -262 },
  { name: 'PALM COURT', flavor: 'OLD MONEY, NEW TROUBLE', x: 117, z: 117 },
];

const PARK = { bx: 1, bz: 1 };
const PLAZA = { bx: 0, bz: 0 };
const GARAGE_BLOCK = { bx: -2, bz: 2 };
const CASINO_BLOCKS = [{ bx: 2, bz: -2 }, { bx: 2, bz: -1 }, { bx: 2, bz: 0 }];

function isSpecialBlock(bx, bz) {
  if (bx === PARK.bx && bz === PARK.bz) return true;
  if (bx === PLAZA.bx && bz === PLAZA.bz) return true;
  if (bx === GARAGE_BLOCK.bx && bz === GARAGE_BLOCK.bz) return true;
  for (const b of CASINO_BLOCKS) {
    if (b.bx === bx && b.bz === bz) return true;
  }
  return false;
}

// Canvas texture: facade with a window grid (most windows lit warm at dusk).
function facadeTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  const cols = 10;
  const rows = 20;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 6 + col * 12;
      const y = 6 + r * 12;
      if (rng.chance(0.55)) {
        g.fillStyle = '#ffd98a';
      } else if (rng.chance(0.5)) {
        g.fillStyle = '#2a3542';
      } else {
        g.fillStyle = '#3a4a58';
      }
      g.fillRect(x, y, 7, 7);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Glowing neon sign: canvas text with shadow blur, on a transparent plane.
// rotY turns the face: -PI/2 faces west, PI/2 east, 0 south, PI north.
function neonSign(scene, text, colorHex, x, y, z, w, h, rotY = -Math.PI / 2) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  const css = '#' + colorHex.toString(16).padStart(6, '0');
  g.font = 'bold 54px "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = css;
  g.shadowBlur = 30;
  g.fillStyle = css;
  g.fillText(text, 256, 66);
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
  return mesh;
}

function flatMesh(w, d, mat, x, y, z, shadow = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  if (shadow) m.receiveShadow = true;
  return m;
}

function boxMesh(w, h, d, mat, x, y, z, shadow = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (shadow) m.castShadow = true;
  return m;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const placer = new THREE.Object3D();
  const tint = new THREE.Color();

  // --- ground (dusk grass) + sea strip + sand on the north edge ---
  const ground = flatMesh(CITY_R * 2 + 260, CITY_R * 2 + 260, new THREE.MeshLambertMaterial({ color: 0x5a7a4a }), 0, -0.05, 0, true);
  scene.add(ground);
  scene.add(flatMesh(CITY_R * 2 + 260, 130, new THREE.MeshLambertMaterial({ color: 0x1e4a6a }), 0, 0.02, -CITY_R - 65));
  scene.add(flatMesh(CITY_R * 2 + 260, 14, new THREE.MeshLambertMaterial({ color: 0xc8b088 }), 0, 0.03, -CITY_R - 2));

  // --- low orange sun + glow on the western horizon ---
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb45a, fog: false }),
  );
  sunDisc.position.set(330, 52, -260);
  sunDisc.lookAt(0, 20, 0);
  scene.add(sunDisc);
  const glowC = document.createElement('canvas');
  glowC.width = 256;
  glowC.height = 256;
  const gg = glowC.getContext('2d');
  const grad = gg.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 170, 90, 0.85)');
  grad.addColorStop(0.45, 'rgba(255, 120, 80, 0.35)');
  grad.addColorStop(1, 'rgba(255, 120, 80, 0)');
  gg.fillStyle = grad;
  gg.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowC);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
  glow.scale.set(320, 320, 1);
  glow.position.copy(sunDisc.position);
  scene.add(glow);

  // --- roads + sidewalks (wet asphalt at dusk, light enough to read) ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e323c });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a9088 });
  const roadsX = [];
  const roadsZ = [];
  for (let i = -GRID_N; i <= GRID_N; i++) {
    roadsX.push(i * PITCH);
    roadsZ.push(i * PITCH);
  }
  for (const x of roadsX) {
    scene.add(flatMesh(ROAD_W, CITY_R * 2 + 8, roadMat, x, 0.05, 0, true));
    scene.add(flatMesh(ROAD_W + 8, CITY_R * 2 + 8, walkMat, x, 0.0, 0));
  }
  for (const z of roadsZ) {
    scene.add(flatMesh(CITY_R * 2 + 8, ROAD_W, roadMat, 0, 0.05, z, true));
    scene.add(flatMesh(CITY_R * 2 + 8, ROAD_W + 8, walkMat, 0, 0.0, z));
  }

  // --- rain puddles: two per road, scattered along it ---
  const puddleMat = new THREE.MeshLambertMaterial({ color: 0x8ab8d8, transparent: true, opacity: 0.16 });
  const allRoads = [];
  for (const x of roadsX) allRoads.push({ onX: true, line: x });
  for (const z of roadsZ) allRoads.push({ onX: false, line: z });
  for (const road of allRoads) {
    for (let k = 0; k < 2; k++) {
      const along = rng.range(-CITY_R + 20, CITY_R - 20);
      const puddle = flatMesh(rng.range(4, 9), rng.range(2.5, 4), puddleMat, road.onX ? road.line : along, 0.07, road.onX ? along : road.line);
      puddle.rotation.z = rng.range(0, Math.PI);
      scene.add(puddle);
    }
  }

  // --- lane dashes (instanced thin boxes, brighter at dusk) ---
  const dashGeo = new THREE.BoxGeometry(0.5, 0.02, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const dashCount = roadsX.length * 2 * 21;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  let di = 0;
  for (const line of roadsX) {
    for (let k = -10; k <= 10; k++) {
      const z = k * (PITCH / 2) + PITCH / 4;
      placer.position.set(line, 0.03, z);
      placer.rotation.set(0, 0, 0);
      placer.scale.set(1, 1, 1);
      placer.updateMatrix();
      dashes.setMatrixAt(di++, placer.matrix);
      placer.position.set(z, 0.03, line);
      placer.rotation.set(0, Math.PI / 2, 0);
      placer.updateMatrix();
      dashes.setMatrixAt(di++, placer.matrix);
    }
  }
  dashes.count = di;
  scene.add(dashes);

  // --- buildings: two per ordinary block, from a shuffled block list ---
  const tex = facadeTexture(rng);
  const blocks = [];
  for (let bx = -GRID_N; bx < GRID_N; bx++) {
    for (let bz = -GRID_N; bz < GRID_N; bz++) {
      if (!isSpecialBlock(bx, bz)) blocks.push({ bx, bz });
    }
  }
  const shuffled = rng.shuffle(blocks);
  const placements = [];
  for (const block of shuffled) {
    const cx = block.bx * PITCH + PITCH / 2;
    const cz = block.bz * PITCH + PITCH / 2;
    const spots = [
      { ox: -14, oz: -12 },
      { ox: 13, oz: 11 },
    ];
    for (const spot of spots) {
      if (!rng.chance(0.85)) continue;
      const w = 18 + rng.range(0, 8);
      const d = 18 + rng.range(0, 8);
      const tall = rng.chance(0.14);
      const h = (10 + rng.range(0, 28)) * (tall ? 1.8 : 1);
      const x = clamp(cx + spot.ox + rng.range(-6, 6), cx - 22, cx + 22);
      const z = clamp(cz + spot.oz + rng.range(-6, 6), cz - 22, cz + 22);
      placements.push({ x, z, w, d, h, c: rng.pick(FACADES), roof: rng.pick(ROOFS) });
      colliders.push({ x, z, hx: w / 2, hz: d / 2 });
    }
  }
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0); // origin at base
  const buildings = new THREE.InstancedMesh(bGeo, new THREE.MeshLambertMaterial({ map: tex }), placements.length);
  const roofs = new THREE.InstancedMesh(bGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), placements.length);
  placements.forEach((p, i) => {
    placer.position.set(p.x, 0, p.z);
    placer.rotation.set(0, 0, 0);
    placer.scale.set(p.w, p.h, p.d);
    placer.updateMatrix();
    buildings.setMatrixAt(i, placer.matrix);
    buildings.setColorAt(i, tint.setHex(p.c));
    placer.position.set(p.x, p.h, p.z);
    placer.scale.set(p.w * 0.86, 1.2, p.d * 0.86);
    placer.updateMatrix();
    roofs.setMatrixAt(i, placer.matrix);
    roofs.setColorAt(i, tint.setHex(p.roof));
  });
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  scene.add(buildings);
  scene.add(roofs);

  // --- casino strip: three tall towers with neon signs (east side) ---
  const casinoTowers = [
    { x: 195, z: -117, w: 30, d: 26, h: 62, tint: 0x8a5aa8, sign: 'CASINO ROYALE', signColor: 0xff3aa8, signY: 34 },
    { x: 195, z: -39, w: 26, d: 30, h: 74, tint: 0x3a6a8a, sign: 'HOTEL MIRAGE', signColor: 0x3ad8ff, signY: 42 },
    { x: 195, z: 39, w: 28, d: 24, h: 48, tint: 0x8a3a3a, sign: 'NEON BAR', signColor: 0xffe23a, signY: 28 },
  ];
  for (const t of casinoTowers) {
    const tower = boxMesh(t.w, t.h, t.d, new THREE.MeshLambertMaterial({ map: tex, color: t.tint }), t.x, 0, t.z, true);
    scene.add(tower);
    colliders.push({ x: t.x, z: t.z, hx: t.w / 2, hz: t.d / 2 });
    neonSign(scene, t.sign, t.signColor, t.x - t.w / 2 - 0.4, t.signY, t.z, 26, 6.5);
  }
  neonSign(scene, 'MOTEL PALMERA', 0xff7a3a, -78, 12, -CITY_R + 12, 22, 5.5, 0);
  neonSign(scene, 'TACOS 24H', 0xff4040, 78 + 7, 8, -156, 14, 3.5);

  // --- Benny's garage: low wide building + neon sign + repair zone ---
  const garageX = -117;
  const garageZ = 195;
  scene.add(boxMesh(34, 9, 22, new THREE.MeshLambertMaterial({ color: 0x4a5a6a }), garageX, 0, garageZ, true));
  colliders.push({ x: garageX, z: garageZ, hx: 17, hz: 11 });
  scene.add(boxMesh(20, 6, 0.4, new THREE.MeshLambertMaterial({ color: 0x2a3442, emissive: 0x111a22 }), garageX, 3, garageZ - 11.2));
  neonSign(scene, "BENNY'S GARAGE", 0x3aff7a, garageX, 12, garageZ - 11.4, 30, 7, Math.PI);

  // --- plaza tower (landmark "Torre Azul") + fountain ---
  scene.add(boxMesh(20, 86, 20, new THREE.MeshLambertMaterial({ map: tex, color: 0x7fa8d8 }), PITCH / 2, 0, PITCH / 2, true));
  scene.add(boxMesh(10, 8, 10, new THREE.MeshLambertMaterial({ color: 0x2a4a6a, emissive: 0x446688 }), PITCH / 2, 86, PITCH / 2));
  colliders.push({ x: PITCH / 2, z: PITCH / 2, hx: 10, hz: 10 });
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x4a9ac8 }),
  );
  fountain.position.set(PITCH / 2 + 24, 0.6, PITCH / 2 - 18);
  scene.add(fountain);
  colliders.push({ x: PITCH / 2 + 24, z: PITCH / 2 - 18, hx: 7, hz: 7 });

  // --- park block: pond + trees ringing it ---
  const parkCx = PARK.bx * PITCH + PITCH / 2;
  const parkCz = PARK.bz * PITCH + PITCH / 2;
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshLambertMaterial({ color: 0x3a8ab8 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(parkCx - 8, 0.05, parkCz + 6);
  scene.add(pond);

  // --- trees: a ring around the park, a scatter over the blocks, palms by the sea ---
  const treeSpots = [];
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    treeSpots.push({ x: parkCx + Math.cos(ang) * 26, z: parkCz + Math.sin(ang) * 26, s: rng.range(0.9, 1.5) });
  }
  for (let i = 0; i < 30; i++) {
    const bx = rng.int(-GRID_N, GRID_N - 1);
    const bz = rng.int(-GRID_N, GRID_N - 1);
    if (bx === PARK.bx && bz === PARK.bz) continue;
    treeSpots.push({
      x: bx * PITCH + PITCH / 2 + rng.range(-26, 26),
      z: bz * PITCH + PITCH / 2 + rng.range(-26, 26),
      s: rng.range(0.7, 1.2),
    });
  }
  for (let x = -CITY_R + 20; x < CITY_R; x += 34) {
    treeSpots.push({ x, z: -CITY_R + 8, s: 1.3, palm: true });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
  trunkGeo.translate(0, 1.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6a4a2a }), treeSpots.length);
  const canGeo = new THREE.BoxGeometry(1, 1, 1);
  canGeo.translate(0, 0.5, 0);
  const canopies = new THREE.InstancedMesh(canGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), treeSpots.length);
  const leafTints = [0x3f8a3f, 0x5a9a3a, 0x2f7a4a];
  treeSpots.forEach((t, i) => {
    placer.position.set(t.x, 0, t.z);
    placer.rotation.set(0, 0, 0);
    placer.scale.set(t.s, t.s, t.s);
    placer.updateMatrix();
    trunks.setMatrixAt(i, placer.matrix);
    placer.position.set(t.x, 3 * t.s, t.z);
    placer.scale.set(4.4 * t.s, 3.4 * t.s, 4.4 * t.s);
    placer.updateMatrix();
    canopies.setMatrixAt(i, placer.matrix);
    const leaf = t.palm ? 0x3a9a5a : leafTints[i % leafTints.length];
    canopies.setColorAt(i, tint.setHex(leaf));
    colliders.push({ x: t.x, z: t.z, hx: 0.5, hz: 0.5 });
  });
  trunks.castShadow = true;
  canopies.castShadow = true;
  scene.add(trunks);
  scene.add(canopies);

  // --- street lamps: two per intersection, on the road shoulders ---
  const lampSpots = [];
  for (const x of roadsX) {
    for (const z of roadsZ) {
      lampSpots.push({ x: x + ROAD_W / 2 + 2.5, z });
      lampSpots.push({ x: x - ROAD_W / 2 - 2.5, z: z + PITCH / 2 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  poleGeo.translate(0, 3, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2a2a2e }), lampSpots.length);
  const headGeo = new THREE.BoxGeometry(1.4, 0.3, 0.5);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa7711 }), lampSpots.length);
  lampSpots.forEach((l, i) => {
    placer.position.set(l.x, 0, l.z);
    placer.rotation.set(0, 0, 0);
    placer.scale.set(1, 1, 1);
    placer.updateMatrix();
    poles.setMatrixAt(i, placer.matrix);
    placer.position.set(l.x, 6.1, l.z);
    placer.updateMatrix();
    heads.setMatrixAt(i, placer.matrix);
  });
  scene.add(poles);
  scene.add(heads);

  return {
    colliders,
    roadsX,
    roadsZ,
    spawn: { x: 0, z: PITCH / 2 + 25 },
    park: { x: parkCx, z: parkCz },
    plaza: { x: PITCH / 2, z: PITCH / 2 },
    tower: { x: PITCH / 2, z: PITCH / 2 },
    seaZ: -CITY_R,
    garage: { x: garageX, z: garageZ - 16 },
    casino: { x: 195, z: -78 },
    docks: { x: -195, z: -240 },
    districts: DISTRICTS,
    districtFor(x, z) { return nearestPlace(x, z, DISTRICTS); },
  };
}
