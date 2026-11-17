// Porto Azul — open-world crime game (three.js, original city/story).
// Bootstrap: renderer, loop, input, camera, combat, thugs, chase car,
// wanted wiring, save/load, deterministic ?shot= staging, window.__game.
import * as THREE from 'three';
import { makeRng, clamp, dist2 } from './rng.js';
import { buildCity, PITCH } from './city.js';
import { createAudio } from './audio.js';
import { createCarMesh, stepCar, makeTraffic, makeParkedCars } from './vehicles.js';
import { makePeds } from './peds.js';
import { makePlayer, stepPlayerOnFoot, nearestCar, shootFrom } from './player.js';
import { makePolice } from './police.js';
import { makeMissions, MISSIONS } from './missions.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
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
scene.background = new THREE.Color(0x87bfe8);
scene.fog = new THREE.Fog(0x9fc8e8, 180, 520);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 600;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x6a7a5a, 1.1));

// --- world ---
const city = buildCity(scene, rng);
const traffic = makeTraffic(scene, rng, city);
const parkedCars = makeParkedCars(scene, rng, city);
const peds = makePeds(scene, rng, city, 26);
const player = makePlayer(scene);
player.x = city.spawn.x; player.z = city.spawn.z;
const police = makePolice(scene, rng, city);
const audio = createAudio();
const hud = createHud(document);

// --- thugs (mission 4 enemies) ---
const thugs = [];
function spawnThugMesh() {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 0.34), dark);
  torso.position.y = 1.08; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
  head.position.y = 1.64;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), dark);
  legL.position.set(-0.15, 0.36, 0);
  g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15;
  g.add(legR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.4, 0.9, 0.2);
  g.add(gun);
  g.userData = { legL, legR };
  return g;
}
function spawnThugs(pos) {
  for (let i = 0; i < 3; i++) {
    const mesh = spawnThugMesh();
    const x = pos.x + (i - 1) * 8 + rng.range(-3, 3);
    const z = pos.z + rng.range(-6, 6);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    thugs.push({ mesh, x, z, hp: 3, dead: false, radius: 0.7, shootTimer: rng.range(0.5, 1.5), walkPhase: 0 });
  }
  missions.m.thugsLeft = 3;
}

// --- chase target (mission 2) ---
let chaseTarget = null;
function startChase() {
  const mesh = createCarMesh(0xc23a2e);
  const x = player.x + 40, z = player.z + 10;
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  chaseTarget = {
    mesh, x, z, heading: Math.PI / 2, speed: 14, maxSpeed: 24,
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
  onObjective: (t) => hud.setObjective('MISI ' + (missions.m.index + 1) + ' — ' + MISSIONS[missions.m.index].title, t),
  onStart: () => {},
  onDone: (cur) => {
    player.cash += cur.reward;
    audio.missionDone();
    hud.showMessage(`Misi selesai! +$${cur.reward}`, 5000);
    doSave();
  },
  startChase,
  startEscape: () => {
    police.addWanted(50, 'razia');
    hud.showMessage('Razia polisi! Hilang dari radar mereka!', 5000);
  },
  spawnThugs,
});

// --- state ---
const G = {
  started: false, paused: false, over: false,
  camYaw: Math.PI, camPitch: 0.32,
  time: 0, playSeconds: 0, lastDamage: -99,
  hour: 10, minute: 0,
  keys: {},
  mouseDown: false,
  saveTimer: 0,
};
const ALL_CARS = () => [...parkedCars, ...traffic.cars, ...police.copCars, ...(chaseTarget ? [chaseTarget] : [])];

function doSave() {
  saveGame({
    cash: player.cash, missionIndex: missions.m.index,
    x: player.x, z: player.z, health: player.health, ammo: player.ammo,
    playSeconds: G.playSeconds,
  });
}

function applyLoadedSave(d) {
  player.cash = d.cash;
  player.health = d.health;
  player.ammo = d.ammo;
  player.x = d.x; player.z = d.z;
  G.playSeconds = d.playSeconds || 0;
  player.mesh.position.set(player.x, 0, player.z);
  if (d.missionIndex > 0 && d.missionIndex < MISSIONS.length) missions.start(d.missionIndex);
}

