// Wanted and the law: heat 0–100 maps to 0–5 stars, cop cars and foot cops
// spawn to match, and a helicopter with a searchlight joins at four stars.
// Cops are slower than a good car, so escape is always possible.
import * as THREE from 'three';
import { clamp } from './rng.js';
import { MODELS, buildCarMesh } from './vehicles.js';
import { buildFigure } from './player.js';

export function createPolice(W) {
  const { scene, city, audio } = W;
  let heat = 0;
  const copCars = [];
  const footCops = [];
  let bustT = 0;

  // Helicopter: body + spinning rotor + a translucent searchlight cone.
  const heli = new THREE.Group();
  const hBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x1c2733 }),
  );
  const hRotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x888888 }),
  );
  hRotor.position.y = 1.1;
  const coneGeo = new THREE.ConeGeometry(7, 34, 20, 1, true);
  coneGeo.translate(0, -17, 0);
  const cone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  heli.add(hBody, hRotor, cone);
  heli.visible = false;
  scene.add(heli);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.1, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.06;
  pool.visible = false;
  scene.add(pool);

  function stars() { return heat <= 0 ? 0 : Math.min(5, Math.ceil(heat / 20)); }

  function spawnCopCar(x, z) {
    const car = {
      model: MODELS[5], x, z, heading: 0, speed: 0,
      mesh: buildCarMesh(MODELS[5], { lightBar: true, bodyColor: 0x14161c }),
      kind: 'cop', hp: 100, dead: false,
    };
    car.mesh.group.position.set(x, 0, z);
    scene.add(car.mesh.group);
    copCars.push(car);
    return car;
  }

  function spawnFootCop(x, z) {
    const mesh = buildFigure(0x1c2a4a, 0x14161c);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const cop = { x, z, heading: 0, hp: 100, dead: false, mesh, speed: 7.4 };
    footCops.push(cop);
    return cop;
  }

  function removeCar(car) {
    scene.remove(car.mesh.group);
    const i = copCars.indexOf(car);
    if (i >= 0) copCars.splice(i, 1);
  }
  function removeCop(cop) {
    scene.remove(cop.mesh);
    const i = footCops.indexOf(cop);
    if (i >= 0) footCops.splice(i, 1);
  }

  function ringSpot(cx, cz, angle, dist) {
    return { x: cx + Math.sin(angle) * dist, z: cz + Math.cos(angle) * dist };
  }

  return {
    copCars, footCops,
    get heat() { return heat; },
    stars,
    addHeat(n) { heat = clamp(heat + n, 0, 100); },
    setHeat(n) { heat = clamp(n, 0, 100); },
    clearWanted() { heat = 0; bustT = 0; },
    spawnCopCar, spawnFootCop,
    clearAll() {
      for (const c of [...copCars]) removeCar(c);
      for (const c of [...footCops]) removeCop(c);
      heat = 0;
      heli.visible = false;
      pool.visible = false;
      audio.stopSiren();
    },
    // Stage a pursuit behind the player's heading: cops converge from the
    // rear and the flanks, never parked dead-centre ahead of the camera.
    stagePursuit(x, z, heading) {
      const spots = [
        { a: heading + Math.PI, d: 26 },
        { a: heading + Math.PI * 0.72, d: 30 },
        { a: heading - Math.PI * 0.72, d: 30 },
      ];
      for (const s of spots) {
        const p = ringSpot(x, z, s.a, s.d);
        const car = spawnCopCar(p.x, p.z);
        car.heading = Math.atan2(x - p.x, z - p.z);
        car.speed = 18;
      }
    },
    // Foot scene: cops in a ring ahead and to the sides, cars off the
    // banner's centre band so chapter text stays readable.
    stageFootScene(x, z) {
      const carSpots = [
        { a: Math.PI * 0.85, d: 22 }, { a: -Math.PI * 0.85, d: 22 },
        { a: Math.PI * 0.35, d: 26 }, { a: -Math.PI * 0.35, d: 26 },
      ];
      for (const s of carSpots) {
        const p = ringSpot(x, z, s.a, s.d);
        const car = spawnCopCar(p.x, p.z);
        car.heading = Math.atan2(x - p.x, z - p.z);
        car.speed = 0;
      }
      const copSpots = [
        { a: Math.PI * 0.15, d: 10 }, { a: -Math.PI * 0.2, d: 12 }, { a: Math.PI * 0.5, d: 11 },
      ];
      for (const s of copSpots) {
        const p = ringSpot(x, z, s.a, s.d);
        spawnFootCop(p.x, p.z);
      }
    },
    update(dt, t) {
      const P = W.player;
      const st = stars();
      if (st > 0) audio.startSiren(); else audio.stopSiren();
      // Staged shots freeze the heat and the roster: the frame must keep
      // its staged stars and its staged cops. Pursuit still runs below.
      if (!W.S.shot) {
      // Heat fades fast when the law loses sight of the player.
      let nearest = 999;
      for (const c of copCars) nearest = Math.min(nearest, Math.hypot(c.x - P.x, c.z - P.z));
      for (const c of footCops) nearest = Math.min(nearest, Math.hypot(c.x - P.x, c.z - P.z));
      heat = clamp(heat - (nearest > 45 ? 2.5 : 0.4) * dt, 0, 100);

      // Spawn to match the star count.
      const wantCars = Math.min(st, 5);
      while (copCars.length < wantCars) {
        const a = W.rng.range(0, Math.PI * 2);
        const p = ringSpot(P.x, P.z, a, W.rng.range(60, 90));
        const c = city.clampToCity(p.x, p.z, 8);
        spawnCopCar(c.x, c.z);
      }
      while (copCars.length > wantCars) removeCar(copCars[copCars.length - 1]);
      const wantFoot = st >= 2 ? Math.min(3, st - 1) : 0;
      while (footCops.length < wantFoot) {
        const a = W.rng.range(0, Math.PI * 2);
        const p = ringSpot(P.x, P.z, a, W.rng.range(25, 40));
        spawnFootCop(p.x, p.z);
      }
      while (footCops.length > wantFoot) removeCop(footCops[footCops.length - 1]);
      }

      // Cop cars chase and ram.
      for (const c of copCars) {
        const dx = P.x - c.x, dz = P.z - c.z;
        const d = Math.hypot(dx, dz);
        if (d > 170) { removeCar(c); continue; }
        const want = Math.atan2(dx, dz);
        let dh = want - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += clamp(dh, -1.8 * dt, 1.8 * dt);
        c.speed = Math.min(29, c.speed + 10 * dt);
        const nx = c.x + Math.sin(c.heading) * c.speed * dt;
        const nz = c.z + Math.cos(c.heading) * c.speed * dt;
        if (!city.collides(nx, nz, 1.6)) { c.x = nx; c.z = nz; }
        else c.speed *= 0.5;
        c.mesh.group.position.set(c.x, 0, c.z);
        c.mesh.group.rotation.y = c.heading;
        if (d < 4.5 && P.car) {
          P.car.speed *= 0.96;
          if (W.rng.chance(0.1)) audio.crash();
        }
      }

      // Foot cops run the player down; touching one too long means busted.
      let touching = false;
      for (const c of footCops) {
        if (c.dead) { removeCop(c); continue; }
        const dx = P.x - c.x, dz = P.z - c.z;
        const d = Math.hypot(dx, dz);
        if (d > 170) { removeCop(c); continue; }
        c.heading = Math.atan2(dx, dz);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
        if (d < 2.2 && !P.inCar && !P.noBust) touching = true;
      }
      if (touching) {
        bustT += dt;
        if (bustT > 2.5) {
          bustT = 0;
          P.cash = Math.max(0, P.cash - 200);
          heat = 0;
          W.S.over = 'busted';
          audio.busted();
        }
      } else {
        bustT = Math.max(0, bustT - dt);
      }

      // Helicopter at four stars and up.
      const heliOn = st >= 4;
      heli.visible = heliOn;
      pool.visible = heliOn;
      if (heliOn) {
        const tx = P.x + 6, ty = 40, tz = P.z + 6;
        heli.position.x += (tx - heli.position.x) * Math.min(1, dt * 1.2);
        heli.position.y += (ty - heli.position.y) * Math.min(1, dt * 1.2);
        heli.position.z += (tz - heli.position.z) * Math.min(1, dt * 1.2);
        hRotor.rotation.y = t * 22;
        // The cone hangs straight down, so the light pool sits on the player.
        pool.position.set(P.x, 0.06, P.z);
      }
    },
  };
}
