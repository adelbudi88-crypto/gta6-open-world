// Porto Azul: a dusk-lit grid city built from one seeded stream. Roads on a
// 60-unit grid, buildings with lit-window facades, neon signs on the Mirage
// Strip, palms and streetlights, a sunset sun and purple-orange fog.
import * as T from 'three';

export const ROAD_LINES = [-180, -120, -60, 0, 60, 120, 180];
export const CITY_LIMIT = 210;

export const DISTRICTS = [
  { name: 'THE MIRAGE STRIP', flavor: 'NEON, CHIPS AND BAD DECISIONS', test: (x, z) => x >= 90 && z < 90 },
  { name: 'HARBOR EAST', flavor: 'CRANES, CONTAINERS, NO QUESTIONS', test: (x, z) => x >= 90 && z >= 90 },
  { name: 'PALMLINE BEACH', flavor: 'SUN, SAND AND BAD DECISIONS', test: (x, z) => z >= 120 },
  { name: 'TORRE PLAZA', flavor: 'GLASS TOWERS AND OLD MONEY', test: (x, z) => x <= -30 && z <= -30 },
  { name: 'OLD TOWN', flavor: "BENNY'S TURF SINCE DAY ONE", test: () => true },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d;
  return DISTRICTS[DISTRICTS.length - 1];
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function facadeTexture(rng) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#2c2438'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 8; y += 18) {
      for (let x = 8; x < w - 8; x += 16) {
        const lit = rng.chance(0.55);
        g.fillStyle = lit ? (rng.chance(0.7) ? '#ffd76a' : '#9fe8ff') : '#14101d';
        g.fillRect(x, y, 10, 12);
      }
    }
  });
}

function roadTexture() {
  const tex = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#17121f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9a13b'; g.fillRect(w / 2 - 2, 6, 4, 26);
  });
  tex.wrapS = T.RepeatWrapping; tex.wrapT = T.RepeatWrapping;
  return tex;
}

function signTexture(text, color, sub) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.shadowColor = color; g.shadowBlur = 26;
    g.fillStyle = color;
    g.font = '900 56px Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, sub ? h / 2 - 18 : h / 2);
    if (sub) {
      g.font = '700 26px Arial';
      g.shadowBlur = 12;
      g.fillText(sub, w / 2, h / 2 + 34);
    }
  });
}

