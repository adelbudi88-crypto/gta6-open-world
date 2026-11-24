// Pedestrians: 60 walkers on the sidewalks; they flee gunfire and carjackings,
// and a witness can raise your wanted level.
import * as THREE from 'three';

const SHIRT_COLORS = [0xe8e8e8, 0xff8df0, 0x7dff5e, 0xffb020, 0x22e6ff, 0xff5f6d, 0xc9a86a];

export function createPeds(scene, rng, count = 60) {
  const list = [];
  const bodyGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.5, 8);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 8);
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: SHIRT_COLORS[Math.floor(rng.next() * SHIRT_COLORS.length)], roughness: 0.9 });
    const body = new THREE.Mesh(bodyGeo, shirt);
    body.position.y = 0.95;
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 }));
    head.position.y = 1.95;
    g.add(body, head);
    const lane = Math.floor(rng.range(-260, 260) / 40) * 40;
    g.position.set(rng.range(-260, 260), 0, lane + (rng.chance(0.5) ? 6 : -6));
    scene.add(g);
    list.push({
      group: g, speed: rng.range(1.2, 2.6), dir: rng.chance(0.5) ? 1 : -1,
      axis: rng.chance(0.5) ? 'x' : 'z', fleeing: false, fleeT: 0,
    });
  }
  return {
    list,
    update(dt, frozen, dangerPos) {
      if (frozen) return;
      for (const p of list) {
        if (dangerPos) {
          const d = p.group.position.distanceTo(dangerPos);
          if (d < 26 && !p.fleeing) { p.fleeing = true; p.fleeT = 4; }
        }
        if (p.fleeing) {
          p.fleeT -= dt;
          const away = p.group.position.clone().sub(dangerPos || p.group.position).setY(0).normalize();
          p.group.position.addScaledVector(away, 5.5 * dt);
          if (p.fleeT <= 0) p.fleeing = false;
          continue;
        }
        const v = p.speed * p.dir * dt;
        if (p.axis === 'x') {
          p.group.position.x += v;
          if (p.group.position.x > 272) { p.group.position.x = -272; }
          if (p.group.position.x < -272) { p.group.position.x = 272; }
        } else {
          p.group.position.z += v;
          if (p.group.position.z > 272) { p.group.position.z = -272; }
          if (p.group.position.z < -272) { p.group.position.z = 272; }
        }
      }
    },
    // A ped within 20m who saw the crime counts as a witness.
    witnessNear(pos, radius = 20) {
      for (const p of list) {
        if (p.group.position.distanceTo(pos) < radius) return true;
      }
      return false;
    },
    fleeFrom(pos) {
      for (const p of list) {
        if (p.group.position.distanceTo(pos) < 14) { p.fleeing = true; p.fleeT = 5; }
      }
    },
  };
}
