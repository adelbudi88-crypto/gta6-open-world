// Wanted system (1-5 stars) + police: patrol cars that ram the player,
// foot cops that chase on foot, and a police helicopter at 4+ stars that
// circles overhead and keeps the heat from cooling off. Lose the heat by
// distance + time; busted if a cop grabs you on foot, wasted if health
// hits zero. At 5 stars the HUD calls it MOST WANTED.
// v2.3: same heat/star thresholds, helicopter orbit and pursuit staging
// as v2.2, with the star lookup as a reducer, the meshes built from spec
// loops, and the per-frame work split into named phases; the on-foot
// staging keeps every car off the centre line so no light bar can cross
// the CHAPTER banner.
import * as THREE from 'three';
import { clamp, dist2 } from './rng.js';
import { createCarMesh, stepCar } from './vehicles.js';

// Star bands: [upper heat bound, stars]. Same thresholds (20/40/60/85).
const STAR_BANDS = [[20, 1], [40, 2], [60, 3], [85, 4], [Infinity, 5]];

function starsFromHeat(heat) {
  if (heat <= 0) return 0;
  return STAR_BANDS.reduce((found, [bound, stars]) => (found === null && heat < bound ? stars : found), null) ?? 5;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function makeHeliMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 6.4), dark);
  body.castShadow = true;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), dark);
  tail.position.set(0, 0.2, -5);
  g.add(tail);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.0, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x9fd8ff, emissive: 0x223344 }),
  );
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
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -18;
  cone.rotation.x = Math.PI;
  g.add(cone);
  g.userData = { rotor, rotor2, cone };
  return g;
}

