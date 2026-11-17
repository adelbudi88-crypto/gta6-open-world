// Cars: box-built meshes, arcade driving physics, and traffic AI that
// follows the road grid (right-hand lanes, random turns at intersections).
// v2.1: same nine named models, top speeds and health as v2, with the mesh
// built from a parts list and the physics split into accelerate / steer /
// move / collide phases.
import * as THREE from 'three';
import { clamp, collideCircle, dist2 } from './rng.js';

export const CAR_MODELS = [
  { name: 'Azul GT Coupe', color: 0x2e6ac2, baseMax: 34 },
  { name: 'Comet GT', color: 0xc23a2e, baseMax: 38 },
  { name: 'Solera S', color: 0xe8c832, baseMax: 36 },
  { name: 'Palma V8', color: 0x3aa85a, baseMax: 35 },
  { name: 'Harbor Taxi', color: 0xe8a832, baseMax: 32 },
  { name: 'Neon Runner', color: 0x8a5ac2, baseMax: 40 },
  { name: 'Mirage LX', color: 0xd8d8d8, baseMax: 33 },
  { name: 'Dune Buggy', color: 0xe87a2a, baseMax: 37 },
  { name: 'Coral Cruiser', color: 0x3ab8a8, baseMax: 34 },
];

export function modelByName(name) {
  return CAR_MODELS.find((m) => m.name === name) || CAR_MODELS[0];
}

function box(w, h, d, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

export function createCarMesh(modelOrColor, police = false) {
  const model = typeof modelOrColor === 'object' ? modelOrColor : { name: '', color: modelOrColor, baseMax: 30 };
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf0f0f0 : model.color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = box(2.0, 0.62, 4.2, bodyMat, 0, 0.55, 0);
  body.castShadow = true;
  g.add(body);
  const cabin = box(1.7, 0.55, 2.1, darkMat, 0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  // neon underglow strip (dusk look): a faint coloured slab under the body
  const glowMat = new THREE.MeshBasicMaterial({ color: police ? 0x3040ff : model.color, transparent: true, opacity: 0.35 });
  g.add(box(1.9, 0.06, 4.0, glowMat, 0, 0.12, 0));
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b8, emissive: 0x887733 });
  for (const x of [-0.6, 0.6]) g.add(box(0.4, 0.18, 0.1, lightMat, x, 0.62, 2.11));
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc02020, emissive: 0x660000 });
  for (const x of [-0.6, 0.6]) g.add(box(0.4, 0.18, 0.1, tailMat, x, 0.62, -2.11));
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const r = box(0.5, 0.18, 0.5, new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0x881111 }), -0.35, 0, 0);
    const b = box(0.5, 0.18, 0.5, new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x111188 }), 0.35, 0, 0);
    lightBar.add(r);
    lightBar.add(b);
    lightBar.position.y = 1.5;
    lightBar.userData = { red: r, blue: b };
    g.add(lightBar);
    // black doors stripe
    g.add(box(2.02, 0.3, 2.2, new THREE.MeshLambertMaterial({ color: 0x181818 }), 0, 0.62, -0.2));
  }
  g.userData.wheels = wheels;
  g.userData.lightBar = lightBar;
  return g;
}

function damageCar(car, amount) {
  car.health = Math.max(0, (car.health ?? 100) - amount);
}

