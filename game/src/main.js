// Porto Azul II — boot, input, game loop and mission flow. The world is a
// three.js dusk city: Daz drives and walks, the police hunt by wanted level,
// five story missions pay out cash, and the HUD shows all of it at once.
// ?shot=1-drive|2-foot|3-chase|4-mission&seed=N stages a frozen dossier shot.
import * as T from 'three';
import { createRng, clamp, lerp } from './rng.js';
import { buildCity, districtAt, collideCircle, ROAD_LINES } from './city.js';
import { CAR_DEFS, makeCarMesh, createTraffic } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPolice } from './police.js';
import { createPlayer } from './player.js';
import { MISSIONS, missionTitle } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;
const rng = createRng(seed);

const canvas = document.getElementById('view');
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);

const city = buildCity(scene, rng);
const traffic = createTraffic(scene, rng, ROAD_LINES);
const peds = createPeds(scene, rng);
const police = createPolice(scene, rng);
const player = createPlayer(scene);
const hud = createHud(document);
const audio = createAudio();
const saved = loadSave();

const state = {
  cash: saved ? saved.cash : 350,
  missionIndex: saved ? saved.missionIndex : 0,
  respect: saved ? saved.respect : 1,
  upgrades: saved ? saved.upgrades : { engine: 0, armour: 0, tyres: 0 },
  day: saved ? saved.day : 1,
  bestCash: saved ? saved.bestCash : 350,
  wanted: 0, health: 100, armour: 40,
  clockMinutes: 19 * 60 + 7,
  district: districtAt(0, 0),
  missionLabel: '', objective: '', missionTimer: 0, missionActive: false,
  playerX: 0, playerZ: 0, heading: 0, speedKmh: 0, gear: 0,
  onFoot: true, carName: 'DAZ', carCondition: 100,
  radioStation: 0, radioLabel: 'SOL FM 95.4 · SYNTHWAVE',
  weaponName: 'HORNET SMG', ammo: 30, ammoReserve: 120,
  target: null, trafficDots: [], copDots: [],
};

// Mission target beacon: gold ring + light pillar.
const markerRing = new T.Mesh(
  new T.CylinderGeometry(3.2, 3.2, 0.35, 24),
  new T.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.85 })
);
const markerPillar = new T.Mesh(
  new T.CylinderGeometry(0.9, 0.9, 70, 12, 1, true),
  new T.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false })
);
markerRing.visible = false;
markerPillar.visible = false;
scene.add(markerRing);
scene.add(markerPillar);

function setMarker(x, z) {
  markerRing.position.set(x, 0.4, z);
  markerPillar.position.set(x, 35, z);
  markerRing.visible = true;
  markerPillar.visible = true;
  state.target = { x, z };
}

// Tono's red Comet GT — parked at the Strip in mission 2, staged in shot 1.
const tonoCar = makeCarMesh(CAR_DEFS.comet, false).group;
tonoCar.visible = false;
scene.add(tonoCar);

const game = {
  state, player, traffic, peds, police, city, hud, tonoCar,
  frozen: false, cameraPose: null,
  setCameraPose(pos, look) { this.cameraPose = { pos, look }; },
  setMarker,
};

const input = { forward: false, back: false, left: false, right: false, boost: false, handbrake: false };
let started = false;
let paused = false;
let garageOpen = false;
let orbitYaw = 0;
let dragging = false;
let lastMouseX = 0;
let wantedDecay = 0;
let bustedAt = 0;

const UPGRADES = [
  { key: 'engine', name: 'ENGINE — top speed +12%', cost: 4000, max: 3 },
  { key: 'armour', name: 'ARMOUR PLATING — refill armour + heal', cost: 2500, max: 3 },
  { key: 'tyres', name: 'TYRES — grip +10%', cost: 3000, max: 3 },
];

function refreshGarageRows() {
  const rows = document.getElementById('garage-rows');
  rows.innerHTML = UPGRADES.map((u, i) => {
    const lv = state.upgrades[u.key] || 0;
    const owned = lv >= u.max;
    return '<div class="row"><span>[' + (i + 1) + '] ' + u.name + '</span><b>' +
      (owned ? 'MAX · LV ' + lv : 'LV ' + lv + ' · $' + u.cost.toLocaleString('en-US')) + '</b></div>';
  }).join('') + '<div class="row"><span>CASH</span><b>$' + Math.floor(state.cash).toLocaleString('en-US') + '</b></div>';
}