function makeFootCopMesh(scene) {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const capMat = new THREE.MeshLambertMaterial({ color: 0x101828 });
  // [w, h, d, x, y, z, material, shadow, leg?]
  const spec = [
    [0.6, 0.72, 0.34, navy, 0, 1.08, 0, true, false],
    [0.38, 0.38, 0.38, skin, 0, 1.64, 0, false, false],
    [0.42, 0.12, 0.42, capMat, 0, 1.86, 0, false, false],
    [0.2, 0.72, 0.22, navy, -0.15, 0.36, 0, false, true],
    [0.2, 0.72, 0.22, navy, 0.15, 0.36, 0, false, true],
  ];
  const legs = [];
  for (const [w, h, d, mat, x, y, z, shadow, leg] of spec) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    g.add(m);
    if (leg) legs.push(m);
  }
  g.userData = { legL: legs[0], legR: legs[1] };
  scene.add(g);
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

  // Cops arrive from behind the player's direction of travel, never
  // materialising in the windshield: a car spawned ahead of a player
  // doing 100+ km/j is an instant head-on ram, not a pursuit. Callers
  // that stage cops by hand (stagePursuit / stageFootScene) pass no
  // heading and keep the old random offset — they override x/z right after.
  function spawnCopCar(px, pz, heading) {
    const mesh = createCarMesh(0xf0f0f0, true);
    scene.add(mesh);
    let x;
    let z;
    if (heading === undefined) {
      x = px + rng.range(-40, 40);
      z = pz + rng.range(-40, 40);
    } else {
      const back = heading + Math.PI;
      const along = 35 + rng.range(0, 15);
      const side = rng.range(-25, 25);
      x = px + Math.sin(back) * along + Math.cos(back) * side;
      z = pz + Math.cos(back) * along - Math.sin(back) * side;
    }
    const car = {
      mesh, x, z,
      heading: rng.range(0, Math.PI * 2),
      speed: 0, maxSpeed: 33,
      health: 100, maxHealth: 100, name: 'PSPD Interceptor',
      dead: false, cop: true, stuck: 0,
    };
    copCars.push(car);
    return car;
  }

  function spawnFootCop(px, pz) {
    const g = makeFootCopMesh(scene);
    const cop = {
      mesh: g,
      x: px + rng.range(-14, 14),
      z: pz + rng.range(-14, 14),
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
    const stars = starsFromHeat(state.heat);
    if (stars !== state.wanted) {
      state.wanted = stars;
      state.loseTimer = 0;
    }
    return reason;
  }

  function countAlive(list) {
    let n = 0;
    for (const c of list) if (!c.dead) n++;
    return n;
  }

  function maintainPopulation(player) {
    const want = desiredCops();
    if (state.wanted <= 0) return;
    // on foot the player has a heading; in a car the car's heading rules
    const heading = player.inCar && player.car ? player.car.heading : player.heading;
    if (countAlive(copCars) < Math.min(want, 4)) spawnCopCar(player.x, player.z, heading);
    if (countAlive(footCops) < Math.min(want - 1, 3) && !player.inCar) {
      spawnFootCop(player.x, player.z);
    }
  }

  function updateHeli(dt, player) {
    if (state.wanted >= 4 && !state.heli) spawnHeli(player.x, player.z);
    if (state.wanted === 0 && state.heli) removeHeli();
    const h = state.heli;
    if (!h) return;
    h.angle += dt * 0.55;
    const tx = player.x + Math.sin(h.angle) * 48;
    const tz = player.z + Math.cos(h.angle) * 48 - 18;
    const chase = Math.min(1, dt * 1.4);
    h.x += (tx - h.x) * chase;
    h.z += (tz - h.z) * chase;
    h.rotorSpin += dt * 22;
    h.mesh.userData.rotor.rotation.y = h.rotorSpin;
    h.mesh.userData.rotor2.rotation.y = h.rotorSpin + Math.PI / 2;
    h.mesh.position.set(h.x, 24 + Math.sin(h.angle * 2) * 1.5, h.z);
    h.mesh.rotation.y = Math.atan2(player.x - h.x, player.z - h.z);
  }

  function nearestCopDist(player) {
    let best = Infinity;
    for (const c of copCars) {
      if (!c.dead) best = Math.min(best, dist2(c.x, c.z, player.x, player.z));
    }
    for (const c of footCops) {
      if (!c.dead) best = Math.min(best, dist2(c.x, c.z, player.x, player.z));
    }
    return best;
  }

  function decayHeat(dt, player) {
    const nearest = nearestCopDist(player);
    if (state.wanted <= 0) return nearest;
    if (state.heli) {
      state.loseTimer = 0;
    } else if (nearest > 120 * 120) {
      state.loseTimer += dt;
      if (state.loseTimer > 6 + state.wanted * 2) {
        state.heat = Math.max(0, state.heat - dt * 9);
        state.wanted = starsFromHeat(state.heat);
        if (state.wanted === 0) state.loseTimer = 0;
      }
    } else {
      state.loseTimer = 0;
    }
    return nearest;
  }

  function flashLightBars() {
    const phase = Math.floor(flashT * 6) % 2 === 0;
    for (const c of copCars) {
      if (c.dead) continue;
      const bar = c.mesh.userData.lightBar;
      if (!bar) continue;
      bar.userData.red.material.emissive.setHex(phase ? 0xff0000 : 0x220000);
      bar.userData.blue.material.emissive.setHex(phase ? 0x111188 : 0x0000ff);
    }
  }

  function updateCopCars(dt, player, colliders, others) {
    flashT += dt;
    for (const c of copCars) {
      if (c.dead) continue;
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const dh = wrapAngle(Math.atan2(dx, dz) - c.heading);
      const steer = clamp(dh * 1.6, -1, 1);
      const throttle = d > 6 ? 1 : 0.4;
      stepCar(c, dt, throttle, steer, 0, colliders, others.concat(copCars), null);
      if (c.speed > 2) c.stuck = 0;
      else c.stuck += dt;
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
    }
    flashLightBars();
  }

  function updateFootCops(dt, player, onBusted) {
    let touching = false;
    for (const c of footCops) {
      if (c.dead) continue;
      const dx = player.x - c.x;
      const dz = player.z - c.z;
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
  }

  // remove dead or far-away units from a list, removing their meshes
  function sweep(list, player, maxDist) {
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      const gone = c.dead || dist2(c.x, c.z, player.x, player.z) > maxDist * maxDist;
      if (!gone) continue;
      scene.remove(c.mesh);
      list.splice(i, 1);
    }
  }

  const api = {};
  api.state = state;
  api.copCars = copCars;
  api.footCops = footCops;
  api.addWanted = addWanted;
  api.clearWanted = () => {
    state.wanted = 0;
    state.heat = 0;
    state.loseTimer = 0;
    removeHeli();
  };
  api.spawnCopCar = spawnCopCar;
  api.spawnFootCop = spawnFootCop;
  api.spawnHeli = spawnHeli;
  api.removeHeli = removeHeli;

  // Stage a pursuit for a screenshot: 3 cop cars converging on the
  // player (two visible ahead, one behind) + the helicopter overhead.
  // The two ahead start far out, on the sidewalks (dx ±8, clear of the
  // player's lane so he never brushes them), and slow (maxSpeed 10), so
  // they are still 20-40 m ahead — head-on, light bars flashing — when
  // the screenshot lands, and the player cannot ram them first. The
  // tail car is capped below the player's top speed so it cannot catch
  // up and ram him from behind either.
  api.stagePursuit = (px, pz, heading) => {
    // [dx, dz, headingOffset, speed, maxSpeed]
    const spots = [
      [-8, -130, Math.PI, 8, 10],
      [8, -152, Math.PI, 8, 10],
      [-14, 34, 0, 18, 28],
    ];
    for (const [dx, dz, off, sp, ms] of spots) {
      const c = spawnCopCar(px, pz);
      c.x = px + dx;
      c.z = pz + dz;
      c.heading = heading + off;
      c.speed = sp;
      c.maxSpeed = ms;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
    if (!state.heli) spawnHeli(px, pz);
    if (state.heli) {
      state.heli.x = px + 18;
      state.heli.z = pz - 60;
      state.heli.angle = Math.PI - 1.375;
      state.heli.mesh.position.set(state.heli.x, 24, state.heli.z);
    }
  };

  // Stage cops for an on-foot screenshot: reposition the pre-spawned
  // pursuit population ahead of the player (north, where the camera
  // looks) instead of converging on top of him. Every car sits off the
  // centre line — v2 parked one at dx 0 and its light bar crossed the
  // CHAPTER banner. Foot cops walk slowly so they are 5-11 m ahead,
  // flanking, when the screenshot lands — never between the camera
  // and the player.
  api.stageFootScene = (px, pz) => {
    const carSpots = [[-8, -34], [9, -44], [-16, -52], [14, -38]];
    copCars.forEach((c, i) => {
      const [dx, dz] = carSpots[i % carSpots.length];
      c.x = px + dx;
      c.z = pz + dz;
      c.heading = 0; // south, facing the player
      c.speed = 6;
      c.maxSpeed = 10;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    });
    const footSpots = [[-4, -10], [5, -12], [3, -16]];
    footCops.forEach((c, i) => {
      const [dx, dz] = footSpots[i % footSpots.length];
      c.x = px + dx;
      c.z = pz + dz;
      c.speed = 2; // slow approach: still ahead at shot time
      c.mesh.position.set(c.x, 0, c.z);
    });
  };

  api.update = (dt, player, colliders, others, onBusted) => {
    maintainPopulation(player);
    updateHeli(dt, player);
    const nearestCop = decayHeat(dt, player);
    updateCopCars(dt, player, colliders, others);
    updateFootCops(dt, player, onBusted);
    state.sirenOn = state.wanted > 0;
    return { nearestCop };
  };

  api.prune = (player) => {
    sweep(copCars, player, 320);
    sweep(footCops, player, 200);
  };

  return api;
}
