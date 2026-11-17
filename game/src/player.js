// Daz, the player: on foot (walk / run / shoot) and behind the wheel
// (arcade driving with gears, boost and handbrake). One mesh for the body,
// one car mesh swapped in when driving.
import * as T from 'three';
import { makeCarMesh, CAR_DEFS } from './vehicles.js';
import { clamp } from './rng.js';

export function createPlayer(scene) {
  const group = new T.Group();
  const jacket = new T.MeshLambertMaterial({ color: 0xd7263d });
  const skin = new T.MeshLambertMaterial({ color: 0xe0ac69 });
  const jeans = new T.MeshLambertMaterial({ color: 0x2a3a5a });
  const body = new T.Mesh(new T.BoxGeometry(0.62, 0.9, 0.36), jacket);
  body.position.y = 1.18; group.add(body);
  const head = new T.Mesh(new T.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.84; group.add(head);
  const cap = new T.Mesh(new T.BoxGeometry(0.42, 0.14, 0.42), new T.MeshLambertMaterial({ color: 0x111118 }));
  cap.position.y = 2.04; group.add(cap);
  const legL = new T.Mesh(new T.BoxGeometry(0.22, 0.75, 0.22), jeans);
  legL.position.set(-0.15, 0.38, 0); group.add(legL);
  const legR = new T.Mesh(new T.BoxGeometry(0.22, 0.75, 0.22), jeans);
  legR.position.set(0.15, 0.38, 0); group.add(legR);
  const gun = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.7), new T.MeshLambertMaterial({ color: 0x111118 }));
  gun.position.set(0.35, 1.25, 0.4); group.add(gun);
  scene.add(group);

  let carMesh = null;
  let carDef = CAR_DEFS.azul;

  return {
    group,
    legL,
    legR,
    gun,
    x: 0, z: 0, heading: 0,
    speed: 0, // m/s, signed; display converts to km/h
    onFoot: true,
    carKey: 'azul',
    walkPhase: 0,
    get carDef() { return carDef; },
    get speedKmh() { return Math.abs(this.speed) * 3.6; },
    get gear() {
      const kmh = this.speedKmh;
      if (kmh < 1) return 0;
      if (kmh < 25) return 1;
      if (kmh < 45) return 2;
      if (kmh < 65) return 3;
      if (kmh < 90) return 4;
      if (kmh < 115) return 5;
      return 6;
    },
    setCar(key) {
      if (carMesh) { scene.remove(carMesh.group); carMesh = null; }
      carDef = typeof key === 'string' ? (CAR_DEFS[key] || CAR_DEFS.azul) : key;
      this.carKey = typeof key === 'string' ? key : 'stolen';
      carMesh = makeCarMesh(carDef, false);
      carMesh.group.position.set(this.x, 0, this.z);
      carMesh.group.rotation.y = this.heading;
      scene.add(carMesh.group);
      return carMesh;
    },
    clearCar() {
      if (carMesh) { scene.remove(carMesh.group); carMesh = null; }
    },
    get carGroup() { return carMesh ? carMesh.group : null; },
    update(dt, input, frozen, upgrades) {
      if (frozen) return;
      const top = (carDef.topSpeed / 3.6) * (1 + 0.12 * (upgrades.engine || 0));
      if (this.onFoot) {
        const walk = 4.2 * (input.boost ? 1.8 : 1);
        let mx = 0, mz = 0;
        if (input.forward) { mx += Math.sin(this.heading); mz += Math.cos(this.heading); }
        if (input.back) { mx -= Math.sin(this.heading); mz -= Math.cos(this.heading); }
        if (input.left) this.heading += 2.6 * dt;
        if (input.right) this.heading -= 2.6 * dt;
        const len = Math.hypot(mx, mz) || 1;
        this.x += (mx / len) * walk * dt * (input.forward || input.back ? 1 : 0);
        this.z += (mz / len) * walk * dt * (input.forward || input.back ? 1 : 0);
        this.speed = (input.forward || input.back) ? walk : 0;
        this.walkPhase += dt * 9 * (this.speed > 0 ? 1 : 0);
        const swing = Math.sin(this.walkPhase) * 0.5;
        this.legL.rotation.x = swing;
        this.legR.rotation.x = -swing;
        this.group.position.set(this.x, 0, this.z);
        this.group.rotation.y = this.heading;
        this.group.visible = true;
        if (carMesh) carMesh.group.visible = false;
      } else {
        const accel = carDef.accel * (1 + 0.15 * (upgrades.engine || 0));
        if (input.forward) this.speed += accel * dt;
        if (input.back) this.speed -= accel * 0.8 * dt;
        if (!input.forward && !input.back) this.speed *= Math.max(0, 1 - 1.4 * dt);
        if (input.handbrake) this.speed *= Math.max(0, 1 - 4 * dt);
        const boost = input.boost ? 1.18 : 1;
        this.speed = clamp(this.speed, -12, top * boost);
        const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        const grip = carDef.grip * (1 + 0.1 * (upgrades.tyres || 0));
        this.heading += steer * 1.9 * grip * dt * clamp(Math.abs(this.speed) / 8, 0, 1) * (this.speed >= 0 ? 1 : -1);
        this.x += Math.sin(this.heading) * this.speed * dt;
        this.z += Math.cos(this.heading) * this.speed * dt;
        if (carMesh) {
          carMesh.group.position.set(this.x, 0, this.z);
          carMesh.group.rotation.y = this.heading;
          carMesh.group.visible = true;
        }
        this.group.visible = false;
      }
    },
  };
}
