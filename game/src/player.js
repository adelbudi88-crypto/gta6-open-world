// Player Daz for Porto Azul II — on foot or driving, health/armour/weapon.
import * as THREE from 'three';
import { clamp } from './rng.js';
import { gearForSpeed } from './vehicles.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    const jacket = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.9, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xd84040 })
    );
    jacket.position.y = 1.05;
    this.mesh.add(jacket);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xd9a066 })
    );
    head.position.y = 1.72;
    this.mesh.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.68, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x1c2436 })
    );
    legs.position.y = 0.34;
    this.mesh.add(legs);
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    this.pos = this.mesh.position;
    this.heading = Math.PI; // facing -z (north) by default
    this.speed = 0; // km/h while driving
    this.onFoot = true;
    this.car = null;
    this.carName = '';
    this.health = 100;
    this.armour = 50;
    this.weapon = { name: 'HORNET SMG', ammo: 30, reserve: 120 };
    this.walkPhase = 0;
  }

  enterCar(carMesh, carName) {
    this.car = carMesh;
    this.carName = carName;
    this.onFoot = false;
    this.speed = 0;
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.car) return;
    this.pos.set(this.car.position.x - 2.4, 0, this.car.position.z);
    this.heading = this.car.rotation.y;
    this.car = null;
    this.carName = '';
    this.onFoot = true;
    this.speed = 0;
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  get speedKmh() {
    return this.onFoot ? 0 : this.speed;
  }

  get gear() {
    return this.onFoot ? 0 : gearForSpeed(this.speed);
  }

  takeDamage(amount) {
    let rest = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest);
      this.armour -= absorbed;
      rest -= absorbed;
    }
    this.health = Math.max(0, this.health - rest);
    return this.health <= 0;
  }

  update(dt, input, frozen) {
    if (frozen) return;
    if (this.car) {
      const accel = 46;
      const brake = 70;
      const maxSpeed = 156;
      if (input.forward) this.speed = Math.min(maxSpeed, this.speed + accel * dt);
      else if (input.back) this.speed = Math.max(-28, this.speed - brake * dt);
      else this.speed = this.speed > 0 ? Math.max(0, this.speed - 22 * dt) : Math.min(0, this.speed + 22 * dt);
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const turnRate = 1.9 * clamp(Math.abs(this.speed) / 40, 0.25, 1);
      this.heading += steer * turnRate * dt * (this.speed >= 0 ? 1 : -1);
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      // The car nose points along (sin heading, cos heading); drive that way.
      this.car.position.x += fx * (this.speed / 3.6) * dt;
      this.car.position.z += fz * (this.speed / 3.6) * dt;
      this.car.position.x = clamp(this.car.position.x, -200, 200);
      this.car.position.z = clamp(this.car.position.z, -200, 200);
      this.car.rotation.y = this.heading;
      for (const w of this.car.userData.wheels) w.rotation.x += (this.speed / 3.6) * dt * 2;
      this.pos.copy(this.car.position);
    } else {
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const mz = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        const sp = input.run ? 9 : 5;
        this.pos.x += (mx / len) * sp * dt;
        this.pos.z += (mz / len) * sp * dt;
        this.heading = Math.atan2(mx, mz) + Math.PI;
        this.mesh.rotation.y = this.heading;
        this.walkPhase += dt * 9;
        this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
      } else {
        this.mesh.position.y = 0;
      }
      this.pos.x = clamp(this.pos.x, -200, 200);
      this.pos.z = clamp(this.pos.z, -200, 200);
      this.mesh.position.copy(this.pos);
    }
  }
}