function skyTexture() {
  return canvasTexture(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1b0f3d');
    grad.addColorStop(0.45, '#5b2360');
    grad.addColorStop(0.72, '#c65a3c');
    grad.addColorStop(0.88, '#ff9a4d');
    grad.addColorStop(1, '#ffb36b');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

export function buildCity(scene, rng) {
  const colliders = [];
  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const facade = facadeTexture(rng);
  const palette = [0x4a3f66, 0x5d4a6e, 0x3d4a6e, 0x6e4a52, 0x44586b, 0x5a5a72];
  const neonSigns = [];

  scene.background = new T.Color(0x2a1245);
  scene.fog = new T.Fog(0x3a1c50, 120, 520);
  const sky = new T.Mesh(
    new T.SphereGeometry(800, 16, 12),
    new T.MeshBasicMaterial({ map: skyTexture(), side: T.BackSide, fog: false })
  );
  scene.add(sky);

  const sun = new T.Mesh(
    new T.CircleGeometry(46, 32),
    new T.MeshBasicMaterial({ color: 0xffb36b, fog: false })
  );
  sun.position.set(-560, 78, -260);
  sun.lookAt(0, 40, 0);
  scene.add(sun);

  scene.add(new T.HemisphereLight(0x8a5cff, 0x2a1a2e, 0.75));
  const sunset = new T.DirectionalLight(0xff8a4d, 1.5);
  sunset.position.set(-220, 90, -140);
  scene.add(sunset);
  scene.add(new T.AmbientLight(0x403060, 0.6));

  const ground = new T.Mesh(
    new T.PlaneGeometry(900, 900),
    new T.MeshLambertMaterial({ color: 0x241a33 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // Roads: asphalt strips with dashed centre lines, texture repeated along.
  for (const line of ROAD_LINES) {
    for (const horizontal of [true, false]) {
      const tex = roadTexture();
      tex.repeat.set(60, 1);
      const strip = new T.Mesh(
        new T.PlaneGeometry(440, 14),
        new T.MeshLambertMaterial({ map: tex })
      );
      strip.rotation.x = -Math.PI / 2;
      if (!horizontal) strip.rotation.z = Math.PI / 2;
      strip.position.set(horizontal ? 0 : line, 0, horizontal ? line : 0);
      scene.add(strip);
    }
  }

  function addBuilding(cx, cz, w, d, hgt, color, signText, signColor, signSub) {
    const mat = new T.MeshLambertMaterial({
      color, map: facade,
      emissive: new T.Color(color).multiplyScalar(0.35),
      emissiveMap: facade,
    });
    const b = new T.Mesh(boxGeo, mat);
    b.scale.set(w, hgt, d);
    b.position.set(cx, hgt / 2, cz);
    scene.add(b);
    const roof = new T.Mesh(boxGeo, new T.MeshLambertMaterial({ color: 0x1c1526 }));
    roof.scale.set(w + 1, 1, d + 1);
    roof.position.set(cx, hgt + 0.5, cz);
    scene.add(roof);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    if (signText) {
      const sign = new T.Mesh(
        new T.PlaneGeometry(Math.min(w * 0.9, 30), Math.min(w * 0.22, 7.5)),
        new T.MeshBasicMaterial({ map: signTexture(signText, signColor, signSub), transparent: true })
      );
      sign.position.set(cx, hgt * 0.72, cz + d / 2 + 0.3);
      sign.rotation.y = 0;
      scene.add(sign);
      neonSigns.push(sign);
    }
    return b;
  }

  // City blocks: centres between road lines, one or two towers per block.
  const centres = [-150, -90, -30, 30, 90, 150];
  for (const bx of centres) {
    for (const bz of centres) {
      if (bx === 150 && bz === -30) continue; // casino plot
      if (bx === -90 && bz === 30) continue; // garage plot
      const tall = bx <= -30 && bz <= -30; // Torre Plaza towers
      const n = rng.chance(0.4) ? 2 : 1;
      for (let i = 0; i < n; i += 1) {
        const ox = n === 2 ? (i === 0 ? -11 : 11) : 0;
        const oz = n === 2 ? (i === 0 ? -8 : 10) : 0;
        const w = rng.range(16, 22);
        const d = rng.range(14, 20);
        const hgt = tall ? rng.range(38, 70) : rng.range(12, 30);
        addBuilding(bx + ox, bz + oz, w, d, hgt, rng.pick(palette), null, null, null);
      }
      // Sidewalk plinth under the block.
      const plinth = new T.Mesh(boxGeo, new T.MeshLambertMaterial({ color: 0x332a44 }));
      plinth.scale.set(46, 0.6, 46);
      plinth.position.set(bx, 0.3, bz);
      scene.add(plinth);
    }
  }

  // Casino Royale on the Mirage Strip — the vault-job landmark.
  addBuilding(150, -30, 40, 30, 26, 0x6e2a6e, 'CASINO ROYALE', '#ff4fd8', 'THE MIRAGE · SLOTS · VAULT');
  const casinoGlow = new T.PointLight(0xff4fd8, 900, 120, 1.6);
  casinoGlow.position.set(150, 18, -52);
  scene.add(casinoGlow);
  addBuilding(150, 30, 26, 22, 18, 0x2a4a6e, 'HOTEL MIRAGE', '#4fd8ff', 'ROOMS · POOL · NEON');
  addBuilding(150, -90, 24, 20, 15, 0x6e4a2a, 'NEON BAR', '#ffb36b', 'OPEN ALL NIGHT');

  // Benny's Garage in Old Town.
  const garage = addBuilding(-90, 30, 30, 20, 10, 0x3a5a3a, "BENNY'S GARAGE", '#7dff9a', 'UPGRADES · REPAIRS · NO QUESTIONS');
  const garageGlow = new T.PointLight(0x7dff9a, 500, 80, 1.6);
  garageGlow.position.set(-90, 10, 12);
  scene.add(garageGlow);
  void garage;

  // Palms along the roads.
  const trunkMat = new T.MeshLambertMaterial({ color: 0x5a4632 });
  const leafMat = new T.MeshLambertMaterial({ color: 0x1f6b34 });
  const trunkGeo = new T.CylinderGeometry(0.35, 0.55, 9, 6);
  const leafGeo = new T.IcosahedronGeometry(3.2, 0);
  for (let i = 0; i < 52; i += 1) {
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(-190, 190);
    const side = rng.chance(0.5) ? 9 : -9;
    const px = rng.chance(0.5) ? line + side : along;
    const pz = rng.chance(0.5) ? along : line + side;
    if (Math.abs(px) > 205 || Math.abs(pz) > 205) continue;
    const trunk = new T.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 4.5, pz);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    scene.add(trunk);
    const leaves = new T.Mesh(leafGeo, leafMat);
    leaves.scale.y = 0.55;
    leaves.position.set(px, 10.2, pz);
    scene.add(leaves);
  }

  // Streetlights at intersections.
  const poleMat = new T.MeshLambertMaterial({ color: 0x22222e });
  const lampMat = new T.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new T.CylinderGeometry(0.18, 0.18, 7, 6);
  const lampGeo = new T.SphereGeometry(0.7, 8, 6);
  for (const lx of [-150, -90, -30, 30, 90, 150]) {
    for (const lz of [-150, -30, 90]) {
      const pole = new T.Mesh(poleGeo, poleMat);
      pole.position.set(lx + 8, 3.5, lz + 8);
      scene.add(pole);
      const lamp = new T.Mesh(lampGeo, lampMat);
      lamp.position.set(lx + 8, 7.2, lz + 8);
      scene.add(lamp);
    }
  }

  return {
    colliders,
    districtAt,
    garagePos: { x: -90, z: 18 },
    spots: {
      torrePlaza: { x: -150, z: -150 },
      casinoVault: { x: 150, z: -48 },
      garage: { x: -90, z: 18 },
      beach: { x: 0, z: 165 },
      harbor: { x: 165, z: 150 },
      strip: { x: 150, z: 30 },
    },
  };
}

// Circle (player / car) vs building AABBs: push the circle out, return true on hit.
export function collideCircle(colliders, x, z, radius) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        x += radius;
      }
    }
  }
  return { x, z, hit };
}
