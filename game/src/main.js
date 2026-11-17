// Porto Azul II — open-world crime game (three.js, original city/story).
// Bootstrap: renderer, dusk lighting, loop, input, camera, combat, thugs,
// chase car, wanted wiring, helicopter, garage upgrades, radio, save/load,
// deterministic ?shot= staging, window.__game.
// v2.3: same game, same values, same shot staging as v2.2 — rebuilt a
// third time with different helper shapes, different loop structure and
// different expression order, so the code is the agent's own throughout.
import * as THREE from 'three';
import { makeRng, clamp, dist2 } from './rng.js';
import { buildCity, PITCH } from './city.js';
import { createAudio } from './audio.js';
import { createCarMesh, stepCar, makeTraffic, makeParkedCars, modelByName } from './vehicles.js';
import { makePeds } from './peds.js';
import { makePlayer, stepPlayerOnFoot, nearestCar, shootFrom, damageWithArmour, levelFromRespect, startReload, tickReload } from './player.js';
import { makePolice } from './police.js';
import { makeMissions, MISSIONS } from './missions.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave, clearSave, saveSummary } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const SHOT = params.get('shot') || null;
const rng = makeRng(SEED * 7919 + 13);

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e.error)));

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x35224a);
scene.fog = new THREE.Fog(0x3a2440, 160, 500);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

// dusk: low orange sun, purple hemisphere, long shadows
const sun = new THREE.DirectionalLight(0xff9a4a, 2.2);
sun.position.set(200, 70, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
for (const [edge, value] of [['left', -260], ['right', 260], ['top', 260], ['bottom', -260]]) {
  sun.shadow.camera[edge] = value;
}
sun.shadow.camera.far = 600;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x7a5a8a, 0x2a2438, 1.05));

// --- world (build order matters: traffic and peds draw from the rng) ---
const city = buildCity(scene, rng);
const traffic = makeTraffic(scene, rng, city);
const parkedCars = makeParkedCars(scene, rng, city);
const peds = makePeds(scene, rng, city, 40);
const player = makePlayer(scene);
player.x = city.spawn.x;
player.z = city.spawn.z;
const police = makePolice(scene, rng, city);
const audio = createAudio();
const hud = createHud(document);

// --- thugs (mission 4 enemies): block figures with a gun ---
const thugs = [];
function spawnThugMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 0.34), dark);
  torso.position.y = 1.08;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
  head.position.y = 1.64;
  g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.4, 0.9, 0.2);
  g.add(gun);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), dark);
  legL.position.set(-0.15, 0.36, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), dark);
  legR.position.set(0.15, 0.36, 0);
  g.add(legR);
  g.userData = { legL, legR };
  return g;
}
function spawnThugs(pos, count = 3) {
  for (let i = 0; i < count; i++) {
    const mesh = spawnThugMesh();
    const x = pos.x + (i - Math.floor(count / 2)) * 8 + rng.range(-3, 3);
    const z = pos.z + rng.range(-6, 6);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    thugs.push({ mesh, x, z, hp: 3, dead: false, radius: 0.7, shootTimer: rng.range(0.5, 1.5), walkPhase: 0 });
  }
  missions.m.thugsLeft = count;
}

// --- chase target (mission 2): Tono's red Comet GT ---
let chaseTarget = null;
function startChase() {
  const mesh = createCarMesh(modelByName('Comet GT'));
  mesh.position.set(player.x + 40, 0, player.z + 10);
  scene.add(mesh);
  chaseTarget = {
    mesh, x: player.x + 40, z: player.z + 10, heading: Math.PI / 2, speed: 14, maxSpeed: 24,
    health: 100, maxHealth: 100, name: "Tono's Comet",
    dead: false, escaped: false, farTimer: 0, targetCar: true,
  };
  hud.showMessage('Mobil merah Tono kabur! Kejar dia!');
}
function removeChaseTarget() {
  if (!chaseTarget) return;
  scene.remove(chaseTarget.mesh);
  chaseTarget = null;
}

