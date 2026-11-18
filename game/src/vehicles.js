// Vehicles for Porto Azul II — player cars and 22-car traffic.
import * as THREE from 'three';
import { clamp } from './rng.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8e8e8, 0x222226, 0xd8a020, 0x3fae6a, 0x7a4fd0, 0x999999];

export function makeCar(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.3), bodyMat);
  body.position.y = 0.62;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.58, 2.1),
    new THREE.MeshLambertMaterial({ color: opts.cabinColor ?? 0x11131c })
  );
  cabin.position.set(0, 1.2, -0.25);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0c });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(hx, 0.62, 2.16);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  for (const tx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(tx, 0.62, -2.16);
    g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.x = 0.4;
    bar.add(red);
    bar.add(blue);
    bar.position.set(0, 1.62, -0.25);
    g.add(bar);
    g.userData.lightBar = bar;
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  g.userData.wheels = wheels;
  return g;
}

// 22 traffic cars cruising the road grid, wrapping at the city edge.
export class Traffic {
  constructor(scene, rng) {
    this.cars = [];
    const roads = [-120, -60, 0, 60, 120];
    for (let i = 0; i < 22; i++) {
      const horizontal = rng.chance(0.5);
      const road = rng.pick(roads);
      const car = makeCar(rng.pick(CAR_COLORS));
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = rng.range(1.6, 3.2) * (rng.chance(0.5) ? 1 : -1);
      const along = rng.range(-190, 190);
      car.position.set(horizontal ? along : road + lane, 0, horizontal ? road + lane : along);
      car.rotation.y = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      scene.add(car);
      this.cars.push({
        mesh: car,
        horizontal,
        road,
        lane,
        dir,
        speed: rng.range(9, 16),
        along,
      });
    }
  }

  update(dt) {
    for (const c of this.cars) {
      c.along += c.dir * c.speed * dt;
      if (c.along > 195) c.along = -195;
      if (c.along < -195) c.along = 195;
      if (c.horizontal) {
        c.mesh.position.x = c.along;
        c.mesh.position.z = c.road + c.lane;
      } else {
        c.mesh.position.x = c.road + c.lane;
        c.mesh.position.z = c.along;
      }
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2;
    }
  }
}

// Speed (km/h) -> gear 1..6. 137 and 144 km/h both read GEAR 6.
export function gearForSpeed(kmh) {
  return clamp(1 + Math.floor(Math.max(0, kmh) / 24), 1, 6);
}
