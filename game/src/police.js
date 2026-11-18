// Wanted system: 0–5 stars. Pursuit cars ram gently, foot cops close in,
// and at 3+ stars a helicopter circles with a searchlight beam. Damage is
// deliberately gentle (12/s ram, 10/s foot) so chases stay fun.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';
import { makeRng } from './rng.js';

export function createPolice(scene) {
  const rng = makeRng(99);
  const group = new THREE.Group();
  scene.add(group);

  const pursuit = [];
  for (let i = 0; i < 4; i++) {
    const car = makeCarMesh(THREE, 0x111122, 'Police Interceptor');
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff2222 : 0x2244ff }),
    );
    bar.position.set(0, 1.42, -0.2);
    car.add(bar);
    car.visible = false;
    group.add(car);
    pursuit.push({ mesh: car, bar, active: false, speed: 0 });
  }

  const cops = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 1.05, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x14143c, roughness: 0.85 }),
    );
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 }),
    );
    head.position.y = 1.82;
    g.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.27, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x0a0a20, roughness: 0.6 }),
    );
    cap.position.y = 2.0;
    g.add(cap);
    g.visible = false;
    group.add(g);
    cops.push({ mesh: g, active: false });
  }

  // Helicopter with a visible searchlight beam.
  const heli = new THREE.Group();
  const heliBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.4, 5.2),
    new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.4, metalness: 0.5 }),
  );
  heli.add(heliBody);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.12, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.5, metalness: 0.6 }),
  );
  rotor.position.y = 0.9;
  heli.add(rotor);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 42, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = -21;
  beam.rotation.x = Math.PI;
  heli.add(beam);
  const spot = new THREE.SpotLight(0xfff2b0, 400, 90, 0.35, 0.5, 1.2);
  spot.position.set(0, 0, 0);
  heli.add(spot);
  heli.add(spot.target);
  spot.target.position.set(0, -42, 0);
  heli.visible = false;
  group.add(heli);

  let wanted = 0;
  let heat = 0;
  let heliAngle = 0;

  function applyVisibility() {
    const nCars = wanted >= 1 ? Math.min(4, wanted + 1) : 0;
    pursuit.forEach((c, i) => { c.active = i < nCars; c.mesh.visible = i < nCars; });
    const nCops = wanted >= 2 ? Math.min(6, wanted * 2) : 0;
    cops.forEach((c, i) => { c.active = i < nCops; c.mesh.visible = i < nCops; });
    heli.visible = wanted >= 3;
  }

  return {
    get wanted() { return wanted; },
    get mostWanted() { return wanted >= 5; },
    setWanted(n) {
      wanted = Math.max(0, Math.min(5, Math.round(n)));
      heat = wanted * 20;
      applyVisibility();
    },
    raise(amount) { this.setWanted(wanted + amount); },
    lower(amount) { this.setWanted(wanted - amount); },
    pursuit,
    cops,
    heli,
    placeForShot(kind, playerPos) {
      // Stage pursuit cars to the FLANKS so they never occlude the player.
      const flank = [
        [-9, 6], [9, 7], [-10, -8], [10, -9],
      ];
      pursuit.forEach((c, i) => {
        const [dx, dz] = flank[i % flank.length];
        c.mesh.position.set(playerPos.x + dx, 0, playerPos.z + dz);
        c.mesh.rotation.y = 0;
        c.active = true;
        c.mesh.visible = true;
      });
      cops.forEach((c, i) => {
        const a = (i / 6) * Math.PI * 2;
        c.mesh.position.set(playerPos.x + Math.cos(a) * 12, 0, playerPos.z + Math.sin(a) * 12);
        c.mesh.rotation.y = a;
        c.active = true;
        c.mesh.visible = true;
      });
      if (kind === 'chase' || kind === 'drive') {
        heli.visible = true;
        heli.position.set(playerPos.x + 14, 42, playerPos.z - 18);
      }
    },
    update(dt, playerPos, player, frozen) {
      if (frozen) {
        rotor.rotation.y += 0.02;
        return;
      }
      heat = Math.max(0, heat - dt * 1.5);
      if (heat < wanted * 20 - 19 && wanted > 0) {
        // Heat cools slowly; wanted only drops when the player hides.
      }
      rotor.rotation.y += dt * 14;
      const t = Date.now() / 1000;
      pursuit.forEach((c, i) => {
        c.bar.material.color.setHex(Math.floor(t * 4 + i) % 2 ? 0xff2222 : 0x2244ff);
        if (!c.active) return;
        const m = c.mesh.position;
        const dx = playerPos.x - m.x;
        const dz = playerPos.z - m.z;
        const dist = Math.hypot(dx, dz) || 1;
        const targetHeading = Math.atan2(dx, dz);
        let dh = targetHeading - c.mesh.rotation.y;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.mesh.rotation.y += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
        const spd = Math.min(46, 26 + wanted * 4);
        m.x += Math.sin(c.mesh.rotation.y) * spd * dt;
        m.z += Math.cos(c.mesh.rotation.y) * spd * dt;
        if (dist < 3.2 && player) player.damage(12 * dt);
      });
      cops.forEach((c, i) => {
        if (!c.active) return;
        const m = c.mesh.position;
        const dx = playerPos.x - m.x;
        const dz = playerPos.z - m.z;
        const dist = Math.hypot(dx, dz) || 1;
        m.x += (dx / dist) * 5.2 * dt;
        m.z += (dz / dist) * 5.2 * dt;
        c.mesh.rotation.y = Math.atan2(dx, dz);
        if (dist < 1.6 && player) player.damage(10 * dt);
      });
      if (heli.visible) {
        heliAngle += dt * 0.35;
        heli.position.set(
          playerPos.x + Math.cos(heliAngle) * 18,
          42,
          playerPos.z + Math.sin(heliAngle) * 18,
        );
        heli.lookAt(playerPos.x, 0, playerPos.z);
      }
    },
  };
}