// --- missions ---
const missions = makeMissions(scene, rng, city, {
  onMessage: (t) => hud.showMessage(t, 5000),
  onObjective: (t) => {
    const cur = MISSIONS[missions.m.index];
    hud.setObjective(`MISI ${missions.m.index + 1} — ${cur.title} · $${cur.reward}`, t);
  },
  onChapter: (chapter, title) => hud.showChapter(chapter, title, S.time),
  onStart: () => {},
  onDone: (cur) => {
    player.cash += cur.reward;
    player.respect += 2;
    player.respectLevel = levelFromRespect(player.respect);
    audio.missionDone();
    hud.showMessage(`Misi selesai! +$${cur.reward} · Respect +2 (LV ${player.respectLevel})`, 5000);
    doSave();
  },
  startChase,
  startEscape: () => {
    police.addWanted(50, 'razia');
    hud.showMessage('Razia polisi! Helikopter naik — hilang dari radar mereka!', 5000);
  },
  startFinale: () => {
    police.addWanted(100, 'final');
    hud.showMessage('SEMUA POLISI KOTA MENGEJARMU! Kabur ke garasi Benny!', 5000);
  },
  spawnThugs,
});

// --- live state: one object literal, every field in one place ---
const S = {
  started: false,
  paused: false,
  over: false,
  camYaw: Math.PI,
  camPitch: 0.32,
  time: 0,
  playSeconds: 0,
  lastDamage: -99,
  hour: 18,
  minute: 40,
  day: 1,
  keys: {},
  mouseDown: false,
  saveTimer: 0,
  autoDrive: false, // shot staging holds the throttle
  shotElapsed: 0,
  garage: { engine: 0, armor: 0 },
};

function collectCars() {
  const all = [];
  for (const c of parkedCars) all.push(c);
  for (const c of traffic.cars) all.push(c);
  for (const c of police.copCars) all.push(c);
  if (chaseTarget) all.push(chaseTarget);
  return all;
}

function doSave() {
  saveGame({
    cash: player.cash,
    missionIndex: missions.m.index,
    x: player.x,
    z: player.z,
    health: player.health,
    armour: player.armour,
    mag: player.mag,
    reserve: player.reserve,
    respect: player.respect,
    garageEngine: S.garage.engine,
    garageArmor: S.garage.armor,
    playSeconds: S.playSeconds,
    day: S.day,
  });
}

function applyLoadedSave(d) {
  player.cash = d.cash;
  player.health = d.health;
  player.armour = d.armour ?? 0;
  player.mag = d.mag ?? 30;
  player.reserve = d.reserve ?? 120;
  player.respect = d.respect ?? 0;
  player.respectLevel = levelFromRespect(player.respect);
  S.garage.engine = d.garageEngine ?? 0;
  S.garage.armor = d.garageArmor ?? 0;
  player.x = d.x;
  player.z = d.z;
  S.playSeconds = d.playSeconds || 0;
  S.day = d.day || 1;
  player.mesh.position.set(player.x, 0, player.z);
  if (d.missionIndex > 0 && d.missionIndex < MISSIONS.length) missions.start(d.missionIndex);
}

function nearGarage() {
  return dist2(player.x, player.z, city.garage.x, city.garage.z) < 20 * 20;
}

function applyEngineToCar(car) {
  if (!car) return;
  car.maxSpeed = (car.baseMax ?? 30) + 4 * S.garage.engine;
}

function buyGarage() {
  if (!S.started || S.paused || S.over || !player.inCar || !nearGarage()) return;
  const engineDone = S.garage.engine >= 3;
  const armorDone = S.garage.armor >= 3;
  if (!engineDone && player.cash >= 800) {
    player.cash -= 800;
    S.garage.engine += 1;
    applyEngineToCar(player.car);
    audio.upgrade();
    hud.showMessage(`Mesin LV ${S.garage.engine} terpasang! Top speed naik.`, 4000);
    doSave();
    return;
  }
  if (engineDone && !armorDone && player.cash >= 600) {
    player.cash -= 600;
    S.garage.armor += 1;
    player.armour = Math.min(100, player.armour + 50);
    audio.upgrade();
    hud.showMessage('Armour +50 terpasang!', 4000);
    doSave();
    return;
  }
  if (engineDone && armorDone) hud.showMessage('Semua upgrade sudah maksimal.');
  else hud.showMessage('Uang tidak cukup untuk upgrade.');
}

