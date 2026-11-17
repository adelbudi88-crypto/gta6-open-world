// Bootstrap and loop for Porto Azul II. Wires the modules into one shared
// world object, runs input, the camera and the frame loop, and exposes the
// test API the acceptance runner drives.
import * as THREE from 'three';
import { makeRng, clamp, angleDiff, fmtTimer } from './rng.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createVehicles, KMH } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { applyShot } from './shots.js';
import { loadSave, storeSave } from './save.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1438);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const W = {
  scene, camera, renderer,
  rng: makeRng(seed),
  S: {
    time: 0, clockMin: 19 * 60 + 7, day: 1,
    started: false, paused: false, over: null,
    engine: 0, shot: shotName, seed, missionIndex: 0,
  },
  camYaw: Math.PI,
  input: { up: false, down: false, left: false, right: false, sprint: false, brake: false },
  errors: [],
};
window.addEventListener('error', (e) => { if (W.errors.length < 20) W.errors.push(String(e.message || e.error)); });
window.addEventListener('unhandledrejection', (e) => { if (W.errors.length < 20) W.errors.push('reject: ' + String(e.reason)); });

// Modules, in dependency order.
W.audio = createAudio();
W.city = createCity(scene, W.rng);
W.vehicles = createVehicles(W);
W.peds = createPeds(W);
W.player = createPlayer(W);
W.police = createPolice(W);
W.hud = createHud(W);
W.missions = createMissions(W);

// Restore a previous campaign.
const saved = loadSave();
if (saved) {
  W.player.setStats({ cash: saved.cash || 0, respect: saved.respect || 0 });
  W.S.engine = saved.engine || 0;
  W.S.missionIndex = Math.min(saved.mission || 0, 4);
  W.player.addRespect(0);
}

W.saveNow = () => {
  storeSave({
    cash: W.player.cash, respect: W.player.respect,
    engine: W.S.engine, mission: W.missions.index,
  });
};

W.startGame = () => {
  if (W.S.started) return;
  W.S.started = true;
  W.hud.hideStart();
  W.audio.unlock();
  W.audio.startMusic();
  if (!W.missions.active && !W.missions.done) W.missions.start(W.S.missionIndex);
};

function buyEngine() {
  const P = W.player;
  const cost = 500 * (W.S.engine + 1);
  const near = Math.hypot(P.x - W.city.garage.x, P.z - W.city.garage.z) < 12;
  if (!near) { W.hud.showToast('Go to Benny\u2019s Garage to upgrade'); return; }
  if (W.S.engine >= 3) { W.hud.showToast('Engine already maxed'); return; }
  if (P.cash < cost) { W.hud.showToast('NOT ENOUGH CASH — need $' + cost); return; }
  P.cash -= cost;
  W.S.engine += 1;
  W.audio.upgrade();
  W.hud.showToast('ENGINE LV ' + W.S.engine + ' INSTALLED');
  W.saveNow();
}

function resetAfterOver() {
  const P = W.player;
  W.S.over = null;
  W.hud.hideEnd();
  P.dead = false;
  P.health = 100;
  P.armour = 0;
  if (P.inCar) P.exitCar();
  P.teleport(W.city.garage.x, W.city.garage.z + 12, Math.PI);
  W.police.clearAll();
  W.camYaw = Math.PI;
}

// ---- Input ----
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'brake',
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] != null) { W.input[KEYMAP[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'Enter') {
    if (W.S.over) resetAfterOver();
    else W.startGame();
  }
  if (e.code === 'KeyP' && W.S.started) {
    W.S.paused = !W.S.paused;
    document.getElementById('overlay-pause').classList.toggle('hidden', !W.S.paused);
    W.hud.showToast(W.S.paused ? 'PAUSED' : 'RESUMED');
  }
  if (e.code === 'KeyM') { W.audio.setMuted(!W.audio.isMuted()); }
  if (e.code === 'KeyC') { W.audio.cycleStation(); W.hud.showToast(W.audio.stationName()); }
  if (e.code === 'KeyR') W.player.reload();
  if (e.code === 'KeyG') buyEngine();
  if (e.code === 'KeyE' && W.S.started && !W.S.over) {
    if (W.player.inCar) W.player.exitCar();
    else W.player.tryEnterCar();
  }
  if (e.code === 'KeyF' && W.S.started && !W.S.over) {
    W.player.punch([...W.missions.guards, ...W.police.footCops]);
  }
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] != null) W.input[KEYMAP[e.code]] = false;
});

