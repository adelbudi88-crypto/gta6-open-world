// Porto Azul II — bootstrap, game loop, input, title/pause flow, shot mode.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { districtAt, createTurf } from './turf.js';
import { createCrew } from './crew.js';
import { createTraffic, createParked, detonate, updateExplosions, buildBoat } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPolice } from './police.js';
import { createPlayer, gearFor, WEAPONS } from './player.js';
import { createMissions } from './missions.js';
import { createSideJobs } from './sidejobs.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { saveGame, loadGame } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 1);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0f28);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const rng = makeRng(SEED);

// ---- shared state (the HUD, missions, police and shots all read this) ----
const state = {
  day: 1, clock: 19.07,
  cash: 0, wanted: 0, health: 100, armour: 0, respect: 1,
  missionNum: 1, missionName: 'FIRST LIGHT', missionObjective: "Reach Benny's Garage",
  missionTimer: 300, missionPayout: 8000, missionDistrict: 'TORRE PLAZA', missionStageLabel: '',
  districtObj: districtAt(-140, -120),
  turfStanding: {}, turf: null,
  weaponIdx: 0,
  ammo: [Infinity, 30, 6, 30, 6],
  ammoReserve: [Infinity, 120, 24, 90, 0],
  driving: false, carName: 'ON FOOT', carHealth: 100, speedKmh: 0, gear: 1,
  radio: { name: 'SOL FM 95.4', genre: 'SYNTHWAVE' },
  racePos: null, sideJob: null, sideJobTimer: 0,
  spikeWarning: false, spiked: false, spikeTimer: 0, pitSpin: 0,
  hint: 'WASD move · E enter car',
  title: true, paused: false, frozen: false,
  missionsDone: 0, sideJobsDone: 0, carsStolen: 0, shotsFired: 0,
  playerPos: new THREE.Vector3(-140, 0, -120),
  playerYaw: 0,
  objectivePos: { x: -140, z: -120 },
  routeName: "BENNY'S GARAGE",
  copPositions: [],
  boatPos: null,
  molotovAt: null,
  wheelOpen: false,
  crew: null,
};

const turf = createTurf();
state.turf = turf;
state.turfStanding = turf.standing;
const crew = createCrew();
state.crew = crew;

// ---- world ----
const city = buildCity(scene, rng);
const traffic = createTraffic(scene, rng, 32);
const parked = createParked(scene, rng, 14);
const peds = createPeds(scene, rng, 60);
const police = createPolice(scene, state);
const player = createPlayer(scene, state);
const missions = createMissions(state);
const sideJobs = createSideJobs(state, turf);
const audio = createAudio();

// Boat in the harbor (drivable in the finale; also a shot prop).
const boat = buildBoat();
boat.position.set(258, 0.4, -60);
boat.rotation.y = -Math.PI / 2;
scene.add(boat);
state.boatPos = { x: 258, z: -60 };

const OBJECTIVES = {
  1: { x: -140, z: -140, name: "BENNY'S GARAGE" },
  2: { x: 60, z: -180, name: "TONO'S HIDEOUT" },
  3: { x: -200, z: 140, name: 'BEACH EXIT' },
  4: { x: 0, z: -140, name: 'CASINO ROYALE' },
  5: { x: 0, z: -140, name: 'CASINO VAULT' },
  6: { x: 200, z: -140, name: 'EAST DOCK' },
  7: { x: -40, z: 120, name: 'OLD TOWN ALLEY' },
  8: { x: 0, z: -140, name: 'CASINO ROYALE' },
  9: { x: -60, z: -260, name: 'RACE CHECKPOINT' },
  10: { x: 200, z: -100, name: 'DOCK 3' },
  11: { x: 0, z: -160, name: 'GANG CORNER' },
  12: { x: 0, z: -140, name: 'CASINO ROYALE VAULT' },
};

const hud = createHud(state, {
  onResume: () => { state.paused = false; hud.showPause(false); },
  onRestart: () => { state.paused = false; hud.showPause(false); restartMission(); },
  onQuitTitle: () => { state.paused = false; hud.showPause(false); showTitle(); },
});
hud.bindButtons();

function showTitle() {
  state.title = true;
  hud.showTitle(true);
}
function hideTitle() {
  state.title = false;
  hud.showTitle(false);
}

function restartMission() {
  missions.start(state.missionNum);
  const obj = OBJECTIVES[state.missionNum] || OBJECTIVES[1];
  state.objectivePos = { x: obj.x, z: obj.z };
  state.routeName = obj.name;
  hud.flash('CHAPTER ' + state.missionNum + '/12: ' + state.missionName, state.missionObjective);
}

