// Porto Azul city — dusk sunset, neon signs, lit towers, palms, 5 districts.
// Roads run on a 60-unit grid; buildings fill the blocks between them.
import * as THREE from 'three';

export const DISTRICTS = [
  { name: 'TORRE PLAZA', flavor: 'NEON, NOISE AND NO WAY OUT', x: 0, z: -80 },
  { name: 'THE MIRAGE STRIP', flavor: 'CASINO LIGHTS NEVER SLEEP', x: 60, z: 40 },
  { name: 'PALMLINE BEACH', flavor: 'SUN, SAND AND BAD DECISIONS', x: -90, z: 60 },
  { name: 'OLD TOWN', flavor: 'EVERY ALLEY HAS A PRICE', x: -80, z: -70 },
  { name: 'HARBOR EAST', flavor: 'CRATES, CRANES AND QUIET DEALS', x: 90, z: -70 },
];

export function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const dd = (d.x - x) * (d.x - x) + (d.z - z) * (d.z - z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0a18';
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng.chance(0.55);
      g.fillStyle = lit ? rng.pick(['#ffd27a', '#ff9d5c', '#9be8ff', '#fff3c4']) : '#181226';
      g.fillRect(x, y, 7, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, color, sub) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0616';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 144);
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 62 : 80);
  if (sub) {
    g.font = 'bold 30px Arial, sans-serif';
    g.fillText(sub, 256, 118);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.35, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2f })
  );
  trunk.position.y = 3.5;
  trunk.rotation.z = 0.08;
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x1f7a3d });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    g.add(leaf);
  }
  return g;
}

export function buildCity(scene, rng) {
  scene.background = new THREE.Color(0x33173f);
  scene.fog = new THREE.Fog(0x33173f, 90, 320);

  const hemi = new THREE.HemisphereLight(0xff9a5c, 0x241533, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff7a3c, 1.6);
  sun.position.set(-120, 42, -160);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7a5cff, 0.5);
  fill.position.set(100, 60, 120);
  scene.add(fill);

  // Low sun disc on the horizon.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8c42, fog: false })
  );
  sunDisc.position.set(-190, 26, -260);
  sunDisc.lookAt(0, 20, 0);
  scene.add(sunDisc);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ color: 0x1c1a26 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Roads on the 60-unit grid + lane dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x0e0d14 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0x8f8a6a });
  const roadLines = [-120, -60, 0, 60, 120];
  for (const v of roadLines) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(420, 10), roadMat);
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(0, 0.02, v);
    scene.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(10, 420), roadMat);
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(v, 0.02, 0);
    scene.add(rz);
    for (let d = -195; d < 200; d += 15) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.4), dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(d, 0.04, v);
      scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3), dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(v, 0.04, d);
      scene.add(d2);
    }
  }

  // Buildings fill the blocks between roads.
  const winTex = windowTexture(rng);
  const blockCenters = [-150, -90, -30, 30, 90, 150];
  const towerColors = [0x2c2440, 0x3a2c4a, 0x24344a, 0x40242e, 0x2e3a2c];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (rng.chance(0.22)) continue; // empty lot / plaza
      const w = rng.range(14, 24);
      const d = rng.range(14, 24);
      const h = rng.range(9, 46);
      const mat = new THREE.MeshLambertMaterial({
        color: rng.pick(towerColors),
        emissive: 0xffffff,
        emissiveMap: winTex,
        emissiveIntensity: 0.85,
        map: winTex,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(bx + rng.range(-4, 4), h / 2, bz + rng.range(-4, 4));
      scene.add(b);
      // Rooftop beacon on tall towers.
      if (h > 30) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff2a4a })
        );
        beacon.position.set(b.position.x, h + 1, b.position.z);
        scene.add(beacon);
      }
    }
  }

  // Neon signs on the south (+z) faces so they read from the Strip.
  function addSign(text, color, sub, x, y, z, w = 26) {
    const tex = signTexture(text, color, sub);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.3125),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    sign.position.set(x, y, z);
    scene.add(sign);
    return sign;
  }
  addSign('CASINO ROYALE', '#ff2e88', 'MIRAGE STRIP', 60, 16, 52.5, 30);
  addSign('MIRAGE', '#22e6ff', 'HOTEL & CASINO', 30, 13, 52.5, 20);
  addSign("BENNY'S GARAGE", '#ffb52e', 'UPGRADES · 24H', -30, 11, -47.5, 24);
  addSign('TORRE PLAZA', '#b46bff', 'DOWNTOWN', 0, 15, -67.5, 22);
  addSign('SOL FM', '#39ff88', '95.4 SYNTHWAVE', -90, 12, 52.5, 18);
  addSign('PALMLINE', '#ff7a3c', 'BEACH · SURF · SUN', -120, 10, 52.5, 20);

  // The casino block: a wide low building whose south face is the vault front.
  const casino = new THREE.Mesh(
    new THREE.BoxGeometry(34, 14, 20),
    new THREE.MeshLambertMaterial({ color: 0x3a1c40, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.7, map: winTex })
  );
  casino.position.set(60, 7, 42);
  scene.add(casino);
  const vaultDoor = new THREE.Mesh(
    new THREE.BoxGeometry(6, 8, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xc9a227, emissive: 0x6a5200, emissiveIntensity: 0.6 })
  );
  vaultDoor.position.set(60, 4, 52.2);
  scene.add(vaultDoor);

  // Benny's Garage block.
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(24, 8, 16),
    new THREE.MeshLambertMaterial({ color: 0x2c2c38, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.5, map: winTex })
  );
  garage.position.set(-30, 4, -55);
  scene.add(garage);

  // Palms along the beach and the Strip.
  for (let i = 0; i < 26; i++) {
    const palm = makePalm();
    const beach = i < 14;
    palm.position.set(
      beach ? rng.range(-160, -50) : rng.range(-40, 140),
      0,
      beach ? rng.range(20, 95) : rng.range(48, 56)
    );
    palm.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(palm);
  }

  // Streetlights along the main roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30303a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let d = -180; d <= 180; d += 40) {
    for (const [px, pz] of [[-66, d], [66, d], [d, -66], [d, 66]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
      pole.position.set(px, 3, pz);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampMat);
      lamp.position.set(px, 6.2, pz);
      scene.add(lamp);
    }
  }

  return {
    casinoPos: new THREE.Vector3(60, 0, 52),
    vaultPos: new THREE.Vector3(60, 0, 54),
    garagePos: new THREE.Vector3(-30, 0, -46),
    plazaPos: new THREE.Vector3(0, 0, -80),
  };
}
