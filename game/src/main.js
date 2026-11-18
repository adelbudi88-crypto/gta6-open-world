// Porto Azul II — bootstrap, game loop, input, camera, title screen,
// busted/respawn, garage, mission flow and shot mode.
import * as THREE from 'three';
import { buildCity, districtAt } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, 30);

const city = buildCity(scene);
const vehicles = createVehicles(scene);
const peds = createPeds(scene);
const player = createPlayer(scene);
const police = createPolice(scene);
const missions = createMissions();
const hud = createHud();
const audio = createAudio();

const world = {
  scene, camera, renderer, city, vehicles, peds, player, police, missions, hud, audio,
  frozen: false,
  day: 1,
  clockMinutes: 19 * 60 + 7,
  started: false,
  updateCamera,
  hudState,
};

const saved = loadSave();
if (saved) {
  player.state.cash = saved.cash || 0;
  player.state.respect = saved.respect || 1;
  player.state.upgrades = saved.upgrades || { engine: 0, armour: 0, handling: 0 };
  world.day = saved.day || 1;
  if (typeof saved.chapter === 'number') missions.setChapter(saved.chapter, 300);
  player.state.armour = 50 + player.state.upgrades.armour * 25;
}

// Starter ride: a Comet GT parked at Torre Plaza.
const starterCar = player.spawnCar('Comet GT', 0x2a6ad8, 4, 14, Math.PI);
let nearCar = starterCar;

const input = { forward: false, back: false, left: false, right: false, boost: false };
const keyMap = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
};

function hudState() {
  const st = player.state;
  const dist = world.districtOverride || districtAt(st.pos.x, st.pos.z);
  const garageDist = Math.hypot(st.pos.x - city.garagePos.x, st.pos.z - city.garagePos.z);
  return {
    pos: st.pos,
    heading: st.heading,
    district: dist,
    mission: missions.current,
    missionActive: missions.active,
    timeLeft: missions.timeLeft,
    banner: missions.banner,
    bannerSub: missions.bannerSub,
    bannerVisible: missions.bannerVisible,
    day: world.day,
    clockMinutes: world.clockMinutes,
    cash: st.cash,
    wanted: police.wanted,
    mostWanted: police.mostWanted,
    health: st.health,
    armour: st.armour,
    respect: st.respect,
    weapon: st.weapon,
    speedKmh: st.speedKmh,
    onFoot: st.onFoot,
    carName: st.carName,
    station: audio.station,
    nearGarage: garageDist < 18,
    traffic: vehicles.traffic,
    policeCars: police.pursuit,
    missionDest: missions.dest(),
  };
}

function updateCamera() {
  const st = player.state;
  if (st.onFoot) {
    const back = 7;
    const hx = Math.sin(st.heading);
    const hz = Math.cos(st.heading);
    camera.position.set(st.pos.x - hx * back, 3.4, st.pos.z - hz * back);
    camera.lookAt(st.pos.x + hx * 6, 1.6, st.pos.z + hz * 6);
  } else if (st.car) {
    const h = st.car.rotation.y;
    const hx = Math.sin(h);
    const hz = Math.cos(h);
    const speedFactor = Math.min(1, st.speedKmh / 140);
    const back = 10 + speedFactor * 3;
    camera.position.set(st.pos.x - hx * back, 4.6 + speedFactor, st.pos.z - hz * back);
    camera.lookAt(st.pos.x + hx * 10, 1.4, st.pos.z + hz * 10);
  }
}

