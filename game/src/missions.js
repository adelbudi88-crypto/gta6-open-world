// Story + missions for Porto Azul II. Dario "Daz" Kosta, a driver for hire,
// takes jobs from Mara and Benny — five chained chapters with a timer and a
// payout each, from a first delivery to a casino vault run under 5 stars.
// Missions are data + a small state machine; the game wires the callbacks.
// v2.3: same five chapters, rewards, timers and messages as v2.2, with
// the win checks back in a per-chapter table and the beacon/arrow setup
// shared by one small helper.
import * as THREE from 'three';
import { dist2 } from './rng.js';

export const MISSIONS = [
  { id: 1, chapter: 'CHAPTER 1/5', title: "Benny's First Job", reward: 400, time: 150, objective: 'Antar paket ke Casino Royale', brief: 'Benny: "Antar paket ini ke Casino Royale. Jangan dibuka, jangan telat — 2 menit."' },
  { id: 2, chapter: 'CHAPTER 2/5', title: "Tono's Debt", reward: 800, time: 180, objective: 'Kejar mobil merah Tono sampai dekat', brief: 'Mara: "Tono kabur bawa uang kita. Kejar mobil merahnya, jangan sampai lolos!"' },
  { id: 3, chapter: 'CHAPTER 3/5', title: 'Heat Wave', reward: 1200, time: 240, objective: 'Lolos dari polisi sampai wanted hilang', brief: 'Mara: "Polisi mengendus kita. Helikopter sudah naik — hilang dari radar mereka!"' },
  { id: 4, chapter: 'CHAPTER 4/5', title: 'The Vault Job', reward: 2500, time: 300, objective: 'Kalahkan 4 penjaga kasino, ambil brankas', brief: 'Benny: "Brankas kasino. Bereskan penjaganya, ambil uangnya, jangan mati."' },
  { id: 5, chapter: 'CHAPTER 5/5', title: 'Casino Vault Run', reward: 5000, time: 240, objective: 'Kabur ke Garasi Benny dengan wanted 5', brief: 'Mara: "Uang sudah di tangan. Kabur ke garasi Benny — semua polisi kota mengejarmu!"' },
];

function makeBeacon(scene) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 16, 1, true), mat);
  beam.visible = false;
  scene.add(beam);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  arrow.rotation.x = Math.PI;
  arrow.visible = false;
  scene.add(arrow);
  return { beam, arrow };
}

