// Deterministic dossier shots. Each shot pins the whole game state (cash, wanted,
// weapon, timer, district, clock, race, EMP, nitro, spike warning) and stages the
// world around the player: pursuit cops on the flanks, roadblock + spike strip ahead,
// rivals ahead, the boat in the harbor water. The world is frozen for the capture.
import * as THREE from 'three';
import { districtAt } from './turf.js';
import { buildCar, buildBoat, CAR_MODELS } from './vehicles.js';

function setBase(state, o) {
  Object.assign(state, o);
  state.districtObj = districtAt(o.playerX, o.playerZ);
  state.playerPos = new THREE.Vector3(o.playerX, 0, o.playerZ);
  state.objectivePos = { x: o.objX, z: o.objZ };
  state.routeName = o.routeName;
}

export const SHOT_NAMES = ['drive', 'foot', 'chase', 'mission'];

export function applyShot(name, ctx) {
  const { state, player, police, traffic, scene } = ctx;
  state.frozen = true;
  state.day = 1;
  state.health = 100;
  state.armour = 0;
  state.respect = 4;
  state.missionsDone = 0;
  state.sideJobsDone = 0;
  state.carsStolen = 3;
  state.sideJob = null;
  state.racePos = null;
  state.spikeWarning = false;
  state.spiked = false;
  state.pitSpin = 0;
  state.hint = '';
  state.boatPos = null;
  if (!state.turfStanding) state.turfStanding = {};
  for (const d of ['TORRE PLAZA', 'THE MIRAGE STRIP', 'HARBOR EAST', 'PALMLINE BEACH', 'OLD TOWN', 'MARINA BAY']) {
    if (state.turfStanding[d] === undefined) state.turfStanding[d] = 0;
  }

  if (name === 'drive') {
    // Chapter 9/12 STREET KINGS race, Comet GT, 152 km/h, NITRO, 1/6, dusk.
    // Race runs down the Torre Plaza road (x=-180).
    setBase(state, {
      missionNum: 9, missionName: 'STREET KINGS', missionStageLabel: '',
      missionObjective: 'Win the 3-lap street race — Lap 2/3',
      missionTimer: 92, cash: 22400, wanted: 2, clock: 19.07,
      playerX: -180, playerZ: -160, objX: -180, objZ: -260, routeName: 'RACE CHECKPOINT',
      speedKmh: 152, driving: true, carName: 'Comet GT', carHealth: 100,
      weaponIdx: 1, racePos: 1, hint: 'NITRO ACTIVE — HOLD SHIFT',
    });
    state.ammo = [Infinity, 24, 6, 30, 6];
    state.ammoReserve = [Infinity, 120, 24, 90, 0];
    state.crew.nitroCharges = 2;
    state.crew.nitroActive = true;
    state.crew.empState = 'ready'; state.crew.empTimer = 0;
    ctx.input.camYaw = Math.PI;
    const car = buildCar(CAR_MODELS[0]);
    car.position.set(-180, 0, -160);
    car.rotation.y = Math.PI; // heading -z along the road
    scene.add(car);
    player.enterCar({ group: car, model: CAR_MODELS[0] });
    player.speedMs = 152 / 3.6;
    player.speedKmh = 152;
    player.yaw = Math.PI;
    // Rival race cars ahead.
    const rivals = [[-186, -185, 2], [-174, -198, 3], [-186, -212, 4]];
    for (const [rx, rz, i] of rivals) {
      const rc = buildCar(CAR_MODELS[i % CAR_MODELS.length]);
      rc.position.set(rx, 0, rz);
      rc.rotation.y = Math.PI;
      scene.add(rc);
    }
    // Oncoming traffic + pursuit cops on the flanks, behind.
    const t0 = traffic.cars[0];
    if (t0) { t0.group.position.set(-186, 0, -120); t0.group.rotation.y = 0; }
    const t1 = traffic.cars[1];
    if (t1) { t1.group.position.set(-174, 0, -100); t1.group.rotation.y = 0; }
    police.setWanted(2);
    const c0 = police.cops[0];
    if (c0) { c0.group.position.set(-198, 0, -140); c0.group.rotation.y = Math.PI; }
    const c1 = police.cops[1];
    if (c1) { c1.group.position.set(-162, 0, -145); c1.group.rotation.y = Math.PI; }
    if (police.helis[0]) police.helis[0].group.position.set(-180, 42, -190);
  }

  if (name === 'foot') {
    // Chapter 11/12 TURF WAR, on foot, night 21:40, Carbine Rifle 42/90, EMP READY.
    // Player stands on the Mirage Strip road crossing (x=-60, z=-140), facing north.
    setBase(state, {
      missionNum: 11, missionName: 'TURF WAR', missionStageLabel: '',
      missionObjective: 'Take the Strip turf — clear the gang corner',
      missionTimer: 221, cash: 31700, wanted: 4, clock: 21.67,
      playerX: -60, playerZ: -140, objX: -60, objZ: -190, routeName: 'GANG CORNER',
      speedKmh: 0, driving: false, carName: 'ON FOOT', carHealth: 100,
      weaponIdx: 3, hint: 'X — EMP PULSE READY · Q — WEAPON WHEEL',
    });
    state.ammo = [Infinity, 30, 6, 42, 6];
    state.ammoReserve = [Infinity, 120, 24, 90, 0];
    state.health = 88; state.armour = 55;
    state.turfStanding['THE MIRAGE STRIP'] = 3;
    state.crew.nitroCharges = 3;
    state.crew.nitroActive = false;
    state.crew.empState = 'ready'; state.crew.empTimer = 0;
    ctx.input.camYaw = Math.PI;
    player.group.position.set(-60, 0, -140);
    player.yaw = Math.PI;
    player.group.rotation.y = Math.PI;
    police.setWanted(4);
    // Cops + cop cars around, none in the center band.
    const spots = [[-76, -128], [-44, -128], [-76, -158], [-44, -158]];
    police.cops.forEach((c, i) => {
      const s = spots[i % spots.length];
      c.group.position.set(s[0], 0, s[1]);
      c.group.rotation.y = Math.atan2(-60 - s[0], -140 - s[1]);
    });
    police.footCops.forEach((f, i) => {
      const s = [[-68, -132], [-52, -132], [-68, -148], [-52, -148]][i % 4];
      f.group.position.set(s[0], 0, s[1]);
    });
    if (police.helis[0]) police.helis[0].group.position.set(-50, 42, -170);
  }

  if (name === 'chase') {
    // Chapter 12/12 THE LAST SCORE STAGE 2, Neon Runner 148 km/h, MOST WANTED,
    // heli + roadblock + spike strip ahead, boat in the harbor water.
    setBase(state, {
      missionNum: 12, missionName: 'THE LAST SCORE', missionStageLabel: 'STAGE 2/3 — FIVE-STAR CHASE',
      missionObjective: 'Break the harbor cordon — reach the boat',
      missionTimer: 125, cash: 58000, wanted: 5, clock: 19.08,
      playerX: 180, playerZ: -100, objX: 250, objZ: -88, routeName: 'VELA SPEEDBOAT',
      speedKmh: 148, driving: true, carName: 'Neon Runner', carHealth: 82,
      weaponIdx: 1, hint: 'MOST WANTED — BREAK THE CORDON',
    });
    state.ammo = [Infinity, 18, 6, 30, 6];
    state.ammoReserve = [Infinity, 120, 24, 90, 0];
    state.crew.nitroCharges = 1;
    state.crew.nitroActive = false;
    state.crew.empState = 'cooldown'; state.crew.empTimer = 34;
    const car = buildCar(CAR_MODELS[1]);
    car.position.set(180, 0, -100);
    car.rotation.y = Math.PI / 2; // heading +x toward the harbor
    scene.add(car);
    player.enterCar({ group: car, model: CAR_MODELS[1] });
    player.speedMs = 148 / 3.6;
    player.speedKmh = 148;
    player.yaw = Math.PI / 2;
    state.carHealth = 82; // enterCar resets it to 100; the chase has already cost paint
    police.setWanted(5);
    // Roadblock + spike strip ahead on the route, close enough to read.
    police.deployRoadblock(220, -92);
    police.deploySpike(205, -97);
    state.spikeWarning = true;
    // Pursuit cops flanking.
    const c0 = police.cops[0];
    if (c0) { c0.group.position.set(165, 0, -116); c0.group.rotation.y = Math.PI / 2; }
    const c1 = police.cops[1];
    if (c1) { c1.group.position.set(163, 0, -84); c1.group.rotation.y = Math.PI / 2; }
    if (police.helis[0]) police.helis[0].group.position.set(195, 42, -120);
    if (police.helis[1]) police.helis[1].group.position.set(170, 46, -70);
    // Vela Speedboat waiting in the water, ahead-right.
    const boat = buildBoat();
    boat.position.set(250, 0.4, -88);
    boat.rotation.y = -Math.PI / 2;
    scene.add(boat);
    state.boatPos = { x: 250, z: -88 };
    ctx.boat = boat;
  }

  if (name === 'mission') {
    // Chapter 12/12 THE LAST SCORE STAGE 1/3, casino vault, Molotov 4/6, EMP ACTIVE.
    // Player on the road west of Casino Royale (x=-60, z=-140), facing east at the vault.
    setBase(state, {
      missionNum: 12, missionName: 'THE LAST SCORE', missionStageLabel: 'STAGE 1/3 — CASINO VAULT',
      missionObjective: 'Crack the Royale vault — grab the cash',
      missionTimer: 72, cash: 48500, wanted: 4, clock: 19.08,
      playerX: -60, playerZ: -140, objX: 0, objZ: -140, routeName: 'CASINO ROYALE VAULT',
      speedKmh: 0, driving: false, carName: 'ON FOOT', carHealth: 100,
      weaponIdx: 4, hint: 'MARA EMP ACTIVE — POLICE BLIND 6s',
    });
    state.ammo = [Infinity, 30, 6, 30, 4];
    state.ammoReserve = [Infinity, 120, 24, 90, 0];
    state.health = 91; state.armour = 40;
    state.crew.nitroCharges = 3;
    state.crew.nitroActive = false;
    state.crew.empState = 'active'; state.crew.empTimer = 6;
    ctx.input.camYaw = Math.PI / 2; // camera west of player, looking east at the casino
    player.group.position.set(-60, 0, -140);
    player.yaw = Math.PI / 2;
    player.group.rotation.y = Math.PI / 2;
    police.setWanted(4);
    // Vault guards (foot cops) close, east of the player; cop cars on the flanks,
    // kept out of the banner's center band.
    police.footCops.forEach((f, i) => {
      const s = [[-40, -132], [-40, -148], [-25, -135], [-25, -145]][i % 4];
      f.group.position.set(s[0], 0, s[1]);
    });
    police.cops.forEach((c, i) => {
      const s = [[-30, -118], [-30, -162], [-14, -118], [-14, -162]][i % 4];
      c.group.position.set(s[0], 0, s[1]);
      c.group.rotation.y = Math.atan2(-60 - s[0], -140 - s[1]);
    });
    if (police.helis[0]) police.helis[0].group.position.set(-40, 42, -170);
  }

  // Radio stays on SOL FM for every shot.
  state.radio = { name: 'SOL FM 95.4', genre: 'SYNTHWAVE' };
}
