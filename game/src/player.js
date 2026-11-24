// Player: on-foot movement, driving physics (gears, nitro, spike cap, PIT spin),
// carjacking, and 5 weapons on the wheel.
import * as THREE from 'three';
import { buildCar } from './vehicles.js';

export const WEAPONS = [
  { name: 'PISTOL', mag: Infinity, reserve: Infinity, damage: 34, rate: 0.28 },
  { name: 'HORNET SMG', mag: 30, reserve: 120, damage: 16, rate: 0.09 },
  { name: 'RIOT SHOTGUN', mag: 6, reserve: 24, damage: 22, rate: 0.85, pellets: 6 },
  { name: 'CARBINE RIFLE', mag: 30, reserve: 90, damage: 30, rate: 0.12 },
  { name: 'MOLOTOV', mag: 6, reserve: 0, damage: 60, rate: 0.9, area: true },
];

export function gearFor(kmh) {
  if (kmh <= 0) return 1;
  return Math.min(6, 1 + Math.floor(kmh / 25));
}

export function createPlayer(scene, state) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x20242e, roughness: 0.8 }),
  );
  body.position.y = 0.95;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 }),
  );
  head.position.y = 1.95;
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffd75e, roughness: 0.7 }),
  );
  jacket.position.y = 1.35;
  g.add(body, head, jacket);
  g.position.set(-140, 0, -120);
  scene.add(g);

  const player = {
    group: g,
    onFoot: true,
    car: null, // {group, model}
    boat: null,
    speedKmh: 0,
    speedMs: 0,
    yaw: 0,
    camYaw: 0,
    fireCooldown: 0,
    wheelOpen: false,
    tracer: null,

    selectWeapon(i) {
      state.weaponIdx = Math.max(0, Math.min(WEAPONS.length - 1, i));
    },
    weapon() { return WEAPONS[state.weaponIdx]; },
    ammoText() {
      const w = this.weapon();
      const mag = state.ammo[state.weaponIdx];
      if (!isFinite(mag)) return '∞';
      const reserve = state.ammoReserve[state.weaponIdx];
      return mag + '/' + reserve;
    },
    fire() {
      if (this.fireCooldown > 0 || state.frozen) return;
      const w = this.weapon();
      this.fireCooldown = w.rate;
      let mag = state.ammo[state.weaponIdx];
      if (isFinite(mag)) {
        if (mag <= 0) {
          // auto reload from reserve
          const reserve = state.ammoReserve[state.weaponIdx];
          if (reserve > 0) {
            const take = Math.min(w.mag, reserve);
            state.ammo[state.weaponIdx] = take;
            state.ammoReserve[state.weaponIdx] -= take;
          }
          return;
        }
        state.ammo[state.weaponIdx] = mag - 1;
      }
      // Muzzle flash + tracer line toward aim point.
      const from = g.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const to = from.clone().addScaledVector(dir, w.area ? 14 : 46);
      if (this.tracer) scene.remove(this.tracer);
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: w.area ? 0xff7a1a : 0xffe9a8 }));
      scene.add(this.tracer);
      setTimeout(() => { if (this.tracer) { scene.remove(this.tracer); this.tracer = null; } }, 90);
      if (w.area) state.molotovAt = { x: to.x, z: to.z, t: 0 };
      // Shooting a cop in view raises heat.
      if (state.wanted < 5 && Math.random() < 0.35) state.wanted += 0; // heat rises via police module on hit
      state.shotsFired = (state.shotsFired || 0) + 1;
    },

    enterCar(carObj) {
      this.car = carObj;
      this.onFoot = false;
      state.driving = true;
      state.carName = carObj.model.name;
      state.carHealth = 100;
      scene.remove(g);
      this.speedMs = 0;
      this.speedKmh = 0;
    },
    enterBoat(boatGroup) {
      this.boat = boatGroup;
      this.onFoot = false;
      state.driving = true;
      state.carName = 'Vela Speedboat';
      state.carHealth = 100;
      scene.remove(g);
      this.speedMs = 0;
    },
    exitCar() {
      if (!this.car && !this.boat) return;
      const src = this.car ? this.car.group.position : this.boat.position;
      g.position.set(src.x + 3, 0, src.z + 3);
      scene.add(g);
      this.car = null;
      this.boat = null;
      this.onFoot = true;
      state.driving = false;
      state.carName = 'ON FOOT';
      state.speedKmh = 0;
      this.speedMs = 0;
    },

    update(dt, input, frozen) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      if (frozen) return;
      this.camYaw = input.camYaw;
      if (this.onFoot) {
        const run = 7.5;
        let mx = 0, mz = 0;
        if (input.forward) { mx += Math.sin(this.camYaw); mz += Math.cos(this.camYaw); }
        if (input.back) { mx -= Math.sin(this.camYaw); mz -= Math.cos(this.camYaw); }
        if (input.left) { mx += Math.sin(this.camYaw - Math.PI / 2); mz += Math.cos(this.camYaw - Math.PI / 2); }
        if (input.right) { mx += Math.sin(this.camYaw + Math.PI / 2); mz += Math.cos(this.camYaw + Math.PI / 2); }
        const len = Math.hypot(mx, mz);
        if (len > 0) {
          g.position.x += (mx / len) * run * dt;
          g.position.z += (mz / len) * run * dt;
          this.yaw = Math.atan2(mx / len, mz / len);
          g.rotation.y = this.yaw;
        }
        this.speedKmh = len > 0 ? 9 : 0;
        state.speedKmh = this.speedKmh;
        // world bounds
        g.position.x = Math.max(-272, Math.min(272, g.position.x));
        g.position.z = Math.max(-272, Math.min(272, g.position.z));
      } else if (this.car) {
        const model = this.car.model;
        const topMs = (model.top * (state.crew?.upgrades?.engine ?? 1) * 0.06 + model.top * 0.94) / 3.6;
        let target = topMs;
        if (state.spiked) target = Math.min(target, 40 / 3.6);
        if (state.crew?.nitroActive) target = topMs * 1.35;
        if (input.forward) this.speedMs = Math.min(target, this.speedMs + model.accel * dt);
        else if (input.back) this.speedMs = Math.max(-8, this.speedMs - model.accel * 1.4 * dt);
        else this.speedMs = Math.max(0, this.speedMs - 9 * dt); // drag
        if (state.pitSpin) {
          // PIT spin: car yaws hard and bleeds speed.
          this.car.group.rotation.y += 2.4 * dt;
          this.speedMs *= (1 - 1.6 * dt);
          state.pitSpin = 0;
        }
        const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        const spd = this.speedMs;
        if (Math.abs(spd) > 0.5) {
          this.car.group.rotation.y += steer * 1.7 * dt * Math.min(1, Math.abs(spd) / 12) * Math.sign(spd);
        }
        this.car.group.position.x += Math.sin(this.car.group.rotation.y) * spd * dt;
        this.car.group.position.z += Math.cos(this.car.group.rotation.y) * spd * dt;
        this.car.group.position.x = Math.max(-272, Math.min(244, this.car.group.position.x));
        this.car.group.position.z = Math.max(-272, Math.min(272, this.car.group.position.z));
        this.speedKmh = Math.abs(spd) * 3.6;
        state.speedKmh = this.speedKmh;
        this.yaw = this.car.group.rotation.y;
      } else if (this.boat) {
        const topMs = 95 / 3.6;
        if (input.forward) this.speedMs = Math.min(topMs, this.speedMs + 12 * dt);
        else this.speedMs = Math.max(0, this.speedMs - 6 * dt);
        const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        this.boat.rotation.y += steer * 1.1 * dt;
        this.boat.position.x += Math.sin(this.boat.rotation.y) * this.speedMs * dt;
        this.boat.position.z += Math.cos(this.boat.rotation.y) * this.speedMs * dt;
        this.boat.position.x = Math.max(246, Math.min(278, this.boat.position.x));
        this.boat.position.z = Math.max(-272, Math.min(272, this.boat.position.z));
        this.speedKmh = this.speedMs * 3.6;
        state.speedKmh = this.speedKmh;
        this.yaw = this.boat.rotation.y;
      }
    },
  };
  return player;
}
