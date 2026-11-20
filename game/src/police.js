// Police — the wanted system made visible. Foot cops, pursuit cop cars,
// roadblocks at wanted ≥3, PIT maneuvers that spin the player's car, and
// Air One: one helicopter at wanted ≥3, a second at wanted 5, both with a
// visible searchlight cone sweeping the streets at dusk.
import * as THREE from 'three';
import { createCarMesh } from './vehicles.js';

function makeCopMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.75, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.85 }),
  );
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.8 }),
  );
  head.position.y = 1.62;
  g.add(head);
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.28, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x0e1a30, roughness: 0.7 }),
  );
  hat.position.y = 1.82;
  g.add(hat);
  return g;
}

function makeHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 1.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.5, metalness: 0.4 }),
  );
  g.add(body);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.7, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.5, metalness: 0.4 }),
  );
  tail.position.set(-4.2, 0.3, 0);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1;
  g.add(rotor);
  g.userData.rotor = rotor;
  const coneGeo = new THREE.ConeGeometry(7, 26, 16, 1, true);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false,
  }));
  cone.position.y = -13.5;
  cone.rotation.x = Math.PI;
  g.add(cone);
  const spot = new THREE.SpotLight(0xfff2b0, 220, 70, 0.32, 0.5, 1.2);
  spot.position.set(0, -1, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -26, 0);
  g.add(spotTarget);
  spot.target = spotTarget;
  g.add(spot);
  return g;
}