// Arcade car physics: throttle/steer/brake in [-1,1]. Mutates car in place.
// A hard crash chips car.health; at 0 health the car stalls (maxSpeed 6).
export function stepCar(car, dt, throttle, steer, brake, colliders, others, peds) {
  const maxSpeed = car.health <= 0 ? 6 : (car.maxSpeed ?? 30);
  const maxReverse = 10;
  if (throttle > 0) car.speed += throttle * 22 * dt;
  else if (throttle < 0) car.speed += throttle * 14 * dt;
  if (brake > 0) {
    car.speed -= Math.sign(car.speed) * 26 * dt;
    if (Math.abs(car.speed) < 0.5) car.speed = 0;
  }
  car.speed -= car.speed * 0.35 * dt; // drag + rolling resistance
  car.speed = clamp(car.speed, -maxReverse, maxSpeed);
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
  // car-car soft push
  for (const o of others) {
    if (o === car || o.dead) continue;
    const d2 = dist2(car.x, car.z, o.x, o.z);
    if (d2 < 16 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (4 - d) / 2;
      const px = (car.x - o.x) / d;
      const pz = (car.z - o.z) / d;
      car.x += px * push;
      car.z += pz * push;
      if (Math.abs(car.speed) > 8) {
        car.speed *= 0.8;
        car.crashed = true;
        damageCar(car, 4);
      }
    }
  }
  // pedestrians get knocked (handled by peds module via car.knock)
  if (peds && Math.abs(car.speed) > 3) {
    for (const p of peds) {
      if (p.fleeing || p.down) continue;
      if (dist2(car.x, car.z, p.x, p.z) < 6) p.knock(car.x, car.z);
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.8;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
}

export function makeTraffic(scene, rng, city) {
  const cars = [];
  const axes = ['x', 'z'];
  for (let i = 0; i < 22; i++) {
    const axis = rng.pick(axes);
    const line = rng.pick(axis === 'x' ? city.roadsZ : city.roadsX);
    const dir = rng.chance(0.5) ? 1 : -1;
    const model = rng.pick(CAR_MODELS);
    const mesh = createCarMesh(model);
    scene.add(mesh);
    const edge = city.roadsX[city.roadsX.length - 1];
    cars.push({
      mesh, axis, line, dir, model,
      name: model.name, baseMax: model.baseMax, maxSpeed: model.baseMax,
      health: 100, maxHealth: 100,
      along: rng.range(-edge, edge),
      speed: rng.range(7, 11), baseSpeed: rng.range(7, 11),
      heading: 0, x: 0, z: 0, dead: false, traffic: true,
    });
  }
  function place(c) {
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
  cars.forEach(place);

  function maybeTurn(c, dt) {
    const lines = c.axis === 'x' ? city.roadsX : city.roadsZ;
    for (const L of lines) {
      if (Math.abs(c.along - L) < c.speed * dt + 0.4 && rng.chance(0.3)) {
        const newAxis = c.axis === 'x' ? 'z' : 'x';
        const newDir = rng.chance(0.5) ? 1 : -1;
        c.axis = newAxis;
        c.line = L;
        // recompute along from current position on the new axis
        c.along = newAxis === 'x' ? c.x : c.z;
        c.dir = newDir;
        break;
      }
    }
  }

  return {
    cars,
    update(dt) {
      for (const c of cars) {
        if (c.dead) continue;
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
        const edge = city.roadsX[city.roadsX.length - 1] + 30;
        if (c.along > edge) c.along = -edge;
        if (c.along < -edge) c.along = edge;
        maybeTurn(c, dt);
        place(c);
      }
    },
  };
}

export function makeParkedCars(scene, rng, city) {
  const cars = [];
  const spots = [
    { x: 4, z: 62, model: 'Azul GT Coupe' }, { x: -7, z: -39, model: 'Comet GT' },
    { x: 39, z: -7, model: 'Solera S' }, { x: -39, z: 7, model: 'Palma V8' },
    { x: 85, z: 39, model: 'Neon Runner' }, { x: -85, z: -39, model: 'Mirage LX' },
    { x: 39, z: 85, model: 'Dune Buggy' }, { x: -39, z: -85, model: 'Coral Cruiser' },
    { x: 163, z: -62, model: 'Comet GT' }, { x: -163, z: 163, model: 'Harbor Taxi' },
  ];
  const headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (const s of spots) {
    const model = modelByName(s.model);
    const mesh = createCarMesh(model);
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = rng.pick(headings);
    scene.add(mesh);
    cars.push({
      mesh, x: s.x, z: s.z, heading: mesh.rotation.y, speed: 0,
      name: model.name, baseMax: model.baseMax, maxSpeed: model.baseMax,
      health: 100, maxHealth: 100,
      dead: false, parked: true, stolen: false,
    });
  }
  void city;
  return cars;
}
