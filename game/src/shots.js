// Staged dossier shots for Porto Azul II — exact values from the v2.6 brief.
// Shot mode freezes the world after staging so the capture is deterministic.
import * as THREE from 'three';

export const SHOT_SPECS = {
  drive: {
    missionIndex: 1,
    state: {
      cash: 18450, wanted: 4, health: 82, armour: 54, respect: 4,
      speedKmh: 137, timer: 134, day: 1, clock: '19:07',
      radio: 'SOL FM 95.4 SYNTHWAVE', onFoot: false, carName: 'Comet GT',
      district: 'TORRE PLAZA', flavor: 'NEON, NOISE AND NO WAY OUT',
      weapon: { name: 'HORNET SMG', ammo: 30, reserve: 120 },
    },
    playerPos: { x: 0, z: -40 }, heading: Math.PI, // driving -z through Torre Plaza
    tonoCar: { x: 0, z: -72 },
    cops: [[-14, -46], [16, -58], [10, -88]],
    heli: { x: 8, z: -30 },
    camera: { dist: 15, height: 5.5, lookAhead: 12 },
  },
  foot: {
    missionIndex: 3,
    state: {
      cash: 12300, wanted: 2, health: 91, armour: 40, respect: 3,
      speedKmh: 0, timer: 298, day: 1, clock: '19:07',
      radio: 'SOL FM 95.4 SYNTHWAVE', onFoot: true, carName: '',
      district: 'THE MIRAGE STRIP', flavor: 'CASINO LIGHTS NEVER SLEEP',
      weapon: { name: 'HORNET SMG', ammo: 24, reserve: 120 },
    },
    playerPos: { x: 60, z: 78 }, heading: Math.PI, // facing the casino vault (north, -z)
    cops: [[44, 70], [76, 70], [48, 88], [72, 88]],
    copCars: [[38, 84], [82, 68]],
    heli: null,
    camera: { dist: 9, height: 3.6, lookAhead: 6 },
  },
  chase: {
    missionIndex: 2,
    state: {
      cash: 24000, wanted: 5, health: 76, armour: 30, respect: 4,
      speedKmh: 144, timer: 180, day: 1, clock: '19:08',
      radio: 'VICE 101.7 ELECTRO', onFoot: false, carName: 'Neon Runner',
      district: 'TORRE PLAZA', flavor: 'NEON, NOISE AND NO WAY OUT',
      weapon: { name: 'HORNET SMG', ammo: 30, reserve: 120 },
    },
    playerPos: { x: 0, z: -90 }, heading: Math.PI,
    tonoCar: null,
    cops: [[-11, -96], [11, -96], [0, -118]],
    heli: { x: -6, z: -72 },
    camera: { dist: 16, height: 6, lookAhead: 14 },
  },
  mission: {
    missionIndex: 4,
    state: {
      cash: 48500, wanted: 4, health: 88, armour: 62, respect: 5,
      speedKmh: 0, timer: 105, day: 1, clock: '19:08',
      radio: 'PALM 88.1 LATIN POP', onFoot: true, carName: '',
      district: 'THE MIRAGE STRIP', flavor: 'CASINO LIGHTS NEVER SLEEP',
      weapon: { name: 'HORNET SMG', ammo: 18, reserve: 120 },
    },
    playerPos: { x: 60, z: 80 }, heading: Math.PI,
    // Vault guards at the casino door, cops kept to the sides so the
    // chapter banner's center band stays clear of any light bar.
    cops: [[52, 60], [68, 60], [34, 72], [86, 72]],
    copCars: [[30, 88], [90, 88]],
    heli: null,
    camera: { dist: 9, height: 3.6, lookAhead: 6 },
  },
};

export function applyShot(world, name) {
  const spec = SHOT_SPECS[name];
  if (!spec) return false;
  const st = world.state;
  world.missions.index = spec.missionIndex;
  world.missions.timer = spec.state.timer;
  Object.assign(st, spec.state);
  st.timer = spec.state.timer;
  st.px = spec.playerPos.x;
  st.pz = spec.playerPos.z;
  st.heading = spec.heading;
  st.showBanner = true;
  const player = world.player;
  // syncState reads health/armour/weapon from the player, so stage them there too.
  player.health = spec.state.health;
  player.armour = spec.state.armour;
  player.weapon = { ...spec.state.weapon };

  if (spec.state.onFoot) {
    if (player.car) player.exitCar();
    player.pos.set(spec.playerPos.x, 0, spec.playerPos.z);
    player.heading = spec.heading;
    player.mesh.visible = true;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = spec.heading;
    player.speed = 0;
  } else {
    const carColor = name === 'chase' ? 0x22e6ff : 0xffc21c;
    if (!player.car || player.carName !== spec.state.carName) {
      if (player.car) world.scene.remove(player.car);
      const car = world.makePlayerCar(carColor);
      world.scene.add(car);
      player.enterCar(car, spec.state.carName);
    }
    player.car.position.set(spec.playerPos.x, 0, spec.playerPos.z);
    player.car.rotation.y = spec.heading;
    player.heading = spec.heading;
    player.speed = spec.state.speedKmh;
    player.pos.copy(player.car.position);
  }

  // Tono's red car ahead in the drive shot.
  if (world.tonoCar) {
    world.tonoCar.visible = !!spec.tonoCar;
    if (spec.tonoCar) {
      world.tonoCar.position.set(spec.tonoCar.x, 0, spec.tonoCar.z);
      world.tonoCar.rotation.y = spec.heading;
    }
  }

  // Pursuit cars at the flanks, never occluding the player.
  if (spec.cops) {
    world.police.cars.forEach((c, i) => {
      const [ox, oz] = spec.cops[i % spec.cops.length];
      c.mesh.position.set(ox, 0, oz);
      c.mesh.rotation.y = spec.heading;
    });
  }
  if (spec.copCars) {
    world.police.cars.forEach((c, i) => {
      const spot = spec.copCars[i % spec.copCars.length];
      if (spot) { c.mesh.position.set(spot[0], 0, spot[1]); c.mesh.rotation.y = spec.heading; }
    });
  }
  if (spec.cops && !spec.copCars) {
    world.police.stageCops(spec.playerPos.x, spec.playerPos.z, [[-16, -8], [16, -8], [-12, 10], [12, 10]]);
  } else if (spec.cops) {
    world.police.stageCops(spec.playerPos.x, spec.playerPos.z, [[-8, -18], [8, -18], [-14, 8], [14, 8]]);
  }
  if (spec.heli) {
    world.police.heli.visible = true;
    world.police.beam.visible = true;
    world.police.heli.position.set(spec.heli.x, 46, spec.heli.z);
  } else {
    world.police.heli.visible = st.wanted >= 5;
    world.police.beam.visible = st.wanted >= 5;
  }

  // Keep the vault approach clear in the on-foot shots: shove any traffic car
  // out of the corridor between the player and the casino vault.
  if (spec.state.onFoot) {
    for (const c of world.traffic.cars) {
      const p = c.mesh.position;
      if (p.x > 44 && p.x < 76 && p.z > 54 && p.z < 86) p.x = p.x < 60 ? 30 : 90;
    }
  }

  // Freeze the world for the capture and pose the camera.
  world.frozen = true;
  world.shotCamera = spec.camera;
  world.updateCamera(true);
  world.hud.update(st, world);
  return true;
}