function buyUpgrade(i) {
  const u = UPGRADES[i];
  if (!u) return;
  const lv = state.upgrades[u.key] || 0;
  if (lv >= u.max || state.cash < u.cost) { audio.blip(180); return; }
  state.cash -= u.cost;
  state.upgrades[u.key] = lv + 1;
  if (u.key === 'armour') { state.armour = 100; state.health = clamp(state.health + 25, 0, 100); }
  audio.blip(660);
  hud.showMessage(u.name.split(' — ')[0] + ' upgraded to LV ' + (lv + 1), 2.5);
  refreshGarageRows();
  writeSave(state);
}

function startMission(index) {
  const m = MISSIONS[index];
  if (!m) {
    state.missionActive = false;
    state.missionLabel = 'FREE ROAM';
    state.objective = 'Porto Azul is yours — cause trouble or lie low';
    markerRing.visible = false;
    markerPillar.visible = false;
    state.target = null;
    return;
  }
  state.missionIndex = index;
  state.missionTimer = m.time;
  state.missionActive = true;
  state.missionLabel = m.chapter + ': ' + m.title;
  state.objective = m.objective;
  const spot = city.spots[m.target];
  setMarker(spot.x, spot.z);
  if (index === 2) state.wanted = 5; // Heat Wave opens at MOST WANTED
  if (index === 1) {
    tonoCar.visible = true;
    tonoCar.position.set(spot.x + 6, 0, spot.z - 4);
    tonoCar.rotation.y = Math.PI / 2;
  } else if (index !== 1) {
    tonoCar.visible = false;
  }
  hud.showBanner(m.chapter, m.title, m.brief, 4);
}

function completeMission() {
  const m = MISSIONS[state.missionIndex];
  state.cash += m.payout;
  state.bestCash = Math.max(state.bestCash, state.cash);
  state.respect = clamp(state.respect + 1, 1, 5);
  state.wanted = Math.max(0, state.wanted - 2);
  hud.showMessage('MISSION COMPLETE  +$' + m.payout.toLocaleString('en-US'), 4);
  audio.blip(880);
  writeSave(state);
  if (state.missionIndex + 1 >= MISSIONS.length) {
    state.missionIndex = MISSIONS.length;
    hud.showBanner('PORTO AZUL II', 'ALL MISSIONS COMPLETE', 'The city is yours, Daz.', 5);
    startMission(MISSIONS.length);
  } else {
    startMission(state.missionIndex + 1);
  }
}

function failMission() {
  hud.showMessage('MISSION FAILED — TRY AGAIN', 3);
  audio.blip(180);
  startMission(state.missionIndex);
}

function bustPlayer() {
  if (performance.now() - bustedAt < 5000) return;
  bustedAt = performance.now();
  state.cash = Math.max(0, state.cash - 500);
  state.health = 100;
  state.armour = 0;
  state.wanted = 0;
  player.x = city.garagePos.x; player.z = city.garagePos.z;
  player.onFoot = true;
  player.clearCar();
  player.speed = 0;
  hud.showMessage('BUSTED — $500 bail. Benny vouched for you. Back on the streets.', 4);
}

