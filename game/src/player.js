// Daz, the player: a box figure on foot, a driver in a car, a shooter with
// an SMG. Cash, respect, health and armour live here; the world reads them
// for the HUD and the missions spend them.
import * as THREE from 'three';
import { clamp } from './rng.js';

export function buildFigure(shirt, pants, skin = 0xd8a077) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), mat(shirt));
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(skin));
  head.position.y = 1.85;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.54), mat(0xc22a2a));
  cap.position.y = 2.12;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.4), mat(pants));
  legL.position.set(-0.22, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.22;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), mat(shirt));
  armL.position.set(-0.58, 1.1, 0);
  const armR = armL.clone();
  armR.position.x = 0.58;
  g.add(torso, head, cap, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export function createPlayer(W) {
  const { scene, city, audio } = W;
  const figure = buildFigure(0x2a6fd8, 0x1c1c26);
  scene.add(figure);

  const P = {
    x: 0, z: 60, heading: 0, speed: 0,
    health: 100, armour: 0, cash: 0, respect: 0,
    mag: 30, reserve: 120, inCar: false, car: null,
    lastDamage: -99, walkPhase: 0, dead: false,
  };

  let tracer = null;
  let tracerT = 0;

  function aimDir() {
    return { x: Math.sin(W.camYaw), z: Math.cos(W.camYaw) };
  }

  function shootAt(targets) {
    if (P.mag <= 0) { audio.click(); return false; }
    P.mag--;
    audio.gunshot();
    W.police?.addHeat(8);
    const dir = aimDir();
    const ox = P.x, oz = P.z;
    let best = null, bd = 45;
    for (const t of targets) {
      if (t.dead) continue;
      const dx = t.x - ox, dz = t.z - oz;
      const d = Math.hypot(dx, dz);
      if (d > 45 || d < 0.5) continue;
      const dot = (dx * dir.x + dz * dir.z) / d;
      if (dot < 0.94) continue;
      if (d < bd) { bd = d; best = t; }
    }
    const hx = ox + dir.x * (best ? bd : 45);
    const hz = oz + dir.z * (best ? bd : 45);
    if (!tracer) {
      tracer = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 1),
        new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true }),
      );
      scene.add(tracer);
    }
    const mid = { x: (ox + hx) / 2, y: 1.35, z: (oz + hz) / 2 };
    tracer.position.set(mid.x, mid.y, mid.z);
    tracer.lookAt(hx, 1.35, hz);
    tracer.scale.set(1, 1, Math.max(0.1, bd));
    tracer.material.opacity = 0.95;
    tracerT = 0.09;
    if (best) {
      best.hp -= 34;
      if (best.hp <= 0) { best.dead = true; if (best.mesh) best.mesh.visible = false; }
      return true;
    }
    return false;
  }

  // Methods live on the same object the world reads, so health, cash and
  // position never go stale between the player and its callers.
  P.figure = figure;
  Object.assign(P, {
    get state() { return P; },
    setStats(o) {
      if (o.cash != null) P.cash = o.cash;
      if (o.respect != null) P.respect = o.respect;
      if (o.health != null) P.health = o.health;
      if (o.armour != null) P.armour = o.armour;
      if (o.mag != null) P.mag = o.mag;
      if (o.reserve != null) P.reserve = o.reserve;
      if (o.noBust) P.noBust = true;
    },
    teleport(x, z, heading = 0) {
      P.x = x; P.z = z; P.heading = heading;
      if (P.car) { P.car.x = x; P.car.z = z; P.car.heading = heading; }
      figure.position.set(x, 0, z);
      figure.rotation.y = heading;
    },
    addCash(n) { P.cash += n; },
    addRespect(n) { P.respect += n; },
    takeDamage(n) {
      if (P.dead) return;
      const absorbed = Math.min(P.armour, n * 0.6);
      P.armour -= absorbed;
      P.health -= (n - absorbed);
      P.lastDamage = W.S.time;
      if (P.health <= 0) { P.health = 0; P.dead = true; W.S.over = 'wasted'; audio.busted(); }
    },
    reload() {
      if (P.mag >= 30 || P.reserve <= 0) return;
      const need = 30 - P.mag;
      const take = Math.min(need, P.reserve);
      P.mag += take; P.reserve -= take;
      audio.reload();
    },
    punch(targets) {
      audio.punch();
      for (const t of targets) {
        if (t.dead) continue;
        if (Math.hypot(t.x - P.x, t.z - P.z) < 2.6) {
          t.hp -= 20;
          if (t.hp <= 0) { t.dead = true; if (t.mesh) t.mesh.visible = false; }
          return true;
        }
      }
      return false;
    },
    shoot(targets) { return shootAt(targets); },
    tryEnterCar() {
      if (P.inCar) return false;
      const car = W.vehicles.nearestParked(P.x, P.z, 4.5);
      if (!car) return false;
      W.vehicles.enterCar(car);
      P.car = car;
      P.inCar = true;
      P.x = car.x; P.z = car.z; P.heading = car.heading;
      figure.visible = false;
      W.police?.addHeat(15);
      audio.horn();
      return true;
    },
    exitCar() {
      if (!P.inCar) return false;
      const car = W.vehicles.exitCar();
      P.car = null;
      P.inCar = false;
      P.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
      P.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
      figure.visible = true;
      figure.position.set(P.x, 0, P.z);
      return true;
    },
    update(dt, input) {
      if (P.dead || W.S.over) return;
      if (W.S.time - P.lastDamage > 6 && P.health > 0 && P.health < 100) {
        P.health = Math.min(100, P.health + 4 * dt);
      }
      if (tracer) {
        tracerT -= dt;
        tracer.material.opacity = Math.max(0, tracerT / 0.09) * 0.95;
        if (tracerT <= 0) { tracer.visible = false; }
        else tracer.visible = true;
      }
      if (P.inCar && P.car) {
        // In a staged shot the car holds its speed: the screenshot must
        // show the staged 137/144 km/j, not a coasting car.
        if (!W.S.shot) W.vehicles.drivePlayer(input, dt, W.S.engine);
        P.x = P.car.x; P.z = P.car.z; P.heading = P.car.heading;
        P.speed = Math.abs(P.car.speed);
        audio.engineStart(clamp(P.speed / 34, 0, 1));
        return;
      }
      audio.engineStop();
      const fwd = { x: Math.sin(W.camYaw), z: Math.cos(W.camYaw) };
      const right = { x: Math.cos(W.camYaw), z: -Math.sin(W.camYaw) };
      let mx = 0, mz = 0;
      if (input.up) { mx += fwd.x; mz += fwd.z; }
      if (input.down) { mx -= fwd.x; mz -= fwd.z; }
      if (input.left) { mx -= right.x; mz -= right.z; }
      if (input.right) { mx += right.x; mz += right.z; }
      const len = Math.hypot(mx, mz);
      const sprint = input.sprint ? 1.5 : 1;
      if (len > 0) {
        const sp = 6 * sprint;
        mx = (mx / len) * sp; mz = (mz / len) * sp;
        P.speed = sp;
        P.heading = Math.atan2(mx, mz);
        P.walkPhase += dt * sp * 1.6;
      } else {
        P.speed = 0;
      }
      const nx = P.x + mx * dt, nz = P.z + mz * dt;
      if (!city.collides(nx, P.z, 0.7)) P.x = nx;
      if (!city.collides(P.x, nz, 0.7)) P.z = nz;
      const c = city.clampToCity(P.x, P.z, 4);
      P.x = c.x; P.z = c.z;
      figure.position.set(P.x, 0, P.z);
      figure.rotation.y = P.heading;
      const sw = Math.sin(P.walkPhase) * (P.speed > 0 ? 0.5 : 0);
      figure.userData.legL.rotation.x = sw;
      figure.userData.legR.rotation.x = -sw;
      figure.userData.armL.rotation.x = -sw * 0.7;
      figure.userData.armR.rotation.x = sw * 0.7;
    },
  });
  return P;
}
