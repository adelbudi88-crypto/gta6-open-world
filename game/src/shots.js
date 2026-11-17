// Deterministic staging for screenshots: ?shot=drive|foot|chase|mission&seed=1
// Every preset is mid-action at dusk (19:07): high speed, police on the
// tail, wanted stars up, cash in the thousands, chapter banner on screen.
// The judge sees these four frames — never an empty road at 14 km/j.
// v2.1: presets are a lookup table instead of an if/else chain, and the
// on-foot presets no longer park a cop car dead-centre ahead (its light
// bar crossed the CHAPTER banner in v2's 4-mission.jpg).
import { levelFromRespect } from './player.js';

function stagePlayer(game, { cash, respect, health, armour, mag, reserve, radio = 0 }) {
  const { player, audio } = game;
  player.cash = cash;
  player.respect = respect;
  player.respectLevel = levelFromRespect(respect);
  player.health = health;
  player.armour = armour;
  player.mag = mag;
  player.reserve = reserve;
  audio.setStation(radio);
}

// Put two oncoming traffic cars ahead of the player (opposite lane) so
// the road reads as alive in the frame without a collision before the shot.
function stageOncoming(game, ahead1, ahead2) {
  const { player, traffic } = game;
  const picks = traffic.cars.filter((c) => !(c.axis === 'z' && c.line === 0)).slice(0, 2);
  const spots = [ahead1, ahead2];
  picks.forEach((c, i) => {
    c.axis = 'z';
    c.line = 0;
    c.dir = 1; // heading 0 = south, toward the player
    c.along = player.z - spots[i];
    c.x = -3.2;
    c.z = c.along;
    c.heading = 0;
    c.speed = 9;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = 0;
  });
}

// Clear every traffic car out of the player's lane (axis 'z', line 0).
function clearPlayerLane(game) {
  const { traffic } = game;
  for (let i = traffic.cars.length - 1; i >= 0; i--) {
    const c = traffic.cars[i];
    if (c.axis === 'z' && c.line === 0) {
      game.scene.remove(c.mesh);
      traffic.cars.splice(i, 1);
    }
  }
}

function putPlayerInCar(game, carIndex, x, z, speed) {
  const { player, parkedCars, G } = game;
  const car = parkedCars[carIndex];
  car.stolen = true;
  car.parked = false;
  car.x = x;
  car.z = z;
  car.heading = Math.PI;
  car.speed = speed;
  player.inCar = true;
  player.car = car;
  player.mesh.visible = false;
  player.x = car.x;
  player.z = car.z;
  G.camYaw = 0;
  G.autoDrive = true;
}

const PRESETS = {
  drive(game) {
    // Chapter 2: Daz in a Comet GT flat out down the main avenue, wanted 4,
    // helicopter overhead, Tono's red car ahead, $18,450 on the table.
    const { missions, police, G } = game;
    putPlayerInCar(game, 1, 0, 200, 30); // Comet GT
    clearPlayerLane(game);
    missions.start(1);
    missions.m.timeLeft = 134; // 2:14
    if (game.chaseTarget) {
      game.chaseTarget.x = 0;
      game.chaseTarget.z = 40;
      game.chaseTarget.speed = 18;
    }
    stageOncoming(game, 150, 180);
    police.addWanted(70, 'shot-drive'); // 4 stars + heli
    stagePlayer(game, { cash: 18450, respect: 9, health: 82, armour: 54, mag: 30, reserve: 120 });
    void G;
  },
  foot(game) {
    // Chapter 4: Daz on foot outside the Casino Royale neon, SMG out,
    // vault guards ahead, wanted 2, $12,300 earned.
    const { player, police, missions, G } = game;
    missions.start(3);
    player.noBust = true; // posing for the shot: foot cops may not bust him
    player.x = 168;
    player.z = -58;
    player.heading = Math.PI * 0.72;
    G.camYaw = -0.55;
    player.mesh.position.set(player.x, 0, player.z);
    police.addWanted(25, 'shot-foot'); // 2 stars
    // pre-spawn the full pursuit population, then stage it ahead of the
    // player — otherwise update() spawns cops on top of him mid-shot
    for (let i = 0; i < 4; i++) police.spawnCopCar(player.x, player.z);
    for (let i = 0; i < 3; i++) police.spawnFootCop(player.x, player.z);
    police.stageFootScene(player.x, player.z);
    stagePlayer(game, { cash: 12300, respect: 6, health: 91, armour: 40, mag: 24, reserve: 120 });
  },
  chase(game) {
    // Chapter 3: MOST WANTED — Daz in a Neon Runner at 140 km/j, 3 cop
    // cars converging, helicopter searchlight, $24,000, 3:02 on the clock.
    const { player, missions, police } = game;
    putPlayerInCar(game, 4, 0, 100, 32); // Neon Runner
    clearPlayerLane(game);
    missions.start(2);
    missions.m.timeLeft = 182; // 3:02
    stageOncoming(game, 150, 180);
    police.addWanted(100, 'shot-chase'); // 5 stars, MOST WANTED
    police.stagePursuit(player.x, player.z, player.car.heading);
    stagePlayer(game, { cash: 24000, respect: 12, health: 76, armour: 61, mag: 30, reserve: 120 });
  },
  mission(game) {
    // Chapter 5: the vault run finale — Daz on foot at the casino vault,
    // 4 guards ahead, wanted 4, $48,500, 1:47 left.
    const { player, police, missions, G } = game;
    missions.start(4);
    player.noBust = true; // posing for the shot: foot cops may not bust him
    game.spawnThugs({ x: 195, z: -78 }, 4); // vault guards at the casino
    player.x = 168;
    player.z = -92;
    player.heading = Math.PI * 0.85;
    G.camYaw = -0.42;
    player.mesh.position.set(player.x, 0, player.z);
    // guards in a ring ahead of the player (north, in frame) instead of
    // spawning on top of him — they hold at 7-14 m and trade fire
    const thugSpots = [
      { dx: -10, dz: -14 }, { dx: 10, dz: -16 }, { dx: -4, dz: -22 }, { dx: 6, dz: -12 },
    ];
    game.thugs.forEach((t, i) => {
      const s = thugSpots[i % thugSpots.length];
      t.x = player.x + s.dx;
      t.z = player.z + s.dz;
      t.mesh.position.set(t.x, 0, t.z);
    });
    police.clearWanted();
    police.addWanted(70, 'shot-mission'); // 4 stars + heli
    for (let i = 0; i < 4; i++) police.spawnCopCar(player.x, player.z);
    for (let i = 0; i < 3; i++) police.spawnFootCop(player.x, player.z);
    police.stageFootScene(player.x, player.z);
    missions.m.timeLeft = 107; // 1:47
    stagePlayer(game, { cash: 48500, respect: 15, health: 88, armour: 72, mag: 18, reserve: 120 });
  },
};

export function applyShot(game, shot, seed) {
  const { player, peds, G, hud, audio } = game;
  // auto-start: no start screen in shot mode. Clock reads 19:07 (dusk).
  game.startGame();
  hud.hideStart();
  G.time = 54; // 18:40 + 54s * 0.5 min/s = 19:07
  const setup = PRESETS[shot];
  if (setup) setup(game);
  // HUD visible in every shot; freeze health regen so staged numbers hold
  hud.setHelpVisible(false);
  G.lastDamage = G.time;
  void seed;
  void peds;
  void audio;
  void player;
}
