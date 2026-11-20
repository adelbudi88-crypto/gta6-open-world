// PORTO AZUL II v2.8 — entry point. Wires the city, vehicles, pedestrians,
// police, player, missions, HUD, radio and saves into one game loop.
// Shot mode (?shot=1..4) stages a frozen dossier frame instead of playing.
import * as THREE from 'three';
import { makeRng, WORLD_SEED } from './rng.js';
import { buildCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPolice } from './police.js';
import { createPlayer } from './player.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotNum = parseInt(params.get('shot') || '0', 10) || 0;

const state = {
  day: 1, minutes: 19 * 60 + 7, cash: 0, wanted: 0, respect: 1,
  missionIndex: 0, missionsDone: [], upgrades: { engine: 0, armour: 0, tires: 0 },
  bestWanted: 0, playerCar: 'comet',
};

const saved = !shotNum ? loadSave() : null;
if (saved) {
  state.cash = saved.cash;
  state.respect = saved.respect;
  state.missionIndex = saved.missionIndex;
  state.missionsDone = saved.missionsDone || [];
  state.upgrades = { engine: 0, armour: 0, tires: 0, ...saved.upgrades };
  state.bestWanted = saved.bestWanted || 0;
  state.playerCar = saved.car || 'comet';
  state.day = saved.day || 1;
}

const rng = makeRng(WORLD_SEED);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 600);

const world = {
  state, scene, camera, renderer, rng,
  frozen: false, cameraPose: null, audio: createAudio(),
  hud: null, player: null, missions: null, police: null,
  vehicles: null, peds: null, city: null, main: null,
};

world.city = buildCity(scene, rng);
world.vehicles = createVehicles(scene, rng);
world.peds = createPeds(scene, rng);
world.police = createPolice(scene, rng);
world.player = createPlayer(scene, rng, world);
world.hud = createHud();
world.missions = createMissions(world);

world.main = {
  wasted() {
    const p = world.player;
    world.hud.showBanner('WASTED', 'The cops got Daz. The garage patched him up — for a price.');
    state.cash = Math.floor(state.cash * 0.9);
    p.health = 100; p.armour = 0;
    world.police.setWanted(0, world);
    p.pos.x = 20; p.pos.z = 16;
    if (p.car) { p.car.mesh.position.set(20, 0, 16); p.car.angle = 0; p.car.speed = 0; p.car.mesh.rotation.y = 0; }
    else { p.mesh.position.set(20, 0, 16); }
    p.angle = 0;
  },
  buyUpgrade(kind) {
    const base = { engine: 5000, armour: 4000, tires: 3000 }[kind] || 3000;
    const level = state.upgrades[kind] || 0;
    if (level >= 3) { world.hud.flash(kind.toUpperCase() + ' ALREADY MAXED'); return; }
    const cost = base + level * 2000;
    if (state.cash < cost) { world.hud.flash('NOT ENOUGH CASH — ' + kind.toUpperCase() + ' LV' + (level + 1) + ' COSTS $' + cost.toLocaleString('en-US')); return; }
    state.cash -= cost;
    state.upgrades[kind] = level + 1;
    if (kind === 'armour') world.player.armour = Math.min(100, 25 * state.upgrades.armour);
    if (kind === 'tires' && world.player.car) world.player.car.accel += 3;
    world.hud.flash(kind.toUpperCase() + ' LV' + state.upgrades[kind] + ' INSTALLED — $' + cost.toLocaleString('en-US'));
    world.hud.update(world);
    saveGame(state);
    world.hud.saved();
  },
};

function updateCamera() {
  if (world.cameraPose) {
    camera.position.set(world.cameraPose.pos[0], world.cameraPose.pos[1], world.cameraPose.pos[2]);
    camera.lookAt(world.cameraPose.look[0], world.cameraPose.look[1], world.cameraPose.look[2]);
    return;
  }
  const p = world.player;
  const back = p.onFoot ? 7 : 10.5;
  const h = p.onFoot ? 3.2 : 4.4;
  const fx = Math.cos(p.angle), fz = -Math.sin(p.angle);
  camera.position.set(p.pos.x - fx * back, h, p.pos.z - fz * back);
  camera.lookAt(p.pos.x + fx * 8, 1.4, p.pos.z + fz * 8);
}
world.updateCamera = updateCamera;

