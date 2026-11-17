// The player on foot: third-person block character, WASD + mouse look,
// punch (F), hitscan shooting (click) with a tracer line, car entry (E).
// v2.3: same armour / HORNET SMG / reload / respect / garage levels as
// v2.2, with the figure built by a loop over a parts spec and the
// movement, reload and shooting helpers rewritten as plain functions.
import * as THREE from 'three';
import { clamp, collideCircle, dist2 } from './rng.js';

const PLAYER_COLOR = 0x2e6ac2;
export const WEAPON_NAME = 'HORNET SMG';
export const MAG_SIZE = 30;

// Respect level: 1 + one level per 3 respect points (missions +2, thug +1).
export function levelFromRespect(respect) {
  return 1 + Math.floor(Math.max(0, respect) / 3);
}

// Damage split: armour absorbs 60% while any is left, health takes the rest.
export function damageWithArmour(p, n) {
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, n * 0.6);
    p.armour = Math.max(0, p.armour - absorbed);
    p.health = clamp(p.health - (n - absorbed), 0, 100);
  } else {
    p.health = clamp(p.health - n, 0, 100);
  }
}

// [w, h, d, material, x, y, z, shadow?, named?]
const FIGURE_PARTS = [
  [0.62, 0.75, 0.36, 'shirt', 0, 1.1, 0, true, null],
  [0.4, 0.4, 0.4, 'skin', 0, 1.68, 0, true, null],
  [0.44, 0.14, 0.44, 'cap', 0, 1.92, 0, false, null],
  [0.22, 0.75, 0.24, 'pants', -0.16, 0.38, 0, false, 'legL'],
  [0.22, 0.75, 0.24, 'pants', 0.16, 0.38, 0, false, 'legR'],
  [0.18, 0.65, 0.2, 'shirt', -0.42, 1.1, 0, false, 'armL'],
  [0.18, 0.65, 0.2, 'shirt', 0.42, 1.1, 0, false, 'armR'],
  [0.1, 0.14, 0.55, 'gun', 0.42, 0.85, 0.22, false, null],
  [0.08, 0.22, 0.1, 'mag', 0.42, 0.72, 0.3, false, null],
];

export function makePlayer(scene) {
  const mats = {
    shirt: new THREE.MeshLambertMaterial({ color: PLAYER_COLOR }),
    skin: new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
    pants: new THREE.MeshLambertMaterial({ color: 0x222831 }),
    cap: new THREE.MeshLambertMaterial({ color: 0xc23a2e }),
    gun: new THREE.MeshLambertMaterial({ color: 0x181818 }),
    mag: new THREE.MeshLambertMaterial({ color: 0x2a2a2e }),
  };
  const g = new THREE.Group();
  g.userData = {};
  for (const [w, h, d, mat, x, y, z, shadow, named] of FIGURE_PARTS) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[mat]);
    mesh.position.set(x, y, z);
    if (shadow) mesh.castShadow = true;
    g.add(mesh);
    if (named) g.userData[named] = mesh;
  }
  scene.add(g);

  return {
    mesh: g,
    x: 0, z: 30, heading: 0, camYaw: 0,
    health: 100, armour: 0, maxArmour: 100,
    weapon: WEAPON_NAME, magSize: MAG_SIZE, mag: MAG_SIZE, reserve: 120,
    reloadTimer: 0, cash: 0,
    respect: 0, respectLevel: 1,
    garageEngine: 0, garageArmor: 0,
    inCar: false, car: null,
    walkPhase: 0, punchTimer: 0, punchCooldown: 0,
    shootCooldown: 0, sprint: false,
    alive: true,
  };
}

// Begin a reload if the magazine is short and reserve ammo exists.
export function startReload(p) {
  if (p.reloadTimer > 0 || p.mag >= p.magSize || p.reserve <= 0) return false;
  p.reloadTimer = 1.0;
  return true;
}

// Advance the reload timer; returns true on the frame the reload lands.
export function tickReload(p, dt) {
  if (p.reloadTimer <= 0) return false;
  p.reloadTimer -= dt;
  if (p.reloadTimer > 0) return false;
  const need = p.magSize - p.mag;
  const take = Math.min(need, p.reserve);
  p.mag += take;
  p.reserve -= take;
  return true;
}

// Move on foot. input: {f, s, l, r, sprint, yaw}. Returns nothing.
export function stepPlayerOnFoot(p, dt, input, colliders) {
  const speed = input.sprint ? 8.5 : 4.6;
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  // camera-relative movement: forward = -Z of camera yaw
  let mx = 0;
  let mz = 0;
  if (input.f) { mx += -sin; mz += -cos; }
  if (input.s) { mx += sin; mz += cos; }
  if (input.l) { mx += -cos; mz += sin; }
  if (input.r) { mx += cos; mz += -sin; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    const res = collideCircle(p.x + mx * speed * dt, p.z + mz * speed * dt, 0.5, colliders);
    p.x = res.x;
    p.z = res.z;
    p.heading = Math.atan2(mx, mz);
    p.walkPhase += dt * speed * 2.4;
  }
  const swing = len > 0 ? Math.sin(p.walkPhase) * 0.55 : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.6;
  u.armR.rotation.x = swing * 0.6;
  if (p.punchTimer > 0) {
    p.punchTimer -= dt;
    u.armR.rotation.x = -1.6 * Math.sin((p.punchTimer / 0.25) * Math.PI);
  }
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
}

// Find the nearest stealable car within reach.
export function nearestCar(p, cars, maxD = 6) {
  let best = null;
  let bestD = maxD * maxD;
  for (const c of cars) {
    if (c.dead) continue;
    const d = dist2(p.x, p.z, c.x, c.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// Hitscan shot from the player toward a world point. Returns hit info.
// targets: array of {x, z, radius, hp, onHit} — enemies / props.
export function shootFrom(scene, origin, dir, range, targets) {
  const end = {
    x: origin.x + dir.x * range,
    y: origin.y + dir.y * range,
    z: origin.z + dir.z * range,
  };
  let bestT = 1;
  let hitTarget = null;
  for (const t of targets) {
    if (t.dead || t.hp <= 0) continue;
    // ray vs vertical cylinder at (t.x, t.z), radius t.radius, height 1.8
    const ox = origin.x - t.x;
    const oz = origin.z - t.z;
    const a = dir.x * dir.x + dir.z * dir.z;
    if (a < 1e-8) continue;
    const b = 2 * (ox * dir.x + oz * dir.z);
    const c = ox * ox + oz * oz - t.radius * t.radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const tHit = (-b - Math.sqrt(disc)) / (2 * a);
    if (tHit > 0 && tHit < range && tHit / range < bestT) {
      bestT = tHit / range;
      hitTarget = t;
    }
  }
  if (hitTarget) {
    end.x = origin.x + dir.x * bestT * range;
    end.y = 1.2;
    end.z = origin.z + dir.z * bestT * range;
  }
  // tracer line, fades out
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(origin.x, origin.y, origin.z),
    new THREE.Vector3(end.x, end.y, end.z),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
  scene.add(line);
  setTimeout(() => { scene.remove(line); geo.dispose(); }, 70);
  return { hit: hitTarget, end };
}

export function clampHealth(p) { p.health = clamp(p.health, 0, 100); }
