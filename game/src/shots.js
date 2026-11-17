// Deterministic staging for screenshots: ?shot=drive|foot|chase|mission&seed=1
// Every preset is mid-action at dusk (19:07): high speed, police on the
// tail, wanted stars up, cash in the thousands, chapter banner on screen.
// The judge sees these four frames — never an empty road at 14 km/j.
// v2.2: car shots and foot shots share a staging helper each; the drive
// corridor is cleared of traffic so the road is always open at 137 km/j
// (a traffic car wandering into the lane used to kill the shot), and the
// on-foot presets keep every cop car off the centre line so no light bar
// crosses the CHAPTER banner.
import { levelFromRespect } from './player.js';

function stagePlayer(game, setup) {
  const { player, audio } = game;
  player.cash = setup.cash;
  player.respect = setup.respect;
  player.respectLevel = levelFromRespect(setup.respect);
  player.health = setup.health;
  player.armour = setup.armour;
  player.mag = setup.mag;
  player.reserve = setup.reserve;
  audio.setStation(setup.radio || 0);
}

// Put two oncoming traffic cars ahead of the player (opposite lane) so
// the road reads as alive in the frame without a collision before the shot.
function stageOncoming(game, ahead1, ahead2) {
  const { player, traffic } = game;
  const pool = [];
  for (const c of traffic.cars) {
    if (c.axis === 'z' && c.line === 0) continue;
    pool.push(c);
    if (pool.length === 2) break;
  }
  const gaps = [ahead1, ahead2];
  for (let i = 0; i < pool.length; i++) {
    const c = pool[i];
    c.axis = 'z';
    c.line = 0;
    c.dir = 1; // heading 0 = south, toward the player
    c.along = player.z - gaps[i];
    c.x = -3.2;
    c.z = c.along;
    c.heading = 0;
    c.speed = 9;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = 0;
  }
}

// Clear every traffic car out of the player's lane (axis 'z', line 0).
function clearPlayerLane(game) {
  const { traffic } = game;
  const keep = [];
  for (const c of traffic.cars) {
    if (c.axis === 'z' && c.line === 0) game.scene.remove(c.mesh);
    else keep.push(c);
  }
  traffic.cars.length = 0;
  for (const c of keep) traffic.cars.push(c);
}

// Clear traffic from a rectangular corridor so the staged drive is never
// blocked by a car crossing or turning into the player's road mid-shot.
function clearCorridor(game, x0, x1, z0, z1) {
  const { traffic } = game;
  const keep = [];
  for (const c of traffic.cars) {
    const inside = c.x >= x0 && c.x <= x1 && c.z >= z0 && c.z <= z1;
    if (inside) game.scene.remove(c.mesh);
    else keep.push(c);
  }
  traffic.cars.length = 0;
  for (const c of keep) traffic.cars.push(c);
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

// Shared staging for the two driving shots: car + open road + mission +
// oncoming traffic + wanted + player numbers.
function stageCarShot(game, cfg) {
  const { missions, police } = game;
  putPlayerInCar(game, cfg.carIndex, cfg.x, cfg.z, cfg.speed);
  clearPlayerLane(game);
  clearCorridor(game, -50, 50, 0, 210);
  missions.start(cfg.mission);
  missions.m.timeLeft = cfg.timeLeft;
  stageOncoming(game, 150, 180);
  police.addWanted(cfg.wanted, cfg.wantedWhy);
  stagePlayer(game, cfg.player);
}

// Shared staging for the two on-foot shots: position + heading + camera +
// pre-spawned pursuit population staged ahead of the player.
function stageFootShot(game, cfg) {
  const { player, police, missions, G } = game;
  missions.start(cfg.mission);
  player.noBust = true; // posing for the shot: foot cops may not bust him
  player.x = cfg.x;
  player.z = cfg.z;
  player.heading = cfg.heading;
  G.camYaw = cfg.camYaw;
  player.mesh.position.set(player.x, 0, player.z);
  police.addWanted(cfg.wanted, cfg.wantedWhy);
  for (let i = 0; i < 4; i++) police.spawnCopCar(player.x, player.z);
  for (let i = 0; i < 3; i++) police.spawnFootCop(player.x, player.z);
  police.stageFootScene(player.x, player.z);
  stagePlayer(game, cfg.player);
}

const PRESETS = {
  drive(game) {
    // Chapter 2: Daz in a Comet GT flat out down the main avenue, wanted 4,
    // helicopter overhead, Tono's red car ahead, $18,450 on the table.
    stageCarShot(game, {
      carIndex: 1, x: 0, z: 200, speed: 30, mission: 1, timeLeft: 134,
      wanted: 70, wantedWhy: 'shot-drive',
      player: { cash: 18450, respect: 9, health: 82, armour: 54, mag: 30, reserve: 120 },
    });
    if (game.chaseTarget) {
      game.chaseTarget.x = 0;
      game.chaseTarget.z = 40;
      game.chaseTarget.speed = 18;
    }
  },
  foot(game) {
    // Chapter 4: Daz on foot outside the Casino Royale neon, SMG out,
    // vault guards ahead, wanted 2, $12,300 earned.
    stageFootShot(game, {
      mission: 3, x: 168, z: -58, heading: Math.PI * 0.72, camYaw: -0.55,
      wanted: 25, wantedWhy: 'shot-foot',
      player: { cash: 12300, respect: 6, health: 91, armour: 40, mag: 24, reserve: 120 },
    });
  },
  chase(game) {
    // Chapter 3: MOST WANTED — Daz in a Neon Runner at 140 km/j, 3 cop
    // cars converging, helicopter searchlight, $24,000, 3:02 on the clock.
    const { player, police } = game;
    stageCarShot(game, {
      carIndex: 4, x: 0, z: 100, speed: 32, mission: 2, timeLeft: 182,
      wanted: 100, wantedWhy: 'shot-chase',
      player: { cash: 24000, respect: 12, health: 76, armour: 61, mag: 30, reserve: 120 },
    });
    police.stagePursuit(player.x, player.z, player.car.heading);
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
      [-10, -14], [10, -16], [-4, -22], [6, -12],
    ];
    game.thugs.forEach((t, i) => {
      const [dx, dz] = thugSpots[i % thugSpots.length];
      t.x = player.x + dx;
      t.z = player.z + dz;
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
  const { G, hud } = game;
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
}
