// Player Daz: on foot or in a car, with health, armour, cash, respect,
// a HORNET SMG and garage upgrades. Arcade movement — no physics engine.
import * as THREE from 'three';
import { makeCarMesh, gearFor } from './vehicles.js';

export function createPlayer(scene) {
  const mesh = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.05, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x1e6fd8, roughness: 0.85 }),
  );
  jacket.position.y = 1.05;
  mesh.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 }),
  );
  head.position.y = 1.85;
  mesh.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.6, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.9 }),
  );
  legs.position.y = 0.3;
  mesh.add(legs);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.7 }),
  );
  gun.position.set(0.35, 1.2, 0.4);
  mesh.add(gun);
  mesh.position.set(0, 0, 20);
  scene.add(mesh);

  const state = {
    mesh,
    pos: mesh.position,
    heading: 0,
    onFoot: true,
    car: null,
    carName: '',
    speedKmh: 0,
    health: 100,
    armour: 50,
    cash: 0,
    respect: 1,
    weapon: { name: 'HORNET SMG', mag: 30, reserve: 120 },
    upgrades: { engine: 0, armour: 0, handling: 0 },
    busted: false,
    nearCar: null,
  };

  let speed = 0;
  const TOP_SPEED = 178;

  function spawnCar(name, color, x, z, heading) {
    const car = makeCarMesh(THREE, color, name);
    car.position.set(x, 0, z);
    car.rotation.y = heading;
    scene.add(car);
    return car;
  }

  return {
    state,
    get gear() { return gearFor(state.speedKmh); },
    spawnCar,
    enterCar(car, name) {
      state.car = car;
      state.carName = name;
      state.onFoot = false;
      mesh.visible = false;
      speed = 0;
    },
    exitCar() {
      if (!state.car) return;
      const c = state.car;
      state.pos.set(c.position.x + 3, 0, c.position.z + 2);
      state.heading = c.rotation.y;
      mesh.position.copy(state.pos);
      mesh.rotation.y = state.heading;
      mesh.visible = true;
      state.car = null;
      state.carName = '';
      state.speedKmh = 0;
      speed = 0;
    },
    drive(dt, input) {
      if (!state.car) return;
      const engineBoost = 1 + state.upgrades.engine * 0.12;
      const accel = 26 * engineBoost;
      const steer = (1 + state.upgrades.handling * 0.15) * 1.9;
      if (input.forward) speed += accel * dt;
      else if (input.back) speed -= 20 * dt;
      else speed -= Math.sign(speed) * Math.min(Math.abs(speed), 9 * dt);
      if (input.boost) speed += 14 * dt;
      const max = TOP_SPEED * engineBoost;
      speed = Math.max(-22, Math.min(max, speed));
      const heading = state.car.rotation.y;
      if (Math.abs(speed) > 0.5) {
        const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        state.car.rotation.y += turn * steer * dt * Math.sign(speed) * Math.min(1, Math.abs(speed) / 30);
      }
      const h = state.car.rotation.y;
      state.car.position.x += Math.sin(h) * (speed / 3.6) * dt;
      state.car.position.z += Math.cos(h) * (speed / 3.6) * dt;
      const p = state.car.position;
      p.x = Math.max(-248, Math.min(248, p.x));
      p.z = Math.max(-248, Math.min(248, p.z));
      state.pos.copy(p);
      state.speedKmh = Math.abs(speed) * 1.0;
      state.heading = h;
    },
    walk(dt, input) {
      const walkSpeed = input.boost ? 9 : 4.5;
      let mx = 0;
      let mz = 0;
      if (input.forward) mz += 1;
      if (input.back) mz -= 1;
      if (input.left) mx -= 1;
      if (input.right) mx += 1;
      if (mx === 0 && mz === 0) { state.speedKmh = 0; return; }
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      state.heading = Math.atan2(mx, mz);
      mesh.rotation.y = state.heading;
      mesh.position.x += mx * walkSpeed * dt;
      mesh.position.z += mz * walkSpeed * dt;
      mesh.position.x = Math.max(-248, Math.min(248, mesh.position.x));
      mesh.position.z = Math.max(-248, Math.min(248, mesh.position.z));
      state.pos.copy(mesh.position);
      state.speedKmh = walkSpeed * 3.6 * 0.35;
    },
    shoot() {
      if (state.weapon.mag <= 0) {
        if (state.weapon.reserve > 0) {
          const take = Math.min(30, state.weapon.reserve);
          state.weapon.mag = take;
          state.weapon.reserve -= take;
        }
        return false;
      }
      state.weapon.mag -= 1;
      return true;
    },
    damage(amount) {
      let left = amount;
      const absorb = Math.min(state.armour, left * 0.6);
      state.armour -= absorb;
      left -= absorb;
      state.health -= left;
      if (state.health <= 0) {
        state.health = 0;
        state.busted = true;
      }
    },
    heal() {
      state.health = 100;
      state.armour = 50 + state.upgrades.armour * 25;
      state.busted = false;
    },
    addCash(amount) {
      state.cash += amount;
      const lvl = 1 + Math.floor(state.cash / 15000);
      if (lvl > state.respect) state.respect = Math.min(10, lvl);
    },
    resetSpeed() { speed = 0; state.speedKmh = 0; },
  };
}
