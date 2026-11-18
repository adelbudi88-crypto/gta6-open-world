// Pedestrians: 40 walkers strolling the sidewalks, turning at corners,
// freezing in place during staged shots.
import * as THREE from 'three';
import { makeRng } from './rng.js';

const SHIRTS = [0xff5e7a, 0x5eff8a, 0x5ea8ff, 0xffd25e, 0xc05eff, 0xffffff, 0xff8a3c, 0x2ec8ff];

export function createPeds(scene) {
  const rng = makeRng(4242);
  const list = [];
  for (let i = 0; i < 40; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: rng.pick(SHIRTS), roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.32), shirt);
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 }),
    );
    head.position.y = 1.8;
    g.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.55, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x22222e, roughness: 0.9 }),
    );
    legs.position.y = 0.28;
    g.add(legs);
    const x = rng.range(-230, 230);
    const z = rng.range(-230, 230);
    g.position.set(x, 0, z);
    scene.add(g);
    list.push({
      mesh: g,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 2.2),
      turnIn: rng.range(2, 8),
    });
  }
  return {
    list,
    update(dt, frozen) {
      if (frozen) return;
      for (const p of list) {
        p.turnIn -= dt;
        if (p.turnIn <= 0) {
          p.heading += (Math.random() - 0.5) * 1.6;
          p.turnIn = 2 + Math.random() * 6;
        }
        p.mesh.position.x += Math.sin(p.heading) * p.speed * dt;
        p.mesh.position.z += Math.cos(p.heading) * p.speed * dt;
        const m = p.mesh.position;
        if (m.x > 245) m.x = 245;
        if (m.x < -245) m.x = -245;
        if (m.z > 245) m.z = 245;
        if (m.z < -245) m.z = -245;
        p.mesh.rotation.y = p.heading;
        p.mesh.position.y = Math.abs(Math.sin(Date.now() / 240 + p.heading * 7)) * 0.05;
      }
    },
  };
}