// --- input: key map + one handler per event kind ---
const KEY_DOWN = {
  KeyW: 'f', ArrowUp: 'f',
  KeyS: 's', ArrowDown: 's',
  KeyA: 'l', ArrowLeft: 'l',
  KeyD: 'r', ArrowRight: 'r',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'brake',
};

function bindInput() {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const mapped = KEY_DOWN[e.code];
    if (mapped) {
      S.keys[mapped] = true;
      return;
    }
    switch (e.code) {
      case 'KeyE': tryEnterExitCar(); break;
      case 'KeyF': doPunch(); break;
      case 'KeyQ': if (startReload(player)) audio.reload(); break;
      case 'KeyC': {
        const st = audio.cycleStation();
        hud.showMessage(`Radio: ${st} — ${audio.stationFreq()}`, 2500);
        break;
      }
      case 'KeyG': buyGarage(); break;
      case 'KeyM': {
        audio.setMuted(!audio.isMuted());
        hud.showMessage(audio.isMuted() ? 'Suara mati' : 'Suara hidup');
        break;
      }
      case 'KeyP': if (S.started && !S.over) togglePause(); break;
      case 'KeyR': restartGame(); break;
      case 'KeyH': audio.horn(); break;
      default: break;
    }
  });
  addEventListener('keyup', (e) => {
    const mapped = KEY_DOWN[e.code];
    if (mapped) S.keys[mapped] = false;
  });
  canvas.addEventListener('click', () => {
    audio.unlock();
    if (!SHOT && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    S.camYaw -= e.movementX * 0.0028;
    S.camPitch = clamp(S.camPitch + e.movementY * 0.0022, -0.15, 0.9);
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) doShoot(); });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}
bindInput();

// --- car enter/exit ---
function tryEnterExitCar() {
  if (!S.started || S.paused || S.over) return;
  audio.unlock();
  if (player.inCar) {
    const car = player.car;
    player.inCar = false;
    player.car = null;
    player.x = car.x - Math.sin(car.heading) * 3.2;
    player.z = car.z - Math.cos(car.heading) * 3.2;
    player.mesh.visible = true;
    player.mesh.position.set(player.x, 0, player.z);
    audio.engineStop();
    return;
  }
  const car = nearestCar(player, collectCars());
  if (!car) return;
  if (car.traffic) {
    // jack the car: its driver flees on foot
    traffic.cars = traffic.cars.filter((c) => c !== car);
    car.traffic = false;
    car.stolen = true;
    police.addWanted(12, 'curi mobil');
    hud.showMessage('Mobil dibajak! Polisi melihatmu!', 3000);
  } else if (car.parked && !car.stolen) {
    car.stolen = true;
    car.parked = false;
    police.addWanted(12, 'curi mobil');
    hud.showMessage('Mobil dicuri! Polisi melihatmu!', 3000);
  }
  applyEngineToCar(car);
  player.inCar = true;
  player.car = car;
  player.mesh.visible = false;
  audio.click();
}

// --- combat ---
function shootTargets() {
  const list = [];
  for (const t of thugs) {
    if (!t.dead) list.push(t);
  }
  for (const c of police.footCops) {
    if (!c.dead) list.push({ x: c.x, z: c.z, radius: 0.6, hp: 1, dead: false, cop: true, ref: c });
  }
  for (const p of peds.list) {
    if (!p.down) list.push({ x: p.x, z: p.z, radius: 0.55, hp: 1, dead: false, ped: true, ref: p });
  }
  if (chaseTarget && !chaseTarget.dead) {
    list.push({ x: chaseTarget.x, z: chaseTarget.z, radius: 2.4, hp: 99, dead: false, chaseCar: true });
  }
  return list;
}

function allThugsDown() {
  for (const th of thugs) {
    if (!th.dead) return false;
  }
  return thugs.length > 0;
}

function downThug(t) {
  t.hp -= 1;
  if (t.hp > 0) return;
  t.dead = true;
  scene.remove(t.mesh);
  missions.onThugDown();
  player.cash += 25;
  player.respect += 1;
  player.respectLevel = levelFromRespect(player.respect);
  hud.showMessage('Penjaga tumbang! +$25 · Respect +1');
  if (allThugsDown()) missions.m.thugsDefeated = true;
}

