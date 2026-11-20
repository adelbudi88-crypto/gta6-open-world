// Shot staging — the four dossier screenshots. Each shot pins exact values
// from the v2.8 brief (chapter, cash, wanted, weapon, timer, district, speed),
// freezes the world so the camera, the cops and the cash cannot drift during
// the capture, stages pursuit cops to the flanks so they never occlude the
// player's car, and renders one frame before raising window.__shotReady.
const SHOTS = [
  { n: 1, chapter: 6, name: 'Harbor Lights', cash: 18450, wanted: 4, timer: 134, minutes: 19 * 60 + 7, district: 'TORRE PLAZA', car: 'comet', speed: 137, weapon: 'smg', mag: 30, reserve: 120, health: 100, armour: 60, pos: [40, -40], angle: 0, onFoot: false },
  { n: 2, chapter: 7, name: 'Air One Down', cash: 12300, wanted: 5, timer: 298, minutes: 19 * 60 + 7, district: 'THE MIRAGE STRIP', car: null, speed: 0, weapon: 'smg', mag: 24, reserve: 120, health: 91, armour: 40, pos: [-40, -80], angle: 3.14, onFoot: true },
  { n: 3, chapter: 8, name: 'The Last Score', cash: 24000, wanted: 5, timer: 180, minutes: 19 * 60 + 8, district: 'TORRE PLAZA', car: 'neon', speed: 144, weapon: 'smg', mag: 30, reserve: 120, health: 100, armour: 60, pos: [0, -80], angle: 0, onFoot: false },
  { n: 4, chapter: 5, name: 'Casino Vault Run', cash: 48500, wanted: 4, timer: 105, minutes: 19 * 60 + 8, district: 'THE MIRAGE STRIP', car: null, speed: 0, weapon: 'shotgun', mag: 18, reserve: 24, health: 88, armour: 60, pos: [-40, -40], angle: 3.14, onFoot: true },
];

function sidePos(px, pz, angle, fwd, lat) {
  const fx = Math.cos(angle), fz = -Math.sin(angle);
  return [px + fx * fwd - fz * lat, pz + fz * fwd + fx * lat];
}

