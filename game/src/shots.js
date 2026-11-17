// Screenshot staging for Porto Azul II: the four dossier shots are frozen
// mid-action scenes — the world is pinned (camera lerp, drag decay, cop
// rams and garage payouts all race a live capture, so nothing moves here),
// the HUD is set to the exact values the brief demands, and the frame is
// rendered twice before window.__shotReady is set.
import { MISSIONS } from './missions.js';

const SHOTS = {
  '1-drive': {
    mission: 1, cash: 18450, wanted: 4, health: 100, armour: 40,
    timer: 134, clock: 19 * 60 + 7, onFoot: false, carKey: 'comet',
    speedKmh: 137, x: -60, z: -120, heading: Math.PI / 2,
    camBack: 15, camUp: 6.5, camAhead: 12,
  },
  '2-foot': {
    mission: 3, cash: 12300, wanted: 2, health: 91, armour: 40,
    timer: 298, clock: 19 * 60 + 7, onFoot: true, carKey: 'azul',
    speedKmh: 0, x: 150, z: 2, heading: Math.PI,
    camBack: 9, camUp: 4.2, camAhead: 8,
    marker: { x: 150, z: -12 },
  },
  '3-chase': {
    mission: 2, cash: 24000, wanted: 5, health: 88, armour: 55,
    timer: 180, clock: 19 * 60 + 8, onFoot: false, carKey: 'neon',
    speedKmh: 144, x: -60, z: -90, heading: Math.PI,
    camBack: 15, camUp: 7, camAhead: 12,
  },
  '4-mission': {
    mission: 4, cash: 48500, wanted: 4, health: 76, armour: 40,
    timer: 105, clock: 19 * 60 + 8, onFoot: true, carKey: 'azul',
    speedKmh: 0, x: 150, z: 2, heading: Math.PI,
    camBack: 10, camUp: 5.5, camAhead: 9,
    marker: { x: 150, z: -12 },
  },
};

export const SHOT_NAMES = Object.keys(SHOTS);

function placeCopRow(game, spec, spots) {
  game.police.ensureCops(spec.wanted, spec.x, spec.z);
  spots.forEach((s, i) => {
    game.police.placeCop(i, s[0], s[1], s[2]);
  });
  game.police.ensureFootCops(spec.onFoot ? Math.min(spec.wanted, 4) : 0, spec.x, spec.z);
}

