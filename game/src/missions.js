// Five story missions with Benny, Tono and Mara. Each mission is data plus a
// small state machine: an objective, a timer, a payout, and a marker the
// player can see in the world and on the minimap.
import * as THREE from 'three';
import { clamp } from './rng.js';
import { buildFigure } from './player.js';

export const DEFS = [
  { chapter: 1, title: 'First Wheels', payout: 800, respect: 3, time: 0, briefing: "Benny needs wheels. Steal a car and bring it to his garage.", objective: 'Steal a car, then drive to Benny\u2019s Garage' },
  { chapter: 2, title: 'Tono\u2019s Debt', payout: 800, respect: 3, time: 150, briefing: 'Tono owes Benny $800. Chase his red Comet down the avenue and stay close.', objective: 'Stay close to Tono\u2019s red car' },
  { chapter: 3, title: 'Heat Wave', payout: 1200, respect: 3, time: 180, briefing: 'The heat is on. Lose the cops until your wanted level clears.', objective: 'Lose the cops — get wanted to zero' },
  { chapter: 4, title: 'The Vault Job', payout: 2500, respect: 3, time: 300, briefing: 'Four guards stand between you and the Casino Royale vault. Take them down.', objective: 'Defeat the 4 vault guards' },
  { chapter: 5, title: 'Casino Vault Run', payout: 5000, respect: 3, time: 105, briefing: 'You have the cash. Now escape to Benny\u2019s Garage with every cop in the city behind you.', objective: 'Escape to Benny\u2019s Garage' },
];

export function createMissions(W) {
  const { scene, city, player, police, vehicles, audio, hud } = W;
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xffd23c }),
  );
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  marker.add(beam);
  marker.visible = false;
  scene.add(marker);

  const M = {
    index: 0,          // next mission to start (0-based)
    active: null,      // runtime state of the running mission
    done: false,
    guards: [],
    chaseCar: null,
    closeT: 0,
  };

  function clearField() {
    for (const g of M.guards) scene.remove(g.mesh);
    M.guards = [];
    if (M.chaseCar) { vehicles.removeCar(M.chaseCar); M.chaseCar = null; }
    M.closeT = 0;
  }

  function spawnGuards(spots) {
    for (const s of spots) {
      const mesh = buildFigure(0xc22a2a, 0x14161c);
      mesh.position.set(s.x, 0, s.z);
      scene.add(mesh);
      M.guards.push({ x: s.x, z: s.z, heading: 0, hp: 100, dead: false, mesh, shootT: 0 });
    }
  }

  function start(i) {
    clearField();
    const def = DEFS[i];
    if (!def) { M.active = null; M.done = true; return; }
    M.index = i;
    M.active = { def, timeLeft: def.time, phase: i === 0 ? 'steal' : 'go' };
    if (i === 1) {
      // Tono's red Comet loops the central avenue.
      const loop = [];
      for (const L of [-108, 0, 108]) {
        loop.push({ x: L, z: -200 }, { x: L, z: 200 });
      }
      M.chaseCar = vehicles.addExtra({ name: 'Comet GT', color: 0xd82828, top: 30, accel: 14 }, 0, 40, Math.PI, { waypoints: loop, cruise: 17 });
      M.active.target = M.chaseCar;
    }
    if (i === 3) {
      const c = city.casino;
      spawnGuards([
        { x: c.x - 10, z: c.z - 14 }, { x: c.x + 10, z: c.z - 16 },
        { x: c.x - 4, z: c.z - 22 }, { x: c.x + 6, z: c.z - 12 },
      ]);
    }
    if (i === 4) police.setHeat(100);
    hud.showChapter(def.chapter, def.title);
    audio.missionDone();
  }

  function complete() {
    const def = M.active.def;
    player.addCash(def.payout);
    player.addRespect(def.respect);
    audio.missionDone();
    W.saveNow();
    const next = M.index + 1;
    if (next >= DEFS.length) {
      M.active = null;
      M.done = true;
      W.S.over = 'done';
      hud.showChapter(5, 'CAMPAIGN COMPLETE');
      return;
    }
    start(next);
  }

  function fail() {
    hud.showToast('MISSION FAILED — TRY AGAIN');
    audio.busted();
    if (M.active.def.chapter === 3 || M.active.def.chapter === 5) police.setHeat(40);
    start(M.index);
  }

  function markerPos() {
    if (!M.active) return null;
    const i = M.index;
    if (i === 0) return M.active.phase === 'steal' ? null : city.garage;
    if (i === 1 && M.chaseCar) return { x: M.chaseCar.x, z: M.chaseCar.z };
    if (i === 3) return city.casino;
    if (i === 4) return city.garage;
    return null;
  }

  return {
    defs: DEFS,
    get index() { return M.index; },
    get active() { return M.active; },
    get done() { return M.done; },
    get guards() { return M.guards; },
    get chaseCar() { return M.chaseCar; },
    get m() { return M.active; }, // short alias used by shots staging
    start, complete, fail, markerPos,
    update(dt) {
      if (!M.active || W.S.over) return;
      const a = M.active;
      // Staged shots freeze the countdown so the frame shows the exact
      // staged timer (2:14, 4:58, 3:00, 1:45).
      if (!W.S.shot && a.timeLeft > 0) {
        a.timeLeft -= dt;
        if (a.timeLeft <= 0) { fail(); return; }
      }
      const i = M.index;
      const mp = markerPos();
      if (mp) {
        marker.visible = true;
        marker.position.set(mp.x, 3.2 + Math.sin(W.S.time * 2.4) * 0.35, mp.z);
        marker.rotation.y = W.S.time * 1.4;
      } else {
        marker.visible = false;
      }
      if (i === 0) {
        if (a.phase === 'steal' && player.inCar) a.phase = 'go';
        if (a.phase === 'go' && Math.hypot(player.x - city.garage.x, player.z - city.garage.z) < 9) complete();
      }
      if (i === 1 && M.chaseCar) {
        const d = Math.hypot(player.x - M.chaseCar.x, player.z - M.chaseCar.z);
        if (d < 14) {
          M.closeT += dt;
          if (M.closeT > 3) complete();
        } else {
          M.closeT = Math.max(0, M.closeT - dt);
        }
      }
      if (i === 2) {
        if (police.stars() === 0) complete();
      }
      if (i === 3) {
        let alive = 0;
        for (const g of M.guards) {
          if (g.dead) continue;
          alive++;
          const d = Math.hypot(player.x - g.x, player.z - g.z);
          g.shootT -= dt;
          if (d < 30 && g.shootT <= 0) {
            g.shootT = 1.3;
            if (W.rng.chance(0.3)) player.takeDamage(4);
            audio.gunshot();
          }
          g.heading = Math.atan2(player.x - g.x, player.z - g.z);
          g.mesh.rotation.y = g.heading;
        }
        if (alive === 0) complete();
      }
      if (i === 4) {
        if (Math.hypot(player.x - city.garage.x, player.z - city.garage.z) < 9) complete();
      }
    },
  };
}