function nearestCar(maxDist) {
  const st = player.state;
  const cars = [starterCar, vehicles.tono, ...vehicles.traffic.map((c) => c.mesh)];
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (!car.visible) continue;
    const d = Math.hypot(car.position.x - st.pos.x, car.position.z - st.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function buyUpgrade(kind, cost) {
  const st = player.state;
  if (st.cash < cost) return;
  if (st.upgrades[kind] >= 3) return;
  st.cash -= cost;
  st.upgrades[kind] += 1;
  if (kind === 'armour') st.armour = 50 + st.upgrades.armour * 25;
  audio.payout();
  saveGame({ cash: st.cash, respect: st.respect, chapter: missions.index, upgrades: st.upgrades, day: world.day });
}

window.addEventListener('keydown', (e) => {
  if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    if (world.started && player.shoot()) {
      audio.shoot();
      police.raise(1);
    }
  }
  if (e.code === 'KeyE' && world.started) {
    if (player.state.onFoot) {
      const car = nearestCar(6);
      if (car) {
        player.enterCar(car, car.userData.carName || 'Street Car');
        audio.start();
      }
    } else {
      player.exitCar();
    }
  }
  if (e.code === 'KeyC') {
    audio.nextStation();
  }
  if (e.code === 'KeyM' && world.started && !missions.active) {
    missions.startNext();
  }
  if (e.code === 'KeyG' && world.started) {
    const st = player.state;
    const d = Math.hypot(st.pos.x - city.garagePos.x, st.pos.z - city.garagePos.z);
    if (d < 18) buyUpgrade('engine', 5000);
  }
  if (e.code === 'KeyR') {
    player.state.pos.set(0, 0, 20);
    player.state.mesh.position.set(0, 0, 20);
    player.heal();
    police.setWanted(0);
    player.resetSpeed();
  }
  if (e.code === 'Enter' && !world.started) startGame();
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = false;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('start-btn').addEventListener('click', startGame);

function startGame() {
  world.started = true;
  document.getElementById('title').style.display = 'none';
  audio.start();
  if (!missions.active) missions.start(0);
}

const clock = new THREE.Clock();
let saveTimer = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (world.frozen) {
    renderer.render(scene, camera);
    return;
  }
  if (world.started) {
    if (player.state.onFoot) player.walk(dt, input);
    else player.drive(dt, input);
    // Mission destination check.
    if (missions.active) {
      const dest = missions.dest();
      const d = Math.hypot(player.state.pos.x - dest[0], player.state.pos.z - dest[1]);
      if (d < 12) {
        const payout = missions.complete(player);
        if (payout > 0) {
          audio.payout();
          police.lower(2);
          saveGame({ cash: player.state.cash, respect: player.state.respect, chapter: missions.index, upgrades: player.state.upgrades, day: world.day });
        }
      } else {
        const status = missions.tick(dt);
        if (status === 'failed') police.raise(1);
      }
    }
    // Speeding in the city draws heat.
    if (!player.state.onFoot && player.state.speedKmh > 110) police.raise(0);
    if (player.state.busted) {
      missions.fail('BUSTED — THE COPS GOT YOU');
      player.state.pos.set(0, 0, 20);
      player.state.mesh.position.set(0, 0, 20);
      player.heal();
      police.setWanted(0);
      player.resetSpeed();
      if (player.state.car) {
        player.state.car.visible = false;
        player.state.car = null;
      }
      player.state.mesh.visible = true;
      player.state.onFoot = true;
    }
    // Clock advances slowly through the evening.
    world.clockMinutes += dt * 0.35;
    if (world.clockMinutes >= 24 * 60) { world.clockMinutes -= 24 * 60; world.day += 1; }
    audio.engine(player.state.speedKmh, !player.state.onFoot);
    audio.siren(police.wanted >= 2);
    saveTimer += dt;
    if (saveTimer > 15) {
      saveTimer = 0;
      saveGame({ cash: player.state.cash, respect: player.state.respect, chapter: missions.index, upgrades: player.state.upgrades, day: world.day });
    }
  }
  vehicles.update(dt, world.frozen);
  peds.update(dt, world.frozen);
  police.update(dt, player.state.pos, player, world.frozen);
  updateCamera();
  hud.update(hudState());
  renderer.render(scene, camera);
}

// Shot mode: stage the exact pose, render once, signal readiness.
if (shotName) {
  world.started = true;
  document.getElementById('title').style.display = 'none';
  const ok = applyShot(world, shotName);
  if (!ok) {
    document.title = 'SHOT-FAILED';
    window.__shotReady = true;
  }
} else {
  updateCamera();
  hud.update(hudState());
  loop();
}
