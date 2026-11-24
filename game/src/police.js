// 5-star police dispatch: patrol cars with PIT maneuvers, foot cops, roadblocks at
// wanted 3+, spike strips at wanted 4+, Air One helicopters with searchlights.
import * as THREE from 'three';
import { buildCar } from './vehicles.js';

function makeHeli(scene) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.4, 6.5),
    new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 }),
  );
  g.add(body);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 4.5),
    new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.5 }),
  );
  tail.position.set(0, 0.3, -5);
  g.add(tail);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.12, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
  );
  rotor.position.y = 1.1;
  g.add(rotor);
  // searchlight cone
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(6, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -13;
  cone.rotation.x = Math.PI;
  g.add(cone);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -25.5;
  g.add(spot);
  scene.add(g);
  return { group: g, rotor, cone, spot, angle: 0 };
}

function makeFootCop(scene, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.8 }),
  );
  body.position.y = 0.95;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 }),
  );
  head.position.y = 1.95;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a1a3a, roughness: 0.7 }),
  );
  cap.position.y = 2.18;
  g.add(body, head, cap);
  g.position.set(x, 0, z);
  scene.add(g);
  return { group: g, speed: 3.4 };
}

export function createPolice(scene, state) {
  const cops = [];
  const footCops = [];
  const helis = [];
  const roadblocks = [];
  const spikes = [];
  let roadblockTimer = 0;
  let spikeTimer = 0;

  function spawnCopCar(x, z) {
    const g = buildCar({ name: 'Police Interceptor', color: 0xf2f2f2, top: 165, accel: 24 }, { cop: true });
    g.position.set(x, 0, z);
    scene.add(g);
    const cop = { group: g, speed: 0, pitT: 0 };
    cops.push(cop);
    return cop;
  }

  function deployRoadblock(x, z) {
    // Two cop cars angled across the road + barrier.
    const a = spawnCopCar(x - 4, z);
    a.group.rotation.y = 0.9;
    const b = spawnCopCar(x + 4, z);
    b.group.rotation.y = -0.9;
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(12, 1.1, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff7a1a, emissiveIntensity: 0.5 }),
    );
    barrier.position.set(x, 0.8, z + 3);
    scene.add(barrier);
    roadblocks.push({ a, b, barrier, x, z });
  }

  function deploySpike(x, z) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.25, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }),
    );
    strip.position.set(x, 0.15, z);
    scene.add(strip);
    for (let i = -3; i <= 3; i++) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.7, 6),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 }),
      );
      spike.position.set(x + i, 0.5, z);
      scene.add(spike);
    }
    spikes.push({ group: strip, x, z, armed: true });
    state.spikeWarning = true;
  }

  function setWanted(n) {
    state.wanted = Math.max(0, Math.min(5, n));
    // Scale forces with heat: patrol cars + foot cops + helis.
    const wantCars = state.wanted === 0 ? 0 : 1 + state.wanted;
    while (cops.length < wantCars && cops.length < 8) {
      const p = state.playerPos || new THREE.Vector3(0, 0, 0);
      spawnCopCar(p.x + 30 + cops.length * 12, p.z - 24);
    }
    const wantFoot = state.wanted >= 2 ? state.wanted : 0;
    while (footCops.length < wantFoot) {
      const p = state.playerPos || new THREE.Vector3(0, 0, 0);
      footCops.push(makeFootCop(scene, p.x + 8 + footCops.length * 5, p.z + 6));
    }
    const wantHeli = state.wanted >= 3 ? (state.wanted >= 5 ? 2 : 1) : 0;
    while (helis.length < wantHeli) helis.push(makeHeli(scene));
  }

  function clear() {
    for (const c of cops) scene.remove(c.group);
    for (const f of footCops) scene.remove(f.group);
    for (const h of helis) scene.remove(h.group);
    for (const r of roadblocks) { scene.remove(r.a.group); scene.remove(r.b.group); scene.remove(r.barrier); }
    for (const s of spikes) scene.remove(s.group);
    cops.length = 0; footCops.length = 0; helis.length = 0; roadblocks.length = 0; spikes.length = 0;
    state.spikeWarning = false;
  }

  function update(dt, playerPos, playerVel, frozen) {
    if (frozen) return;
    if (state.wanted > 0) {
      // Roadblocks at wanted 3+ every ~25s; spike strips at wanted 4+ every ~30s.
      roadblockTimer -= dt;
      if (state.wanted >= 3 && roadblockTimer <= 0 && roadblocks.length < 2) {
        deployRoadblock(playerPos.x + 55, playerPos.z + 10);
        roadblockTimer = 25;
      }
      spikeTimer -= dt;
      if (state.wanted >= 4 && spikeTimer <= 0 && spikes.length < 2) {
        deploySpike(playerPos.x + 70, playerPos.z);
        spikeTimer = 30;
      }
    }
    // Cop cars: chase the player; PIT = ram the rear quarter to spin the car.
    for (const c of cops) {
      const g = c.group;
      const toPlayer = new THREE.Vector3().subVectors(playerPos, g.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      if (dist > 1) {
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        let dy = targetYaw - g.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        g.rotation.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
        const speed = Math.min(34, 14 + state.wanted * 3.2);
        g.position.x += Math.sin(g.rotation.y) * speed * dt;
        g.position.z += Math.cos(g.rotation.y) * speed * dt;
        // PIT: within 5m and slightly behind -> shove the player sideways.
        if (dist < 5.5 && state.driving) {
          c.pitT += dt;
          if (c.pitT > 0.9) {
            state.pitSpin = 1;
            c.pitT = 0;
          }
        }
      }
      // Flash the light bar.
      const t = performance.now() / 240;
      const red = g.children[3];
      const blue = g.children[4];
      if (red && red.material.emissive) red.material.emissiveIntensity = (t % 2 < 1) ? 3 : 0.2;
      if (blue && blue.material.emissive) blue.material.emissiveIntensity = (t % 2 < 1) ? 0.2 : 3;
    }
    // Foot cops walk toward the player.
    for (const f of footCops) {
      const to = new THREE.Vector3().subVectors(playerPos, f.group.position);
      to.y = 0;
      if (to.length() > 2) {
        to.normalize();
        f.group.position.addScaledVector(to, f.speed * dt);
        f.group.rotation.y = Math.atan2(to.x, to.z);
      }
    }
    // Helicopters circle above, searchlight pinned on the player.
    for (const h of helis) {
      h.angle += dt * 0.35;
      h.group.position.set(
        playerPos.x + Math.cos(h.angle) * 26,
        42,
        playerPos.z + Math.sin(h.angle) * 26,
      );
      h.rotor.rotation.y += dt * 22;
      h.group.lookAt(playerPos.x, 0, playerPos.z);
      const night = (state.clock ?? 19.07) >= 21;
      h.cone.material.opacity = night ? 0.22 : 0.13;
      h.spot.material.opacity = night ? 0.5 : 0.3;
    }
    // Spike strips: driving over one bursts a tire — 40 km/h cap for 20s.
    for (const s of spikes) {
      if (!s.armed) continue;
      const d = Math.hypot(playerPos.x - s.x, playerPos.z - s.z);
      if (d < 3.5 && state.driving) {
        s.armed = false;
        state.spiked = true;
        state.spikeTimer = 20;
        state.spikeWarning = false;
      }
    }
    if (state.spiked) {
      state.spikeTimer -= dt;
      if (state.spikeTimer <= 0) state.spiked = false;
    }
  }

  return { cops, footCops, helis, roadblocks, spikes, setWanted, deployRoadblock, deploySpike, spawnCopCar, update, clear };
}
