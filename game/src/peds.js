// Pedestrians — 60 walkers on the sidewalks. They stroll between blocks,
// cross at corners, and flee on foot when a car is jacked or a crash happens
// nearby. A fleeing driver (after a carjacking) is just a ped in a hurry.
import * as THREE from 'three';

const SHIRTS = [0xe8e8e8, 0xff6a3c, 0x3ca8ff, 0xffd23c, 0x8aff6b, 0xff4d6d, 0x9b6bff, 0x222226];
const PANTS = [0x222633, 0x3a3a44, 0x4a2c1a, 0x1a3a4a];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.75, 0.32),
    new THREE.MeshStandardMaterial({ color: rng.pick(SHIRTS), roughness: 0.9 }),
  );
  shirt.position.y = 1.05;
  g.add(shirt);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.8 }),
  );
  head.position.y = 1.62;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.3),
    new THREE.MeshStandardMaterial({ color: rng.pick(PANTS), roughness: 0.9 }),
  );
  legs.position.y = 0.35;
  g.add(legs);
  return g;
}

export function createPeds(scene, rng) {
  const peds = [];
  for (let i = 0; i < 60; i++) {
    const mesh = makePedMesh(rng);
    const x = rng.range(-150, 150), z = rng.range(-150, 150);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, x, z, angle: rng.range(0, Math.PI * 2),
      speed: rng.range(0.9, 1.8), flee: 0, tx: x, tz: z,
    });
  }

  return {
    peds,
    count: 60,
    fleeFrom(x, z, radius) {
      for (const p of peds) {
        const dx = p.x - x, dz = p.z - z;
        if (dx * dx + dz * dz < radius * radius) {
          p.flee = 6;
          p.tx = p.x + dx * 3;
          p.tz = p.z + dz * 3;
        }
      }
    },
    spawnFleeingDriver(x, z) {
      const p = peds.find((q) => q.flee === 0 && Math.hypot(q.x - x, q.z - z) > 30);
      if (p) {
        p.x = x; p.z = z; p.mesh.position.set(x, 0, z);
        p.flee = 8;
        p.tx = x + 40; p.tz = z + 40;
      }
    },
    update(dt, frozen) {
      if (frozen) return;
      for (const p of peds) {
        if (p.flee > 0) {
          p.flee -= dt;
          const dx = p.tx - p.x, dz = p.tz - p.z;
          const d = Math.hypot(dx, dz) || 1;
          p.x += (dx / d) * 4.2 * dt;
          p.z += (dz / d) * 4.2 * dt;
          p.angle = Math.atan2(-dz, dx);
        } else {
          p.x += Math.cos(p.angle) * p.speed * dt;
          p.z -= Math.sin(p.angle) * p.speed * dt;
          if (Math.hypot(p.x - p.tx, p.z - p.tz) < 2 || rng.chance(0.002)) {
            p.tx = Math.max(-150, Math.min(150, p.x + rng.range(-50, 50)));
            p.tz = Math.max(-150, Math.min(150, p.z + rng.range(-50, 50)));
            p.angle = Math.atan2(-(p.tz - p.z), p.tx - p.x);
          }
          if (Math.abs(p.x) > 155 || Math.abs(p.z) > 155) {
            p.angle += Math.PI;
            p.x = Math.max(-150, Math.min(150, p.x));
            p.z = Math.max(-150, Math.min(150, p.z));
          }
        }
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.angle;
      }
    },
  };
}