export function createPolice(scene, rng) {
  const cops = [];
  const footCops = [];
  const helis = [];
  const roadblocks = [];

  for (let i = 0; i < 6; i++) {
    const mesh = createCarMesh(0x101418, { police: true });
    mesh.visible = false;
    scene.add(mesh);
    cops.push({ mesh, speed: 0, angle: 0, active: false, pitCooldown: 0, role: 'pursuit' });
  }
  for (let i = 0; i < 8; i++) {
    const mesh = makeCopMesh();
    mesh.visible = false;
    scene.add(mesh);
    footCops.push({ mesh, x: 0, z: 0, angle: 0, active: false });
  }
  for (let i = 0; i < 2; i++) {
    const mesh = makeHeli();
    mesh.visible = false;
    scene.add(mesh);
    helis.push({ mesh, active: false, orbit: rng.range(0, Math.PI * 2) });
  }
  for (let i = 0; i < 2; i++) {
    const mesh = createCarMesh(0x101418, { police: true });
    mesh.visible = false;
    scene.add(mesh);
    roadblocks.push({ mesh, active: false });
  }

  function placePursuit(cop, px, pz, side) {
    cop.active = true;
    cop.mesh.visible = true;
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(14, 22);
    cop.mesh.position.set(px + Math.cos(a) * d * side, 0, pz + Math.sin(a) * d);
    cop.angle = Math.atan2(-(pz - cop.mesh.position.z), px - cop.mesh.position.x);
    cop.speed = 10;
  }

  return {
    cops, footCops, helis, roadblocks,
    wanted: 0,
    setWanted(n, world) {
      const prev = this.wanted;
      this.wanted = Math.max(0, Math.min(5, n));
      world.state.wanted = this.wanted;
      if (this.wanted > world.state.bestWanted) world.state.bestWanted = this.wanted;
      const px = world.player.pos.x, pz = world.player.pos.z;
      const wantCars = this.wanted === 0 ? 0 : Math.min(6, 1 + this.wanted);
      cops.forEach((c, i) => {
        if (i < wantCars && !c.active) placePursuit(c, px, pz, i % 2 === 0 ? 1 : -1);
        if (i >= wantCars) { c.active = false; c.mesh.visible = false; }
      });
      const wantFoot = this.wanted >= 2 ? Math.min(8, this.wanted * 2) : 0;
      footCops.forEach((f, i) => {
        if (i < wantFoot && !f.active) {
          f.active = true; f.mesh.visible = true;
          f.x = px + rng.range(-25, 25); f.z = pz + rng.range(-25, 25);
          f.mesh.position.set(f.x, 0, f.z);
        }
        if (i >= wantFoot) { f.active = false; f.mesh.visible = false; }
      });
      helis[0].active = this.wanted >= 3;
      helis[0].mesh.visible = this.wanted >= 3;
      helis[1].active = this.wanted >= 5;
      helis[1].mesh.visible = this.wanted >= 5;
      if (this.wanted >= 3 && prev < 3) this.spawnRoadblock(world);
      if (this.wanted < 3) roadblocks.forEach((r) => { r.active = false; r.mesh.visible = false; });
    },
    spawnRoadblock(world) {
      // Two cop cars parked across the road ahead of the player, on the route.
      const p = world.player;
      const fx = Math.cos(p.angle), fz = -Math.sin(p.angle);
      const ahead = p.onFoot ? 26 : 34;
      const cx = p.pos.x + fx * ahead, cz = p.pos.z + fz * ahead;
      roadblocks.forEach((r, i) => {
        r.active = true;
        r.mesh.visible = true;
        const off = (i === 0 ? -3.4 : 3.4);
        r.mesh.position.set(cx - fz * off, 0, cz + fx * off);
        r.mesh.rotation.y = p.angle + Math.PI / 2;
      });
    },
    update(dt, world) {
      if (world.frozen) return;
      const p = world.player;
      const px = p.pos.x, pz = p.pos.z;
      for (const c of cops) {
        if (!c.active) continue;
        const dx = px - c.mesh.position.x, dz = pz - c.mesh.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const targetAngle = Math.atan2(-dz, dx);
        let da = targetAngle - c.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        c.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, da));
        const chaseSpeed = p.onFoot ? 9 : 15 + this.wanted * 1.6;
        c.speed = Math.min(chaseSpeed, c.speed + 6 * dt);
        c.mesh.position.x += Math.cos(c.angle) * c.speed * dt;
        c.mesh.position.z -= Math.sin(c.angle) * c.speed * dt;
        c.mesh.rotation.y = c.angle;
        // PIT: ram the rear quarter to spin the player car.
        c.pitCooldown -= dt;
        if (!p.onFoot && d < 6.5 && c.pitCooldown <= 0 && p.car) {
          p.car.spin = (rng.chance(0.5) ? 1 : -1) * 3.2;
          p.car.speed *= 0.55;
          c.pitCooldown = 4;
          world.city.showWreck(rng.int(0, 1));
          world.hud.flash('PIT MANEUVER — COPS SPUN YOUR CAR!');
        }
        if (d > 90) { c.active = false; c.mesh.visible = false; }
      }
      for (const f of footCops) {
        if (!f.active) continue;
        const dx = px - f.x, dz = pz - f.z;
        const d = Math.hypot(dx, dz) || 1;
        const sp = p.onFoot ? 3.4 : 2.2;
        f.x += (dx / d) * sp * dt;
        f.z += (dz / d) * sp * dt;
        f.angle = Math.atan2(-dz, dx);
        f.mesh.position.set(f.x, 0, f.z);
        f.mesh.rotation.y = f.angle;
        if (!p.onFoot && d < 2.5) { /* cop grabs at the car, no-op while driving */ }
        if (p.onFoot && d < 1.6) {
          world.player.health -= 14 * dt;
          if (world.player.health <= 0) world.main.wasted();
        }
      }
      for (const h of helis) {
        if (!h.active) continue;
        h.orbit += dt * 0.25;
        h.mesh.position.set(px + Math.cos(h.orbit) * 18, 34, pz + Math.sin(h.orbit) * 18);
        h.mesh.rotation.y = -h.orbit;
        h.mesh.userData.rotor.rotation.y += dt * 22;
      }
      for (const r of roadblocks) {
        if (!r.active) continue;
        if (Math.hypot(r.mesh.position.x - px, r.mesh.position.z - pz) > 120) {
          r.active = false; r.mesh.visible = false;
        }
      }
    },
  };
}
