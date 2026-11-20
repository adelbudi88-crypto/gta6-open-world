// Vehicles — box-built cars (no model files), arcade handling, traffic AI.
// Player cars: Comet GT and Neon Runner. Traffic: 32 cars on the road grid.
// Parked cars can be carjacked with E (see player.js).
import * as THREE from 'three';

export const PLAYER_CARS = {
  comet: { name: 'Comet GT', color: 0xffb400, topSpeed: 158, accel: 34 },
  neon: { name: 'Neon Runner', color: 0x22e6ff, topSpeed: 166, accel: 36 },
};

const TRAFFIC_COLORS = [0xc0c0c8, 0x30343c, 0x8a1a1a, 0x1a4a8a, 0xd8d8d8, 0x3c6b2e, 0x707070, 0xff6a00];
const TRAFFIC_NAMES = ['Azul GT Coupe', 'Torre Sedan', 'Plaza Hatch', 'Harbor Van', 'Mirage Taxi', 'Beach Cruiser'];

export function createCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 2), bodyMat);
  body.position.y = 0.75;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 0.2, metalness: 0.8 }),
  );
  cabin.position.set(-0.2, 1.45, 0);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const wz of [0.6, -0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), lightMat);
    hl.position.set(2.25, 0.8, wz);
    g.add(hl);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const wz of [0.6, -0.6]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), tailMat);
    tl.position.set(-2.25, 0.8, wz);
    g.add(tl);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 1.1), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar.position.set(-0.2, 1.95, 0);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(-0.2, 1.95, 0.55);
    g.add(bar2);
    g.userData.lightBar = bar;
  }
  if (opts.neon) {
    const under = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 1.9), new THREE.MeshBasicMaterial({ color: opts.neon }));
    under.position.y = 0.12;
    g.add(under);
  }
  g.userData.wheels = wheels;
  return g;
}

export function createVehicles(scene, rng) {
  const traffic = [];
  const parked = [];
  const lanes = [-120, -80, -40, 0, 40, 80, 120];

  // 32 moving traffic cars on the grid.
  for (let i = 0; i < 32; i++) {
    const horizontal = rng.chance(0.5);
    const lane = rng.pick(lanes);
    const along = rng.range(-150, 150);
    const mesh = createCarMesh(rng.pick(TRAFFIC_COLORS));
    mesh.position.set(horizontal ? along : lane, 0, horizontal ? lane : along);
    mesh.rotation.y = horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    scene.add(mesh);
    traffic.push({
      mesh, horizontal, lane, along, speed: rng.range(7, 13),
      dir: rng.chance(0.5) ? 1 : -1, name: rng.pick(TRAFFIC_NAMES),
    });
  }

  // 10 parked cars (carjackable) along the plaza + strip.
  const parkSpots = [[30, -30], [34, -30], [-30, -70], [-34, -70], [70, 30], [74, 30], [-70, -30], [-74, -30], [30, 70], [-30, 110]];
  for (const [px, pz] of parkSpots) {
    const mesh = createCarMesh(rng.pick(TRAFFIC_COLORS));
    mesh.position.set(px, 0, pz);
    mesh.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(mesh);
    parked.push({ mesh, name: rng.pick(TRAFFIC_NAMES), stolen: false });
  }

  return {
    traffic, parked,
    nearestCar(x, z, maxDist, includeTraffic) {
      let best = null, bestD = maxDist;
      const pool = includeTraffic ? traffic.concat(parked) : parked;
      for (const c of pool) {
        if (c.stolen) continue;
        const dx = c.mesh.position.x - x, dz = c.mesh.position.z - z;
        const d = Math.hypot(dx, dz);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    },
    update(dt, frozen) {
      if (frozen) return;
      for (const c of traffic) {
        c.along += c.speed * c.dir * dt;
        if (c.along > 165) c.along = -165;
        if (c.along < -165) c.along = 165;
        if (c.horizontal) { c.mesh.position.x = c.along; c.mesh.position.z = c.lane; }
        else { c.mesh.position.z = c.along; c.mesh.position.x = c.lane; }
        for (const w of c.mesh.userData.wheels) w.rotation.z += c.speed * dt * 2;
      }
    },
  };
}

// Arcade car physics: accel/brake/steer with drag and an upgrade multiplier.
// Returns speed in km/h. spin is applied by police PIT maneuvers.
export function driveCar(car, input, dt, topSpeedKmh) {
  const top = topSpeedKmh / 3.6;
  if (input.forward) car.speed += car.accel * dt;
  if (input.back) car.speed -= car.accel * 0.7 * dt;
  if (!input.forward && !input.back) car.speed -= Math.sign(car.speed) * 8 * dt;
  car.speed = Math.max(-top * 0.35, Math.min(top, car.speed));
  if (Math.abs(car.speed) < 0.05 && !input.forward && !input.back) car.speed = 0;
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const spd01 = Math.min(1, Math.abs(car.speed) / top);
  car.angle += steer * (0.9 + spd01 * 1.5) * Math.sign(car.speed || 1) * dt * (car.speed < 0 ? -1 : 1);
  if (car.spin) {
    car.angle += car.spin * dt;
    car.spin *= Math.pow(0.2, dt);
    if (Math.abs(car.spin) < 0.05) car.spin = 0;
  }
  car.mesh.position.x += Math.cos(car.angle) * car.speed * dt;
  car.mesh.position.z -= Math.sin(car.angle) * car.speed * dt;
  car.mesh.rotation.y = car.angle;
  car.mesh.position.x = Math.max(-168, Math.min(168, car.mesh.position.x));
  car.mesh.position.z = Math.max(-168, Math.min(168, car.mesh.position.z));
  for (const w of car.mesh.userData.wheels) w.rotation.z += car.speed * dt * 2;
  return Math.abs(car.speed) * 3.6;
}

export function gearFor(kmh) {
  return Math.max(1, Math.min(6, Math.floor(kmh / 24) + 1));
}