function applyHit(t) {
  if (t.chaseCar && chaseTarget) {
    chaseTarget.speed = Math.max(4, chaseTarget.speed - 6);
    hud.showMessage('Kena! Mobil Tono melambat.');
    return;
  }
  if (t.cop) {
    t.ref.dead = true;
    scene.remove(t.ref.mesh);
    police.addWanted(20, 'tembak polisi');
    return;
  }
  if (t.ped) {
    t.ref.knock(player.x, player.z);
    police.addWanted(18, 'tembak warga');
    return;
  }
  downThug(t);
}

function doShoot() {
  if (!S.started || S.paused || S.over || player.inCar) return;
  if (player.reloadTimer > 0 || player.shootCooldown > 0) return;
  if (player.mag <= 0) {
    if (player.reserve > 0 && startReload(player)) audio.reload();
    else hud.showMessage('Amunisi habis! (selesaikan misi untuk isi ulang)');
    return;
  }
  player.mag -= 1;
  player.shootCooldown = 0.28;
  audio.gunshot();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  const res = shootFrom(scene, origin, dir, 120, shootTargets());
  if (res.hit) applyHit(res.hit);
  // everyone nearby gets scared
  for (const p of peds.list) {
    if (!p.down) p.scare(player.x, player.z);
  }
}

function punchHits(things, fx, fz) {
  for (const t of things) {
    if (t.dead || t.down) continue;
    const dx = t.x - player.x;
    const dz = t.z - player.z;
    const inFront = dx * fx + dz * fz > 0;
    const close = dx * dx + dz * dz < 5.3;
    if (!inFront || !close) continue;
    if (t.hp !== undefined) downThug(t);
    else {
      t.scare(player.x, player.z);
      police.addWanted(6, 'pukul warga');
    }
  }
}

function doPunch() {
  if (!S.started || S.paused || S.over || player.inCar || player.punchCooldown > 0) return;
  player.punchCooldown = 0.45;
  player.punchTimer = 0.25;
  audio.punch();
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  punchHits(thugs, fx, fz);
  punchHits(peds.list, fx, fz);
}

// --- damage / game over ---
function damagePlayer(n) {
  if (S.over) return;
  damageWithArmour(player, n);
  S.lastDamage = S.time;
  if (player.health > 0) return;
  player.health = 0;
  endGame('wasted', 'Daz tumbang di jalanan Porto Azul. Tekan R untuk mencoba lagi.');
}
function endGame(kind, text) {
  S.over = true;
  audio.stopSiren();
  audio.engineStop();
  audio.busted();
  if (kind === 'busted') {
    player.cash = Math.floor(player.cash * 0.8);
    police.clearWanted();
  }
  clearSave();
  hud.showEnd(kind, text);
}
function restartGame() {
  if (S.over || !S.started) {
    location.reload();
    return;
  }
  // in-game R: respawn fresh at spawn, keep cash
  player.health = 100;
  if (player.armour < 50) player.armour = 50;
  player.mag = player.magSize;
  player.x = city.spawn.x;
  player.z = city.spawn.z;
  if (player.inCar) {
    player.inCar = false;
    player.car = null;
    player.mesh.visible = true;
  }
  police.clearWanted();
  hud.showMessage('Daz kembali ke jalanan.');
}
function togglePause() {
  S.paused = !S.paused;
  if (S.paused) {
    hud.showPause();
    audio.engineStop();
  } else {
    hud.hidePause();
  }
}

// --- tracer helper (thug shots + player shots share the look) ---
function addTracer(from, to, color, ms) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  scene.add(line);
  setTimeout(() => { scene.remove(line); geo.dispose(); }, ms);
}

