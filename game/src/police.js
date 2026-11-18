// Police for Porto Azul II — pursuit cars, foot cops and a searchlight helicopter.
import * as THREE from 'three';
import { makeCar } from './vehicles.js';
import { clamp } from './rng.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    for (let i = 0; i < 3; i++) {
      const car = makeCar(0x101014, { police: true, cabinColor: 0xe8e8e8 });
      // White doors read as a police livery.
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(2.04, 0.4, 1.6),
        new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
      );
      door.position.y = 0.62;
      car.add(door);
      car.position.set(-40 + i * 40, 0, -20 - i * 25);
      scene.add(car);
      this.cars.push({ mesh: car, speed: 0 });
    }
    // Foot cops.
    this.cops = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.9, 0.35),
        new THREE.MeshLambertMaterial({ color: 0x1a2a5e })
      );
      body.position.y = 1.05;
      g.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xd9a066 })
      );
      head.position.y = 1.68;
      g.add(head);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10),
        new THREE.MeshLambertMaterial({ color: 0x0d1440 })
      );
      cap.position.y = 1.86;
      g.add(cap);
      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.65, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x141824 })
      );
      legs.position.y = 0.33;
      g.add(legs);
      g.position.set(30 + i * 12, 0, 80);
      scene.add(g);
      this.cops.push({ mesh: g, phase: i * 1.7 });
    }
    // Helicopter with a searchlight cone.
    this.heli = new THREE.Group();
    const heliBody = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x1a1a20 })
    );
    this.heli.add(heliBody);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 5),
      new THREE.MeshLambertMaterial({ color: 0x1a1a20 })
    );
    tail.position.set(0, 0.3, -5);
    this.heli.add(tail);
    this.rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x333338 })
    );
    this.rotor.position.y = 1;
    this.heli.add(this.rotor);
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(7, 42, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    this.beam.position.y = -21;
    this.beam.rotation.x = Math.PI;
    this.heli.add(this.beam);
    this.heli.position.set(0, 46, -40);
    scene.add(this.heli);
    this.flash = 0;
  }

  // Chase the player when wanted > 0; hover the heli above them. Frozen in shot mode.
  update(dt, t, playerPos, wanted) {
    this.flash += dt;
    const on = Math.floor(this.flash * 3) % 2 === 0;
    for (const c of this.cars) {
      c.mesh.userData.lightRed.material.color.setHex(on ? 0xff2030 : 0x551018);
      c.mesh.userData.lightBlue.material.color.setHex(on ? 0x18204a : 0x2040ff);
    }
    const active = wanted > 0;
    this.heli.visible = active;
    this.beam.visible = active;
    if (!active) return;
    const chaseSpeed = 10 + wanted * 4.5;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      const m = c.mesh;
      // Staggered flank offsets so pursuit cars do not ram the player.
      const tx = playerPos.x + (i === 0 ? -9 : i === 1 ? 9 : 0);
      const tz = playerPos.z + (i === 2 ? -12 : 4);
      const dx = tx - m.position.x;
      const dz = tz - m.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const step = Math.min(chaseSpeed * dt, dist);
      m.position.x += (dx / dist) * step;
      m.position.z += (dz / dist) * step;
      m.rotation.y = Math.atan2(dx, dz);
      for (const w of m.userData.wheels) w.rotation.x += chaseSpeed * dt * 2;
    }
    // Heli holds above and slightly ahead of the player, rotor spinning.
    this.heli.position.x += (playerPos.x - this.heli.position.x) * Math.min(1, dt * 1.2);
    this.heli.position.z += (playerPos.z + 6 - this.heli.position.z) * Math.min(1, dt * 1.2);
    this.heli.position.y = 46 + Math.sin(t * 0.7) * 1.5;
    this.rotor.rotation.y += dt * 22;
    // Foot cops close in slowly on foot.
    for (const cop of this.cops) {
      const m = cop.mesh;
      const dx = playerPos.x - m.position.x;
      const dz = playerPos.z - m.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist > 6) {
        m.position.x += (dx / dist) * 2.4 * dt;
        m.position.z += (dz / dist) * 2.4 * dt;
        m.rotation.y = Math.atan2(dx, dz);
      }
      m.position.y = Math.abs(Math.sin(t * 6 + cop.phase)) * 0.05;
    }
  }

  // Place pursuit cars at the flanks for a staged shot (never occluding the player).
  stageFlank(playerPos, heading) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const rx = Math.cos(heading);
    const rz = -Math.sin(heading);
    const spots = [
      [-11, 6], [11, 6], [0, -14],
    ];
    this.cars.forEach((c, i) => {
      const [side, fwd] = spots[i];
      c.mesh.position.set(
        playerPos.x + rx * side + fx * fwd,
        0,
        playerPos.z + rz * side + fz * fwd
      );
      c.mesh.rotation.y = heading;
    });
    this.heli.visible = true;
    this.beam.visible = true;
    this.heli.position.set(playerPos.x + 6, 46, playerPos.z + 18);
  }

  // Park the foot cops around a spot for a staged shot.
  stageCops(cx, cz, offsets) {
    this.cops.forEach((cop, i) => {
      const [ox, oz] = offsets[i % offsets.length];
      cop.mesh.position.set(cx + ox, 0, cz + oz);
      cop.mesh.rotation.y = Math.atan2(cx - cop.mesh.position.x, cz - cop.mesh.position.z);
    });
  }
}