let dragging = false, lastX = 0, lastY = 0, moved = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
  W.audio.unlock();
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  moved += Math.abs(dx) + Math.abs(dy);
  W.camYaw -= dx * 0.005;
  W.camYaw = ((W.camYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  void dy;
});
window.addEventListener('pointerup', () => {
  if (dragging && moved < 6 && W.S.started && !W.S.paused && !W.S.over) {
    W.player.shoot([...W.missions.guards, ...W.police.footCops]);
  }
  dragging = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.getElementById('overlay-start').addEventListener('click', () => W.startGame());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Camera ----
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const P = W.player;
  if (!W.S.shot && P.inCar && P.car) {
    const dh = angleDiff(W.camYaw, P.car.heading);
    W.camYaw += dh * Math.min(1, dt * 2.2);
  }
  const dist = P.inCar ? 10.5 : 8.5;
  const height = P.inCar ? 4.4 : 3.8;
  const tx = P.x - Math.sin(W.camYaw) * dist;
  const tz = P.z - Math.cos(W.camYaw) * dist;
  const k = Math.min(1, dt * 5);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camTarget.set(P.x + Math.sin(W.camYaw) * 6, 1.6, P.z + Math.cos(W.camYaw) * 6);
  camera.lookAt(camTarget);
}

// ---- Test API ----
let firstFrame = false;
window.__game = {
  version: '2.4.0',
  get ready() { return firstFrame; },
  S: W.S,
  player: W.player,
  vehicles: W.vehicles,
  missions: W.missions,
  police: W.police,
  stats() {
    const P = W.player;
    const a = W.missions.active;
    return {
      time: +W.S.time.toFixed(2),
      mission: a ? a.def.chapter : 0,
      phase: a ? a.phase : null,
      cops: W.police.copCars.length,
      footCops: W.police.footCops.length,
      heli: W.police.stars() >= 4,
      traffic: W.vehicles.traffic.length,
      peds: W.peds.list.length,
      errors: W.errors.length,
      cam: { x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(1), z: +camera.position.z.toFixed(1) },
      car: P.car ? { name: P.car.model.name, x: +P.car.x.toFixed(1), z: +P.car.z.toFixed(1), heading: +P.car.heading.toFixed(2), speed: +P.car.speed.toFixed(2) } : null,
      hud: {
        cash: '$' + Math.floor(P.cash).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
        chapter: a ? 'CHAPTER ' + a.def.chapter + '/5' : '',
        chapterVisible: !!document.querySelector('#hud-chapter.show'),
        wanted: W.police.stars() >= 5 ? 'MOST WANTED' : 'WANTED ' + W.police.stars() + '/5',
        weapon: 'HORNET SMG  ' + P.mag + ' / ' + P.reserve,
        district: W.city.districtAt(P.x, P.z).name,
        speed: String(Math.round((P.car ? Math.abs(P.car.speed) : 0) * KMH)),
        timer: a && a.timeLeft > 0 ? fmtTimer(a.timeLeft) : '',
        radio: W.audio.stationName(),
      },
    };
  },
  errors() { return W.errors.slice(); },
  teleport(x, z) { W.player.teleport(x, z, W.player.heading); },
  setHour(h) { W.S.clockMin = h * 60; },
  reset() { location.reload(); },
  keys(obj) { Object.assign(W.input, obj); },
  press(code, ms = 120) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    return new Promise((res) => setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      res(true);
    }, ms));
  },
};

// ---- Shot staging ----
if (shotName && ['drive', 'foot', 'chase', 'mission'].includes(shotName)) {
  applyShot(W, shotName, seed);
  if (shotName === 'drive' || shotName === 'chase') W.camYaw = Math.PI;
} else {
  W.hud.showStart();
}

// ---- Loop ----
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (!W.S.paused) {
    W.S.time += dt;
    if (!W.S.shot) W.S.clockMin += dt * 0.5;
    const threat = W.player.inCar && W.player.car ? { x: W.player.car.x, z: W.player.car.z } : null;
    W.player.update(dt, W.input);
    W.vehicles.update(dt);
    W.peds.update(dt, W.S.time, threat);
    W.police.update(dt, W.S.time);
    W.missions.update(dt);
    W.city.update(W.S.time);
  }
  W.hud.update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  firstFrame = true;
}
requestAnimationFrame(frame);
