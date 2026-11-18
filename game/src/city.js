// Porto Azul city: five districts, dusk/sunset lighting, neon signs on the
// south (+z) face so they read from the street, lit-window towers, palms,
// roads, the Casino Royale with its gold vault, and Benny's Garage.
import * as THREE from 'three';
import { makeRng } from './rng.js';

export const DISTRICTS = [
  { name: 'TORRE PLAZA', flavor: 'GLASS, GOLD AND BAD DECISIONS', center: [0, 0], color: 0xff9a3c },
  { name: 'THE MIRAGE STRIP', flavor: 'NEON NEVER SLEEPS HERE', center: [0, -120], color: 0xff2e88 },
  { name: 'PALMLINE BEACH', flavor: 'SUN, SAND AND BAD DECISIONS', center: [0, 170], color: 0x2ec8ff },
  { name: 'OLD TOWN', flavor: 'EVERY ALLEY KEEPS A SECRET', center: [-160, 0], color: 0xffc93c },
  { name: 'HARBOR EAST', flavor: 'CRATES, CRANES AND CASH', center: [160, 0], color: 0x7dff5e },
];

export function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - d.center[0];
    const dz = z - d.center[1];
    const dist = dx * dx + dz * dz;
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best;
}

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1c1426';
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng.chance(0.55);
      g.fillStyle = lit ? (rng.chance(0.7) ? '#ffd27d' : '#9be8ff') : '#241a30';
      g.fillRect(x, y, 8, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function neonTexture(text, color, sub) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0614';
  g.fillRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, sub ? 48 : 64);
  if (sub) {
    g.font = 'bold 26px Arial, sans-serif';
    g.shadowBlur = 12;
    g.fillStyle = '#ffffff';
    g.fillText(sub, 256, 100);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(THREE, rng, x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.45, 7, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }),
  );
  trunk.position.y = 3.5;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e7d46, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

export function buildCity(scene) {
  const rng = makeRng(20261118);
  const group = new THREE.Group();
  scene.add(group);

  // Dusk sky: deep purple horizon fog, orange sun low in the west.
  scene.background = new THREE.Color(0x2b1740);
  scene.fog = new THREE.Fog(0x3a1e52, 90, 420);
  const hemi = new THREE.HemisphereLight(0xff9a5c, 0x241533, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-120, 40, -60);
  scene.add(sun);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, fog: false }),
  );
  sunDisc.position.set(-260, 34, -180);
  sunDisc.lookAt(0, 20, 0);
  group.add(sunDisc);

  // Ground + road grid.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x14121c, roughness: 0.7, metalness: 0.25 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  for (const coord of [-180, -120, -60, 0, 60, 120, 180]) {
    for (const [w, l, x, z] of [[14, 560, coord, 0], [560, 14, 0, coord]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.02, z);
      group.add(road);
    }
    for (let d = -260; d < 260; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(coord, 0.04, d);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.04, coord);
      group.add(dash2);
    }
  }

  // Buildings: lit-window towers per district, kept off the roads.
  const winTex = windowTexture(rng);
  const blocks = [];
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      if (gx === 0 || gz === 0) continue;
      const bx = gx * 60 + rng.range(-8, 8);
      const bz = gz * 60 + rng.range(-8, 8);
      blocks.push([bx, bz]);
    }
  }
  for (const [bx, bz] of blocks) {
    const h = rng.range(14, 52);
    const w = rng.range(14, 24);
    const d = rng.range(14, 24);
    const dist = districtAt(bx, bz);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2c2340, roughness: 0.85, emissive: 0xffffff,
      emissiveMap: winTex, emissiveIntensity: 0.85,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(bx, h / 2, bz);
    group.add(b);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1, 0.8, d + 1),
      new THREE.MeshStandardMaterial({ color: dist.color, emissive: dist.color, emissiveIntensity: 0.7 }),
    );
    roof.position.set(bx, h + 0.4, bz);
    group.add(roof);
  }

  // Neon signs — always on the south (+z) face so they read from the street.
  const signs = [
    { text: 'CASINO ROYALE', sub: 'MIRAGE STRIP', color: '#ff2e88', x: 0, y: 26, z: -118 },
    { text: 'TORRE PLAZA', sub: 'DOWNTOWN', color: '#ff9a3c', x: -40, y: 30, z: 22 },
    { text: 'SOL FM 95.4', sub: 'SYNTHWAVE', color: '#2ec8ff', x: 44, y: 24, z: 82 },
    { text: "BENNY'S GARAGE", sub: 'UPGRADES • REPAIRS', color: '#7dff5e', x: -84, y: 12, z: 42 },
    { text: 'PALMLINE BEACH', sub: 'SUN • SAND • CASH', color: '#2ec8ff', x: 30, y: 22, z: 178 },
    { text: 'HARBOR EAST', sub: 'CRATES & CRANES', color: '#7dff5e', x: 168, y: 24, z: 24 },
  ];
  for (const s of signs) {
    const tex = neonTexture(s.text, s.color, s.sub);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 8.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    sign.position.set(s.x, s.y, s.z);
    group.add(sign);
  }

  // Casino Royale: gold block on the Mirage Strip, vault door on its south face.
  const casino = new THREE.Group();
  const casinoBody = new THREE.Mesh(
    new THREE.BoxGeometry(52, 22, 30),
    new THREE.MeshStandardMaterial({ color: 0x3a1c4d, roughness: 0.6, metalness: 0.3, emissive: 0xff2e88, emissiveIntensity: 0.12 }),
  );
  casinoBody.position.y = 11;
  casino.add(casinoBody);
  const vaultDoor = new THREE.Mesh(
    new THREE.BoxGeometry(8, 10, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xd8b13c, metalness: 0.9, roughness: 0.25, emissive: 0x8a6a10, emissiveIntensity: 0.5 }),
  );
  vaultDoor.position.set(0, 5, 15.6);
  casino.add(vaultDoor);
  const vaultGlow = new THREE.PointLight(0xffd27d, 60, 40);
  vaultGlow.position.set(0, 8, 20);
  casino.add(vaultGlow);
  casino.position.set(0, 0, -135);
  group.add(casino);

  // Benny's Garage at (-84, 36).
  const garage = new THREE.Group();
  const gBody = new THREE.Mesh(
    new THREE.BoxGeometry(24, 9, 16),
    new THREE.MeshStandardMaterial({ color: 0x2e4a2e, roughness: 0.8, emissive: 0x7dff5e, emissiveIntensity: 0.15 }),
  );
  gBody.position.y = 4.5;
  garage.add(gBody);
  const gDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.6 }),
  );
  gDoor.position.set(0, 3, 8.1);
  garage.add(gDoor);
  garage.position.set(-84, 0, 36);
  group.add(garage);

  // Palms along the beach road and the Strip.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-220, 220);
    const z = rng.pick([rng.range(150, 210), rng.range(-160, -100), rng.range(-40, 40)]);
    group.add(makePalm(THREE, rng, x, z));
  }

  // Streetlights along the main roads.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.5, metalness: 0.7 });
  for (let d = -240; d <= 240; d += 60) {
    for (const [x, z] of [[-8, d], [8, d], [d, -8], [d, 8]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8, 6), lampMat);
      pole.position.set(x, 4, z);
      group.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd27d }),
      );
      lamp.position.set(x, 8.2, z);
      group.add(lamp);
    }
  }

  return {
    group,
    districts: DISTRICTS,
    casinoPos: new THREE.Vector3(0, 0, -135),
    vaultDoor: new THREE.Vector3(0, 0, -118.5),
    garagePos: new THREE.Vector3(-84, 0, 36),
    bounds: 250,
  };
}