export function applyShot(world, n) {
  const shot = SHOTS.find((s) => s.n === n);
  if (!shot) return false;
  const s = world.state;
  const p = world.player;
  world.frozen = true;

  // Core state — exact brief values.
  s.day = 1;
  s.minutes = shot.minutes;
  s.cash = shot.cash;
  s.health = shot.health;
  s.armour = shot.armour;
  p.health = shot.health;
  p.armour = shot.armour;
  p.weapon = shot.weapon;
  p.weapons[shot.weapon].mag = shot.mag;
  p.weapons[shot.weapon].reserve = shot.reserve;
  p.speedKmh = shot.speed;

  // Player pose.
  p.pos.x = shot.pos[0];
  p.pos.z = shot.pos[1];
  p.angle = shot.angle;
  if (shot.onFoot) {
    p.onFoot = true;
    p.car = null;
    p.mesh.visible = true;
    p.mesh.position.set(p.pos.x, 0, p.pos.z);
    p.mesh.rotation.y = p.angle;
    // Rim-light Daz so the on-foot player reads at dusk (shot only).
    const jacket = p.mesh.children[0];
    if (jacket && jacket.material && jacket.material.emissive) {
      jacket.material.emissive.setHex(0x0e7a6b);
      jacket.material.emissiveIntensity = 0.7;
    }
    const cap = p.mesh.children[2];
    if (cap && cap.material && cap.material.emissive) {
      cap.material.emissive.setHex(0xffb400);
      cap.material.emissiveIntensity = 0.5;
    }
  } else {
    if (p.car) { world.scene.remove(p.car.mesh); p.car = null; }
    p.spawnCar(shot.car);
    p.car.mesh.position.set(p.pos.x, 0, p.pos.z);
    p.car.mesh.rotation.y = p.angle;
    p.car.angle = p.angle;
    p.car.speed = shot.speed / 3.6;
    p.mesh.visible = false;
  }

  // Mission + banner (sticky — it must survive until the capture).
  world.missions.index = shot.chapter - 1;
  world.missions.active = true;
  world.missions.timeLeft = shot.timer;
  s.missionIndex = shot.chapter - 1;
  const cur = world.missions.current();
  world.hud.showBanner(cur.chapter + ': ' + cur.name, cur.desc, true);

  // Wanted + police. setWanted activates the right count, then we re-stage
  // the pursuit cars to the flanks so none occludes the player.
  world.police.setWanted(shot.wanted, world);
  const fx = Math.cos(shot.angle), fz = -Math.sin(shot.angle);
  const flank = (i, fwd, lat) => sidePos(shot.pos[0], shot.pos[1], shot.angle, fwd, lat);
  world.police.cops.forEach((c, i) => {
    if (!c.active) return;
    const spots = [flank(i, 16, -5), flank(i, 14, 5), flank(i, -2, -11), flank(i, 2, 11), flank(i, 30, 0), flank(i, 24, -8)];
    const sp = spots[i % spots.length];
    c.mesh.position.set(sp[0], 0, sp[1]);
    c.angle = shot.angle + Math.PI;
    c.mesh.rotation.y = c.angle;
  });
  world.police.footCops.forEach((f, i) => {
    if (!f.active) return;
    const sp = flank(i, 8 + (i % 3) * 4, (i % 2 === 0 ? -1 : 1) * (6 + (i % 2) * 4));
    f.x = sp[0]; f.z = sp[1];
    f.mesh.position.set(f.x, 0, f.z);
  });
  world.police.helis.forEach((h, i) => {
    if (!h.active) return;
    h.mesh.position.set(shot.pos[0] + fx * 8 + (i === 0 ? 10 : -14), 34, shot.pos[1] + fz * 8 + (i === 0 ? -12 : 10));
  });

  // Roadblocks ahead on the route (shots 1–3). Shot 4 keeps the banner band
  // clear: no roadblock, cop cars stay low at the frame edges.
  if (n === 1 || n === 2 || n === 3) world.police.spawnRoadblock(world);
  if (n === 4) world.police.roadblocks.forEach((r) => { r.active = false; r.mesh.visible = false; });

  // Traffic staging.
  const t = world.vehicles.traffic;
  if (n === 1) {
    // Tono's red car ahead, oncoming traffic on the far lane.
    if (t[0]) {
      t[0].mesh.children[0].material.color.setHex(0xd21f1f);
      t[0].mesh.position.set(shot.pos[0] + 20, 0, shot.pos[1]);
      t[0].mesh.rotation.y = shot.angle;
    }
    if (t[1]) { t[1].mesh.position.set(shot.pos[0] + 34, 0, shot.pos[1] + 4); t[1].mesh.rotation.y = shot.angle + Math.PI; }
    if (t[2]) { t[2].mesh.position.set(shot.pos[0] + 44, 0, shot.pos[1] + 4); t[2].mesh.rotation.y = shot.angle + Math.PI; }
    if (t[3]) { t[3].mesh.position.set(shot.pos[0] - 18, 0, shot.pos[1] - 4); t[3].mesh.rotation.y = shot.angle; }
  }
  if (n === 3) {
    if (t[0]) { t[0].mesh.position.set(shot.pos[0] + 22, 0, shot.pos[1]); t[0].mesh.rotation.y = shot.angle; }
    if (t[1]) { t[1].mesh.position.set(shot.pos[0] + 36, 0, shot.pos[1] + 4); t[1].mesh.rotation.y = shot.angle + Math.PI; }
    if (t[2]) { t[2].mesh.position.set(shot.pos[0] - 16, 0, shot.pos[1] - 4); t[2].mesh.rotation.y = shot.angle; }
  }
  if (n === 2) {
    // Cops + cop cars + roadblock ringing the player on foot.
    if (t[0]) { t[0].mesh.position.set(shot.pos[0] + 26, 0, shot.pos[1] - 8); t[0].mesh.rotation.y = shot.angle; }
  }

  // Weapon wheel visible on the foot + SMG shot.
  if (n === 2) world.hud.showWheel(true, 'smg');
  else world.hud.showWheel(false, shot.weapon);

  // Camera: pinned behind the player, looking down the road / at the casino.
  const dist = shot.onFoot ? 9 : 11;
  const height = shot.onFoot ? 3.8 : 4.2;
  const lookAhead = shot.onFoot ? 12 : 14;
  world.cameraPose = {
    pos: [shot.pos[0] - fx * dist, height, shot.pos[1] - fz * dist],
    look: [shot.pos[0] + fx * lookAhead, 1.2, shot.pos[1] + fz * lookAhead],
  };

  world.hud.update(world);
  world.updateCamera();
  world.renderer.render(world.scene, world.camera);
  window.__shotReady = true;
  return true;
}
