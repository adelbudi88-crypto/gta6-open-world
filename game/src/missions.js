// Story + missions for Porto Azul. Dario "Daz" Kosta, a driver for hire,
// takes jobs from Mara — four chained missions with a clear objective each.
// Missions are data + a small state machine; the game wires the callbacks.
import * as THREE from 'three';
import { dist2 } from './rng.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'Paket untuk Mara',
    brief: 'Mara: "Antar paket ini ke Plaza Torre Azul. Jangan dibuka, jangan telat."',
    objective: 'Antar paket ke Plaza Torre Azul',
    reward: 150,
  },
  {
    id: 2,
    title: 'Kejar si Pengkhianat',
    brief: 'Mara: "Tono kabur bawa uang kita. Kejar mobil merahnya, jangan sampai lolos!"',
    objective: 'Kejar mobil merah Tono sampai dekat',
    reward: 250,
  },
  {
    id: 3,
    title: 'Kabur dari Razia',
    brief: 'Mara: "Polisi mengendus kita. Hilang dari radar mereka — jangan ketangkap!"',
    objective: 'Lolos dari polisi sampai wanted hilang',
    reward: 300,
  },
  {
    id: 4,
    title: 'Pertemuan di Dermaga',
    brief: 'Mara: "Terakhir: bereskan penjaga dermaga, lalu temui aku. Setelah ini kita bebas."',
    objective: 'Kalahkan 3 penjaga dermaga, lalu temui Mara',
    reward: 500,
  },
];

export function makeMissions(scene, rng, city, hooks) {
  // hooks: { onMessage(text), onDone(mission), onStart(mission), onObjective(text),
  //         spawnThugs(pos), targetCar API via ctx }
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
    meetMara: false,
    done: false,
    t: 0,
  };

  function current() { return MISSIONS[m.index] ?? null; }

  function setMarker(x, z) {
    m.marker = { x, z };
    beacon.position.set(x, 20, z);
    beacon.visible = true;
    arrow.position.set(x, 9, z);
    arrow.visible = true;
  }
  function hideMarker() { m.marker = null; beacon.visible = false; arrow.visible = false; }

  function start(i) {
    m.index = i;
    m.phase = 'active';
    m.chaseTime = 0;
    m.thugsLeft = 0;
    m.thugsSpawned = false;
    m.meetMara = false;
    const cur = current();
    hooks.onObjective(cur.objective);
    hooks.onMessage(`${cur.title} — ${cur.brief}`);
    hooks.onStart(cur);
    if (i === 0) setMarker(city.plaza.x, city.plaza.z);
    if (i === 1) hooks.startChase();
    if (i === 2) hooks.startEscape();
    if (i === 3) setMarker(city.plaza.x - 60, -240); // dermaga di tepi laut utara
  }

  function complete() {
    const cur = current();
    hooks.onDone(cur);
    hideMarker();
    m.index++;
    m.phase = m.index >= MISSIONS.length ? 'done' : 'idle';
    if (m.phase === 'done') {
      m.done = true;
      hooks.onMessage('CERITA SELESAI — Daz dan Mara bebas. Porto Azul milik kalian. (R untuk main lagi)');
    } else {
      setTimeout(() => start(m.index), 1200);
    }
  }

  return {
    m,
    current,
    start,
    complete,
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
      const px = ctx.player.x, pz = ctx.player.z;
      if (m.index === 0) {
        if (dist2(px, pz, city.plaza.x, city.plaza.z) < 100) {
          hooks.onMessage('Paket diserahkan. Mara: "Bagus. Ada kerjaan lagi buatmu."');
          complete();
        }
      } else if (m.index === 1) {
        const target = ctx.chaseTarget;
        if (!target) { complete(); return; }
        if (target.escaped) {
          hooks.onMessage('Tono lolos... Mara: "Sial. Kita coba lagi lain kali."');
          ctx.removeChaseTarget();
          hideMarker();
          m.index++;
          m.phase = 'idle';
          setTimeout(() => start(m.index), 1200);
          return;
        }
        const d = Math.hypot(px - target.x, pz - target.z);
        if (d < 8) {
          m.chaseTime += dt;
          if (m.chaseTime > 3) {
            hooks.onMessage('Tono tertangkap! Uang kembali ke tangan Mara.');
            ctx.removeChaseTarget();
            complete();
          }
        } else {
          m.chaseTime = Math.max(0, m.chaseTime - dt * 0.5);
        }
        if (target) setMarker(target.x, target.z);
      } else if (m.index === 2) {
        if (ctx.police.state.wanted === 0) {
          hooks.onMessage('Polisi kehilangan jejakmu. Mara: "Bersih. Lanjutkan."');
          complete();
        }
      } else if (m.index === 3) {
        if (!m.thugsSpawned) {
          m.thugsSpawned = true;
          hooks.spawnThugs({ x: city.plaza.x - 60, z: -240 });
          hooks.onMessage('Penjaga dermaga menghadang! Kalahkan mereka.');
        }
        if (m.thugsLeft <= 0 && m.thugsSpawned && ctx.thugsDefeated) {
          if (!m.meetMara) {
            m.meetMara = true;
            setMarker(city.plaza.x, city.plaza.z);
            hooks.onObjective('Temui Mara di Plaza Torre Azul');
            hooks.onMessage('Dermaga bersih. Temui Mara di plaza.');
          } else if (dist2(px, pz, city.plaza.x, city.plaza.z) < 100) {
            complete();
          }
        }
      }
    },
    onThugDown() {
      m.thugsLeft = Math.max(0, m.thugsLeft - 1);
      if (m.thugsLeft === 0) hooks.onMessage('Semua penjaga tumbang.');
    },
  };
}
