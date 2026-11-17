// Wanted system (1-5 stars) + police: patrol cars that ram the player,
// foot cops that chase on foot, and a police helicopter at 4+ stars that
// circles overhead and keeps the heat from cooling off. Lose the heat by
// distance + time; busted if a cop grabs you on foot, wasted if health
// hits zero. At 5 stars the HUD calls it MOST WANTED.
// v2: helicopter pursuit + staged chase placement for screenshots.
import * as THREE from 'three';
import { clamp, dist2 } from './rng.js';
import { createCarMesh, stepCar } from './vehicles.js';

function makeHeliMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 6.4), dark);
  body.position.y = 0;
  body.castShadow = true;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), dark);
  tail.position.set(0, 0.2, -5);
  g.add(tail);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.6), new THREE.MeshLambertMaterial({ color: 0x9fd8ff, emissive: 0x223344 }));
  glass.position.set(0, 0.4, 2.6);
  g.add(glass);
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.7), rotorMat);
  rotor.position.y = 1.1;
  g.add(rotor);
  const rotor2 = rotor.clone();
  rotor2.rotation.y = Math.PI / 2;
  g.add(rotor2);
  // searchlight cone pointing down
  const coneGeo = new THREE.ConeGeometry(7, 34, 16, 1, true);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2b8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
  }));
  cone.position.y = -18;
  cone.rotation.x = Math.PI;
  g.add(cone);
  g.userData = { rotor, rotor2, cone };
  return g;
}

export function makePolice(scene, rng, city) {
  const state = {
    wanted: 0,
    heat: 0,            // 0..100, drives star display
    loseTimer: 0,       // seconds out of cop sight
    bustedTimer: 0,
    sirenOn: false,
    heli: null,         // helicopter object when active
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
      health: 100, maxHealth: 100, name: 'PSPD Interceptor',
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

  function spawnHeli(px, pz) {
    const mesh = makeHeliMesh();
    mesh.position.set(px + 24, 24, pz - 30);
    scene.add(mesh);
    // Orbit angle starts at PI - 1.375 so that after ~2.5 game-seconds
    // (the screenshot moment) the orbit target is straight ahead of the
    // player — the helicopter sits top-center in the frame, not off to
    // the side. The angle advances 0.55 rad/s in update().
    state.heli = { mesh, x: px + 24, z: pz - 30, angle: Math.PI - 1.375, rotorSpin: 0 };
    return state.heli;
  }

  function removeHeli() {
    if (!state.heli) return;
    scene.remove(state.heli.mesh);
    state.heli = null;
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
    clearWanted() { state.wanted = 0; state.heat = 0; state.loseTimer = 0; removeHeli(); },
    spawnCopCar,
    spawnFootCop,
    spawnHeli,
    removeHeli,

    // Stage a pursuit for a screenshot: 3 cop cars converging on the
    // player (two visible ahead, one behind) + the helicopter overhead.
    // The two ahead start far out, on the sidewalks (dx ±8, clear of the
    // player's lane so he never brushes them), and slow (maxSpeed 10), so
    // they are still 20-40 m ahead — head-on, light bars flashing — when
    // the screenshot lands, and the player cannot ram them first. The
    // tail car is capped below the player's top speed so it cannot catch
    // up and ram him from behind either.
    stagePursuit(px, pz, heading) {
      const spots = [
        { dx: -8, dz: -130, hd: heading + Math.PI, sp: 8, ms: 10 },
        { dx: 8, dz: -152, hd: heading + Math.PI, sp: 8, ms: 10 },
        { dx: -14, dz: 34, hd: heading, sp: 18, ms: 28 },
      ];
      for (const s of spots) {
        const c = spawnCopCar(px, pz);
        c.x = px + s.dx; c.z = pz + s.dz;
        c.heading = s.hd;
        c.speed = s.sp;
        c.maxSpeed = s.ms;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
      }
      if (!state.heli) spawnHeli(px, pz);
      if (state.heli) {
        state.heli.x = px + 18; state.heli.z = pz - 60;
        state.heli.angle = Math.PI - 1.375;
        state.heli.mesh.position.set(state.heli.x, 24, state.heli.z);
      }
    },

    // Stage cops for an on-foot screenshot: reposition the pre-spawned
    // pursuit population ahead of the player (north, where the camera
    // looks) instead of converging on top of him. Car cops stay slow and
    // in-lane; foot cops walk slowly so they are 5-11 m ahead, flanking,
    // when the screenshot lands — never between the camera and the player.
    stageFootScene(px, pz) {
      const carSpots = [
        { dx: -5, dz: -34 }, { dx: 5, dz: -42 }, { dx: 0, dz: -52 }, { dx: -12, dz: -40 },
      ];
      copCars.forEach((c, i) => {
        const s = carSpots[i % carSpots.length];
        c.x = px + s.dx; c.z = pz + s.dz;
        c.heading = 0; // south, facing the player
        c.speed = 6;
        c.maxSpeed = 10;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
      });
      const footSpots = [
        { dx: -4, dz: -10 }, { dx: 4, dz: -12 }, { dx: 0, dz: -16 },
      ];
      footCops.forEach((c, i) => {
        const s = footSpots[i % footSpots.length];
        c.x = px + s.dx; c.z = pz + s.dz;
        c.speed = 2; // slow approach: still ahead at shot time
        c.mesh.position.set(c.x, 0, c.z);
      });
    },

    update(dt, player, colliders, others, onBusted) {
      // maintain cop population
      const want = desiredCops();
      const activeCars = copCars.filter((c) => !c.dead).length;
      if (activeCars < Math.min(want, 4) && state.wanted > 0) spawnCopCar(player.x, player.z);
      if (footCops.filter((c) => !c.dead).length < Math.min(want - 1, 3) && state.wanted > 0 && !player.inCar) {
        spawnFootCop(player.x, player.z);
      }
      // helicopter at 4+ stars
      if (state.wanted >= 4 && !state.heli) spawnHeli(player.x, player.z);
      if (state.wanted === 0 && state.heli) removeHeli();
      if (state.heli) {
        const h = state.heli;
        h.angle += dt * 0.55;
        const tx = player.x + Math.sin(h.angle) * 48;
        const tz = player.z + Math.cos(h.angle) * 48 - 18;
        h.x += (tx - h.x) * Math.min(1, dt * 1.4);
        h.z += (tz - h.z) * Math.min(1, dt * 1.4);
        h.rotorSpin += dt * 22;
        h.mesh.userData.rotor.rotation.y = h.rotorSpin;
        h.mesh.userData.rotor2.rotation.y = h.rotorSpin + Math.PI / 2;
        h.mesh.position.set(h.x, 24 + Math.sin(h.angle * 2) * 1.5, h.z);
        h.mesh.rotation.y = Math.atan2(player.x - h.x, player.z - h.z);
      }
      // heat decay when no cop is near (never while the heli is overhead)
      let nearestCop = Infinity;
      for (const c of copCars) if (!c.dead) nearestCop = Math.min(nearestCop, dist2(c.x, c.z, player.x, player.z));
      for (const c of footCops) if (!c.dead) nearestCop = Math.min(nearestCop, dist2(c.x, c.z, player.x, player.z));
      if (state.wanted > 0) {
        if (state.heli) {
          state.loseTimer = 0;
        } else if (nearestCop > 120 * 120) {
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
      if (touching && !player.inCar && state.wanted > 0 && !player.noBust) {
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
