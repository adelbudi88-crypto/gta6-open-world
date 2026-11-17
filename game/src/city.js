// Procedural city for Porto Azul — an original coastal city at dusk.
// Grid of roads, instanced buildings with lit windows, park, plaza tower,
// marina strip, lamps and palms, plus the neon casino strip, Benny's
// garage, wet-road puddles and a low orange sun. No external assets.
// v2: dusk mood, named districts, neon signs, casino + garage landmarks.
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

// Canvas texture: facade with a window grid (most windows lit warm at dusk).
function facadeTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  for (let y = 6; y < 250; y += 12) {
    for (let x = 6; x < 122; x += 12) {
      const lit = rng.chance(0.55);
      g.fillStyle = lit ? '#ffd98a' : (rng.chance(0.5) ? '#2a3542' : '#3a4a58');
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
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  const css = '#' + colorHex.toString(16).padStart(6, '0');
  g.font = 'bold 58px "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = css;
  g.shadowBlur = 26;
  g.fillStyle = css;
  g.fillText(text, 256, 64);
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 64);
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

export function buildCity(scene, rng) {
  const colliders = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // --- ground (dusk grass, darker than the midday v1) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_R * 2 + 260, CITY_R * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x5a7a4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // --- sea strip on the north edge (z < -CITY_R) ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_R * 2 + 260, 130),
    new THREE.MeshLambertMaterial({ color: 0x1e4a6a }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, -CITY_R - 65);
  scene.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_R * 2 + 260, 14),
    new THREE.MeshLambertMaterial({ color: 0xc8b088 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, -CITY_R - 2);
  scene.add(sand);

  // --- low orange sun + glow on the western horizon ---
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb45a, fog: false }),
  );
  sunDisc.position.set(330, 52, -260);
  sunDisc.lookAt(0, 20, 0);
  scene.add(sunDisc);
  const glowC = document.createElement('canvas');
  glowC.width = 256; glowC.height = 256;
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
  const roadsX = [], roadsZ = [];
  for (let i = -GRID_N; i <= GRID_N; i++) {
    roadsX.push(i * PITCH);
    roadsZ.push(i * PITCH);
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CITY_R * 2 + 8), roadMat);
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(i * PITCH, 0.05, 0);
    rx.receiveShadow = true;
    scene.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(CITY_R * 2 + 8, ROAD_W), roadMat);
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(0, 0.05, i * PITCH);
    rz.receiveShadow = true;
    scene.add(rz);
    const wx = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 8, CITY_R * 2 + 8), walkMat);
    wx.rotation.x = -Math.PI / 2;
    wx.position.set(i * PITCH, 0.0, 0);
    scene.add(wx);
    const wz = new THREE.Mesh(new THREE.PlaneGeometry(CITY_R * 2 + 8, ROAD_W + 8), walkMat);
    wz.rotation.x = -Math.PI / 2;
    wz.position.set(0, 0.0, i * PITCH);
    scene.add(wz);
  }

  // --- rain puddles on the roads (cheap wet-road shimmer) ---
  const puddleMat = new THREE.MeshLambertMaterial({ color: 0x8ab8d8, transparent: true, opacity: 0.16 });
  for (let i = 0; i < 14; i++) {
    const onX = rng.chance(0.5);
    const road = rng.pick(onX ? roadsX : roadsZ);
    const along = rng.range(-CITY_R + 20, CITY_R - 20);
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(4, 9), rng.range(2.5, 4)), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = rng.range(0, Math.PI);
    puddle.position.set(onX ? road : along, 0.07, onX ? along : road);
    scene.add(puddle);
  }

  // --- lane dashes (instanced thin boxes, brighter at dusk) ---
  const dashGeo = new THREE.BoxGeometry(0.5, 0.02, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const dashCount = (GRID_N * 2 + 1) * 2 * 22;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  let di = 0;
  for (let i = -GRID_N; i <= GRID_N; i++) {
    for (let k = -10; k <= 10; k++) {
      const z = k * (PITCH / 2) + PITCH / 4;
      dummy.position.set(i * PITCH, 0.03, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dashes.setMatrixAt(di++, dummy.matrix);
      dummy.position.set(z, 0.03, i * PITCH);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      dashes.setMatrixAt(di++, dummy.matrix);
    }
  }
  dashes.count = di;
  scene.add(dashes);

  // --- buildings (instanced boxes with facade texture) ---
  const tex = facadeTexture(rng);
  const bMat = new THREE.MeshLambertMaterial({ map: tex });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0); // origin at base
  const placements = [];
  const parkBlock = { bx: 1, bz: 1 };      // park
  const plazaBlock = { bx: 0, bz: 0 };     // central plaza + tower
  const casinoBlocks = [{ bx: 2, bz: -2 }, { bx: 2, bz: -1 }, { bx: 2, bz: 0 }]; // neon strip
  const garageBlock = { bx: -2, bz: 2 };   // Benny's garage
  const isSpecial = (bx, bz) =>
    (bx === parkBlock.bx && bz === parkBlock.bz) ||
    (bx === plazaBlock.bx && bz === plazaBlock.bz) ||
    (bx === garageBlock.bx && bz === garageBlock.bz) ||
    casinoBlocks.some((b) => b.bx === bx && b.bz === bz);
  for (let bx = -GRID_N; bx < GRID_N; bx++) {
    for (let bz = -GRID_N; bz < GRID_N; bz++) {
      const cx = bx * PITCH + PITCH / 2;
      const cz = bz * PITCH + PITCH / 2;
      if (isSpecial(bx, bz)) continue;
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const w = rng.range(16, 26), d = rng.range(16, 26);
        const h = rng.range(9, 40) * (rng.chance(0.14) ? 1.8 : 1);
        const ox = rng.range(-14, 14), oz = rng.range(-14, 14);
        const x = clamp(cx + ox, cx - 22, cx + 22);
        const z = clamp(cz + oz, cz - 22, cz + 22);
        placements.push({ x, z, w, d, h, c: rng.pick(FACADES), roof: rng.pick(ROOFS) });
        colliders.push({ x, z, hx: w / 2, hz: d / 2 });
      }
    }
  }
  const buildings = new THREE.InstancedMesh(bGeo, bMat, placements.length);
  const roofs = new THREE.InstancedMesh(bGeo, roofMat, placements.length);
  placements.forEach((p, i) => {
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.updateMatrix();
    buildings.setMatrixAt(i, dummy.matrix);
    buildings.setColorAt(i, color.setHex(p.c));
    dummy.position.set(p.x, p.h, p.z);
    dummy.scale.set(p.w * 0.86, 1.2, p.d * 0.86);
    dummy.updateMatrix();
    roofs.setMatrixAt(i, dummy.matrix);
    roofs.setColorAt(i, color.setHex(p.roof));
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
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(t.w, t.h, t.d),
      new THREE.MeshLambertMaterial({ map: tex, color: t.tint }),
    );
    tower.position.set(t.x, 0, t.z);
    tower.castShadow = true;
    scene.add(tower);
    colliders.push({ x: t.x, z: t.z, hx: t.w / 2, hz: t.d / 2 });
    neonSign(scene, t.sign, t.signColor, t.x - t.w / 2 - 0.4, t.signY, t.z, 26, 6.5);
  }
  // motel sign on the beach road, facing the city (south)
  neonSign(scene, 'MOTEL PALMERA', 0xff7a3a, -78, 12, -CITY_R + 12, 22, 5.5, 0);
  neonSign(scene, 'TACOS 24H', 0xff4040, 78 + 7, 8, -156, 14, 3.5);

  // --- Benny's garage: low wide building + neon sign + repair zone ---
  const garageX = -117, garageZ = 195;
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(34, 9, 22),
    new THREE.MeshLambertMaterial({ color: 0x4a5a6a }),
  );
  garage.position.set(garageX, 0, garageZ);
  garage.castShadow = true;
  scene.add(garage);
  colliders.push({ x: garageX, z: garageZ, hx: 17, hz: 11 });
  const garageDoor = new THREE.Mesh(
    new THREE.BoxGeometry(20, 6, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2a3442, emissive: 0x111a22 }),
  );
  garageDoor.position.set(garageX, 3, garageZ - 11.2);
  scene.add(garageDoor);
  neonSign(scene, "BENNY'S GARAGE", 0x3aff7a, garageX, 12, garageZ - 11.4, 30, 7, Math.PI);

  // --- plaza tower (landmark "Torre Azul") ---
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(20, 86, 20),
    new THREE.MeshLambertMaterial({ map: tex, color: 0x7fa8d8 }),
  );
  tower.position.set(PITCH / 2, 0, PITCH / 2);
  tower.castShadow = true;
  scene.add(tower);
  const towerTop = new THREE.Mesh(
    new THREE.BoxGeometry(10, 8, 10),
    new THREE.MeshLambertMaterial({ color: 0x2a4a6a, emissive: 0x446688 }),
  );
  towerTop.position.set(PITCH / 2, 86, PITCH / 2);
  scene.add(towerTop);
  colliders.push({ x: PITCH / 2, z: PITCH / 2, hx: 10, hz: 10 });
  // plaza fountain
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x4a9ac8 }),
  );
  fountain.position.set(PITCH / 2 + 24, 0.6, PITCH / 2 - 18);
  scene.add(fountain);
  colliders.push({ x: PITCH / 2 + 24, z: PITCH / 2 - 18, hx: 7, hz: 7 });

  // --- park block: trees, pond, paths ---
  const parkCx = parkBlock.bx * PITCH + PITCH / 2;
  const parkCz = parkBlock.bz * PITCH + PITCH / 2;
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshLambertMaterial({ color: 0x3a8ab8 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(parkCx - 8, 0.05, parkCz + 6);
  scene.add(pond);

  // --- trees (instanced trunk + canopy), palms along the sea ---
  const treeSpots = [];
  for (let i = 0; i < 46; i++) {
    const bx = rng.int(-GRID_N, GRID_N - 1), bz = rng.int(-GRID_N, GRID_N - 1);
    if (bx === parkBlock.bx && bz === parkBlock.bz) {
      treeSpots.push({ x: parkCx + rng.range(-26, 26), z: parkCz + rng.range(-26, 26), s: rng.range(0.9, 1.5) });
    } else if (rng.chance(0.5)) {
      treeSpots.push({
        x: bx * PITCH + PITCH / 2 + rng.range(-26, 26),
        z: bz * PITCH + PITCH / 2 + rng.range(-26, 26),
        s: rng.range(0.7, 1.2),
      });
    }
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
  treeSpots.forEach((t, i) => {
    dummy.position.set(t.x, 0, t.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(t.x, 3 * t.s, t.z);
    dummy.scale.set(4.4 * t.s, 3.4 * t.s, 4.4 * t.s);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);
    canopies.setColorAt(i, color.setHex(t.palm ? 0x3a9a5a : rng.pick([0x3f8a3f, 0x5a9a3a, 0x2f7a4a])));
    colliders.push({ x: t.x, z: t.z, hx: 0.5, hz: 0.5 });
  });
  trunks.castShadow = true;
  canopies.castShadow = true;
  scene.add(trunks);
  scene.add(canopies);

  // --- street lamps (instanced pole + glowing head) ---
  const lampSpots = [];
  for (let i = -GRID_N; i <= GRID_N; i++) {
    for (let k = -GRID_N; k < GRID_N; k++) {
      lampSpots.push({ x: i * PITCH + ROAD_W / 2 + 2.5, z: k * PITCH + PITCH / 2 });
      lampSpots.push({ x: i * PITCH - ROAD_W / 2 - 2.5, z: k * PITCH + PITCH / 2 + PITCH / 2 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  poleGeo.translate(0, 3, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2a2a2e }), lampSpots.length);
  const headGeo = new THREE.BoxGeometry(1.4, 0.3, 0.5);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa7711 }), lampSpots.length);
  lampSpots.forEach((l, i) => {
    dummy.position.set(l.x, 0, l.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(l.x, 6.1, l.z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
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