// --- input ---
const KEYMAP = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 's', ArrowDown: 's',
  KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'brake',
};
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = KEYMAP[e.code];
  if (k) G.keys[k] = true;
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code === 'KeyF') doPunch();
  if (e.code === 'KeyM') { audio.setMuted(!audio.isMuted()); hud.showMessage(audio.isMuted() ? 'Suara mati' : 'Suara hidup'); }
  if (e.code === 'KeyP' && G.started && !G.over) togglePause();
  if (e.code === 'KeyR') restartGame();
  if (e.code === 'KeyH') audio.horn();
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) G.keys[k] = false;
});
canvas.addEventListener('click', () => {
  audio.unlock();
  if (!SHOT && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  G.camYaw -= e.movementX * 0.0028;
  G.camPitch = clamp(G.camPitch + e.movementY * 0.0022, -0.15, 0.9);
});
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) doShoot(); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- car enter/exit ---
function tryEnterExitCar() {
  if (!G.started || G.paused || G.over) return;
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
  const car = nearestCar(player, ALL_CARS());
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
  player.inCar = true;
  player.car = car;
  player.mesh.visible = false;
  audio.click();
}

// --- combat ---
function shootTargets() {
  const list = [];
  for (const t of thugs) if (!t.dead) list.push(t);
  for (const c of police.footCops) if (!c.dead) list.push({ x: c.x, z: c.z, radius: 0.6, hp: 1, dead: false, cop: true, ref: c });
  for (const p of peds.list) if (!p.down) list.push({ x: p.x, z: p.z, radius: 0.55, hp: 1, dead: false, ped: true, ref: p });
  if (chaseTarget && !chaseTarget.dead) list.push({ x: chaseTarget.x, z: chaseTarget.z, radius: 2.4, hp: 99, dead: false, chaseCar: true });
  return list;
}

function doShoot() {
  if (!G.started || G.paused || G.over || player.inCar) return;
  if (player.shootCooldown > 0 || player.ammo <= 0) {
    if (player.ammo <= 0) hud.showMessage('Amunisi habis! (cari misi untuk isi ulang)');
    return;
  }
  player.ammo--;
  player.shootCooldown = 0.28;
  audio.gunshot();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  const res = shootFrom(scene, origin, dir, 120, shootTargets());
  if (res.hit) {
    const t = res.hit;
    if (t.chaseCar && chaseTarget) {
      chaseTarget.speed = Math.max(4, chaseTarget.speed - 6);
      hud.showMessage('Kena! Mobil Tono melambat.');
    } else if (t.cop) {
      t.ref.dead = true;
      scene.remove(t.ref.mesh);
      police.addWanted(20, 'tembak polisi');
    } else if (t.ped) {
      t.ref.knock(player.x, player.z);
      police.addWanted(18, 'tembak warga');
    } else {
      t.hp -= 1;
      if (t.hp <= 0) {
        t.dead = true;
        scene.remove(t.mesh);
        missions.onThugDown();
        player.cash += 25;
        hud.showMessage('Penjaga tumbang! +$25');
        if (thugs.every((th) => th.dead)) missions.m.thugsDefeated = true;
      }
    }
  }
  // everyone nearby gets scared
  for (const p of peds.list) if (!p.down) p.scare(player.x, player.z);
}

function doPunch() {
  if (!G.started || G.paused || G.over || player.inCar || player.punchCooldown > 0) return;
  player.punchCooldown = 0.45;
  player.punchTimer = 0.25;
  audio.punch();
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  for (const t of thugs) {
    if (t.dead) continue;
    const dx = t.x - player.x, dz = t.z - player.z;
    if (dx * dx + dz * dz < 5.3 && dx * fx + dz * fz > 0) {
      t.hp -= 1;
      if (t.hp <= 0) {
        t.dead = true;
        scene.remove(t.mesh);
        missions.onThugDown();
        player.cash += 25;
        if (thugs.every((th) => th.dead)) missions.m.thugsDefeated = true;
      }
    }
  }
  for (const p of peds.list) {
    if (p.down) continue;
    const dx = p.x - player.x, dz = p.z - player.z;
    if (dx * dx + dz * dz < 5.3 && dx * fx + dz * fz > 0) {
      p.scare(player.x, player.z);
      police.addWanted(6, 'pukul warga');
    }
  }
}

