// Pedestrians: instanced bodies, heads and legs so forty walkers cost three
// draw calls. They stroll the sidewalks, and scatter when a car or a shot
// comes too close.
import * as THREE from 'three';

const COUNT = 40;

export function createPeds(W) {
  const { scene, city, rng } = W;
  const geoBody = new THREE.BoxGeometry(0.85, 1.05, 0.45);
  geoBody.translate(0, 1.0, 0);
  const geoHead = new THREE.BoxGeometry(0.48, 0.48, 0.48);
  geoHead.translate(0, 1.78, 0);
  const geoLegs = new THREE.BoxGeometry(0.7, 0.55, 0.4);
  geoLegs.translate(0, 0.28, 0);
  const bodies = new THREE.InstancedMesh(geoBody, new THREE.MeshLambertMaterial({ color: 0xffffff }), COUNT);
  const heads = new THREE.InstancedMesh(geoHead, new THREE.MeshLambertMaterial({ color: 0xd8a077 }), COUNT);
  const legs = new THREE.InstancedMesh(geoLegs, new THREE.MeshLambertMaterial({ color: 0x1c1c26 }), COUNT);
  scene.add(bodies, heads, legs);
  const shirts = [0xe84a4a, 0x4a7de8, 0x4ae87a, 0xe8c94a, 0xb44ae8, 0xe8e8e8, 0x4ad8e8];
  const peds = [];
  for (let i = 0; i < COUNT; i++) {
    const L = rng.pick(city.streets);
    const along = rng.range(-250, 250);
    const side = rng.chance(0.5) ? 1 : -1;
    const p = {
      x: rng.chance(0.5) ? along : L + side * 10.5,
      z: rng.chance(0.5) ? L + side * 10.5 : along,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 2.0),
      target: null, state: 'walk', fleeT: 0, bob: rng.range(0, 6),
    };
    p.target = { x: p.x + rng.range(-40, 40), z: p.z + rng.range(-40, 40) };
    bodies.setColorAt(i, new THREE.Color(rng.pick(shirts)));
    peds.push(p);
  }
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);

  function setInstance(mesh, i, x, y, z, heading) {
    q.setFromAxisAngle(up, heading);
    pos.set(x, y, z);
    m4.compose(pos, q, sc);
    mesh.setMatrixAt(i, m4);
  }

  return {
    list: peds,
    scatterFrom(x, z, radius = 22) {
      for (const p of peds) {
        if (Math.hypot(p.x - x, p.z - z) < radius) {
          p.state = 'flee';
          p.fleeT = 2.5;
          p.heading = Math.atan2(p.x - x, p.z - z);
        }
      }
    },
    update(dt, t, threat) {
      for (let i = 0; i < peds.length; i++) {
        const p = peds[i];
        if (threat && Math.hypot(p.x - threat.x, p.z - threat.z) < 13) {
          p.state = 'flee';
          p.fleeT = 2;
          p.heading = Math.atan2(p.x - threat.x, p.z - threat.z);
        }
        if (p.state === 'flee') {
          p.fleeT -= dt;
          p.speed = 4.2;
          if (p.fleeT <= 0) { p.state = 'walk'; p.speed = 1.4; }
        } else {
          const dx = p.target.x - p.x, dz = p.target.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 2) {
            const L = rng.pick(city.streets);
            const along = rng.range(-250, 250);
            const side = rng.chance(0.5) ? 1 : -1;
            p.target = rng.chance(0.5)
              ? { x: along, z: L + side * 10.5 }
              : { x: L + side * 10.5, z: along };
          } else {
            p.heading = Math.atan2(dx, dz);
          }
        }
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        const c = city.clampToCity(p.x, p.z, 8);
        p.x = c.x; p.z = c.z;
        p.bob += dt * p.speed * 2.2;
        const bounce = Math.abs(Math.sin(p.bob)) * 0.06;
        setInstance(bodies, i, p.x, bounce, p.z, p.heading);
        setInstance(heads, i, p.x, bounce, p.z, p.heading);
        setInstance(legs, i, p.x, bounce, p.z, p.heading);
      }
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      legs.instanceMatrix.needsUpdate = true;
    },
  };
}
