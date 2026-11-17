// Cars for Porto Azul II: low-poly box-built cars (body, cabin, wheels,
// headlights, taillights, police light bar) and the traffic system — 22 cars
// looping the road grid in lanes, plus the player's drivable definitions.
import * as T from 'three';

export const CAR_DEFS = {
  azul:   { name: 'AZUL COUPE',  color: 0x2f7fd0, topSpeed: 132, accel: 26, grip: 1.0 },
  comet:  { name: 'COMET GT',    color: 0xd7263d, topSpeed: 168, accel: 34, grip: 1.1 },
  neon:   { name: 'NEON RUNNER', color: 0x19c2ff, topSpeed: 184, accel: 38, grip: 1.15 },
  van:    { name: "BENNY'S VAN", color: 0x8a8f98, topSpeed: 112, accel: 20, grip: 0.9 },
  taxi:   { name: 'CITY TAXI',   color: 0xffc21c, topSpeed: 128, accel: 24, grip: 1.0 },
};

const TRAFFIC_COLORS = [0xd7263d, 0x2f7fd0, 0xffc21c, 0x7dff9a, 0xe8e8e8, 0x22222e, 0xff7b2f, 0x9b59ff, 0x19c2ff, 0xc0c8d0];
const wheelGeo = new T.CylinderGeometry(0.42, 0.42, 0.32, 10);
const wheelMat = new T.MeshLambertMaterial({ color: 0x0c0c10 });
const boxGeo = new T.BoxGeometry(1, 1, 1);

export function makeCarMesh(def, police) {
  const group = new T.Group();
  const bodyMat = new T.MeshLambertMaterial({ color: police ? 0x1a1a22 : def.color });
  const body = new T.Mesh(boxGeo, bodyMat);
  body.scale.set(2.0, 0.62, 4.4);
  body.position.y = 0.55;
  group.add(body);
  const cabinMat = new T.MeshLambertMaterial({ color: police ? 0x1a1a22 : 0x14141c });
  const cabin = new T.Mesh(boxGeo, cabinMat);
  cabin.scale.set(1.7, 0.55, 2.1);
  cabin.position.set(0, 1.1, -0.25);
  group.add(cabin);
  const glass = new T.Mesh(boxGeo, new T.MeshLambertMaterial({ color: 0x9fd8ff, emissive: 0x2a4a5a }));
  glass.scale.set(1.72, 0.3, 0.9);
  glass.position.set(0, 1.05, 0.62);
  group.add(glass);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new T.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  const headMat = new T.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.7, 0.7]) {
    const head = new T.Mesh(boxGeo, headMat);
    head.scale.set(0.42, 0.18, 0.1);
    head.position.set(hx, 0.55, 2.22);
    group.add(head);
  }
  const tailMat = new T.MeshBasicMaterial({ color: 0xff2e4d });
  for (const tx of [-0.7, 0.7]) {
    const tail = new T.Mesh(boxGeo, tailMat);
    tail.scale.set(0.42, 0.16, 0.1);
    tail.position.set(tx, 0.6, -2.22);
    group.add(tail);
  }
  let lightBar = null;
  if (police) {
    const stripe = new T.Mesh(boxGeo, new T.MeshBasicMaterial({ color: 0xffffff }));
    stripe.scale.set(2.02, 0.2, 0.5);
    stripe.position.set(0, 0.62, 0);
    group.add(stripe);
    lightBar = new T.Group();
    const red = new T.Mesh(boxGeo, new T.MeshBasicMaterial({ color: 0xff2e4d }));
    red.scale.set(0.7, 0.22, 0.5); red.position.x = -0.45;
    const blue = new T.Mesh(boxGeo, new T.MeshBasicMaterial({ color: 0x2e7bff }));
    blue.scale.set(0.7, 0.22, 0.5); blue.position.x = 0.45;
    lightBar.add(red); lightBar.add(blue);
    lightBar.position.set(0, 1.5, -0.25);
    group.add(lightBar);
    const plate = new T.Mesh(boxGeo, new T.MeshBasicMaterial({ color: 0xffffff }));
    plate.scale.set(0.9, 0.3, 0.06);
    plate.position.set(0, 0.42, -2.26);
    group.add(plate);
  }
  return { group, lightBar };
}

export function createTraffic(scene, rng, roadLines) {
  const cars = [];
  for (let i = 0; i < 22; i += 1) {
    const def = { name: 'TRAFFIC', color: rng.pick(TRAFFIC_COLORS), topSpeed: 60, accel: 20, grip: 1 };
    const { group } = makeCarMesh(def, false);
    const horizontal = rng.chance(0.5);
    const line = rng.pick(roadLines);
    const lane = rng.chance(0.5) ? 3.4 : -3.4;
    const along = rng.range(-200, 200);
    const dir = rng.chance(0.5) ? 1 : -1;
    group.position.set(horizontal ? along : line + lane, 0, horizontal ? line + lane : along);
    group.rotation.y = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    scene.add(group);
    cars.push({
      group, horizontal, line, lane, dir,
      along, speed: rng.range(9, 16),
      x: group.position.x, z: group.position.z,
    });
  }
  return {
    cars,
    update(dt, frozen) {
      if (frozen) return;
      for (const c of cars) {
        c.along += c.dir * c.speed * dt;
        if (c.along > 210) c.along = -210;
        if (c.along < -210) c.along = 210;
        if (c.horizontal) { c.group.position.x = c.along; c.group.position.z = c.line + c.lane; }
        else { c.group.position.z = c.along; c.group.position.x = c.line + c.lane; }
        c.x = c.group.position.x; c.z = c.group.position.z;
      }
    },
  };
}