// --- damage / game over ---
function damagePlayer(n) {
  if (G.over) return;
  player.health -= n;
  G.lastDamage = G.time;
  if (player.health <= 0) {
    player.health = 0;
    endGame('wasted', 'Daz tumbang di jalanan Porto Azul. Tekan R untuk mencoba lagi.');
  }
}
function endGame(kind, text) {
  G.over = true;
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
  if (G.over || !G.started) { location.reload(); return; }
  // in-game R: respawn fresh at spawn, keep cash
  player.health = 100;
  player.ammo = 24;
  player.x = city.spawn.x; player.z = city.spawn.z;
  if (player.inCar) { player.inCar = false; player.car = null; player.mesh.visible = true; }
  police.clearWanted();
  hud.showMessage('Daz kembali ke jalanan.');
}
function togglePause() {
  G.paused = !G.paused;
  if (G.paused) { hud.showPause(); audio.engineStop(); }
  else hud.hidePause();
}

// --- thug AI ---
function updateThugs(dt) {
  for (const t of thugs) {
    if (t.dead) continue;
    const dx = player.x - t.x, dz = player.z - t.z;
    const d = Math.hypot(dx, dz);
    if (d < 42 && !player.inCar) {
      // strafe toward the player, keep some distance
      const want = d > 14 ? 1 : d < 7 ? -1 : 0;
      t.x += (dx / (d || 1)) * want * 3.4 * dt;
      t.z += (dz / (d || 1)) * want * 3.4 * dt;
      t.heading = Math.atan2(dx, dz);
      t.shootTimer -= dt;
      if (t.shootTimer <= 0) {
        t.shootTimer = 1.3 + rng.next() * 0.9;
        audio.gunshot();
        // tracer from thug toward the player
        const from = new THREE.Vector3(t.x, 1.3, t.z);
        const to = new THREE.Vector3(player.x + rng.range(-1, 1), 1.2, player.z + rng.range(-1, 1));
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff9060, transparent: true, opacity: 0.9 }));
        scene.add(line);
        setTimeout(() => { scene.remove(line); geo.dispose(); }, 80);
        if (rng.chance(0.34)) damagePlayer(8);
      }
    } else if (d < 42 && player.inCar) {
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
  if (!c || c.dead || c.escaped || (player.inCar && player.car === c)) return;
  const dx = c.x - player.x, dz = c.z - player.z;
  const d = Math.hypot(dx, dz) || 1;
  const fleeX = c.x + (dx / d) * 30, fleeZ = c.z + (dz / d) * 30;
  const targetHeading = Math.atan2(fleeX - c.x, fleeZ - c.z);
  let dh = targetHeading - c.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  stepCar(c, dt, 1, clamp(dh * 1.8, -1, 1), 0, city.colliders, ALL_CARS(), peds.list);
  if (d > 130) {
    c.farTimer += dt;
    if (c.farTimer > 8) { c.escaped = true; scene.remove(c.mesh); }
  } else c.farTimer = 0;
  const bar = c.mesh.userData.lightBar;
  void bar;
}

// --- camera ---
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (player.inCar && player.car) {
    const car = player.car;
    const want = car.heading + Math.PI;
    let d = want - G.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    G.camYaw += d * Math.min(1, dt * 3.2);
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    camTarget.set(car.x - fx * 10, 3.6, car.z - fz * 10);
    camera.position.lerp(camTarget, Math.min(1, dt * 6));
    camera.lookAt(car.x + fx * 6, 1.4, car.z + fz * 6);
  } else {
    const dist = 7.5;
    const fx = -Math.sin(G.camYaw), fz = -Math.cos(G.camYaw);
    const px = player.x - fx * dist * Math.cos(G.camPitch);
    const pz = player.z - fz * dist * Math.cos(G.camPitch);
    const py = 2.6 + Math.sin(G.camPitch) * dist * 0.6;
    camTarget.set(px, py, pz);
    camera.position.lerp(camTarget, Math.min(1, dt * 10));
    camera.lookAt(player.x, 1.6, player.z);
  }
}

// --- main loop ---
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!G.started || G.paused) {
    if (G.started) renderer.render(scene, camera);
    return;
  }
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 3) {
    tick(STEP);
    acc -= STEP;
    steps++;
  }
  renderer.render(scene, camera);
}