function startGame(slotData) {
  audio.ensure();
  audio.startMusic();
  hideTitle();
  if (slotData) {
    state.cash = slotData.cash;
    state.respect = slotData.respect;
    state.health = slotData.health;
    state.armour = slotData.armour;
    state.clock = slotData.clock;
    state.day = slotData.day;
    Object.assign(turf.standing, slotData.turf || {});
    missions.done = slotData.missionsDone || 0;
    missions.start(slotData.missionNum || 1);
  } else {
    missions.start(1);
  }
  const obj = OBJECTIVES[state.missionNum] || OBJECTIVES[1];
  state.objectivePos = { x: obj.x, z: obj.z };
  state.routeName = obj.name;
  hud.flash('CHAPTER ' + state.missionNum + '/12: ' + state.missionName, state.missionObjective);
}

// ---- input ----
const input = { forward: false, back: false, left: false, right: false, camYaw: Math.PI, camPitch: 0.32 };
let dragging = false;
let downX = 0, downY = 0, moved = 0;
let lastFireHeat = 0;

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.forward = true;
  if (k === 's' || k === 'arrowdown') input.back = true;
  if (k === 'a' || k === 'arrowleft') input.left = true;
  if (k === 'd' || k === 'arrowright') input.right = true;
  if (k === 'q') { state.wheelOpen = true; hud.showWheel(true); }
  if (k >= '1' && k <= '5' && !state.title) player.selectWeapon(Number(k) - 1);
  if (k === 'enter' && state.title) startGame(null);
  if (k === 'p' || k === 'escape') {
    if (!state.title) {
      state.paused = !state.paused;
      hud.showPause(state.paused);
    }
  }
  if (state.title || state.paused || state.frozen) return;
  if (k === 'e') tryEnterExitCar();
  if (k === 'x') {
    if (crew.useEmp(state)) { hud.toast('MARA EMP — POLICE BLIND 8s'); police.clear(); police.setWanted(state.wanted); }
    else hud.toast(crew.empState === 'ready' ? 'EMP NEEDS $500' : 'EMP ' + crew.empLabel());
  }
  if (k === 'g') useGarage();
  if (k === 'c') { state.radio = audio.nextStation(); }
  if (k === 'm') { const m = audio.toggleMute(); hud.toast(m ? 'MUTED' : 'SOUND ON'); }
  if (k === 'r') restartMission();
  if (k === 't') startSideJob('taxi');
  if (k === 'y') startSideJob('dock');
  if (k === 'u') startSideJob('race');
  if (k === 'shift') { if (crew.useNitro(state)) crew.spendNitroCharge(); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.forward = false;
  if (k === 's' || k === 'arrowdown') input.back = false;
  if (k === 'a' || k === 'arrowleft') input.left = false;
  if (k === 'd' || k === 'arrowright') input.right = false;
  if (k === 'q') { state.wheelOpen = false; hud.showWheel(false); }
  if (k === 'shift') crew.releaseNitro();
});
canvas.addEventListener('mousedown', (e) => { dragging = true; moved = 0; downX = e.clientX; downY = e.clientY; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - downX, dy = e.clientY - downY;
  moved += Math.abs(dx) + Math.abs(dy);
  downX = e.clientX; downY = e.clientY;
  input.camYaw -= dx * 0.005;
  input.camPitch = Math.max(0.08, Math.min(0.9, input.camPitch + dy * 0.003));
});
window.addEventListener('mouseup', () => {
  if (dragging && moved < 6 && !state.title && !state.paused && !state.frozen) {
    player.fire();
    audio.shot();
    const now = performance.now();
    if (now - lastFireHeat > 3000 && state.wanted < 5) {
      const nearCop = police.cops.some((c) => c.group.position.distanceTo(player.group.position) < 60);
      if (nearCop) { state.wanted = Math.min(5, state.wanted + 1); police.setWanted(state.wanted); lastFireHeat = now; }
    }
  }
  dragging = false;
});
document.getElementById('title-slots').addEventListener('click', (e) => {
  const slot = e.target.closest('.slot-save');
  if (!slot) return;
  const idx = Array.from(slot.parentElement.children).indexOf(slot);
  const data = loadGame(idx + 1);
  startGame(data || null);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function tryEnterExitCar() {
  if (!player.onFoot) { player.exitCar(); state.hint = 'WASD move · E enter car'; return; }
  const pos = player.group.position;
  // Boat first if close to the harbor boat.
  if (Math.hypot(pos.x - boat.position.x, pos.z - boat.position.z) < 6) {
    player.enterBoat(boat);
    state.hint = 'WASD sail · E step off';
    hud.toast('VELA SPEEDBOAT — HARBOR ESCAPE READY');
    return;
  }
  const near = traffic.nearest(pos, 4.5);
  let target = near ? { group: near.group, model: near.model } : null;
  if (!target) {
    for (const p of parked) {
      if (p.group.position.distanceTo(pos) < 4.5) { target = p; break; }
    }
  }
  if (!target) return;
  const witnessed = peds.witnessNear(pos, 20) ||
    police.cops.some((c) => c.group.position.distanceTo(pos) < 30);
  player.enterCar(target);
  state.carsStolen += 1;
  state.hint = 'WASD drive · E exit · Shift nitro';
  peds.fleeFrom(pos);
  if (witnessed && state.wanted < 5) {
    state.wanted = Math.min(5, state.wanted + 1);
    police.setWanted(state.wanted);
    hud.toast('CARJACKED — WITNESSED! WANTED ★'.repeat(0) + 'WANTED UP');
  } else {
    hud.toast('CARJACKED — ' + target.model.name);
  }
}

function useGarage() {
  const pos = player.group.position;
  const d = Math.hypot(pos.x + 140, pos.z + 140);
  if (d > 14) { hud.toast("BENNY'S GARAGE IS IN TORRE PLAZA — FOLLOW THE ROUTE"); return; }
  if (crew.buyEngine(state)) { hud.toast("BENNY'S GARAGE — ENGINE Lv " + crew.upgrades.engine + ' · -$5,000'); return; }
  if (crew.buyArmour(state)) { hud.toast("BENNY'S GARAGE — ARMOUR 100% · -$1,000"); return; }
  crew.refillNitro();
  hud.toast("BENNY'S GARAGE — NITRO REFILLED · ENGINE MAXED");
}

function startSideJob(kind) {
  const job = sideJobs.start(kind);
  if (!job) { hud.toast('FINISH YOUR CURRENT JOB FIRST'); return; }
  const obj = kind === 'taxi' ? { x: -40, z: 120 } : kind === 'dock' ? { x: 200, z: -100 } : { x: -60, z: -260 };
  state.objectivePos = obj;
  state.routeName = job.job.label;
  hud.toast('SIDE JOB: ' + job.job.label + ' — ' + job.job.objective + ' · $' + job.job.payout.toLocaleString());
}

// ---- camera ----
function updateCamera() {
  const pos = state.playerPos;
  const dist = state.driving ? 12 : 8.5;
  const height = 4.6 + input.camPitch * 4;
  const back = state.driving ? player.yaw : input.camYaw;
  const cx = pos.x - Math.sin(back) * dist;
  const cz = pos.z - Math.cos(back) * dist;
  camera.position.set(cx, height, cz);
  camera.lookAt(pos.x, 1.6, pos.z);
}

// ---- main loop ----
let explosions = [];
let hiddenTimer = 0;
let lastT = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (state.paused || state.title) {
    renderer.render(scene, camera);
    return;
  }
  if (!state.frozen) {
    // Day cycle: 1 game hour per 150s, dusk 19:07 -> night 21:40.
    state.clock += dt / 150;
    if (state.clock >= 24) { state.clock -= 24; state.day += 1; }
    city.updateDayCycle(state.clock);
  }
  // Player position + district.
  const pPos = player.onFoot ? player.group.position
    : player.car ? player.car.group.position : player.boat.position;
  state.playerPos.copy(pPos);
  state.playerYaw = player.yaw;
  state.districtObj = districtAt(pPos.x, pPos.z);
  state.gear = gearFor(state.speedKmh);
  state.copPositions = police.cops.map((c) => ({ x: c.group.position.x, z: c.group.position.z }));

  player.update(dt, input, state.frozen);
  crew.tick(dt);
  traffic.update(dt, state.frozen);
  peds.update(dt, state.frozen, state.shotsFired > 0 ? pPos : null);
  police.update(dt, pPos, null, state.frozen);
  missions.tick(dt);
  sideJobs.tick(dt);

  // Wanted decay: hidden from every cop for 20s -> heat drops one star.
  if (state.wanted > 0) {
    const seen = police.cops.some((c) => c.group.position.distanceTo(pPos) < 40) || police.helis.length > 0;
    if (!seen) {
      hiddenTimer += dt;
      if (hiddenTimer > 20) { state.wanted -= 1; police.setWanted(state.wanted); hiddenTimer = 0; }
    } else hiddenTimer = 0;
  }

  // Mission objective reached?
  const obj = state.objectivePos;
  const od = Math.hypot(pPos.x - obj.x, pPos.z - obj.z);
  if (!state.frozen && od < 12) {
    if (sideJobs.active) {
      const done = sideJobs.complete();
      if (done) {
        hud.toast('SIDE JOB DONE — ' + done.job.label + ' +$' + done.payout.toLocaleString());
        audio.cash();
        const o2 = OBJECTIVES[state.missionNum] || OBJECTIVES[1];
        state.objectivePos = { x: o2.x, z: o2.z };
        state.routeName = o2.name;
      }
    } else if (missions.current.type === 'finale') {
      if (missions.stage < 2) {
        missions.nextStage();
        state.missionStageLabel = missions.stageLabel();
        state.missionObjective = missions.current.stages[missions.stage];
        if (missions.stage === 1) {
          state.objectivePos = { x: 252, z: -60 };
          state.routeName = 'VELA SPEEDBOAT';
          state.wanted = 5; police.setWanted(5);
          hud.flash('STAGE 2/3 — FIVE-STAR CHASE', 'Break the harbor cordon!');
        } else {
          state.objectivePos = { x: 258, z: -60 };
          state.routeName = 'BOAT ESCAPE';
          hud.flash('STAGE 3/3 — BOAT ESCAPE', 'Sail out of Porto Azul!');
        }
      } else {
        finishMission();
      }
    } else {
      finishMission();
    }
  }
  // Mission timer expired -> restart the chapter.
  if (missions.timer <= 0 && !state.frozen) {
    hud.toast('TIME UP — CHAPTER RESTARTED');
    restartMission();
  }

  // Car collisions: ramming traffic hard explodes it.
  if (state.driving && player.car) {
    for (const c of traffic.cars) {
      if (c.group.userData.wrecked) continue;
      const d = c.group.position.distanceTo(player.car.group.position);
      if (d < 3.2 && state.speedKmh > 45) {
        const ex = detonate(scene, c.group);
        if (ex) explosions.push(ex);
        audio.explosion();
        state.carHealth = Math.max(0, state.carHealth - 15);
        hud.toast('CAR EXPLODED — BURNING WRECK');
        break;
      }
    }
  }
  // Molotov fire: detonate the nearest car to the impact point.
  if (state.molotovAt) {
    const m = state.molotovAt;
    let best = null, bd = 9;
    for (const c of traffic.cars) {
      if (c.group.userData.wrecked) continue;
      const d = Math.hypot(c.group.position.x - m.x, c.group.position.z - m.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      const ex = detonate(scene, best.group);
      if (ex) explosions.push(ex);
      audio.explosion();
    }
    state.molotovAt = null;
  }
  explosions = updateExplosions(explosions, dt);

  audio.engine(state.speedKmh, state.driving);
  audio.siren(state.wanted >= 2);

  updateCamera();
  hud.update();
  renderer.render(scene, camera);
}

function finishMission() {
  const m = missions.complete({ turf });
  audio.cash();
  saveGame(1, state);
  hud.flash('CHAPTER ' + m.num + '/12 COMPLETE', '+' + '$' + m.payout.toLocaleString() + ' · ' + m.district + ' TURF UP');
  if (missions.done < 12) {
    const o = OBJECTIVES[state.missionNum] || OBJECTIVES[1];
    state.objectivePos = { x: o.x, z: o.z };
    state.routeName = o.name;
    state.missionStageLabel = missions.stageLabel();
  } else {
    hud.flash('PORTO AZUL II — CAMPAIGN COMPLETE', 'Daz owns the city. $' + state.cash.toLocaleString());
  }
}

// ---- boot ----
if (SHOT) {
  // Deterministic dossier shot: freeze the world, stage, render once.
  try {
    state.title = false;
    state.paused = false;
    hud.showTitle(false);
    applyShot(SHOT, { state, player, police, traffic, parked, scene, boat, input });
    city.updateDayCycle(state.clock);
    state.gear = gearFor(state.speedKmh);
    state.copPositions = police.cops.map((c) => ({ x: c.group.position.x, z: c.group.position.z }));
    state.missionStageLabel = state.missionStageLabel || '';
    updateCamera();
    hud.update();
    renderer.render(scene, camera);
    window.__shotReady = true;
  } catch (err) {
    window.__shotError = String(err && err.stack || err);
    throw err;
  }
} else {
  showTitle();
  updateCamera();
  requestAnimationFrame(frame);
}
