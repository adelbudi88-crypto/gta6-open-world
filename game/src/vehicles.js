// Cars: 22 traffic cars cruising the road grid plus the player's rides
// (Comet GT, Neon Runner) and Tono's red car. Simple arcade physics:
// throttle, brake, steering by heading, speed in km/h.
import * as THREE from 'three';
import { makeRng } from './rng.js';

const CAR_COLORS = [0xc0c8d8, 0x8a2a2a, 0x2a6a8a, 0xd8b13c, 0x3a3a44, 0x7d5eff, 0xe8e8e8, 0x2e8a4a];
const CAR_NAMES = ['Comet GT', 'Neon Runner', 'Azul Coupe', 'Vortex S', 'Palmline GT', 'Harbor Hauler'];

export function makeCarMesh(THREE, color, name) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.65 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.6), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.15, metalness: 0.8 }),
  );
  cabin.position.set(0, 1.05, -0.25);
  g.add(cabin);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
  for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.38, z);
    g.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(x, 0.6, 2.32);
    g.add(light);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(x, 0.6, -2.32);
    g.add(tail);
  }
  g.userData.carName = name;
  return g;
}

export function createVehicles(scene) {
  const rng = makeRng(777);
  const traffic = [];
  const lanes = [-180, -120, -60, 0, 60, 120, 180];
  for (let i = 0; i < 22; i++) {
    const along = rng.chance(0.5);
    const lane = rng.pick(lanes);
    const pos = rng.range(-240, 240);
    const color = rng.pick(CAR_COLORS);
    const mesh = makeCarMesh(THREE, color, rng.pick(CAR_NAMES));
    const dir = rng.chance(0.5) ? 1 : -1;
    if (along) mesh.position.set(lane + (dir > 0 ? 3.5 : -3.5), 0, pos);
    else mesh.position.set(pos, 0, lane + (dir > 0 ? 3.5 : -3.5));
    mesh.rotation.y = along ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    scene.add(mesh);
    traffic.push({
      mesh,
      speed: rng.range(28, 52),
      along,
      lane,
      dir,
      color,
    });
  }
  // Tono's red car — the mission target that stays ahead of the player.
  const tono = makeCarMesh(THREE, 0xd81e1e, "Tono's Comet");
  tono.position.set(2, 0, -40);
  scene.add(tono);

  function stepCar(car, dt, frozen) {
    if (frozen) return;
    const step = (car.speed / 3.6) * dt * car.dir;
    if (car.along) {
      car.mesh.position.z += step;
      if (car.mesh.position.z > 250) car.mesh.position.z = -250;
      if (car.mesh.position.z < -250) car.mesh.position.z = 250;
    } else {
      car.mesh.position.x += step;
      if (car.mesh.position.x > 250) car.mesh.position.x = -250;
      if (car.mesh.position.x < -250) car.mesh.position.x = 250;
    }
  }

  return {
    traffic,
    tono,
    update(dt, frozen) {
      for (const car of traffic) stepCar(car, dt, frozen);
    },
    // Push any traffic car out of the corridor between a and b (used so a
    // frozen car never blocks the vault sightline in foot shots).
    clearCorridor(a, b, radius) {
      for (const car of traffic) {
        const p = car.mesh.position;
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const len2 = abx * abx + abz * abz || 1;
        let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + abx * t;
        const cz = a.z + abz * t;
        const dx = p.x - cx;
        const dz = p.z - cz;
        if (dx * dx + dz * dz < radius * radius) {
          p.x += radius * 1.6;
          p.z += radius;
        }
      }
    },
  };
}

// Gear bands tuned so 137 and 144 km/h read GEAR 6.
export function gearFor(speedKmh) {
  if (speedKmh < 1) return 1;
  if (speedKmh < 25) return 1;
  if (speedKmh < 50) return 2;
  if (speedKmh < 75) return 3;
  if (speedKmh < 100) return 4;
  if (speedKmh < 125) return 5;
  return 6;
}
