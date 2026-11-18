// Porto Azul II — main loop, camera, input, wanted system, save, shot mode.
import * as THREE from 'three';
import { makeRng, clamp, lerp } from './rng.js';
import { buildCity, districtAt } from './city.js';
import { makeCar, Traffic, gearForSpeed } from './vehicles.js';
import { Peds } from './peds.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // drive | foot | chase | mission
const SEED = Number(params.get('seed') || 1337);

const rng = makeRng(SEED);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 8, 14);

const city = buildCity(scene, rng);
const traffic = new Traffic(scene, rng);
const peds = new Peds(scene, rng);
const police = new Police(scene);
const player = new Player(scene);
const missions = new MissionManager();
const hud = new Hud();
const audio = new AudioEngine();

// Parked stealable cars.
const comet = makeCar(0xffc21c);
comet.position.set(4, 0, -44);
comet.rotation.y = Math.PI;
scene.add(comet);
const runner = makeCar(0x22e6ff);
runner.position.set(56, 0, 30);
runner.rotation.y = Math.PI / 2;
scene.add(runner);
// Tono's red car, used by the drive shot.
const tonoCar = makeCar(0xc23b2e);
tonoCar.position.set(0, 0, -72);
tonoCar.rotation.y = Math.PI;
tonoCar.visible = false;
scene.add(tonoCar);

const saved = loadSave();
const state = {
  cash: saved?.cash ?? 0,
  wanted: 0,
  health: saved?.health ?? 100,
  armour: saved?.armour ?? 50,
  respect: saved?.respect ?? 1,
  weapon: { name: 'HORNET SMG', ammo: 30, reserve: 120 },
  speedKmh: 0,
  gear: 0,
  carName: '',
  radio: audio.stationName(),
  district: 'TORRE PLAZA',
  flavor: 'NEON, NOISE AND NO WAY OUT',
  timer: missions.timer,
  day: 1,
  clock: '19:02',
  onFoot: true,
  px: 0, pz: 0, heading: Math.PI,
  showBanner: false,
};
if (saved?.missionIndex != null) {
  missions.index = Math.min(saved.missionIndex, MISSIONS.length - 1);
  missions.timer = missions.current.duration;
}
player.health = state.health;
player.armour = state.armour;
player.pos.set(0, 0, 6);
player.mesh.position.copy(player.pos);

const world = {
  scene, camera, state, player, traffic, peds, police, missions, hud, city,
  tonoCar, frozen: false, shotCamera: null, started: false,
  makePlayerCar: (color) => makeCar(color),
  updateCamera,
};
window.__world = world;

const input = { forward: false, back: false, left: false, right: false, run: false };
const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};
addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] != null) input[KEYMAP[e.code]] = true;
  if (e.code === 'KeyC') { audio.ensure(); state.radio = audio.stationName(); }
  if (e.code === 'KeyM') audio.setMuted(true);
  if (e.code === 'Space') shoot();
  if (e.code === 'KeyE') toggleCar();
  if (e.code === 'Enter') startGame();
});
addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] != null) input[KEYMAP[e.code]] = false;
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function nearestCar(maxDist) {
  let best = null;
  let bd = maxDist;
  for (const [mesh, name] of [[comet, 'Comet GT'], [runner, 'Neon Runner']]) {
    if (mesh === player.car) continue;
    const d = Math.hypot(mesh.position.x - player.pos.x, mesh.position.z - player.pos.z);
    if (d < bd) { bd = d; best = [mesh, name]; }
  }
  return best;
}

function toggleCar() {
  if (!world.started && !SHOT) return;
  if (player.car) { player.exitCar(); return; }
  const found = nearestCar(5);
  if (found) {
    const [mesh, name] = found;
    player.enterCar(mesh, name);
    audio.ensure();
  }
}

function shoot() {
  if (!world.started && !SHOT) return;
  if (player.weapon.ammo <= 0) return;
  player.weapon.ammo -= 1;
  state.wanted = clamp(state.wanted + 1, 0, 5);
  const el = document.getElementById('hud-flash');
  if (el) {
    el.style.opacity = '0.5';
    setTimeout(() => { el.style.opacity = '0'; }, 90);
  }
}

