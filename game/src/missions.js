// Story + missions for Porto Azul II. Dario "Daz" Kosta, a driver for hire,
// takes jobs from Mara and Benny — five chained chapters with a timer and a
// payout each, from a first delivery to a casino vault run under 5 stars.
// Missions are data + a small state machine; the game wires the callbacks.
// v2.1: the per-chapter win checks live in a STEPS table instead of one
// long if/else chain, and the mission banner shows the payout up front.
import * as THREE from 'three';
import { dist2 } from './rng.js';

export const MISSIONS = [
  {
    id: 1,
    title: "Benny's First Job",
    chapter: 'CHAPTER 1/5',
    brief: 'Benny: "Antar paket ini ke Casino Royale. Jangan dibuka, jangan telat — 2 menit."',
    objective: 'Antar paket ke Casino Royale',
    reward: 400,
    time: 150,
  },
  {
    id: 2,
    title: "Tono's Debt",
    chapter: 'CHAPTER 2/5',
    brief: 'Mara: "Tono kabur bawa uang kita. Kejar mobil merahnya, jangan sampai lolos!"',
    objective: 'Kejar mobil merah Tono sampai dekat',
    reward: 800,
    time: 180,
  },
  {
    id: 3,
    title: 'Heat Wave',
    chapter: 'CHAPTER 3/5',
    brief: 'Mara: "Polisi mengendus kita. Helikopter sudah naik — hilang dari radar mereka!"',
    objective: 'Lolos dari polisi sampai wanted hilang',
    reward: 1200,
    time: 240,
  },
  {
    id: 4,
    title: 'The Vault Job',
    chapter: 'CHAPTER 4/5',
    brief: 'Benny: "Brankas kasino. Bereskan penjaganya, ambil uangnya, jangan mati."',
    objective: 'Kalahkan 4 penjaga kasino, ambil brankas',
    reward: 2500,
    time: 300,
  },
  {
    id: 5,
    title: 'Casino Vault Run',
    chapter: 'CHAPTER 5/5',
    brief: 'Mara: "Uang sudah di tangan. Kabur ke garasi Benny — semua polisi kota mengejarmu!"',
    objective: 'Kabur ke Garasi Benny dengan wanted 5',
    reward: 5000,
    time: 240,
  },
];

export function makeMissions(scene, rng, city, hooks) {
  // hooks: { onMessage(text), onDone(mission), onStart(mission), onObjective(text),
  //         onChapter(chapter, title), spawnThugs(pos, count), startChase,
  //         startEscape, startFinale }
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 16, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const arrowGeo = new THREE.ConeGeometry(1.1, 2.4, 4);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  const arrow = new THREE.Mesh(arrowGeo, arrowMat);
  arrow.rotation.x = Math.PI;
  arrow.visible = false;
  scene.add(arrow);

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

  function current() { return MISSIONS[m.index] ?? null; }

  function setMarker(x, z) {
    m.marker = { x, z };
    beacon.position.set(x, 20, z);
    beacon.visible = true;
    arrow.position.set(x, 9, z);
    arrow.visible = true;
  }
  function hideMarker() {
    m.marker = null;
    beacon.visible = false;
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
    if (i === 1) hooks.startChase();
    if (i === 2) hooks.startEscape();
    if (i === 3) setMarker(city.casino.x, city.casino.z);
    if (i === 4) {
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
    m.phase = m.index >= MISSIONS.length ? 'done' : 'idle';
    if (m.phase === 'done') {
      m.done = true;
      hooks.onMessage('CERITA SELESAI — Daz, Mara dan Benny bebas. Porto Azul milik kalian. (R untuk main lagi)');
    } else {
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

  // One win-check per chapter, in story order.
  const STEPS = [
    // 1 — delivery: reach the casino.
    (ctx) => {
      if (dist2(ctx.player.x, ctx.player.z, city.casino.x, city.casino.z) < 100) {
        hooks.onMessage('Paket diserahkan. Benny: "Bagus. Ada kerjaan lagi buatmu."');
        complete();
      }
    },
    // 2 — chase: stay close to Tono's red Comet for 3 seconds (the
    // proximity timer lives in update, this step only tracks the marker).
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
    // 3 — escape: lose the heat entirely.
    (ctx) => {
      if (ctx.police.state.wanted === 0) {
        hooks.onMessage('Polisi kehilangan jejakmu. Mara: "Bersih. Lanjutkan."');
        complete();
      }
    },
    // 4 — vault: beat the guards, then grab the cash.
    (ctx) => {
      if (!m.thugsSpawned) {
        m.thugsSpawned = true;
        hooks.spawnThugs({ x: city.casino.x, z: city.casino.z }, 4);
        hooks.onMessage('Penjaga kasino menghadang! Kalahkan mereka.');
      }
      if (m.thugsLeft <= 0 && m.thugsSpawned && ctx.thugsDefeated && !m.vaultTaken) {
        m.vaultTaken = true;
        setMarker(city.casino.x + 12, city.casino.z + 8);
        hooks.onObjective('Ambil uang brankas di Casino Royale');
        hooks.onMessage('Kasino bersih. Ambil uang brankasnya.');
      } else if (m.vaultTaken && dist2(ctx.player.x, ctx.player.z, city.casino.x + 12, city.casino.z + 8) < 36) {
        hooks.onMessage('Uang brankas di tangan. Benny: "Cantik. Sekarang hilang."');
        complete();
      }
    },
    // 5 — finale: reach Benny's garage.
    (ctx) => {
      if (dist2(ctx.player.x, ctx.player.z, city.garage.x, city.garage.z) < 120) {
        hooks.onMessage('Daz sampai di garasi Benny. Semua polisi kehilangan jejak.');
        ctx.police.clearWanted();
        complete();
      }
    },
  ];

  return {
    m,
    current,
    start,
    complete,
    fail,
    setMarker,
    hideMarker,
    get marker() { return m.marker; },
    get done() { return m.done; },
    update(dt, ctx) {
      m.t += dt;
      if (beacon.visible) {
        beacon.rotation.y += dt * 0.8;
        arrow.position.y = 9 + Math.sin(m.t * 3) * 0.8;
      }
      if (m.phase !== 'active') return;
      const cur = current();
      // mission timer: run out and the job fails
      m.timeLeft -= dt;
      if (m.timeLeft <= 0) {
        m.timeLeft = 0;
        if (!(m.index === 1 && ctx.chaseTarget && ctx.chaseTarget.escaped)) {
          fail('Waktu habis!');
          return;
        }
      }
      // chase proximity timer lives here so the STEPS table stays pure
      if (m.index === 1 && ctx.chaseTarget && !ctx.chaseTarget.escaped) {
        const d = Math.hypot(ctx.player.x - ctx.chaseTarget.x, ctx.player.z - ctx.chaseTarget.z);
        if (d < 8) {
          m.chaseTime += dt;
          if (m.chaseTime > 3) {
            hooks.onMessage('Tono tertangkap! Uang kembali ke tangan Mara.');
            ctx.removeChaseTarget();
            complete();
            return;
          }
        } else {
          m.chaseTime = Math.max(0, m.chaseTime - dt * 0.5);
        }
      }
      const step = STEPS[m.index];
      if (step) step(ctx);
    },
    onThugDown() {
      m.thugsLeft = Math.max(0, m.thugsLeft - 1);
      if (m.thugsLeft === 0) hooks.onMessage('Semua penjaga tumbang.');
    },
  };
}
