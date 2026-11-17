// Cars: box-built meshes, arcade driving physics, and traffic AI that
// follows the road grid (right-hand lanes, random turns at intersections).
// v2.2: same nine named models, top speeds and health as v2.1, with the
// models stored as tuples, the mesh built from one parts list, the physics
// as small named steps, and traffic assembled by a factory function.
import * as THREE from 'three';
import { clamp, collideCircle, dist2 } from './rng.js';

// [name, color, baseMax] — the nine cars of Porto Azul.
const MODEL_ROWS = [
  ['Azul GT Coupe', 0x2e6ac2, 34],
  ['Comet GT', 0xc23a2e, 38],
  ['Solera S', 0xe8c832, 36],
  ['Palma V8', 0x3aa85a, 35],
  ['Harbor Taxi', 0xe8a832, 32],
  ['Neon Runner', 0x8a5ac2, 40],
  ['Mirage LX', 0xd8d8d8, 33],
  ['Dune Buggy', 0xe87a2a, 37],
  ['Coral Cruiser', 0x3ab8a8, 34],
];

export const CAR_MODELS = MODEL_ROWS.map(([name, color, baseMax]) => ({ name, color, baseMax }));

export function modelByName(name) {
  for (const m of CAR_MODELS) {
    if (m.name === name) return m;
  }
  return CAR_MODELS[0];
}

function part(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

export function createCarMesh(modelOrColor, police = false) {
  const model = typeof modelOrColor === 'object'
    ? modelOrColor
    : { name: '', color: modelOrColor, baseMax: 30 };
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf0f0f0 : model.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = part(2.0, 0.62, 4.2, bodyMat, 0, 0.55, 0);
  body.castShadow = true;
  g.add(body);
  const cabin = part(1.7, 0.55, 2.1, darkMat, 0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  // neon underglow strip (dusk look): a faint coloured slab under the body
  const glowMat = new THREE.MeshBasicMaterial({ color: police ? 0x3040ff : model.color, transparent: true, opacity: 0.35 });
  g.add(part(1.9, 0.06, 4.0, glowMat, 0, 0.12, 0));
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  const wheelSpots = [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]];
  for (const [x, z] of wheelSpots) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b8, emissive: 0x887733 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc02020, emissive: 0x660000 });
  for (const x of [-0.6, 0.6]) {
    g.add(part(0.4, 0.18, 0.1, lightMat, x, 0.62, 2.11));
    g.add(part(0.4, 0.18, 0.1, tailMat, x, 0.62, -2.11));
  }
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const r = part(0.5, 0.18, 0.5, new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0x881111 }), -0.35, 0, 0);
    const b = part(0.5, 0.18, 0.5, new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x111188 }), 0.35, 0, 0);
    lightBar.add(r);
    lightBar.add(b);
    lightBar.position.y = 1.5;
    lightBar.userData = { red: r, blue: b };
    g.add(lightBar);
    // black doors stripe
    g.add(part(2.02, 0.3, 2.2, new THREE.MeshLambertMaterial({ color: 0x181818 }), 0, 0.62, -0.2));
  }
  g.userData.wheels = wheels;
  g.userData.lightBar = lightBar;
  return g;
}

function damageCar(car, amount) {
  car.health = Math.max(0, (car.health ?? 100) - amount);
}

function applyThrottle(car, dt, throttle, brake) {
  if (throttle > 0) car.speed += throttle * 22 * dt;
  else if (throttle < 0) car.speed += throttle * 14 * dt;
  if (brake > 0) {
    car.speed -= Math.sign(car.speed) * 26 * dt;
    if (Math.abs(car.speed) < 0.5) car.speed = 0;
  }
  car.speed -= car.speed * 0.35 * dt; // drag + rolling resistance
}

function pushOutOfCars(car, others) {
  for (const o of others) {
    if (o === car || o.dead) continue;
    const d2 = dist2(car.x, car.z, o.x, o.z);
    if (d2 >= 16 || d2 <= 0.01) continue;
    const d = Math.sqrt(d2);
    const push = (4 - d) / 2;
    car.x += ((car.x - o.x) / d) * push;
    car.z += ((car.z - o.z) / d) * push;
    if (Math.abs(car.speed) > 8) {
      car.speed *= 0.8;
      car.crashed = true;
      damageCar(car, 4);
    }
  }
}

function knockPeds(car, peds) {
  if (!peds || Math.abs(car.speed) <= 3) return;
  for (const p of peds) {
    if (p.fleeing || p.down) continue;
    if (dist2(car.x, car.z, p.x, p.z) < 6) p.knock(car.x, car.z);
  }
}