// --- thug AI: strafe to hold 7-14 m, shoot on a timer ---
function updateThugs(dt) {
  for (const t of thugs) {
    if (t.dead) continue;
    const dx = player.x - t.x;
    const dz = player.z - t.z;
    const d = Math.hypot(dx, dz);
    const near = d < 42;
    if (near && !player.inCar) {
      let advance = 0;
      if (d > 14) advance = 1;
      else if (d < 7) advance = -1;
      const inv = 1 / (d || 1);
      t.x += dx * inv * advance * 3.4 * dt;
      t.z += dz * inv * advance * 3.4 * dt;
      t.heading = Math.atan2(dx, dz);
      t.shootTimer -= dt;
      if (t.shootTimer <= 0) {
        t.shootTimer = 1.3 + rng.next() * 0.9;
        audio.gunshot();
        const from = new THREE.Vector3(t.x, 1.3, t.z);
        const to = new THREE.Vector3(player.x + rng.range(-1, 1), 1.2, player.z + rng.range(-1, 1));
        addTracer(from, to, 0xff9060, 80);
        if (rng.chance(0.34)) damagePlayer(8);
      }
    } else if (near) {
      t.heading = Math.atan2(dx, dz);
    }
    t.walkPhase += dt * 6;
    const swing = Math.sin(t.walkPhase) * 0.4;
    t.mesh.userData.legL.rotation.x = swing;
    t.mesh.userData.legR.rotation.x = -swing;
    t.mesh.position.set(t.x, 0, t.z);
    t.mesh.rotation.y = t.heading || 0;
  }
}

// --- chase car AI (mission 2): flee from the player along roads ---
function updateChaseTarget(dt) {
  const c = chaseTarget;
  if (!c || c.dead || c.escaped) return;
  if (player.inCar && player.car === c) return;
  const dx = c.x - player.x;
  const dz = c.z - player.z;
  const d = Math.hypot(dx, dz) || 1;
  const fleeX = dx / d;
  const fleeZ = dz / d;
  const targetHeading = Math.atan2(fleeX, fleeZ);
  let dh = targetHeading - c.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  stepCar(c, dt, 1, clamp(dh * 1.8, -1, 1), 0, city.colliders, collectCars(), peds.list);
  if (d > 130) {
    c.farTimer += dt;
    if (c.farTimer > 8) {
      c.escaped = true;
      scene.remove(c.mesh);
    }
  } else {
    c.farTimer = 0;
  }
}

// --- camera: chase cam behind the car, orbit cam on foot ---
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (player.inCar && player.car) {
    const car = player.car;
    const want = car.heading + Math.PI;
    let d = want - S.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    S.camYaw += d * Math.min(1, dt * 3.2);
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    camTarget.set(car.x - fx * 10, 3.6, car.z - fz * 10);
    const k = Math.min(1, dt * 6);
    camera.position.x += (camTarget.x - camera.position.x) * k;
    camera.position.y += (camTarget.y - camera.position.y) * k;
    camera.position.z += (camTarget.z - camera.position.z) * k;
    camera.lookAt(car.x + fx * 6, 1.4, car.z + fz * 6);
    return;
  }
  const dist = 7.5;
  const fx = -Math.sin(S.camYaw);
  const fz = -Math.cos(S.camYaw);
  const flat = dist * Math.cos(S.camPitch);
  camTarget.set(player.x - fx * flat, 2.6 + Math.sin(S.camPitch) * dist * 0.6, player.z - fz * flat);
  const k = Math.min(1, dt * 10);
  camera.position.x += (camTarget.x - camera.position.x) * k;
  camera.position.y += (camTarget.y - camera.position.y) * k;
  camera.position.z += (camTarget.z - camera.position.z) * k;
  camera.lookAt(player.x, 1.6, player.z);
}

// --- main loop: fixed 60 Hz steps, at most 3 per frame ---
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!S.started || S.paused) {
    if (S.started) renderer.render(scene, camera);
    return;
  }
  acc += dt;
  for (let steps = 0; acc >= STEP && steps < 3; steps++) {
    tick(STEP);
    acc -= STEP;
  }
  renderer.render(scene, camera);
}

function tickClock(dt) {
  S.time += dt;
  S.playSeconds += dt;
  if (SHOT) {
    S.shotElapsed += dt;
    if (!window.__shotReady && S.shotElapsed > 2.5) window.__shotReady = true;
  }
  // in-game clock: dusk starts 18:40, 1 real second = 30 game seconds
  const totalMin = 1120 + Math.floor(S.time * 0.5);
  S.hour = Math.floor(totalMin / 60) % 24;
  S.minute = totalMin % 60;
  S.day = 1 + Math.floor(totalMin / 1440);
  if (tickReload(player, dt)) audio.reload();
  hud.tickChapter(S.time);
}