function shoot() {
  if (state.ammo <= 0) { audio.blip(140); return; }
  state.ammo -= 1;
  audio.blip(1200);
  const range = player.onFoot ? 42 : 30;
  let best = null;
  let bestD = range;
  for (const c of police.footCops) {
    const dx = c.group.position.x - player.x;
    const dz = c.group.position.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (best) {
    best.hp -= 34;
    if (best.hp <= 0) {
      scene.remove(best.group);
      police.footCops.splice(police.footCops.indexOf(best), 1);
      state.cash += 50;
      state.wanted = clamp(state.wanted + 1, 0, 5);
      hud.showMessage('COP DOWN  +$50', 2);
    }
  }
}

function enterExitCar() {
  if (player.onFoot) {
    // Steal the nearest traffic car, else take your own parked car.
    let nearest = null;
    let nearestD = 6;
    for (const c of traffic.cars) {
      const d = Math.hypot(c.x - player.x, c.z - player.z);
      if (d < nearestD) { nearestD = d; nearest = c; }
    }
    if (nearest) {
      const color = nearest.group.children[0].material.color.getHex();
      traffic.cars.splice(traffic.cars.indexOf(nearest), 1);
      scene.remove(nearest.group);
      player.setCar({ name: 'STOLEN RIDE', color, topSpeed: 140, accel: 28, grip: 1.0 });
      player.onFoot = false;
      state.wanted = clamp(state.wanted + 1, 0, 5);
      hud.showMessage('CAR STOLEN — the law noticed', 2.5);
    } else if (player.carGroup) {
      const d = Math.hypot(player.x - player.carGroup.position.x, player.z - player.carGroup.position.z);
      if (d < 6) { player.onFoot = false; hud.showMessage('Back in the ' + player.carDef.name, 1.5); }
    }
  } else {
    player.onFoot = true;
    player.x = player.carGroup.position.x - Math.sin(player.heading) * 3;
    player.z = player.carGroup.position.z - Math.cos(player.heading) * 3;
    player.speed = 0;
  }
}

function onKey(e, down) {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.forward = down;
  else if (k === 's' || k === 'arrowdown') input.back = down;
  else if (k === 'a' || k === 'arrowleft') input.left = down;
  else if (k === 'd' || k === 'arrowright') input.right = down;
  else if (k === 'shift') input.boost = down;
  else if (k === ' ') { input.handbrake = down; e.preventDefault(); }
  if (!down) return;
  audio.start();
  if (k === 'enter') startGame();
  else if (k === 'e' && started && !paused) enterExitCar();
  else if (k === 'f' && started && !paused) shoot();
  else if (k === 'r' && started) {
    const need = 30 - state.ammo;
    const take = Math.min(need, state.ammoReserve);
    state.ammo += take; state.ammoReserve -= take;
  } else if (k === 'c' && started) {
    audio.cycleStation();
    state.radioLabel = audio.stationLabel;
  } else if (k === 'p' && started) {
    paused = !paused;
    hud.showMessage(paused ? 'PAUSED' : 'RESUMED', 1.2);
  } else if (k === 'b' && started) {
    const d = Math.hypot(player.x - city.garagePos.x, player.z - city.garagePos.z);
    if (d < 26 || garageOpen) {
      garageOpen = !garageOpen;
      document.getElementById('garage').style.display = garageOpen ? 'block' : 'none';
      if (garageOpen) refreshGarageRows();
    } else {
      hud.showMessage("Benny's Garage is in Old Town — get closer", 2);
    }
  } else if (k === 'escape' && garageOpen) {
    garageOpen = false;
    document.getElementById('garage').style.display = 'none';
  } else if (garageOpen && (k === '1' || k === '2' || k === '3')) {
    buyUpgrade(Number(k) - 1);
  }
}

function startGame() {
  if (started) return;
  started = true;
  document.getElementById('title').style.display = 'none';
  audio.start();
  if (state.missionIndex < MISSIONS.length) {
    startMission(state.missionIndex);
    if (saved) hud.showMessage('Welcome back, Daz — ' + missionTitle(state.missionIndex), 3);
  } else {
    startMission(MISSIONS.length);
  }
}

window.addEventListener('keydown', (e) => onKey(e, true));
window.addEventListener('keyup', (e) => onKey(e, false));
window.addEventListener('mousedown', (e) => {
  if (e.target.id === 'view') { dragging = true; lastMouseX = e.clientX; }
  audio.start();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  orbitYaw += (e.clientX - lastMouseX) * 0.005;
  lastMouseX = e.clientX;
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.getElementById('title').addEventListener('click', startGame);

// Starting pose: outside Benny's Garage, in the Azul Coupe's neighbourhood.
player.x = city.garagePos.x + 6;
player.z = city.garagePos.z + 10;
player.heading = Math.PI / 2;
player.setCar('azul');
player.onFoot = true;
player.group.position.set(player.x, 0, player.z);
state.playerX = player.x; state.playerZ = player.z;
state.district = districtAt(player.x, player.z);

function updateCamera(dt) {
  if (game.cameraPose) {
    camera.position.set(game.cameraPose.pos[0], game.cameraPose.pos[1], game.cameraPose.pos[2]);
    camera.lookAt(game.cameraPose.look[0], game.cameraPose.look[1], game.cameraPose.look[2]);
    return;
  }
  const fx = Math.sin(player.heading + orbitYaw);
  const fz = Math.cos(player.heading + orbitYaw);
  const dist = player.onFoot ? 8 : 12.5;
  const height = player.onFoot ? 3.4 : 4.6;
  const tx = player.x - fx * dist;
  const tz = player.z - fz * dist;
  const k = 1 - Math.exp(-5 * dt);
  camera.position.x = lerp(camera.position.x, tx, k);
  camera.position.y = lerp(camera.position.y, height, k);
  camera.position.z = lerp(camera.position.z, tz, k);
  camera.lookAt(player.x + fx * 9, 1.6, player.z + fz * 9);
  orbitYaw *= Math.max(0, 1 - 1.2 * dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = 0.016;
  if (started && !paused && !garageOpen && !game.frozen) {
    player.update(dt, input, false, state.upgrades);
    // Collide with buildings.
    const fixed = collideCircle(city.colliders, player.x, player.z, player.onFoot ? 0.8 : 2.4);
    player.x = clamp(fixed.x, -CITY_LIMIT_X, CITY_LIMIT_X);
    player.z = clamp(fixed.z, -CITY_LIMIT_X, CITY_LIMIT_X);
    if (fixed.hit && !player.onFoot) player.speed *= 0.55;
    if (player.onFoot) player.group.position.set(player.x, 0, player.z);
    else if (player.carGroup) player.carGroup.position.set(player.x, 0, player.z);
    traffic.update(dt, false);
    peds.update(dt, false, player.x, player.z);
    police.update(dt, false, state, player.x, player.z, player.heading, player.onFoot, now / 1000);
    // Wanted decays when no cop is close.
    let nearestCop = 999;
    for (const c of police.copCars) nearestCop = Math.min(nearestCop, Math.hypot(c.group.position.x - player.x, c.group.position.z - player.z));
    if (state.wanted > 0 && nearestCop > 45) {
      wantedDecay += dt;
      if (wantedDecay > 25) { state.wanted -= 1; wantedDecay = 0; }
    } else wantedDecay = 0;
    // Mission timer + arrival.
    if (state.missionActive) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) failMission();
      else if (state.target) {
        const d = Math.hypot(player.x - state.target.x, player.z - state.target.z);
        if (d < 9) completeMission();
      }
    }
    state.clockMinutes += dt / 6;
    if (state.clockMinutes >= 1440) { state.clockMinutes -= 1440; state.day += 1; }
    if (state.wanted === 0 && state.health < 100) state.health = clamp(state.health + 1.5 * dt, 0, 100);
    if (state.health <= 0) bustPlayer();
    audio.setEngine(player.speedKmh, !player.onFoot);
    audio.setSiren(state.wanted > 0, now / 1000);
    const pulse = 1 + Math.sin(now / 240) * 0.12;
    markerRing.scale.set(pulse, 1, pulse);
  }
  // HUD state assembly.
  state.playerX = player.x; state.playerZ = player.z; state.heading = player.heading;
  state.speedKmh = player.speedKmh; state.gear = player.gear;
  state.onFoot = player.onFoot; state.carName = player.carDef.name;
  state.district = districtAt(player.x, player.z);
  state.trafficDots = traffic.cars.map((c) => ({ x: c.x, z: c.z }));
  state.copDots = police.copCars.map((c) => ({ x: c.group.position.x, z: c.group.position.z }))
    .concat(police.footCops.map((c) => ({ x: c.group.position.x, z: c.group.position.z })));
  if (started || game.frozen) hud.update(state);
  updateCamera(dt);
  renderer.render(scene, camera);
}

const CITY_LIMIT_X = 208;

if (shotName) {
  document.getElementById('title').style.display = 'none';
  started = true;
  stageShot(shotName, game);
  let painted = 0;
  (function paintShot() {
    updateCamera(0.016);
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  })();
} else {
  camera.position.set(player.x - 8, 4, player.z - 10);
  hud.update(state);
  requestAnimationFrame(frame);
}