export function stageShot(name, game) {
  const spec = SHOTS[name] || SHOTS['1-drive'];
  const mission = MISSIONS[spec.mission];
  const s = game.state;
  game.frozen = true;

  // HUD state: exact staged values.
  s.cash = spec.cash;
  s.wanted = spec.wanted;
  s.health = spec.health;
  s.armour = spec.armour;
  s.respect = 4;
  s.day = 1;
  s.clockMinutes = spec.clock;
  s.missionIndex = spec.mission;
  s.missionLabel = mission.chapter + ': ' + mission.title;
  s.objective = mission.objective;
  s.missionTimer = spec.timer;
  s.missionActive = true;
  s.weaponName = 'HORNET SMG';
  s.ammo = name === '4-mission' ? 18 : 24;
  s.ammoReserve = 120;
  s.radioStation = 0;
  s.radioLabel = 'SOL FM 95.4 · SYNTHWAVE';
  s.onFoot = spec.onFoot;
  s.carKey = spec.carKey;
  s.speedKmh = spec.speedKmh;
  s.carCondition = 100;

  // Player pose.
  const p = game.player;
  p.x = spec.x; p.z = spec.z; p.heading = spec.heading;
  p.onFoot = spec.onFoot;
  p.speed = spec.onFoot ? 0 : spec.speedKmh / 3.6;
  if (!spec.onFoot) {
    p.setCar(spec.carKey);
    p.carGroup.position.set(spec.x, 0, spec.z);
    p.carGroup.rotation.y = spec.heading;
    p.group.visible = false;
  } else {
    p.clearCar();
    p.group.position.set(spec.x, 0, spec.z);
    p.group.rotation.y = spec.heading;
    p.group.visible = true;
  }
  s.playerX = spec.x; s.playerZ = spec.z; s.heading = spec.heading;
  s.district = game.city.districtAt(spec.x, spec.z);
  s.carName = p.carDef.name;
  s.gear = p.gear;

  // Mission target marker + route for the minimap (a shot may pin the
  // marker to the visible vault door instead of the inside target).
  const target = game.city.spots[mission.target];
  const markerTarget = spec.marker || target;
  s.target = markerTarget;
  game.setMarker(markerTarget.x, markerTarget.z);

  // Camera: pinned behind the player, looking ahead down the action.
  const fx = Math.sin(spec.heading);
  const fz = Math.cos(spec.heading);
  game.setCameraPose(
    [spec.x - fx * spec.camBack, spec.camUp, spec.z - fz * spec.camBack],
    [spec.x + fx * spec.camAhead, 1.6, spec.z + fz * spec.camAhead]
  );

  // Traffic: staged around the player, never on top of them.
  const t = game.traffic.cars;
  if (name === '1-drive') {
    // Tono's red car ahead in the same lane, oncoming cars in the far lane.
    game.tonoCar.visible = true;
    game.tonoCar.position.set(spec.x + 20, 0, spec.z - 3.4);
    game.tonoCar.rotation.y = Math.PI / 2;
    const spots = [
      [spec.x - 26, spec.z + 3.4, -Math.PI / 2],
      [spec.x + 34, spec.z + 3.4, -Math.PI / 2],
      [spec.x - 44, spec.z - 3.4, Math.PI / 2],
      [spec.x + 48, spec.z + 3.4, -Math.PI / 2],
    ];
    spots.forEach((sp, i) => {
      const c = t[i % t.length];
      c.group.position.set(sp[0], 0, sp[1]);
      c.group.rotation.y = sp[2];
      c.x = sp[0]; c.z = sp[1];
    });
  } else if (name === '3-chase') {
    game.tonoCar.visible = false;
    const spots = [
      [spec.x + 4, spec.z + 26, 0],
      [spec.x - 5, spec.z - 30, Math.PI],
      [spec.x + 22, spec.z + 14, 0.4],
      [spec.x - 24, spec.z - 12, Math.PI + 0.3],
    ];
    spots.forEach((sp, i) => {
      const c = t[i % t.length];
      c.group.position.set(sp[0], 0, sp[1]);
      c.group.rotation.y = sp[2];
      c.x = sp[0]; c.z = sp[1];
    });
  } else {
    game.tonoCar.visible = false;
    // Strip traffic cruising past the casino for the foot shots.
    const spots = [
      [120, -120, Math.PI / 2], [96, -120, Math.PI / 2], [180, -90, -Math.PI / 2],
      [120, -150, Math.PI / 2], [186, -120, -Math.PI / 2],
    ];
    spots.forEach((sp, i) => {
      const c = t[i % t.length];
      c.group.position.set(sp[0], 0, sp[1]);
      c.group.rotation.y = sp[2];
      c.x = sp[0]; c.z = sp[1];
    });
  }

  // Police: flanking pursuit, kept out of the player's centre line and —
  // for shot 4 — out of the chapter banner's centre band entirely.
  if (name === '1-drive') {
    placeCopRow(game, spec, [
      [spec.x - 16, spec.z - 10, Math.PI / 2],
      [spec.x - 14, spec.z + 11, Math.PI / 2],
      [spec.x + 30, spec.z + 12, Math.PI / 2],
      [spec.x + 44, spec.z - 12, -Math.PI / 2],
    ]);
    game.police.placeHeli(spec.x + 18, spec.z - 14, true);
    game.police.placeFootCop(0, spec.x + 8, spec.z + 14);
  } else if (name === '2-foot') {
    placeCopRow(game, spec, [
      [spec.x - 16, spec.z, 0.4],
      [spec.x + 16, spec.z - 6, -2.6],
    ]);
    game.police.placeFootCop(0, spec.x - 8, spec.z - 8);
    game.police.placeFootCop(1, spec.x + 8, spec.z - 6);
    game.police.placeHeli(0, 0, false);
  } else if (name === '3-chase') {
    placeCopRow(game, spec, [
      [spec.x - 6, spec.z + 18, Math.PI],
      [spec.x + 7, spec.z + 16, Math.PI],
      [spec.x - 12, spec.z - 20, 0],
      [spec.x + 13, spec.z - 22, 0],
      [spec.x - 22, spec.z + 8, Math.PI],
      [spec.x + 24, spec.z + 6, Math.PI],
    ]);
    game.police.placeHeli(spec.x - 12, spec.z - 18, true);
  } else {
    placeCopRow(game, spec, [
      [spec.x - 22, spec.z - 18, 0.6],
      [spec.x + 22, spec.z - 18, -0.6],
      [spec.x - 16, spec.z - 26, 0.4],
      [spec.x + 16, spec.z - 26, -0.4],
    ]);
    // Vault guards at the casino door, low in frame, clear of the banner.
    game.police.placeFootCop(0, 142, -14);
    game.police.placeFootCop(1, 158, -14);
    game.police.placeFootCop(2, spec.x - 9, spec.z + 4);
    game.police.placeFootCop(3, spec.x + 9, spec.z + 4);
    game.police.placeHeli(spec.x + 10, spec.z - 20, true);
  }

  // Chapter banner, held for the whole capture.
  game.hud.showBanner(mission.chapter, mission.title, mission.brief, 3600);
  game.hud.update(s);
  return { screen: 'shot' };
}
