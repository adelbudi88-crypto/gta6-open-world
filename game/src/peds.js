// Pedestrians: simple block figures walking the sidewalks; they flee from
// gunfire, speeding cars and high wanted levels, and get knocked down by cars.
// v2.1: same crowd (40, a quarter of them lingering around the casino strip
// neon at dusk, scattering wider when a police chase rolls through), with
// the per-pedestrian step split into flee / stroll / knocked-down helpers.
import * as THREE from 'three';
import { collideCircle, dist2 } from './rng.js';

const SKIN = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];
const SHIRT = [0xc23a2e, 0x2e6ac2, 0x3aa85a, 0xe8c832, 0x8a5ac2, 0xd8d8d8, 0x3ab8a8, 0xe87a2a, 0xff5aa8, 0x2ad8c8];

function makePedMesh(colorHex, skinHex) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: colorHex });
  const skin = new THREE.MeshLambertMaterial({ color: skinHex });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3242 });
  const parts = [
    { geo: new THREE.BoxGeometry(0.55, 0.7, 0.32), mat: shirt, at: [0, 1.05, 0], shadow: true },
    { geo: new THREE.BoxGeometry(0.36, 0.36, 0.36), mat: skin, at: [0, 1.6, 0], shadow: true },
    { geo: new THREE.BoxGeometry(0.2, 0.7, 0.22), mat: pants, at: [-0.14, 0.35, 0], name: 'legL' },
    { geo: new THREE.BoxGeometry(0.2, 0.7, 0.22), mat: pants, at: [0.14, 0.35, 0], name: 'legR' },
    { geo: new THREE.BoxGeometry(0.16, 0.6, 0.18), mat: shirt, at: [-0.36, 1.05, 0], name: 'armL' },
    { geo: new THREE.BoxGeometry(0.16, 0.6, 0.18), mat: shirt, at: [0.36, 1.05, 0], name: 'armR' },
  ];
  const named = {};
  for (const part of parts) {
    const mesh = new THREE.Mesh(part.geo, part.mat);
    mesh.position.set(part.at[0], part.at[1], part.at[2]);
    if (part.shadow) mesh.castShadow = true;
    g.add(mesh);
    if (part.name) named[part.name] = mesh;
  }
  g.userData = named;
  return g;
}

export function makePeds(scene, rng, city, count = 40) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    // one in four hangs around the casino strip, the rest spread city-wide
    const nearCasino = i % 4 === 0;
    let axis;
    let road;
    let along;
    let side;
    if (nearCasino) {
      axis = 'z';
      road = rng.pick([156, 234]);
      along = rng.range(-140, 40);
      side = rng.chance(0.5) ? 1 : -1;
    } else {
      axis = rng.chance(0.5) ? 'x' : 'z';
      road = rng.pick(axis === 'x' ? city.roadsZ : city.roadsX);
      along = rng.range(-230, 230);
      side = rng.chance(0.5) ? 1 : -1;
    }
    const mesh = makePedMesh(rng.pick(SHIRT), rng.pick(SKIN));
    scene.add(mesh);
    const p = {
      mesh, axis, road, side,
      x: axis === 'x' ? along : road + side * 9.5,
      z: axis === 'x' ? road + side * 9.5 : along,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.7),
      walkPhase: rng.range(0, 6),
      fleeing: false, down: false, downTimer: 0,
      fleeX: 0, fleeZ: 0, fleeTimer: 0,
      knock() {
        if (this.down) return;
        this.down = true;
        this.downTimer = 3;
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = 0.25;
      },
      scare(fx, fz) {
        if (this.down) return;
        this.fleeing = true;
        const dx = this.x - fx;
        const dz = this.z - fz;
        const d = Math.hypot(dx, dz) || 1;
        this.fleeX = dx / d;
        this.fleeZ = dz / d;
      },
    };
    peds.push(p);
  }

  function stepDown(p, dt) {
    p.downTimer -= dt;
    if (p.downTimer > 0) return true;
    p.down = false;
    p.mesh.rotation.x = 0;
    p.mesh.position.y = 0;
    p.fleeing = true;
    return false;
  }

  function stepFlee(p, dt) {
    p.fleeTimer += dt;
    if (p.fleeTimer > 4) {
      p.fleeing = false;
      p.fleeTimer = 0;
    }
    return { vx: p.fleeX, vz: p.fleeZ, sp: 4.2 };
  }

  function stepStroll(p, dt) {
    // stroll along the sidewalk, turn at intersections sometimes
    const alongAxis = p.axis === 'x' ? p.x : p.z;
    const lines = p.axis === 'x' ? city.roadsX : city.roadsZ;
    if (rng.chance(dt * 0.05)) {
      for (const L of lines) {
        if (Math.abs(alongAxis - L) < 2) {
          p.axis = p.axis === 'x' ? 'z' : 'x';
          p.road = L;
          p.side = rng.chance(0.5) ? 1 : -1;
          break;
        }
      }
    }
    const dir = Math.sin(p.heading) >= 0 ? 1 : -1;
    const vx = p.axis === 'x' ? dir : 0;
    const vz = p.axis === 'x' ? 0 : dir;
    p.heading = Math.atan2(vx, vz);
    return { vx, vz, sp: p.speed };
  }

  return {
    list: peds,
    update(dt, colliders, playerPos, danger) {
      for (const p of peds) {
        if (p.down) {
          if (stepDown(p, dt)) continue;
        }
        if (danger && dist2(p.x, p.z, playerPos.x, playerPos.z) < 1600) {
          p.scare(playerPos.x, playerPos.z);
        }
        const move = p.fleeing ? stepFlee(p, dt) : stepStroll(p, dt);
        const nx = p.x + move.vx * move.sp * dt;
        const nz = p.z + move.vz * move.sp * dt;
        const res = collideCircle(nx, nz, 0.45, colliders);
        p.x = res.x;
        p.z = res.z;
        if (res.hit && !p.fleeing) p.heading += Math.PI / 2;
        p.walkPhase += dt * move.sp * 3.2;
        const swing = Math.sin(p.walkPhase) * 0.5;
        const u = p.mesh.userData;
        u.legL.rotation.x = swing;
        u.legR.rotation.x = -swing;
        u.armL.rotation.x = -swing * 0.7;
        u.armR.rotation.x = swing * 0.7;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = Math.atan2(move.vx, move.vz);
      }
    },
  };
}
