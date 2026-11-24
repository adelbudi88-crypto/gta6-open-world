// Vehicles: 9 named cars + the Vela Speedboat, traffic AI, parked cars, explosions.
import * as THREE from 'three';

export const CAR_MODELS = [
  { name: 'Comet GT', color: 0xffd75e, top: 172, accel: 26 },
  { name: 'Neon Runner', color: 0x22e6ff, top: 168, accel: 25 },
  { name: 'Azul GT Coupe', color: 0x2f7bff, top: 160, accel: 23 },
  { name: 'Falcon Interceptor', color: 0xff3b30, top: 182, accel: 29 },
  { name: 'Brisa Van', color: 0xe8e0c8, top: 118, accel: 16 },
  { name: 'Solara S', color: 0xff8df0, top: 158, accel: 22 },
  { name: 'Viento LX', color: 0x7dff5e, top: 150, accel: 21 },
  { name: 'Coral Coupe', color: 0xff7a3c, top: 154, accel: 22 },
  { name: 'Duna Pickup', color: 0xc9a86a, top: 138, accel: 18 },
];
export const BOAT_MODEL = { name: 'Vela Speedboat', color: 0xf2f2f2, top: 95, accel: 20 };

function box(w, h, d, color, x = 0, y = 0, z = 0, rough = 0.35, metal = 0.55) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }),
  );
  m.position.set(x, y, z);
  return m;
}

export function buildCar(model, opts = {}) {
  const g = new THREE.Group();
  const color = opts.color ?? model.color;
  const isCop = !!opts.cop;
  const bodyColor = isCop ? 0xf2f2f2 : color;
  g.add(box(2.0, 0.62, 4.4, bodyColor, 0, 0.62, 0));
  g.add(box(1.7, 0.55, 2.2, 0x14181f, 0, 1.18, -0.2, 0.15, 0.7)); // cabin / glass
  if (isCop) {
    g.add(box(2.02, 0.3, 1.0, 0x14181f, 0, 0.66, 0.6)); // black hood band
    g.add(box(1.1, 0.22, 0.5, 0xff2020, -0.4, 1.55, -0.2)); // light bar red
    const blue = box(1.1, 0.22, 0.5, 0x2050ff, 0.4, 1.55, -0.2);
    blue.material = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2050ff, emissiveIntensity: 2.5 });
    g.add(blue);
    g.children[3].material = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2020, emissiveIntensity: 2.5 });
  }
  // headlights + taillights
  const hl = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2b0, emissiveIntensity: 2 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.12), hl);
    h.position.set(sx, 0.62, 2.22);
    g.add(h);
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.2, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2020, emissiveIntensity: 1.6 }),
    );
    t.position.set(sx, 0.62, -2.22);
    g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  g.userData = { model, isCop, wrecked: false, exploded: false };
  return g;
}

export function buildBoat() {
  const g = new THREE.Group();
  g.add(box(2.4, 0.8, 6.5, 0xf2f2f2, 0, 0.6, 0));
  g.add(box(1.8, 0.9, 2.4, 0x14324a, 0, 1.4, -0.6, 0.3, 0.4));
  g.add(box(0.3, 1.1, 0.3, 0x222222, 0, 2.2, -1.4));
  g.userData = { model: BOAT_MODEL, isBoat: true };
  return g;
}

// Traffic: cars loop along the road grid; ramming one hard makes it explode.
export function createTraffic(scene, rng, count = 32) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const model = CAR_MODELS[Math.floor(rng.next() * CAR_MODELS.length)];
    const g = buildCar(model);
    const horizontal = rng.chance(0.5);
    const lane = Math.floor(rng.range(-260, 260) / 40) * 40;
    const along = rng.range(-260, 260);
    g.position.set(horizontal ? along : lane, 0, horizontal ? lane : along);
    g.rotation.y = horizontal ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    scene.add(g);
    cars.push({ group: g, horizontal, lane, speed: rng.range(8, 16), dir: rng.chance(0.5) ? 1 : -1, model });
  }
  return {
    cars,
    update(dt, frozen) {
      if (frozen) return;
      for (const c of cars) {
        if (c.group.userData.wrecked) continue;
        const v = c.speed * c.dir * dt;
        if (c.horizontal) {
          c.group.position.x += v;
          if (c.group.position.x > 272) c.group.position.x = -272;
          if (c.group.position.x < -272) c.group.position.x = 272;
        } else {
          c.group.position.z += v;
          if (c.group.position.z > 272) c.group.position.z = -272;
          if (c.group.position.z < -272) c.group.position.z = 272;
        }
      }
    },
    nearest(pos, maxDist) {
      let best = null, bd = maxDist;
      for (const c of this.cars) {
        if (c.group.userData.wrecked) continue;
        const d = c.group.position.distanceTo(pos);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
  };
}

export function createParked(scene, rng, count = 14) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const model = CAR_MODELS[Math.floor(rng.next() * CAR_MODELS.length)];
    const g = buildCar(model);
    const lane = Math.floor(rng.range(-240, 240) / 40) * 40;
    const along = rng.range(-240, 240);
    const side = rng.chance(0.5);
    g.position.set(side ? lane + 7 : lane + rng.range(-4, 4), 0, side ? along : lane + 7);
    g.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(g);
    list.push({ group: g, model });
  }
  return list;
}

// Explosion: fireball + smoke + blackened wreck. Returns the wreck group.
export function detonate(scene, group) {
  if (!group || group.userData.exploded) return null;
  group.userData.exploded = true;
  group.userData.wrecked = true;
  const pos = group.position.clone();
  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.95 }),
  );
  fire.position.copy(pos).y = 1.6;
  scene.add(fire);
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.7 }),
  );
  smoke.position.copy(pos).y = 4.2;
  scene.add(smoke);
  // blacken the car
  group.traverse((m) => {
    if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 });
  });
  return { fire, smoke, group, t: 0 };
}

export function updateExplosions(list, dt) {
  for (const e of list) {
    e.t += dt;
    const s = Math.max(0.1, 3.2 - e.t * 2.2);
    e.fire.scale.setScalar(s / 3.2 + 0.4);
    e.fire.material.opacity = Math.max(0, 0.95 - e.t * 0.5);
    e.smoke.position.y += dt * 1.5;
    e.smoke.material.opacity = Math.max(0, 0.7 - e.t * 0.25);
  }
  return list.filter((e) => e.t < 4);
}
