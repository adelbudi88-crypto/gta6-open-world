// Porto Azul — procedural dusk city: road grid, district buildings with neon signs,
// palms on the beach, streetlights, harbor water + docks, day-cycle lighting.
import * as THREE from 'three';
import { districtAt, DISTRICTS } from './turf.js';

const BUILDING_COLORS = [0x2a2f45, 0x3a2b3f, 0x24384a, 0x40332a, 0x2f3a2a, 0x453a55];
const NEON_COLORS = [0xff2e88, 0x22e6ff, 0xffb020, 0x7dff5e, 0xb78cff, 0xff5f6d];

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const neons = [];
  const lamps = [];
  const buildings = [];

  // Ground: dark asphalt base, sand strip on Palmline Beach, water plane east.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x252a3a, roughness: 0.85, metalness: 0.15 }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(185, 280),
    new THREE.MeshStandardMaterial({ color: 0x8a7a52, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-187, 0.05, 140);
  group.add(sand);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 560),
    new THREE.MeshStandardMaterial({ color: 0x0a3a5c, roughness: 0.25, metalness: 0.6 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(262, 0.08, 0);
  group.add(water);

  // Roads: grid lines every 40 units, slightly lighter strips + center dashes.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3d4257, roughness: 0.7, metalness: 0.2 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  for (let c = -260; c <= 260; c += 40) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 560), roadMat);
    v.position.set(c, 0.06, 0);
    group.add(v);
    const h = new THREE.Mesh(new THREE.BoxGeometry(560, 0.1, 10), roadMat);
    h.position.set(0, 0.06, c);
    group.add(h);
    for (let d = -260; d <= 260; d += 24) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 5), dashMat);
      dash.position.set(c, 0.1, d);
      group.add(dash);
    }
  }

  // Buildings: one per block cell, height varies by district (Strip = tallest, neon).
  const winMat = new THREE.MeshStandardMaterial({ color: 0x11131c, emissive: 0xffc46b, emissiveIntensity: 0.9, roughness: 0.4 });
  for (let gx = -260; gx < 260; gx += 40) {
    for (let gz = -260; gz < 260; gz += 40) {
      if (gx > 220) continue; // harbor water
      if (gx < -200 && gz > 100) continue; // beach sand
      if (rng.chance(0.14)) continue; // empty lots / plazas
      const cx = gx + 20, cz = gz + 20;
      const d = districtAt(cx, cz);
      const tall = d.name === 'THE MIRAGE STRIP' ? rng.range(34, 72) : rng.range(10, 42);
      const w = rng.range(16, 26), dep = rng.range(16, 26);
      const mat = new THREE.MeshStandardMaterial({
        color: BUILDING_COLORS[Math.floor(rng.next() * BUILDING_COLORS.length)],
        roughness: 0.8, metalness: 0.1,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, tall, dep), mat);
      b.position.set(cx, tall / 2, cz);
      group.add(b);
      buildings.push(b);
      // Lit windows: thin emissive slab on the front face.
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, tall * 0.72, 0.3), winMat);
      win.position.set(cx, tall * 0.52, cz + dep / 2 + 0.15);
      group.add(win);
      // Neon sign on taller buildings (Strip + Harbor especially).
      if (tall > 26 || d.name === 'THE MIRAGE STRIP') {
        const nc = NEON_COLORS[Math.floor(rng.next() * NEON_COLORS.length)];
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(rng.range(6, 12), 1.6, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x111111, emissive: nc, emissiveIntensity: 2.4 }),
        );
        sign.position.set(cx, tall + 1.2, cz);
        group.add(sign);
        neons.push(sign);
      }
      // Rooftop beacon on the tallest towers.
      if (tall > 55) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2020, emissiveIntensity: 3 }),
        );
        beacon.position.set(cx, tall + 1, cz);
        group.add(beon(beacon));
      }
    }
  }
  function beon(m) { return m; }

  // Casino Royale + hotel towers on the Strip (landmarks).
  const casino = new THREE.Mesh(
    new THREE.BoxGeometry(46, 30, 30),
    new THREE.MeshStandardMaterial({ color: 0x3a1040, roughness: 0.5, metalness: 0.3 }),
  );
  casino.position.set(0, 15, -140);
  group.add(casino);
  const casinoSign = new THREE.Mesh(
    new THREE.BoxGeometry(40, 4, 1),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2e88, emissiveIntensity: 3.2 }),
  );
  casinoSign.position.set(0, 32, -124);
  group.add(casinoSign);
  neons.push(casinoSign);

  // Palms along Palmline Beach.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4a, roughness: 0.9 });
  for (let i = 0; i < 42; i++) {
    const x = rng.range(-270, -110), z = rng.range(10, 270);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat);
    crown.position.set(x, 8.2, z);
    group.add(crown);
  }

  // Streetlights on every other road crossing.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.6 });
  for (let gx = -240; gx <= 240; gx += 80) {
    for (let gz = -240; gz <= 240; gz += 80) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(gx + 6, 3.5, gz + 6);
      group.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x333311, emissive: 0xffe9a8, emissiveIntensity: 0.4 }),
      );
      lamp.position.set(gx + 6, 7.2, gz + 6);
      group.add(lamp);
      lamps.push(lamp);
    }
  }

  // Harbor docks + crates (Harbor East).
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 8), dockMat);
    dock.position.set(232, 0.7, -160 + i * 70);
    group.add(dock);
  }
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.9 });
  for (let i = 0; i < 26; i++) {
    const s = rng.range(2, 3.4);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    crate.position.set(rng.range(150, 225), s / 2 + 0.1, rng.range(-240, -30));
    crate.rotation.y = rng.range(0, 1.5);
    group.add(crate);
  }

  // Benny's Garage marker (Torre Plaza) — glowing pad + sign.
  const garagePad = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.3, 14),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x22e6ff, emissiveIntensity: 1.2 }),
  );
  garagePad.position.set(-140, 0.2, -140);
  group.add(garagePad);
  const garageSign = new THREE.Mesh(
    new THREE.BoxGeometry(14, 2, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x22e6ff, emissiveIntensity: 2.6 }),
  );
  garageSign.position.set(-140, 9, -148);
  group.add(garageSign);
  neons.push(garageSign);

  // Burning-wreck props (spawned after high-speed crashes; two pre-placed for flavor).
  const wreckMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 });
  for (const [wx, wz] of [[60, 60], [-60, 200]]) {
    const wreck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 2), wreckMat);
    wreck.position.set(wx, 0.7, wz);
    wreck.rotation.y = rng.range(0, 3);
    group.add(wreck);
  }

  // Day-cycle lighting: sun + hemisphere + fog, driven by clock hours.
  const sun = new THREE.DirectionalLight(0xffb36b, 1.9);
  sun.position.set(-180, 90, 120);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x8a7bd8, 0x1a1410, 0.85);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x35354a, 0.55);
  scene.add(ambient);
  scene.fog = new THREE.Fog(0x2a1535, 120, 620);

  function updateDayCycle(hours) {
    // 19.07 dusk -> 21.40 night. t=0 dusk, t=1 full night.
    const t = Math.max(0, Math.min(1, (hours - 19.07) / 2.55));
    sun.intensity = 1.9 - 1.0 * t;
    sun.color.setHSL(0.07 - 0.02 * t, 0.85, 0.62 - 0.22 * t);
    hemi.intensity = 0.85 - 0.25 * t;
    scene.fog.color.setHex(t > 0.5 ? 0x0a0a1e : 0x2a1535);
    for (const n of neons) n.material.emissiveIntensity = 2.4 + 1.8 * t;
    for (const l of lamps) l.material.emissiveIntensity = 0.4 + 2.6 * t;
    return t;
  }

  return { group, neons, lamps, buildings, updateDayCycle, districtAt };
}