export function makeMissions(scene, rng, city, hooks) {
  // hooks: { onMessage(text), onDone(mission), onStart(mission), onObjective(text),
  //         onChapter(chapter, title), spawnThugs(pos, count), startChase,
  //         startEscape, startFinale }
  const { beam, arrow } = makeBeacon(scene);
  const m = {
    index: 0,               // 0-based, MISSIONS.length = done
    phase: 'idle',          // idle | active | done
    marker: null,           // {x, z}
    chaseTime: 0,
    thugsLeft: 0,
    thugsSpawned: false,
    vaultTaken: false,
    done: false,
    t: 0,
    timeLeft: 0,            // seconds left on the current mission timer
  };

  const current = () => MISSIONS[m.index] ?? null;

  function setMarker(x, z) {
    m.marker = { x, z };
    beam.position.set(x, 20, z);
    beam.visible = true;
    arrow.position.set(x, 9, z);
    arrow.visible = true;
  }
  function hideMarker() {
    m.marker = null;
    beam.visible = false;
    arrow.visible = false;
  }

  function start(i) {
    m.index = i;
    m.phase = 'active';
    m.chaseTime = 0;
    m.thugsLeft = 0;
    m.thugsSpawned = false;
    m.vaultTaken = false;
    const cur = current();
    m.timeLeft = cur.time;
    hooks.onChapter(cur.chapter, cur.title);
    hooks.onObjective(cur.objective);
    hooks.onMessage(`${cur.title} — ${cur.brief}`);
    hooks.onStart(cur);
    if (i === 0) setMarker(city.casino.x, city.casino.z);
    else if (i === 1) hooks.startChase();
    else if (i === 2) hooks.startEscape();
    else if (i === 3) setMarker(city.casino.x, city.casino.z);
    else if (i === 4) {
      hooks.startFinale();
      setMarker(city.garage.x, city.garage.z);
    }
  }

  function fail(reason) {
    const cur = current();
    hooks.onMessage(`${reason} Misi "${cur.title}" gagal — coba lagi.`);
    hideMarker();
    m.phase = 'idle';
    setTimeout(() => start(m.index), 1500);
  }

  function complete() {
    const cur = current();
    hooks.onDone(cur);
    hideMarker();
    m.index++;
    if (m.index >= MISSIONS.length) {
      m.phase = 'done';
      m.done = true;
      hooks.onMessage('CERITA SELESAI — Daz, Mara dan Benny bebas. Porto Azul milik kalian. (R untuk main lagi)');
    } else {
      m.phase = 'idle';
      setTimeout(() => start(m.index), 1200);
    }
  }

  function advanceAfterEscape(ctx) {
    ctx.removeChaseTarget();
    hideMarker();
    m.index++;
    m.phase = 'idle';
    setTimeout(() => start(m.index), 1200);
  }

  // One win-check per chapter, in story order, as a table.
  const CHECKS = [
    (ctx) => {
      if (dist2(ctx.player.x, ctx.player.z, city.casino.x, city.casino.z) >= 100) return;
      hooks.onMessage('Paket diserahkan. Benny: "Bagus. Ada kerjaan lagi buatmu."');
      complete();
    },
    (ctx) => {
      const target = ctx.chaseTarget;
      if (!target) {
        complete();
        return;
      }
      if (target.escaped) {
        hooks.onMessage('Tono lolos... Mara: "Sial. Kita coba lagi lain kali."');
        advanceAfterEscape(ctx);
        return;
      }
      setMarker(target.x, target.z);
    },
    (ctx) => {
      if (ctx.police.state.wanted !== 0) return;
      hooks.onMessage('Polisi kehilangan jejakmu. Mara: "Bersih. Lanjutkan."');
      complete();
    },
    (ctx) => {
      if (!m.thugsSpawned) {
        m.thugsSpawned = true;
        hooks.spawnThugs({ x: city.casino.x, z: city.casino.z }, 4);
        hooks.onMessage('Penjaga kasino menghadang! Kalahkan mereka.');
      }
      const cleared = m.thugsLeft <= 0 && m.thugsSpawned && ctx.thugsDefeated;
      if (cleared && !m.vaultTaken) {
        m.vaultTaken = true;
        setMarker(city.casino.x + 12, city.casino.z + 8);
        hooks.onObjective('Ambil uang brankas di Casino Royale');
        hooks.onMessage('Kasino bersih. Ambil uang brankasnya.');
        return;
      }
      if (!m.vaultTaken) return;
      if (dist2(ctx.player.x, ctx.player.z, city.casino.x + 12, city.casino.z + 8) >= 36) return;
      hooks.onMessage('Uang brankas di tangan. Benny: "Cantik. Sekarang hilang."');
      complete();
    },
    (ctx) => {
      if (dist2(ctx.player.x, ctx.player.z, city.garage.x, city.garage.z) >= 120) return;
      hooks.onMessage('Daz sampai di garasi Benny. Semua polisi kehilangan jejak.');
      ctx.police.clearWanted();
      complete();
    },
  ];

  function tickChaseTimer(dt, ctx) {
    const target = ctx.chaseTarget;
    if (m.index !== 1 || !target || target.escaped) return;
    const d = Math.hypot(ctx.player.x - target.x, ctx.player.z - target.z);
    if (d >= 8) {
      m.chaseTime = Math.max(0, m.chaseTime - dt * 0.5);
      return;
    }
    m.chaseTime += dt;
    if (m.chaseTime <= 3) return;
    hooks.onMessage('Tono tertangkap! Uang kembali ke tangan Mara.');
    ctx.removeChaseTarget();
    complete();
  }

  function update(dt, ctx) {
    m.t += dt;
    if (beam.visible) {
      beam.rotation.y += dt * 0.8;
      arrow.position.y = 9 + Math.sin(m.t * 3) * 0.8;
    }
    if (m.phase !== 'active') return;
    // mission timer: run out and the job fails
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      m.timeLeft = 0;
      const escaped = m.index === 1 && ctx.chaseTarget && ctx.chaseTarget.escaped;
      if (!escaped) {
        fail('Waktu habis!');
        return;
      }
    }
    tickChaseTimer(dt, ctx);
    if (m.phase !== 'active') return; // the chase timer may have completed the mission
    CHECKS[m.index]?.(ctx);
  }

  const api = {};
  api.m = m;
  api.current = current;
  api.start = start;
  api.complete = complete;
  api.fail = fail;
  api.setMarker = setMarker;
  api.hideMarker = hideMarker;
  Object.defineProperty(api, 'marker', { get() { return m.marker; } });
  Object.defineProperty(api, 'done', { get() { return m.done; } });
  api.update = update;
  api.onThugDown = () => {
    m.thugsLeft = Math.max(0, m.thugsLeft - 1);
    if (m.thugsLeft === 0) hooks.onMessage('Semua penjaga tumbang.');
  };
  return api;
}
