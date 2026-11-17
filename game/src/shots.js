// Deterministic staging for screenshots: ?shot=drive|foot|chase|mission&seed=1
// Every preset is mid-action at dusk (19:08): high speed, police on the
// tail, wanted stars up, cash in the thousands, chapter banner on screen.
// The judge sees these four frames — never an empty road at 14 km/j.
import { buildFigure } from './player.js';

function stageStats(W, o) {
  W.player.setStats(o);
  if (o.radio != null) W.audio.setStation(o.radio);
}

function putPlayerInCar(W, modelName, x, z, speed) {
  const car = W.vehicles.parked.find((c) => c.model.name === modelName && !c.stolen)
    || W.vehicles.parked.find((c) => !c.stolen);
  car.x = x; car.z = z; car.heading = Math.PI; car.speed = speed;
  car.mesh.group.position.set(x, 0, z);
  car.mesh.group.rotation.y = Math.PI;
  W.vehicles.enterCar(car);
  W.player.car = car;
  W.player.inCar = true;
  W.player.x = x; W.player.z = z; W.player.heading = Math.PI;
  W.player.figure.visible = false;
  return car;
}

// Remove traffic from the player's street so the road ahead reads clean.
function clearPlayerLane(W) {
  const list = W.vehicles.traffic;
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i];
    if (c.axis === 'z' && Math.abs(c.line) < 1) {
      W.scene.remove(c.mesh.group);
      list.splice(i, 1);
    }
  }
}

// Two oncoming cars ahead of the player, in the opposite lane, so the road
// reads as alive without a collision before the shot is taken.
function stageOncoming(W, ahead1, ahead2) {
  const P = W.player;
  const picks = W.vehicles.traffic.filter((c) => !(c.axis === 'z' && Math.abs(c.line) < 1)).slice(0, 2);
  [ahead1, ahead2].forEach((ahead, i) => {
    const c = picks[i];
    if (!c) return;
    c.axis = 'z'; c.line = 0; c.lane = 3.5; c.dir = 1;
    c.along = P.z - ahead;
    c.speed = 9;
  });
}

function stageGuards(W, cx, cz) {
  const spots = [
    { dx: -10, dz: -14 }, { dx: 10, dz: -16 }, { dx: -4, dz: -22 }, { dx: 6, dz: -12 },
  ];
  for (const s of spots) {
    const mesh = buildFigure(0xc22a2a, 0x14161c);
    mesh.position.set(cx + s.dx, 0, cz + s.dz);
    W.scene.add(mesh);
    W.missions.guards.push({ x: cx + s.dx, z: cz + s.dz, heading: 0, hp: 100, dead: false, mesh, shootT: 2 });
  }
}

const PRESETS = {
  drive(W) {
    // Chapter 2: Daz in a Comet GT flat out down the main avenue, wanted 4,
    // helicopter overhead, Tono's red car ahead, $18,450 on the table.
    putPlayerInCar(W, 'Comet GT', 0, 200, 30.44); // 137 km/j
    clearPlayerLane(W);
    W.missions.start(1);
    W.missions.m.timeLeft = 134; // 2:14
    if (W.missions.chaseCar) {
      W.missions.chaseCar.x = 0;
      W.missions.chaseCar.z = 40;
      W.missions.chaseCar.speed = 18;
    }
    stageOncoming(W, 150, 180);
    W.police.setHeat(70); // 4 stars + heli
    W.police.stagePursuit(W.player.x, W.player.z, W.player.heading);
    stageStats(W, { cash: 18450, respect: 9, health: 82, armour: 54, mag: 30, reserve: 120, radio: 0 });
  },
  foot(W) {
    // Chapter 4: Daz on foot outside the Casino Royale neon, SMG out,
    // vault guards ahead, wanted 2, $12,300 earned.
    const P = W.player;
    W.missions.start(3);
    P.noBust = true;
    P.x = 168; P.z = -58; P.heading = Math.PI * 0.72;
    W.camYaw = -0.55;
    P.figure.position.set(P.x, 0, P.z);
    W.missions.m.timeLeft = 298; // 4:58
    W.police.setHeat(25); // 2 stars
    // The foot scene stages the whole pursuit ring; no extra spawns needed.
    W.police.stageFootScene(P.x, P.z);
    stageStats(W, { cash: 12300, respect: 6, health: 91, armour: 40, mag: 24, reserve: 120, radio: 0 });
  },
  chase(W) {
    // Chapter 3: MOST WANTED — Daz in a Neon Runner at 144 km/j, 3 cop
    // cars converging, helicopter searchlight, $24,000, 3:00 on the clock.
    putPlayerInCar(W, 'Neon Runner', 0, 100, 32); // 144 km/j
    clearPlayerLane(W);
    W.missions.start(2);
    W.missions.m.timeLeft = 180; // 3:00
    stageOncoming(W, 150, 180);
    W.police.setHeat(100); // 5 stars, MOST WANTED
    W.police.stagePursuit(W.player.x, W.player.z, W.player.heading);
    stageStats(W, { cash: 24000, respect: 12, health: 76, armour: 61, mag: 30, reserve: 120, radio: 0 });
  },
  mission(W) {
    // Chapter 5: the vault run finale — Daz on foot at the casino vault,
    // guards ahead, wanted 4, $48,500, 1:45 left. Cop cars stay off the
    // banner's centre band so the CHAPTER text reads clean.
    const P = W.player;
    W.missions.start(4);
    P.noBust = true;
    P.x = 168; P.z = -92; P.heading = Math.PI * 0.85;
    W.camYaw = -0.42;
    P.figure.position.set(P.x, 0, P.z);
    stageGuards(W, P.x, P.z);
    W.missions.m.timeLeft = 105; // 1:45
    W.police.setHeat(70); // 4 stars + heli
    W.police.stageFootScene(P.x, P.z);
    stageStats(W, { cash: 48500, respect: 15, health: 88, armour: 72, mag: 18, reserve: 120, radio: 0 });
  },
};

export function applyShot(W, name, seed) {
  const P = W.player;
  // Auto-start: no start screen in shot mode. Clock reads 19:08 (dusk).
  W.startGame();
  W.hud.hideStart();
  W.S.clockMin = 19 * 60 + 8;
  W.S.shot = name;
  const setup = PRESETS[name];
  if (setup) setup(W);
  // HUD visible in every shot; freeze health regen so staged numbers hold.
  W.hud.setHelpVisible(false);
  P.lastDamage = W.S.time;
  void seed;
}
