// Wanted system (1-5 stars) + police: patrol cars that ram the player and
// foot cops that chase on foot. Lose the heat by distance + time; busted if
// a cop grabs you on foot, wasted if health hits zero.
import * as THREE from 'three';
import { clamp, dist2 } from './rng.js';
import { createCarMesh, stepCar } from './vehicles.js';

export function makePolice(scene, rng, city) {
  const state = {
    wanted: 0,
    heat: 0,            // 0..100, drives star display
    loseTimer: 0,       // seconds out of cop sight
    bustedTimer: 0,
    sirenOn: false,
  };
  const copCars = [];
  const footCops = [];
  let flashT = 0;

  function spawnCopCar(px, pz) {
    const mesh = createCarMesh(0xf0f0f0, true);
    scene.add(mesh);
    const road = rng.pick(city.roadsX);
    const car = {
      mesh, x: px + rng.range(-40, 40), z: pz + rng.range(-40, 40),
      heading: rng.range(0, Math.PI * 2), speed: 0, maxSpeed: 33,
      dead: false, cop: true, stuck: 0,
    };
    copCars.push(car);
    return car;
  }

  function spawnFootCop(px, pz) {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 0.34), navy);
    torso.position.y = 1.08;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
    head.position.y = 1.64;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x101828 }));
    cap.position.y = 1.86;
    g.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), navy);
    legL.position.set(-0.15, 0.36, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.15;
    g.add(legR);
    g.userData = { legL, legR };
    scene.add(g);
    const cop = {
      mesh: g, x: px + rng.range(-14, 14), z: pz + rng.range(-14, 14),
      heading: 0, speed: 5.4, walkPhase: 0, dead: false, footCop: true,
    };
    footCops.push(cop);
    return cop;
  }

  function desiredCops() {
    return state.wanted === 0 ? 0 : Math.min(2 + state.wanted, 6);
  }

  function addWanted(n, reason) {
    state.heat = clamp(state.heat + n, 0, 100);
    const stars = state.heat <= 0 ? 0 : state.heat < 20 ? 1 : state.heat < 40 ? 2 : state.heat < 60 ? 3 : state.heat < 85 ? 4 : 5;
    if (stars !== state.wanted) {
      state.wanted = stars;
      state.loseTimer = 0;
    }
    return reason;
  }

  return {
    state,
    copCars,
    footCops,
    addWanted,
    clearWanted() { state.wanted = 0; state.heat = 0; state.loseTimer = 0; },

    update(dt, player, colliders, others, onBusted) {
      // maintain cop population
      const want = desiredCops();
      const activeCars = copCars.filter((c) => !c.dead).length;
      if (activeCars < Math.min(want, 4) && state.wanted > 0) spawnCopCar(player.x, player.z);
      if (footCops.filter((c) => !c.dead).length < Math.min(want - 1, 3) && state.wanted > 0 && !player.inCar) {
        spawnFootCop(player.x, player.z);
      }
      // heat decay when no cop is near
      let nearestCop = Infinity;
      for (const c of copCars) if (!c.dead) nearestCop = Math.min(nearestCop, dist2(c.x, c.z, player.x, player.z));
      for (const c of footCops) if (!c.dead) nearestCop = Math.min(nearestCop, dist2(c.x, c.z, player.x, player.z));
      if (state.wanted > 0) {
        if (nearestCop > 120 * 120) {
          state.loseTimer += dt;
          if (state.loseTimer > 6 + state.wanted * 2) {
            state.heat = Math.max(0, state.heat - dt * 9);
            const stars = state.heat <= 0 ? 0 : state.heat < 20 ? 1 : state.heat < 40 ? 2 : state.heat < 60 ? 3 : state.heat < 85 ? 4 : 5;
            state.wanted = stars;
            if (state.wanted === 0) state.loseTimer = 0;
          }
        } else {
          state.loseTimer = 0;
        }
      }
      // cop cars chase + ram
      flashT += dt;
      for (const c of copCars) {
        if (c.dead) continue;
        const dx = player.x - c.x, dz = player.z - c.z;
        const d = Math.hypot(dx, dz) || 1;
        const targetHeading = Math.atan2(dx, dz);
        let dh = targetHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        const steer = clamp(dh * 1.6, -1, 1);
        const throttle = d > 6 ? 1 : 0.4;
        stepCar(c, dt, throttle, steer, 0, colliders, [...others, ...copCars], null);
        c.stuck += dt;
        if (c.speed > 2) c.stuck = 0;
        if (c.stuck > 4) { // respawn closer if stuck on a building
          c.x = player.x + rng.range(-30, 30);
          c.z = player.z + rng.range(-30, 30);
          c.speed = 0;
          c.stuck = 0;
        }
        // ramming the player's car damages it; touching the player on foot busts
        if (d < 4.5 && player.inCar && Math.abs(c.speed) > 4) {
          player.car.speed *= 0.85;
        }
        // flashing light bar
        const bar = c.mesh.userData.lightBar;
        if (bar) {
          const on = Math.floor(flashT * 6) % 2 === 0;
          bar.userData.red.material.emissive.setHex(on ? 0xff0000 : 0x220000);
          bar.userData.blue.material.emissive.setHex(on ? 0x111188 : 0x0000ff);
        }
      }
      // foot cops chase the player on foot
      let touching = false;
      for (const c of footCops) {
        if (c.dead) continue;
        const dx = player.x - c.x, dz = player.z - c.z;
        const d = Math.hypot(dx, dz) || 1;
        if (player.inCar) {
          // cops give up chasing a car, drift back
          c.x += Math.sin(c.heading) * 1.5 * dt;
          continue;
        }
        c.heading = Math.atan2(dx, dz);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        c.walkPhase += dt * 8;
        const swing = Math.sin(c.walkPhase) * 0.5;
        c.mesh.userData.legL.rotation.x = swing;
        c.mesh.userData.legR.rotation.x = -swing;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
        if (d < 1.6) touching = true;
      }
      if (touching && !player.inCar && state.wanted > 0) {
        state.bustedTimer += dt;
        if (state.bustedTimer > 1.2) {
          state.bustedTimer = 0;
          onBusted();
        }
      } else {
        state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);
      }
      state.sirenOn = state.wanted > 0;
      return { nearestCop };
    },

    // remove cops far away (cleanup)
    prune(player) {
      for (let i = copCars.length - 1; i >= 0; i--) {
        const c = copCars[i];
        if (c.dead || dist2(c.x, c.z, player.x, player.z) > 320 * 320) {
          scene.remove(c.mesh);
          copCars.splice(i, 1);
        }
      }
      for (let i = footCops.length - 1; i >= 0; i--) {
        const c = footCops[i];
        if (c.dead || dist2(c.x, c.z, player.x, player.z) > 200 * 200) {
          scene.remove(c.mesh);
          footCops.splice(i, 1);
        }
      }
    },
  };
}
