// Cars: box-built meshes, arcade driving physics, and traffic AI that
// follows the road grid (right-hand lanes, random turns at intersections).
import * as THREE from 'three';
import { clamp, collideCircle, dist2 } from './rng.js';

const CAR_COLORS = [0xc23a2e, 0x2e6ac2, 0xe8c832, 0x3aa85a, 0x8a5ac2, 0xd8d8d8, 0x222226, 0xe87a2a, 0x3ab8a8];

export function createCarMesh(colorHex, police = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf0f0f0 : colorHex });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), darkMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
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
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b8, emissive: 0x554400 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    h.position.set(x, 0.62, 2.11);
    g.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc02020, emissive: 0x440000 });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    t.position.set(x, 0.62, -2.11);
    g.add(t);
  }
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0x881111 }));
    r.position.x = -0.35;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x111188 }));
    b.position.x = 0.35;
    lightBar.add(r); lightBar.add(b);
    lightBar.position.y = 1.5;
    lightBar.userData = { red: r, blue: b };
    g.add(lightBar);
    // black doors stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 2.2), new THREE.MeshLambertMaterial({ color: 0x181818 }));
    stripe.position.set(0, 0.62, -0.2);
    g.add(stripe);
  }
  g.userData.wheels = wheels;
  g.userData.lightBar = lightBar;
  return g;
}

// Arcade car physics: throttle/steer/brake in [-1,1]. Mutates car in place.
export function stepCar(car, dt, throttle, steer, brake, colliders, others, peds) {
  const maxSpeed = car.maxSpeed ?? 30;
  const maxReverse = 10;
  if (throttle > 0) car.speed += throttle * 16 * dt;
  else if (throttle < 0) car.speed += throttle * 11 * dt;
  if (brake > 0) {
    car.speed -= Math.sign(car.speed) * 26 * dt;
    if (Math.abs(car.speed) < 0.5) car.speed = 0;
  }
  car.speed -= car.speed * 0.55 * dt; // drag + rolling resistance
  car.speed = clamp(car.speed, -maxReverse, maxSpeed);
  const steerFactor = clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.heading += steer * 1.9 * steerFactor * dt;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  // building collision (circle radius 2.1)
  const res = collideCircle(nx, nz, 2.1, colliders);
  if (res.hit) {
    // kill the speed component into the wall
    const vn = fx * res.nx + fz * res.nz;
    if (vn < 0) car.speed *= 0.45;
    if (Math.abs(car.speed) > 12) car.crashed = true;
    nx = res.x; nz = res.z;
  }
  car.x = nx; car.z = nz;
  // car-car soft push
  for (const o of others) {
    if (o === car || o.dead) continue;
    const d2 = dist2(car.x, car.z, o.x, o.z);
    if (d2 < 16 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (4 - d) / 2;
      const px = (car.x - o.x) / d, pz = (car.z - o.z) / d;
      car.x += px * push; car.z += pz * push;
      if (Math.abs(car.speed) > 8) { car.speed *= 0.8; car.crashed = true; }
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
  for (let i = 0; i < 14; i++) {
    const axis = rng.pick(axes);
    const line = rng.pick(axis === 'x' ? city.roadsZ : city.roadsX);
    const dir = rng.chance(0.5) ? 1 : -1;
    const mesh = createCarMesh(rng.pick(CAR_COLORS));
    scene.add(mesh);
    cars.push({
      mesh, axis, line, dir,
      along: rng.range(-city.roadsX[city.roadsX.length - 1], city.roadsX[city.roadsX.length - 1]),
      speed: rng.range(7, 11), baseSpeed: rng.range(7, 11),
      heading: 0, x: 0, z: 0, dead: false, traffic: true,
    });
  }
  function place(c) {
    const off = c.axis === 'x' ? 3.2 * c.dir : -3.2 * c.dir;
    if (c.axis === 'x') { c.x = c.along; c.z = c.line + off; c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { c.x = c.line + off; c.z = c.along; c.heading = c.dir > 0 ? 0 : Math.PI; }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  }
  cars.forEach(place);

  return {
    cars,
    update(dt, colliders) {
      for (const c of cars) {
        if (c.dead) continue;
        // slow down for a car ahead in the same lane
        let target = c.baseSpeed;
        for (const o of cars) {
          if (o === c || o.dead || o.axis !== c.axis || o.line !== c.line || o.dir !== c.dir) continue;
          const ahead = (o.along - c.along) * c.dir;
          if (ahead > 0 && ahead < 12) { target = 0; break; }
        }
        c.speed += (target - c.speed) * Math.min(1, dt * 2);
        c.along += c.dir * c.speed * dt;
        // wrap at city edge
        const edge = city.roadsX[city.roadsX.length - 1] + 30;
        if (c.along > edge) c.along = -edge;
        if (c.along < -edge) c.along = edge;
        // turn at an intersection
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
        place(c);
      }
    },
  };
}

export function makeParkedCars(scene, rng, city) {
  const cars = [];
  const spots = [
    { x: 4, z: 62 }, { x: -7, z: -39 }, { x: 39, z: -7 }, { x: -39, z: 7 },
    { x: 85, z: 39 }, { x: -85, z: -39 }, { x: 39, z: 85 }, { x: -39, z: -85 },
  ];
  for (const s of spots) {
    const mesh = createCarMesh(rng.pick(CAR_COLORS));
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    scene.add(mesh);
    cars.push({
      mesh, x: s.x, z: s.z, heading: mesh.rotation.y, speed: 0,
      maxSpeed: 30, dead: false, parked: true, stolen: false,
    });
  }
  return cars;
}