// Input.
const keys = {};
const input = { forward: false, back: false, left: false, right: false, run: false };
let wheelHeld = false;
function syncInput() {
  input.forward = !!(keys.KeyW || keys.ArrowUp);
  input.back = !!(keys.KeyS || keys.ArrowDown);
  input.left = !!(keys.KeyA || keys.ArrowLeft);
  input.right = !!(keys.KeyD || keys.ArrowRight);
  input.run = !!(keys.ShiftLeft || keys.ShiftRight);
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  syncInput();
  world.audio.ensure();
  if (e.code === 'KeyE') world.player.tryEnterOrJack();
  if (e.code === 'KeyQ') { wheelHeld = true; world.hud.showWheel(true, world.player.weapon); }
  if (e.code === 'Digit1') world.player.selectWeapon('pistol');
  if (e.code === 'Digit2') world.player.selectWeapon('smg');
  if (e.code === 'Digit3') world.player.selectWeapon('shotgun');
  if (e.code === 'KeyC') { world.audio.nextStation(); world.audio.start(); }
  if (e.code === 'KeyM' && !world.missions.active) world.missions.start(world.missions.index);
  if (e.code === 'KeyF') world.player.fire();
  if (e.code === 'KeyG') {
    const g = world.city.garagePos;
    const near = Math.hypot(world.player.pos.x - g.x, world.player.pos.z - g.z) < 16;
    if (near) {
      const panel = document.getElementById('garage');
      world.hud.showGarage(!(panel && panel.classList.contains('show')));
    }
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  syncInput();
  if (e.code === 'KeyQ') { wheelHeld = false; world.hud.showWheel(false, world.player.weapon); }
});
renderer.domElement.addEventListener('mousedown', () => {
  world.audio.ensure();
  if (!world.player.onFoot) return;
  world.player.fire();
});
document.querySelectorAll('#garage button[data-upgrade]').forEach((btn) => {
  btn.addEventListener('click', () => world.main.buyUpgrade(btn.dataset.upgrade));
});
document.getElementById('garage-close').addEventListener('click', () => world.hud.showGarage(false));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start screen / shot mode.
const startScreen = document.getElementById('start-screen');
if (shotNum) {
  if (startScreen) startScreen.style.display = 'none';
} else {
  document.getElementById('start-btn').addEventListener('click', () => {
    world.audio.ensure();
    world.audio.start();
    startScreen.style.display = 'none';
    if (!world.missions.active) world.missions.start(state.missionIndex);
    world.hud.update(world);
  });
}

// Starting position: Benny's Garage.
world.player.pos.x = 20;
world.player.pos.z = 30;
world.player.angle = Math.PI / 2;
world.player.mesh.position.set(20, 0, 30);
if (!shotNum && saved) world.player.spawnCar(state.playerCar);

let saveTimer = 0;
let decayTimer = 0;
const clock = new THREE.Clock();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!world.frozen) {
    state.minutes += dt * 0.05;
    world.player.update(dt, input);
    world.vehicles.update(dt, false);
    world.peds.update(dt, false);
    world.police.update(dt, world);
    world.city.update(dt);
    world.missions.update(dt);
    // Mission complete when the player reaches the target.
    if (world.missions.active && world.missions.atTarget()) world.missions.complete();
    // Wanted decays when the heat dies down.
    if (state.wanted > 0) {
      const nearCop = world.police.cops.some((c) => c.active && Math.hypot(c.mesh.position.x - world.player.pos.x, c.mesh.position.z - world.player.pos.z) < 40);
      if (!nearCop) {
        decayTimer += dt;
        if (decayTimer > 25) { decayTimer = 0; world.police.setWanted(state.wanted - 1, world); }
      } else decayTimer = 0;
    }
    if (world.player.health <= 0) world.main.wasted();
    saveTimer += dt;
    if (saveTimer > 20) { saveTimer = 0; saveGame(state); world.hud.saved(); }
    world.audio.setEngineRpm(world.player.onFoot ? 0 : Math.min(1, (world.player.speedKmh || 0) / 160));
    world.hud.update(world);
  }
  updateCamera();
  renderer.render(scene, camera);
}
loop();

if (shotNum) {
  // One staged frame, then signal the capture tool.
  requestAnimationFrame(() => {
    try {
      applyShot(world, shotNum);
    } catch (err) {
      window.__shotError = String(err && err.message || err);
    }
  });
}
window.__world = world;