function startGame() {
  world.started = true;
  const title = document.getElementById('title-screen');
  if (title) title.style.display = 'none';
  audio.ensure();
  missions.startBanner(clockNow());
  state.showBanner = true;
}
document.getElementById('start-btn')?.addEventListener('click', startGame);

function updateCamera(snap) {
  const spec = world.shotCamera || { dist: 13, height: 5, lookAhead: 10 };
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  const px = player.pos.x;
  const pz = player.pos.z;
  const tx = px - fx * spec.dist;
  const tz = pz - fz * spec.dist;
  const ty = spec.height;
  if (snap) {
    camera.position.set(tx, ty, tz);
  } else {
    camera.position.x = lerp(camera.position.x, tx, 0.12);
    camera.position.y = lerp(camera.position.y, ty, 0.12);
    camera.position.z = lerp(camera.position.z, tz, 0.12);
  }
  camera.lookAt(px + fx * spec.lookAhead, 1.6, pz + fz * spec.lookAhead);
}

const clock = new THREE.Clock();
let elapsed = 0;
let frames = 0;
let saveTimer = 0;
let bannerTimer = 0;

function clockNow() { return elapsed; }

function syncState() {
  state.px = player.pos.x;
  state.pz = player.pos.z;
  state.heading = player.heading;
  state.speedKmh = player.speedKmh;
  state.gear = player.gear;
  state.onFoot = player.onFoot;
  state.carName = player.carName;
  state.health = player.health;
  state.armour = player.armour;
  state.weapon = player.weapon;
  state.timer = missions.timer;
  const d = districtAt(player.pos.x, player.pos.z);
  state.district = d.name;
  state.flavor = d.flavor;
  if (!world.frozen) {
    const mins = 19 * 60 + 2 + Math.floor(elapsed / 10);
    state.clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  frames += 1;

  if (!world.frozen) {
    player.update(dt, input, false);
    traffic.update(dt);
    peds.update(dt, elapsed);
    police.update(dt, elapsed, player.pos, state.wanted);
    missions.update(dt, elapsed, state);
    // Wanted decays when the player is slow and out of sight; rises at speed.
    if (state.wanted > 0 && player.speedKmh < 30) state.wanted = Math.max(0, state.wanted - dt * 0.05);
    if (!player.onFoot && player.speedKmh > 110 && state.wanted < 2) state.wanted = 2;
    // Cops leaning on the player hurt.
    if (state.wanted > 0) {
      for (const c of police.cars) {
        const d = Math.hypot(c.mesh.position.x - player.pos.x, c.mesh.position.z - player.pos.z);
        if (d < 7 && player.takeDamage(dt * 3)) busted();
      }
    }
    // Mission target reached.
    const t = missions.current.target;
    if (!missions.finished && Math.hypot(t.x - player.pos.x, t.z - player.pos.z) < 9) {
      const payout = missions.complete(state, elapsed);
      const toast = document.getElementById('hud-toast');
      if (toast && payout > 0) {
        toast.textContent = `MISSION COMPLETE — +$${payout.toLocaleString('en-US')}`;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 3500);
      }
    }
    // Banner fades after 4 seconds of play.
    bannerTimer += dt;
    if (bannerTimer > 4) state.showBanner = false;
    audio.setEngine(player.speedKmh, !player.onFoot);
    audio.setSiren(state.wanted >= 3);
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      writeSave({ cash: state.cash, respect: state.respect, missionIndex: missions.index, health: state.health, armour: state.armour });
    }
  }

  syncState();
  updateCamera(false);
  hud.update(state, world);
  renderer.render(scene, camera);

  if (SHOT && frames >= 4 && !window.__shotReady) {
    window.__shotReady = true;
  }
}

function busted() {
  state.cash = Math.max(0, state.cash - 500);
  player.health = 100;
  player.armour = 0;
  state.wanted = 0;
  player.pos.set(-30, 0, -30);
  player.mesh.position.copy(player.pos);
  if (player.car) player.exitCar();
  const toast = document.getElementById('hud-toast');
  if (toast) {
    toast.textContent = 'BUSTED — $500 bail, back on the street';
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3500);
  }
}

// Shot mode: hide the title, stage the shot, freeze the world.
if (SHOT) {
  world.started = true;
  const title = document.getElementById('title-screen');
  if (title) title.style.display = 'none';
  applyShot(world, SHOT);
}

tick();