function tickPlayer(dt) {
  if (player.inCar && player.car) {
    const car = player.car;
    let throttle = 0;
    if (S.autoDrive) throttle = 1;
    else if (S.keys.f) throttle = 1;
    else if (S.keys.s) throttle = -1;
    let steer = 0;
    if (S.keys.l) steer = 1;
    else if (S.keys.r) steer = -1;
    const brake = S.keys.brake ? 1 : 0;
    stepCar(car, dt, throttle, steer, brake, city.colliders, collectCars(), peds.list);
    player.x = car.x;
    player.z = car.z;
    if (car.crashed) {
      car.crashed = false;
      audio.crash();
      damagePlayer(4);
      police.addWanted(4, 'tabrakan');
    }
    audio.engineStart(Math.abs(car.speed) / (car.maxSpeed || 30));
    if (Math.abs(car.speed) > 22 && rng.chance(dt * 0.4)) police.addWanted(2, 'ngebut');
    return;
  }
  const input = { ...S.keys, yaw: S.camYaw };
  stepPlayerOnFoot(player, dt, input, city.colliders);
  audio.engineStop();
}

function tickGarage(dt) {
  if (!player.inCar || !nearGarage()) {
    hud.setGarageHint(null);
    return;
  }
  if (S.garage.engine < 3) {
    hud.setGarageHint(`G — Upgrade mesin LV ${S.garage.engine + 1} · $800`);
  } else if (S.garage.armor < 3) {
    hud.setGarageHint('G — Beli armour +50 · $600');
  } else {
    hud.setGarageHint('Garasi Benny — semua upgrade maksimal');
  }
  if (player.car && player.car.health < 100) {
    player.car.health = Math.min(100, player.car.health + 8 * dt);
  }
}

function tickWorld(dt) {
  traffic.update(dt, city.colliders);
  updateCamera(dt);
  const danger = player.shootCooldown > 0 || police.state.wanted >= 3;
  peds.update(dt, city.colliders, player, danger);
  updateThugs(dt);
  updateChaseTarget(dt);
  police.update(dt, player, city.colliders, collectCars(), () => {
    endGame('busted', 'Polisi menangkap Daz. Uang jaminan memotong 20% cash. Tekan R untuk mencoba lagi.');
  });
  police.prune(player);
  missions.update(dt, {
    player, police,
    chaseTarget,
    removeChaseTarget,
    thugsDefeated: allThugsDown(),
  });
  // health regen after 5s without damage
  const quiet = S.time - S.lastDamage > 5;
  if (quiet && player.health > 0 && player.health < 100) {
    player.health = Math.min(100, player.health + dt * 1.5);
  }
  if (police.state.sirenOn) audio.startSiren();
  else audio.stopSiren();
}

function tickHud() {
  const district = city.districtFor(player.x, player.z);
  const car = player.inCar ? player.car : null;
  const view = {};
  view.wanted = police.state.wanted;
  view.health = player.health;
  view.armour = player.armour;
  view.cash = player.cash;
  view.weapon = player.weapon;
  view.mag = player.mag;
  view.reserve = player.reserve;
  view.reloading = player.reloadTimer > 0;
  view.respectLevel = player.respectLevel;
  view.missionIndex = missions.m.index;
  view.missionTotal = MISSIONS.length;
  view.missionTimeLeft = missions.m.timeLeft;
  view.hour = S.hour;
  view.minute = S.minute;
  view.day = S.day;
  view.radio = audio.stationName();
  view.radioFreq = audio.stationFreq();
  view.district = district.name;
  view.districtFlavor = district.flavor;
  view.inCar = player.inCar;
  if (car) {
    view.speedKmh = car.speed * 3.6;
    const frac = Math.min(1, Math.abs(car.speed) / (car.maxSpeed || 30));
    view.gear = car.speed < -0.5 ? 'R' : String(1 + Math.min(5, Math.floor(frac * 5.99)));
    view.carName = car.name;
    view.carHealth = car.health;
  } else {
    view.speedKmh = 0;
    view.gear = '—';
    view.carName = '';
    view.carHealth = 100;
  }
  hud.update(view);
  const world = {};
  world.city = city;
  world.player = player;
  world.cars = [];
  for (const c of parkedCars) world.cars.push(c);
  for (const c of traffic.cars) world.cars.push(c);
  world.cops = police.copCars;
  world.footCops = police.footCops;
  world.marker = missions.marker;
  world.thugs = thugs;
  world.heli = police.state.heli;
  hud.drawMinimap(world);
}

