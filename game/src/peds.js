// Pedestrians for Porto Azul II: 40 simple figures (body, head, legs) walking
// the sidewalks, turning at intersections, scattering when a car screams past.
import * as T from 'three';

const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function createPeds(scene, rng) {
  const bodyGeo = new T.BoxGeometry(0.55, 0.85, 0.32);
  const headGeo = new T.BoxGeometry(0.34, 0.34, 0.34);
  const legGeo = new T.BoxGeometry(0.2, 0.7, 0.2);
  const peds = [];
  for (let i = 0; i < 40; i += 1) {
    const g = new T.Group();
    const shirt = new T.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
    const skin = new T.MeshLambertMaterial({ color: rng.pick(SKINS) });
    const pants = new T.MeshLambertMaterial({ color: rng.pick([0x22222e, 0x3a3a4a, 0x5a4632]) });
    const body = new T.Mesh(bodyGeo, shirt); body.position.y = 1.15; g.add(body);
    const head = new T.Mesh(headGeo, skin); head.position.y = 1.78; g.add(head);
    const legL = new T.Mesh(legGeo, pants); legL.position.set(-0.14, 0.35, 0); g.add(legL);
    const legR = new T.Mesh(legGeo, pants); legR.position.set(0.14, 0.35, 0); g.add(legR);
    const line = rng.pick([-180, -120, -60, 0, 60, 120, 180]);
    const along = rng.range(-200, 200);
    const horizontal = rng.chance(0.5);
    g.position.set(horizontal ? along : line + 8.5, 0, horizontal ? line + 8.5 : along);
    g.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(g);
    peds.push({
      group: g, legL, legR,
      horizontal, line, along,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(1.1, 2.2),
      walkPhase: rng.range(0, 6),
    });
  }
  return {
    peds,
    update(dt, frozen, playerX, playerZ) {
      if (frozen) return;
      for (const p of peds) {
        p.along += p.dir * p.speed * dt;
        if (p.along > 208) { p.along = 208; p.dir = -1; }
        if (p.along < -208) { p.along = -208; p.dir = 1; }
        if (rng.chance(dt * 0.02)) p.dir *= -1;
        if (p.horizontal) {
          p.group.position.x = p.along; p.group.position.z = p.line + 8.5;
          p.group.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          p.group.position.z = p.along; p.group.position.x = p.line + 8.5;
          p.group.rotation.y = p.dir > 0 ? 0 : Math.PI;
        }
        // Scatter from a fast car nearby.
        const dx = p.group.position.x - playerX;
        const dz = p.group.position.z - playerZ;
        if (dx * dx + dz * dz < 30) {
          p.group.position.x += (dx > 0 ? 1 : -1) * dt * 3;
          p.group.position.z += (dz > 0 ? 1 : -1) * dt * 3;
        }
        p.walkPhase += dt * 7;
        const swing = Math.sin(p.walkPhase) * 0.45;
        p.legL.rotation.x = swing;
        p.legR.rotation.x = -swing;
      }
    },
  };
}
