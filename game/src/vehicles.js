// Cars: a box-built mesh factory, grid traffic, stealable parked cars and
// arcade driving for the player. No physics engine — positions live on the
// XZ plane and collisions are circle-vs-box tests against the city.
import * as THREE from 'three';
import { clamp } from './rng.js';

export const MODELS = [
  { name: 'Comet GT', color: 0xd82828, top: 34, accel: 15 },
  { name: 'Neon Runner', color: 0x8a3ffc, top: 36, accel: 16 },
  { name: 'Azul GT', color: 0x2a6fd8, top: 32, accel: 13 },
  { name: 'Palm Cruiser', color: 0xe8a33d, top: 30, accel: 12 },
  { name: 'Dock Hauler', color: 0x5a6b7a, top: 28, accel: 11 },
  { name: 'Interceptor', color: 0x14161c, top: 37, accel: 17 },
];

export const KMH = 4.5; // display km/h per unit of speed

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

// A car faces +Z in local space; heading 0 means +Z in the world.
export function buildCarMesh(model, opts = {}) {
  const g = new THREE.Group();
  const body = box(2.0, 0.62, 4.4, opts.bodyColor ?? model.color, 0, 0.55, 0);
  const cabin = box(1.7, 0.55, 2.1, opts.cabinColor ?? 0x10131c, 0, 1.1, -0.25);
  const stripe = box(2.02, 0.1, 4.0, opts.stripeColor ?? 0xffffff, 0, 0.72, 0);
  stripe.material = new THREE.MeshBasicMaterial({ color: opts.stripeColor ?? 0xffffff });
  g.add(body, cabin, stripe);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = box(0.32, 0.62, 0.85, 0x0a0a0c, wx, 0.31, wz);
    g.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wx of [-0.7, 0.7]) {
    const h = box(0.42, 0.16, 0.08, 0xfff2b0, wx, 0.6, 2.21);
    h.material = headMat;
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const wx of [-0.7, 0.7]) {
    const t = box(0.42, 0.16, 0.08, 0xff2a2a, wx, 0.6, -2.21);
    t.material = tailMat;
    g.add(t);
  }
  if (opts.lightBar) {
    const bar = box(1.3, 0.18, 0.5, 0x2244ff, 0, 1.48, -0.2);
    bar.material = new THREE.MeshBasicMaterial({ color: 0x3355ff });
    g.add(bar);
    const bar2 = box(0.5, 0.18, 0.5, 0xff2222, -0.45, 1.48, -0.2);
    bar2.material = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    g.add(bar2);
  }
  return { group: g, wheels };
}