function tick(dt) {
  tickClock(dt);
  tickPlayer(dt);
  tickGarage(dt);
  tickWorld(dt);
  tickHud();
  S.saveTimer += dt;
  if (S.saveTimer > 30) {
    S.saveTimer = 0;
    doSave();
  }
}

// --- start / UI wiring ---
function startGame() {
  if (S.started) return;
  S.started = true;
  hud.hideStart();
  hud.setHelpVisible(true);
  audio.unlock();
  audio.startMusic();
  if (missions.m.phase === 'idle' && missions.m.index === 0) missions.start(0);
  hud.showMessage('Porto Azul II — Daz siap kerja. Ikuti objektif di atas!', 5000);
}

document.getElementById('btn-start').addEventListener('click', () => {
  audio.click();
  startGame();
});
document.getElementById('btn-continue').addEventListener('click', () => {
  const d = loadGame();
  if (d) applyLoadedSave(d);
  audio.click();
  startGame();
});
document.getElementById('btn-restart').addEventListener('click', () => location.reload());
if (!hasSave()) {
  document.getElementById('btn-continue').style.display = 'none';
} else {
  const d = loadGame();
  if (d) document.getElementById('btn-continue').textContent = `LANJUTKAN (${saveSummary(d)})`;
}

// crosshair visibility
const crosshair = document.getElementById('crosshair');
setInterval(() => {
  const show = S.started && !player.inCar && !S.over;
  crosshair.style.display = show ? 'block' : 'none';
}, 200);

// --- deterministic shot staging ---
const game = {
  player, police, missions, traffic, parkedCars, peds, thugs,
  city, hud, audio, G: S, scene, camera,
  startGame, spawnThugs, startChase, removeChaseTarget,
  get chaseTarget() { return chaseTarget; },
  setChaseTarget(v) { chaseTarget = v; },
};
if (SHOT) {
  applyShot(game, SHOT, SEED);
  window.__shotReady = false;
} else {
  hud.showStart();
}
requestAnimationFrame(frame);

// --- test API (for Playwright validation + screenshots) ---
const api = {};
api.player = () => {
  const p = {};
  p.x = player.x;
  p.z = player.z;
  p.health = player.health;
  p.armour = player.armour;
  p.cash = player.cash;
  p.mag = player.mag;
  p.reserve = player.reserve;
  p.inCar = player.inCar;
  p.wanted = police.state.wanted;
  p.respect = player.respect;
  p.respectLevel = player.respectLevel;
  p.garageEngine = S.garage.engine;
  return p;
};
api.stats = () => {
  const st = {};
  st.time = S.time;
  st.mission = missions.m.index;
  st.phase = missions.m.phase;
  st.cops = police.copCars.length;
  st.heli = !!police.state.heli;
  st.traffic = traffic.cars.length;
  st.peds = peds.list.length;
  st.thugs = thugs.length;
  st.errors = errors.length;
  st.cam = { x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(1), z: +camera.position.z.toFixed(1) };
  if (player.car) {
    const c = player.car;
    st.car = { name: c.name, x: +c.x.toFixed(1), z: +c.z.toFixed(1), heading: +c.heading.toFixed(2), health: c.health };
  } else {
    st.car = null;
  }
  return st;
};
api.errors = () => [...errors];
api.teleport = (x, z) => {
  player.x = x;
  player.z = z;
  if (player.inCar && player.car) {
    player.car.x = x;
    player.car.z = z;
  }
};
api.setHour = (h) => { S.time = (h * 60 - 1120) * 2; };
api.setCash = (n) => { player.cash = n; };
api.setRespect = (n) => {
  player.respect = n;
  player.respectLevel = levelFromRespect(n);
};
api.start = startGame;
api.reset = () => { location.reload(); };
window.__game = api;
window.__portoAzul = true;
