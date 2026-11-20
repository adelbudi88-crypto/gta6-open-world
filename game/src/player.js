// Daz — the player. On foot (WASD, run with Shift) or behind the wheel.
// E enters a parked car, carjacks a traffic car (driver flees; witnesses
// raise the heat), or steps out. Q holds the weapon wheel, 1/2/3 pick a
// weapon, click / F fires. Benny's Garage upgrades live on the car.
import * as THREE from 'three';
import { createCarMesh, PLAYER_CARS, driveCar } from './vehicles.js';

export const WEAPONS = {
  pistol: { name: 'Pistol', mag: Infinity, reserve: Infinity, damage: 20, rate: 0.35 },
  smg: { name: 'HORNET SMG', mag: 24, reserve: 120, damage: 14, rate: 0.09 },
  shotgun: { name: 'Riot Shotgun', mag: 18, reserve: 24, damage: 46, rate: 0.8 },
};

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.78, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x0e7a6b, roughness: 0.85 }),
  );
  jacket.position.y = 1.06;
  g.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc89068, roughness: 0.8 }),
  );
  head.position.y = 1.64;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.28, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: 0xffb400, roughness: 0.7 }),
  );
  cap.position.y = 1.84;
  g.add(cap);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.72, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x1c2030, roughness: 0.9 }),
  );
  legs.position.y = 0.36;
  g.add(legs);
  return g;
}

