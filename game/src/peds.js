// Pedestrians for Porto Azul II — 40 walkers on the sidewalks.
import * as THREE from 'three';

const SHIRTS = [0xe84a5f, 0x3fae6a, 0x2e6fc2, 0xd8a020, 0x7a4fd0, 0xe8e8e8, 0xff7a3c, 0x39c2d7];
const PANTS = [0x22262e, 0x3a2c22, 0x1c2c44, 0x444444];

export class Peds {
  constructor(scene, rng) {
    this.walkers = [];
    const roads = [-120, -60, 0, 60, 120];
    for (let i = 0; i < 40; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.85, 0.32),
        new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) })
      );
      shirt.position.y = 1.05;
      g.add(shirt);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 8),
        new THREE.MeshLambertMaterial({ color: rng.pick([0xd9a066, 0x8a5a3b, 0xe8b88a, 0x6b4423]) })
      );
      head.position.y = 1.68;
      g.add(head);
      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.65, 0.3),
        new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) })
      );
      legs.position.y = 0.33;
      g.add(legs);
      const horizontal = rng.chance(0.5);
      const road = rng.pick(roads);
      const side = rng.chance(0.5) ? 6.5 : -6.5;
      const along = rng.range(-190, 190);
      g.position.set(horizontal ? along : road + side, 0, horizontal ? road + side : along);
      scene.add(g);
      this.walkers.push({
        mesh: g,
        horizontal,
        road,
        side,
        dir: rng.chance(0.5) ? 1 : -1,
        speed: rng.range(1.2, 2.6),
        along,
        phase: rng.range(0, Math.PI * 2),
      });
    }
  }

  update(dt, t) {
    for (const w of this.walkers) {
      w.along += w.dir * w.speed * dt;
      if (w.along > 195) w.along = -195;
      if (w.along < -195) w.along = 195;
      if (w.horizontal) {
        w.mesh.position.x = w.along;
        w.mesh.position.z = w.road + w.side;
        w.mesh.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        w.mesh.position.x = w.road + w.side;
        w.mesh.position.z = w.along;
        w.mesh.rotation.y = w.dir > 0 ? 0 : Math.PI;
      }
      w.mesh.position.y = Math.abs(Math.sin(t * 6 + w.phase)) * 0.06;
    }
  }
}