export function createVehicles(W) {
  const { scene, city, rng } = W;
  const streets = city.streets;

  function placeOnRoad(axis, line, along) {
    return axis === 'x' ? { x: along, z: line } : { x: line, z: along };
  }

  const traffic = [];
  for (let i = 0; i < 22; i++) {
    const model = rng.pick(MODELS.slice(0, 5));
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = rng.pick(streets);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = dir > 0 ? -3.5 : 3.5;
    const car = {
      model, axis, line, lane, dir,
      along: rng.range(-260, 260),
      speed: rng.range(8, 12),
      mesh: buildCarMesh(model),
      kind: 'traffic',
    };
    scene.add(car.mesh.group);
    traffic.push(car);
  }

  const parked = [];
  for (let i = 0; i < 10; i++) {
    const model = MODELS[i % 5];
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = rng.pick(streets);
    const along = rng.range(-240, 240);
    const p = placeOnRoad(axis, line + (rng.chance(0.5) ? 10.5 : -10.5), along);
    const heading = axis === 'x' ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = {
      model, x: p.x, z: p.z, heading, speed: 0,
      mesh: buildCarMesh(model), kind: 'parked', stolen: false,
    };
    car.mesh.group.position.set(p.x, 0, p.z);
    car.mesh.group.rotation.y = heading;
    scene.add(car.mesh.group);
    parked.push(car);
  }

  const extra = []; // mission cars with waypoint drivers
  let playerCar = null;

  function syncMesh(car) {
    car.mesh.group.position.set(car.x, 0, car.z);
    car.mesh.group.rotation.y = car.heading;
    const spin = car.speed * 0.35;
    for (const w of car.mesh.wheels) w.rotation.x += 0; // wheels stay static; body does the work
    void spin;
  }

  function stepTraffic(car, dt) {
    car.along += car.dir * car.speed * dt;
    if (car.along > 272) car.along = -272;
    if (car.along < -272) car.along = 272;
    // At an intersection, sometimes turn onto the crossing street.
    for (const L of streets) {
      if (Math.abs(car.along - L) < 1.2 && rng.chance(0.25)) {
        const oldLine = car.line;
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.line = L;
        car.along = oldLine;
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.lane = car.dir > 0 ? -3.5 : 3.5;
        break;
      }
    }
    const p = placeOnRoad(car.axis, car.line + car.lane, car.along);
    car.x = p.x; car.z = p.z;
    car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    syncMesh(car);
  }

  return {
    traffic, parked, extra,
    get playerCar() { return playerCar; },
    buildCarMesh,
    addExtra(model, x, z, heading, opts = {}) {
      const car = { model, x, z, heading, speed: 0, mesh: buildCarMesh(model, opts), kind: 'extra', waypoints: opts.waypoints || null, wp: 0, cruise: opts.cruise || 14 };
      syncMesh(car);
      scene.add(car.mesh.group);
      extra.push(car);
      return car;
    },
    removeCar(car) {
      scene.remove(car.mesh.group);
      const i = extra.indexOf(car);
      if (i >= 0) extra.splice(i, 1);
    },
    nearestParked(x, z, maxD = 4.5) {
      let best = null, bd = maxD;
      for (const c of parked) {
        if (c.stolen) continue;
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
    enterCar(car) {
      car.stolen = true;
      playerCar = car;
      return car;
    },
    exitCar() {
      const car = playerCar;
      playerCar = null;
      return car;
    },
    // Arcade driving for the player car. input: {up, down, left, right, brake}
    drivePlayer(input, dt, engineLevel) {
      const car = playerCar;
      if (!car) return;
      const top = car.model.top * (1 + 0.12 * engineLevel);
      const fwd = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
      if (input.up) car.speed += car.model.accel * dt;
      if (input.down) car.speed -= car.model.accel * 0.8 * dt;
      if (input.brake) car.speed *= Math.max(0, 1 - 3.2 * dt);
      car.speed -= car.speed * 0.35 * dt; // drag
      car.speed = clamp(car.speed, -top * 0.45, top);
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const grip = clamp(Math.abs(car.speed) / 8, 0, 1);
      car.heading += steer * 1.5 * grip * dt * (car.speed >= 0 ? 1 : -1);
      const nx = car.x + fwd.x * car.speed * dt;
      const nz = car.z + fwd.z * car.speed * dt;
      if (city.collides(nx, nz, 1.6)) {
        car.speed *= -0.25;
        W.audio?.crash();
      } else {
        const c = city.clampToCity(nx, nz, 4);
        car.x = c.x; car.z = c.z;
      }
      // Nudge traffic cars we touch.
      for (const t of traffic) {
        const d = Math.hypot(t.x - car.x, t.z - car.z);
        if (d < 4.2 && d > 0.01) {
          car.speed *= 0.985;
          t.along += (t.x - car.x) * 0.02;
        }
      }
      syncMesh(car);
    },
    update(dt) {
      for (const t of traffic) stepTraffic(t, dt);
      for (const e of extra) {
        if (e.waypoints && e.waypoints.length) {
          const wp = e.waypoints[e.wp % e.waypoints.length];
          const dx = wp.x - e.x, dz = wp.z - e.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 6) { e.wp++; continue; }
          const want = Math.atan2(dx, dz);
          let dh = want - e.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          e.heading += clamp(dh, -1.4 * dt, 1.4 * dt);
          e.speed = e.cruise;
          e.x += Math.sin(e.heading) * e.speed * dt;
          e.z += Math.cos(e.heading) * e.speed * dt;
          syncMesh(e);
        }
      }
    },
  };
}