// Arcade car physics: throttle/steer/brake in [-1,1]. Mutates car in place.
// A hard crash chips car.health; at 0 health the car stalls (maxSpeed 6).
export function stepCar(car, dt, throttle, steer, brake, colliders, others, peds) {
  const maxSpeed = car.health <= 0 ? 6 : (car.maxSpeed ?? 30);
  applyThrottle(car, dt, throttle, brake);
  car.speed = clamp(car.speed, -10, maxSpeed);
  const steerFactor = clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += steer * 1.9 * steerFactor * dt;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  // building collision (circle radius 2.1)
  const res = collideCircle(nx, nz, 2.1, colliders);
  if (res.hit) {
    // kill the speed component into the wall
    const vn = fx * res.nx + fz * res.nz;
    if (vn < 0) car.speed *= 0.45;
    if (Math.abs(car.speed) > 12) {
      car.crashed = true;
      damageCar(car, 6);
    }
    nx = res.x;
    nz = res.z;
  }
  car.x = nx;
  car.z = nz;
  pushOutOfCars(car, others);
  knockPeds(car, peds);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.8;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
}

function placeOnRoad(c) {
  const off = c.axis === 'x' ? 3.2 * c.dir : -3.2 * c.dir;
  if (c.axis === 'x') {
    c.x = c.along;
    c.z = c.line + off;
    c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    c.x = c.line + off;
    c.z = c.along;
    c.heading = c.dir > 0 ? 0 : Math.PI;
  }
  c.mesh.position.set(c.x, 0, c.z);
  c.mesh.rotation.y = c.heading;
}

export function makeTraffic(scene, rng, city) {
  const cars = [];
  const axes = ['x', 'z'];
  const edge = city.roadsX[city.roadsX.length - 1];
  for (let i = 0; i < 22; i++) {
    const axis = rng.pick(axes);
    const line = rng.pick(axis === 'x' ? city.roadsZ : city.roadsX);
    const dir = rng.chance(0.5) ? 1 : -1;
    const model = rng.pick(CAR_MODELS);
    const mesh = createCarMesh(model);
    scene.add(mesh);
    const along = rng.range(-edge, edge);
    const speed = rng.range(7, 11);
    const baseSpeed = rng.range(7, 11);
    cars.push({
      mesh, axis, line, dir, model,
      name: model.name, baseMax: model.baseMax, maxSpeed: model.baseMax,
      health: 100, maxHealth: 100,
      along, speed, baseSpeed,
      heading: 0, x: 0, z: 0, dead: false, traffic: true,
    });
  }
  for (const c of cars) placeOnRoad(c);

  function maybeTurn(c, dt) {
    const lines = c.axis === 'x' ? city.roadsX : city.roadsZ;
    for (const L of lines) {
      const nearLine = Math.abs(c.along - L) < c.speed * dt + 0.4;
      if (!nearLine || !rng.chance(0.3)) continue;
      const newAxis = c.axis === 'x' ? 'z' : 'x';
      c.line = L;
      // recompute along from current position on the new axis
      c.along = newAxis === 'x' ? c.x : c.z;
      c.axis = newAxis;
      c.dir = rng.chance(0.5) ? 1 : -1;
      break;
    }
  }

  function followLane(c, dt) {
    // slow down for a car ahead in the same lane
    let target = c.baseSpeed;
    for (const o of cars) {
      if (o === c || o.dead || o.axis !== c.axis || o.line !== c.line || o.dir !== c.dir) continue;
      const ahead = (o.along - c.along) * c.dir;
      if (ahead > 0 && ahead < 12) {
        target = 0;
        break;
      }
    }
    c.speed += (target - c.speed) * Math.min(1, dt * 2);
    c.along += c.dir * c.speed * dt;
    // wrap at city edge
    const wrap = city.roadsX[city.roadsX.length - 1] + 30;
    if (c.along > wrap) c.along = -wrap;
    if (c.along < -wrap) c.along = wrap;
  }

  return {
    cars,
    update(dt) {
      for (const c of cars) {
        if (c.dead) continue;
        followLane(c, dt);
        maybeTurn(c, dt);
        placeOnRoad(c);
      }
    },
  };
}

export function makeParkedCars(scene, rng, city) {
  const cars = [];
  // [x, z, model]
  const spots = [
    [4, 62, 'Azul GT Coupe'], [-7, -39, 'Comet GT'],
    [39, -7, 'Solera S'], [-39, 7, 'Palma V8'],
    [85, 39, 'Neon Runner'], [-85, -39, 'Mirage LX'],
    [39, 85, 'Dune Buggy'], [-39, -85, 'Coral Cruiser'],
    [163, -62, 'Comet GT'], [-163, 163, 'Harbor Taxi'],
  ];
  const headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (const [x, z, name] of spots) {
    const model = modelByName(name);
    const mesh = createCarMesh(model);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rng.pick(headings);
    scene.add(mesh);
    cars.push({
      mesh, x, z, heading: mesh.rotation.y, speed: 0,
      name: model.name, baseMax: model.baseMax, maxSpeed: model.baseMax,
      health: 100, maxHealth: 100,
      dead: false, parked: true, stolen: false,
    });
  }
  void city;
  return cars;
}
