// Porto Azul — dusk city. One deterministic build from the seeded RNG:
// road grid, lit towers, neon signs, palms, streetlights, Benny's Garage,
// the Mirage casino strip, the harbor dock + boat, and two burning wrecks
// that only appear after high-speed crashes.
import * as THREE from 'three';

export const DISTRICTS = [
  { name: 'TORRE PLAZA', flavor: 'GLASS, GOLD AND BAD DECISIONS', test: (x, z) => x >= 0 && z < 0 },
  { name: 'THE MIRAGE STRIP', flavor: 'NEON NEVER SLEEPS HERE', test: (x, z) => x < 0 && z < 0 },
  { name: 'PALMLINE BEACH', flavor: 'SUN, SAND AND BAD DECISIONS', test: (x, z) => x < 0 && z >= 0 },
  { name: 'HARBOR EAST', flavor: 'CRATES, BOATS AND QUIET MONEY', test: (x, z) => x >= 0 && z >= 0 },
];

function windowTexture(rng, warm) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#101018';
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng.chance(0.55);
      g.fillStyle = lit ? (warm ? '#ffd27a' : '#9fd8ff') : '#1a1a26';
      g.fillRect(x, y, 8, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text, color, bg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // Dusk sky + fog + lights.
  scene.background = new THREE.Color(0x2a1535);
  scene.fog = new THREE.Fog(0x2a1535, 60, 320);
  const hemi = new THREE.HemisphereLight(0xff9a5c, 0x1a1030, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff7a3c, 1.6);
  sun.position.set(-80, 38, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x403060, 0.7));

  // Ground + wet-road sheen.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: 0.55, metalness: 0.35 }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Road grid every 40 units, roads 10 wide.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x14121c, roughness: 0.35, metalness: 0.5 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  for (let i = -160; i <= 160; i += 40) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(340, 10), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, i);
    group.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(10, 340), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(i, 0.02, 0);
    group.add(v);
    for (let d = -140; d <= 140; d += 20) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 4), lineMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.04, d);
      group.add(dash);
    }
  }

  // Towers with lit windows — deterministic placement in blocks between roads.
  const winTex = [windowTexture(rng, true), windowTexture(rng, false), windowTexture(rng, true)];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1c1a26, roughness: 0.9 });
  let placed = 0;
  for (let bx = -140; bx <= 140 && placed < 110; bx += 40) {
    for (let bz = -140; bz <= 140 && placed < 110; bz += 40) {
      if (rng.chance(0.18)) continue;
      const cx = bx + rng.range(-8, 8);
      const cz = bz + rng.range(-8, 8);
      const w = rng.range(10, 18), d = rng.range(10, 18), h = rng.range(12, 46);
      const mat = new THREE.MeshStandardMaterial({
        map: winTex[placed % 3], emissive: 0xffffff, emissiveMap: winTex[placed % 3],
        emissiveIntensity: 0.55, roughness: 0.85,
      });
      const tower = new THREE.Mesh(boxGeo, mat);
      tower.scale.set(w, h, d);
      tower.position.set(cx, h / 2, cz);
      group.add(tower);
      const roof = new THREE.Mesh(boxGeo, roofMat);
      roof.scale.set(w + 0.6, 0.8, d + 0.6);
      roof.position.set(cx, h + 0.4, cz);
      group.add(roof);
      placed++;
    }
  }

  // Neon signs (canvas textures, emissive) — the Strip, the garage, the plaza.
  const signs = [
    { text: 'CASINO ROYALE', color: '#ff2e88', bg: '#12041a', pos: [-100, 16, -98], ry: Math.PI / 4 },
    { text: 'THE MIRAGE', color: '#22e6ff', bg: '#04141a', pos: [-118, 13, -62], ry: Math.PI / 2 },
    { text: "BENNY'S GARAGE", color: '#ffb400', bg: '#1a0f04', pos: [20, 9, 22], ry: 0 },
    { text: 'HOTEL AZUL', color: '#7cff6b', bg: '#041a08', pos: [62, 20, -62], ry: -Math.PI / 4 },
    { text: 'SOL FM 95.4', color: '#ff7a3c', bg: '#1a0804', pos: [-62, 14, 62], ry: Math.PI },
  ];
  const neonMats = [];
  for (const s of signs) {
    const tex = signTexture(s.text, s.color, s.bg);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), mat);
    mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
    mesh.rotation.y = s.ry;
    group.add(mesh);
    neonMats.push(mat);
  }

  // Benny's Garage block + casino block (low, wide, lit).
  const garage = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x3a2c14, roughness: 0.8, emissive: 0x332200, emissiveIntensity: 0.4 }));
  garage.scale.set(22, 6, 14);
  garage.position.set(20, 3, 16);
  group.add(garage);
  const casino = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x2c0a2e, roughness: 0.7, emissive: 0xff2e88, emissiveIntensity: 0.08 }));
  casino.scale.set(30, 10, 20);
  casino.position.set(-100, 5, -90);
  group.add(casino);

  // Harbor dock + boat (Harbor East, Ch.6).
  const dock = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x4a3a22, roughness: 0.9 }));
  dock.scale.set(30, 1.2, 8);
  dock.position.set(120, 0.6, 118);
  group.add(dock);
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.5 }));
  hull.scale.set(14, 2.4, 5);
  boat.add(hull);
  const cabin = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.5 }));
  cabin.scale.set(5, 2.6, 4);
  cabin.position.set(-2, 2.4, 0);
  boat.add(cabin);
  boat.position.set(120, 1.4, 128);
  group.add(boat);

  // Crates at the dock (Ch.6 smuggle run).
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const crate = new THREE.Mesh(boxGeo, crateMat);
    crate.scale.setScalar(rng.range(1.6, 2.4));
    crate.position.set(108 + (i % 4) * 4, 1.2, 112 + Math.floor(i / 4) * 4);
    crate.rotation.y = rng.range(0, 1);
    group.add(crate);
  }

  // Palms along the beach + plaza.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f6b2e, roughness: 0.9 });
  for (let i = 0; i < 46; i++) {
    const px = i < 24 ? rng.range(-140, -20) : rng.range(-20, 140);
    const pz = i < 24 ? rng.range(20, 140) : rng.range(-140, -20);
    if (Math.abs(px % 40) < 8 || Math.abs(pz % 40) < 8) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
    trunk.position.set(px, 3, pz);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 6), leafMat);
    leaves.position.set(px, 7, pz);
    group.add(leaves);
  }

  // Streetlights — emissive globes only (no extra real lights, keeps swiftshader fast).
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x30303a, roughness: 0.6, metalness: 0.6 });
  const globeMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let x = -120; x <= 120; x += 40) {
    for (let z = -120; z <= 120; z += 40) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.4, 5), poleMat);
      pole.position.set(x + 6, 2.7, z + 6);
      group.add(pole);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), globeMat);
      globe.position.set(x + 6, 5.5, z + 6);
      group.add(globe);
    }
  }

  // Burning wrecks — hidden until a high-speed crash triggers them.
  const wrecks = [];
  const wreckSpots = [[40, -80], [-40, 40]];
  for (const [wx, wz] of wreckSpots) {
    const wreck = new THREE.Group();
    const body = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 1 }));
    body.scale.set(4.4, 1.1, 2);
    body.position.y = 0.6;
    body.rotation.y = rng.range(0, 3);
    wreck.add(body);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.9 }),
    );
    flame.position.y = 2.2;
    wreck.add(flame);
    const light = new THREE.PointLight(0xff5a00, 12, 18);
    light.position.y = 2.5;
    wreck.add(light);
    wreck.position.set(wx, 0, wz);
    wreck.visible = false;
    wreck.userData.flame = flame;
    wreck.userData.light = light;
    group.add(wreck);
    wrecks.push(wreck);
  }

  let pulseT = 0;
  return {
    group,
    districtAt(x, z) {
      for (const d of DISTRICTS) if (d.test(x, z)) return d;
      return DISTRICTS[0];
    },
    showWreck(i) { if (wrecks[i]) wrecks[i].visible = true; },
    wreckVisible(i) { return !!(wrecks[i] && wrecks[i].visible); },
    garagePos: { x: 20, z: 16 },
    boatPos: { x: 120, z: 128 },
    update(dt) {
      pulseT += dt;
      const s = 0.75 + Math.sin(pulseT * 3) * 0.25;
      for (const mat of neonMats) mat.opacity = 1;
      for (const w of wrecks) {
        if (!w.visible) continue;
        w.userData.flame.scale.setScalar(0.85 + Math.sin(pulseT * 9 + w.position.x) * 0.2);
        w.userData.light.intensity = 10 + Math.sin(pulseT * 11) * 4;
      }
      void s;
    },
  };
}