export function createPlayer(scene, rng, world) {
  const mesh = makePlayerMesh();
  mesh.position.set(0, 0, 0);
  scene.add(mesh);

  const player = {
    mesh,
    pos: { x: 0, z: 0 },
    angle: 0,
    onFoot: true,
    car: null,
    health: 100,
    armour: 0,
    speedKmh: 0,
    weapon: 'smg',
    weapons: {
      pistol: { mag: Infinity, reserve: Infinity },
      smg: { mag: 24, reserve: 120 },
      shotgun: { mag: 18, reserve: 24 },
    },
    _fireCooldown: 0,
    _wantedCooldown: 0,
    carName() { return this.car ? this.car.name : 'ON FOOT'; },
    weaponName() { return WEAPONS[this.weapon].name; },
    ammoText() {
      const w = this.weapons[this.weapon];
      if (!isFinite(w.mag)) return '∞';
      return w.mag + '/' + w.reserve;
    },
    selectWeapon(key) {
      if (!WEAPONS[key]) return;
      this.weapon = key;
      world.hud.update(world);
    },
    topSpeed() {
      const base = this.car ? this.car.topSpeed : 0;
      return base + (world.state.upgrades.engine || 0) * 8;
    },
    spawnCar(key) {
      const def = PLAYER_CARS[key] || PLAYER_CARS.comet;
      const mesh = createCarMesh(def.color, { neon: def.color });
      mesh.position.set(this.pos.x + 3, 0, this.pos.z);
      scene.add(mesh);
      this.car = {
        mesh, angle: this.angle, speed: 0, spin: 0,
        accel: def.accel, topSpeed: def.topSpeed, name: def.name, key,
      };
      this.onFoot = false;
      this.mesh.visible = false;
      const spot = new THREE.SpotLight(0xfff2c0, 90, 42, 0.5, 0.5, 1.4);
      spot.position.set(2.2, 1, 0);
      const tgt = new THREE.Object3D();
      tgt.position.set(14, 0, 0);
      mesh.add(tgt);
      spot.target = tgt;
      mesh.add(spot);
      this.car.spot = spot;
      world.audio.engine(true);
      return this.car;
    },
    enterCar(carObj, jacked) {
      // carObj is a traffic/parked entry {mesh, name, stolen?} — convert to a player car.
      const mesh = carObj.mesh;
      this.car = {
        mesh, angle: Math.atan2(0, 1), speed: 0, spin: 0,
        accel: 32, topSpeed: 148, name: carObj.name || 'Street Car', key: 'stolen',
      };
      this.car.angle = mesh.rotation.y;
      this.onFoot = false;
      this.mesh.visible = false;
      this.pos.x = mesh.position.x;
      this.pos.z = mesh.position.z;
      if (carObj.stolen !== undefined) carObj.stolen = true;
      world.audio.engine(true);
      if (jacked) world.hud.flash('CARJACKED — ' + this.car.name.toUpperCase());
      return this.car;
    },
    exitCar() {
      if (!this.car) return;
      const m = this.car.mesh;
      this.pos.x = m.position.x + Math.cos(this.car.angle + Math.PI / 2) * 2.5;
      this.pos.z = m.position.z - Math.sin(this.car.angle + Math.PI / 2) * 2.5;
      this.mesh.position.set(this.pos.x, 0, this.pos.z);
      this.mesh.visible = true;
      this.car.speed = 0;
      this.car = null;
      this.onFoot = true;
      this.speedKmh = 0;
      world.audio.engine(false);
    },
    tryEnterOrJack() {
      if (!this.onFoot) { this.exitCar(); return; }
      const near = world.vehicles.nearestCar(this.pos.x, this.pos.z, 5, true);
      if (!near) return;
      const isTraffic = world.vehicles.traffic.includes(near);
      if (isTraffic) {
        // Carjacking: the driver bails out on foot, witnesses raise the heat.
        world.peds.spawnFleeingDriver(near.mesh.position.x, near.mesh.position.z);
        world.peds.fleeFrom(near.mesh.position.x, near.mesh.position.z, 14);
        const witnessed = world.police.cops.some((c) => c.active && Math.hypot(c.mesh.position.x - this.pos.x, c.mesh.position.z - this.pos.z) < 22)
          || world.police.footCops.some((f) => f.active && Math.hypot(f.x - this.pos.x, f.z - this.pos.z) < 18)
          || world.peds.peds.some((p) => Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 10);
        if (witnessed) world.police.setWanted(world.state.wanted + 1, world);
        this.enterCar(near, true);
      } else {
        this.enterCar(near, false);
        world.hud.flash('IN THE CAR — ' + this.car.name.toUpperCase());
      }
    },
    fire() {
      if (this._fireCooldown > 0 || this.onFoot === false) return;
      const w = WEAPONS[this.weapon];
      const ammo = this.weapons[this.weapon];
      if (isFinite(ammo.mag) && ammo.mag <= 0) {
        if (ammo.reserve > 0) {
          const take = Math.min(w.mag, ammo.reserve);
          ammo.mag = take; ammo.reserve -= take;
          world.hud.flash('RELOADED — ' + w.name);
        }
        return;
      }
      this._fireCooldown = w.rate;
      if (isFinite(ammo.mag)) ammo.mag--;
      // Hitscan: a cop in the firing cone takes the hit.
      const fx = Math.cos(this.angle), fz = -Math.sin(this.angle);
      let hit = false;
      for (const f of world.police.footCops) {
        if (!f.active) continue;
        const dx = f.x - this.pos.x, dz = f.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 34 && (dx * fx + dz * fz) / d > 0.86) {
          f.active = false; f.mesh.visible = false; hit = true;
        }
      }
      for (const c of world.police.cops) {
        if (!c.active) continue;
        const dx = c.mesh.position.x - this.pos.x, dz = c.mesh.position.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 40 && (dx * fx + dz * fz) / d > 0.9) {
          c.speed = Math.max(0, c.speed - 6);
          hit = true;
        }
      }
      if (hit) world.hud.flash('HIT — ' + w.name);
      if (this._wantedCooldown <= 0) {
        world.police.setWanted(world.state.wanted + 1, world);
        this._wantedCooldown = 3;
      }
      world.hud.update(world);
    },
    update(dt, input) {
      this._fireCooldown = Math.max(0, this._fireCooldown - dt);
      this._wantedCooldown = Math.max(0, this._wantedCooldown - dt);
      if (this.onFoot) {
        const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const mz = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
        const moving = mx !== 0 || mz !== 0;
        const speed = input.run ? 7.5 : 5;
        if (moving) {
          // Camera-relative: forward is -Z rotated by camera yaw — simplified to
          // world axes with the camera behind the player (angle drives facing).
          const len = Math.hypot(mx, mz) || 1;
          const dx = (mx / len) * speed * dt;
          const dz = -(mz / len) * speed * dt;
          this.pos.x += dx;
          this.pos.z += dz;
          this.angle = Math.atan2(-dz, dx);
          this.mesh.rotation.y = this.angle;
        }
        this.pos.x = Math.max(-168, Math.min(168, this.pos.x));
        this.pos.z = Math.max(-168, Math.min(168, this.pos.z));
        this.mesh.position.set(this.pos.x, 0, this.pos.z);
        this.speedKmh = moving ? speed * 3.6 : 0;
      } else if (this.car) {
        this.speedKmh = driveCar(this.car, input, dt, this.topSpeed());
        this.pos.x = this.car.mesh.position.x;
        this.pos.z = this.car.mesh.position.z;
        this.angle = this.car.angle;
        if (this.speedKmh > 120 && Math.abs(this.car.spin) > 1.5) world.city.showWreck(0);
        if (this.car.speed > 30 && Math.random() < dt * 0.02) world.city.showWreck(1);
      }
    },
  };
  return player;
}
