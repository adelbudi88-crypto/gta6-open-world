// Staged screenshot poses. In shot mode the world is FROZEN — no traffic,
// no police movement, no drag — and every value is pinned to the exact
// numbers in the brief, so the dossier screenshots read as a finished
// game at a glance. The camera pose is applied via updateCamera() before
// each render.
import * as THREE from 'three';

export const SHOTS = {
  drive: {
    chapter: 2, cash: 18450, wanted: 4, speedKmh: 137, timer: 134,
    carName: 'Comet GT', carColor: 0x2a6ad8, onFoot: false,
    pos: [0, 0, -20], heading: 0, district: 'TORRE PLAZA', clock: 19 * 60 + 7,
    weapon: { mag: 24, reserve: 120 }, health: 91, armour: 40,
  },
  foot: {
    chapter: 4, cash: 12300, wanted: 2, speedKmh: 0, timer: 298,
    carName: '', carColor: 0, onFoot: true,
    pos: [0, 0, -100], heading: Math.PI, district: 'THE MIRAGE STRIP', clock: 19 * 60 + 7,
    weapon: { mag: 24, reserve: 120 }, health: 91, armour: 40,
  },
  chase: {
    chapter: 3, cash: 24000, wanted: 5, speedKmh: 144, timer: 180,
    carName: 'Neon Runner', carColor: 0xd81e8a, onFoot: false,
    pos: [0, 0, -90], heading: 0, district: 'TORRE PLAZA', clock: 19 * 60 + 8,
    weapon: { mag: 30, reserve: 120 }, health: 82, armour: 54,
  },
  mission: {
    chapter: 5, cash: 48500, wanted: 4, speedKmh: 0, timer: 105,
    carName: '', carColor: 0, onFoot: true,
    pos: [0, 0, -100], heading: Math.PI, district: 'THE MIRAGE STRIP', clock: 19 * 60 + 8,
    weapon: { mag: 18, reserve: 120 }, health: 88, armour: 62,
  },
};

export function applyShot(world, name) {
  const s = SHOTS[name];
  if (!s) return false;
  const { player, police, missions, vehicles } = world;
  const st = player.state;

  world.frozen = true;
  world.clockMinutes = s.clock;
  world.day = 1;
  world.districtOverride = world.city.districts.find((d) => d.name === s.district) || null;

  // Mission + banner.
  missions.setChapter(s.chapter - 1, s.timer);
  // Player state.
  st.cash = s.cash;
  st.health = s.health;
  st.armour = s.armour;
  st.weapon.mag = s.weapon.mag;
  st.weapon.reserve = s.weapon.reserve;
  st.respect = 4;
  st.speedKmh = s.speedKmh;
  st.heading = s.heading;
  st.onFoot = s.onFoot;
  player.resetSpeed();

  if (s.onFoot) {
    if (st.car) {
      st.car.visible = false;
      st.car = null;
      st.carName = '';
    }
    st.pos.set(s.pos[0], 0, s.pos[2]);
    player.state.mesh.position.copy(st.pos);
    player.state.mesh.rotation.y = s.heading;
    player.state.mesh.visible = true;
  } else {
    player.state.mesh.visible = false;
    let car = st.car;
    if (!car || st.carName !== s.carName) {
      if (car) car.visible = false;
      car = player.spawnCar(s.carName, s.carColor, s.pos[0], s.pos[2], s.heading);
      player.enterCar(car, s.carName);
    }
    car.position.set(s.pos[0], 0, s.pos[2]);
    car.rotation.y = s.heading;
    st.pos.set(s.pos[0], 0, s.pos[2]);
    st.speedKmh = s.speedKmh;
  }

  // Wanted + staged police (flanks only, never occluding the player).
  police.setWanted(s.wanted);
  police.placeForShot(name, new THREE.Vector3(s.pos[0], 0, s.pos[2]));

  // Tono's red car ahead of the player in the drive shot.
  vehicles.tono.visible = true;
  if (name === 'drive') {
    vehicles.tono.position.set(s.pos[0] + 1, 0, s.pos[2] - 26);
    vehicles.tono.rotation.y = s.heading;
  } else if (name === 'chase') {
    vehicles.tono.position.set(s.pos[0] - 12, 0, s.pos[2] - 30);
    vehicles.tono.rotation.y = s.heading;
  } else {
    vehicles.tono.position.set(s.pos[0] + 18, 0, s.pos[2] - 34);
    vehicles.tono.rotation.y = s.heading;
  }

  // On-foot shots: stand south of the casino, marker pinned to the vault
  // door, and shove any frozen traffic car out of the sightline.
  if (s.onFoot) {
    const vault = world.city.vaultDoor;
    vehicles.clearCorridor(st.pos, vault, 7);
  }

  // Radio pinned to SOL FM for drive/chase shots.
  world.audio.setStation(name === 'drive' || name === 'chase' ? 0 : 2);

  // Apply the staged camera pose now, before the render.
  world.updateCamera();
  world.hud.update(world.hudState());
  world.renderer.render(world.scene, world.camera);
  window.__shotReady = true;
  return true;
}