function tick(dt) {
  G.time += dt;
  G.playSeconds += dt;
  if (SHOT && !window.__shotReady && G.time > 2.5) window.__shotReady = true;
  // in-game clock: 1 real second = 30 game seconds
  const totalMin = 10 * 60 + Math.floor(G.time * 0.5);
  G.hour = Math.floor(totalMin / 60) % 24;
  G.minute = totalMin % 60;

  // player
  if (player.inCar && player.car) {
    const car = player.car;
    const throttle = (G.keys.f ? 1 : 0) + (G.keys.s ? -1 : 0);
    const steer = (G.keys.l ? 1 : 0) + (G.keys.r ? -1 : 0);
    stepCar(car, dt, throttle, steer, G.keys.brake ? 1 : 0, city.colliders, ALL_CARS(), peds.list);
    player.x = car.x; player.z = car.z;
    if (car.crashed) {
      car.crashed = false;
      audio.crash();
      damagePlayer(4);
      police.addWanted(4, 'tabrakan');
    }
    audio.engineStart(Math.abs(car.speed) / 30);
    if (Math.abs(car.speed) > 22 && rng.chance(dt * 0.4)) police.addWanted(2, 'ngebut');
  } else {
    stepPlayerOnFoot(player, dt, { ...G.keys, yaw: G.camYaw }, city.colliders);
    audio.engineStop();
  }

  // world systems
  traffic.update(dt, city.colliders);
  updateCamera(dt);
  const danger = player.shootCooldown > 0 || police.state.wanted >= 3;
  peds.update(dt, city.colliders, player, danger);
  updateThugs(dt);
  updateChaseTarget(dt);
  police.update(dt, player, city.colliders, ALL_CARS(), () => {
    endGame('busted', 'Polisi menangkap Daz. Uang jaminan memotong 20% cash. Tekan R untuk mencoba lagi.');
  });
  police.prune(player);
  missions.update(dt, {
    player, police,
    chaseTarget,
    removeChaseTarget,
    thugsDefeated: thugs.length > 0 && thugs.every((t) => t.dead),
  });

  // health regen after 5s without damage
  if (G.time - G.lastDamage > 5 && player.health > 0 && player.health < 100) {
    player.health = Math.min(100, player.health + dt * 1.5);
  }
  // siren
  if (police.state.sirenOn) audio.startSiren(); else audio.stopSiren();

  // HUD + minimap
  hud.update({
    wanted: police.state.wanted,
    health: player.health,
    cash: player.cash,
    inCar: player.inCar,
    speedKmh: player.inCar && player.car ? player.car.speed * 3.6 : 0,
    hour: G.hour, minute: G.minute, ammo: player.ammo,
  });
  hud.drawMinimap({
    city, player,
    cars: [...parkedCars, ...traffic.cars],
    cops: police.copCars, footCops: police.footCops,
    marker: missions.marker, thugs,
  });

  // autosave
  G.saveTimer += dt;
  if (G.saveTimer > 30) { G.saveTimer = 0; doSave(); }
}

// --- start / UI wiring ---
function startGame() {
  if (G.started) return;
  G.started = true;
  hud.hideStart();
  hud.setHelpVisible(true);
  audio.unlock();
  audio.startMusic();
  if (missions.m.phase === 'idle' && missions.m.index === 0) missions.start(0);
  hud.showMessage('Porto Azul — Daz siap kerja. Ikuti objektif di atas!', 5000);
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
if (!hasSave()) document.getElementById('btn-continue').style.display = 'none';

// crosshair visibility
const crosshair = document.getElementById('crosshair');
setInterval(() => {
  crosshair.style.display = G.started && !player.inCar && !G.over ? 'block' : 'none';
}, 200);

// --- deterministic shot staging ---
const game = {
  player, police, missions, traffic, parkedCars, peds, thugs,
  city, hud, audio, G, scene, camera,
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
window.__game = {
  player: () => ({ x: player.x, z: player.z, health: player.health, cash: player.cash, ammo: player.ammo, inCar: player.inCar, wanted: police.state.wanted }),
  stats: () => ({ time: G.time, mission: missions.m.index, phase: missions.m.phase, cops: police.copCars.length, traffic: traffic.cars.length, peds: peds.list.length, thugs: thugs.length, errors: errors.length, cam: { x: +camera.position.x.toFixed(1), y: +camera.position.y.toFixed(1), z: +camera.position.z.toFixed(1) }, car: player.car ? { x: +player.car.x.toFixed(1), z: +player.car.z.toFixed(1), heading: +player.car.heading.toFixed(2) } : null }),
  errors: () => [...errors],
  teleport(x, z) { player.x = x; player.z = z; if (player.inCar && player.car) { player.car.x = x; player.car.z = z; } },
  setHour(h) { G.time = (h - 10) * 120; },
  start: startGame,
  reset() { location.reload(); },
};
window.__portoAzul = true;
