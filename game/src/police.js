// Police for Porto Azul II: pursuit cars with flashing light bars, foot cops
// who chase the player on foot, and a helicopter with a searchlight cone.
// Spawn counts scale with the wanted level; at 5 stars the city is MOST WANTED.
import * as T from 'three';
import { makeCarMesh, CAR_DEFS } from './vehicles.js';
import { clamp } from './rng.js';

export function createPolice(scene, rng) {
  const copCars = [];
  const footCops = [];
  const heliGroup = new T.Group();
  const heliBody = new T.Mesh(
    new T.BoxGeometry(3.4, 1.4, 6.5),
    new T.MeshLambertMaterial({ color: 0x1a1a22 })
  );
  heliGroup.add(heliBody);
  const heliStripe = new T.Mesh(
    new T.BoxGeometry(3.45, 0.4, 6.55),
    new T.MeshBasicMaterial({ color: 0xffffff })
  );
  heliGroup.add(heliStripe);
  const rotor = new T.Mesh(
    new T.BoxGeometry(11, 0.12, 0.7),
    new T.MeshLambertMaterial({ color: 0x33333e })
  );
  rotor.position.y = 1.1;
  heliGroup.add(rotor);
  const tailRotor = new T.Mesh(
    new T.BoxGeometry(0.5, 2.2, 0.12),
    new T.MeshLambertMaterial({ color: 0x33333e })
  );
  tailRotor.position.set(0, 0.4, -3.6);
  heliGroup.add(tailRotor);
  const coneGeo = new T.ConeGeometry(7, 55, 20, 1, true);
  const coneMat = new T.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.16,
    side: T.DoubleSide, depthWrite: false,
  });
  const cone = new T.Mesh(coneGeo, coneMat);
  cone.position.y = -28;
  cone.rotation.x = Math.PI;
  heliGroup.add(cone);
  const spotCircle = new T.Mesh(
    new T.CircleGeometry(7, 24),
    new T.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35 })
  );
  spotCircle.rotation.x = -Math.PI / 2;
  spotCircle.position.y = 0.12;
  scene.add(spotCircle);
  heliGroup.visible = false;
  spotCircle.visible = false;
  scene.add(heliGroup);

  let heliAngle = 0;

  function spawnCopCar(x, z) {
    const { group, lightBar } = makeCarMesh(CAR_DEFS.azul, true);
    group.position.set(x, 0, z);
    scene.add(group);
    const car = { group, lightBar, speed: 0, heading: 0, ram: 0 };
    copCars.push(car);
    return car;
  }

  function spawnFootCop(x, z) {
    const g = new T.Group();
    const navy = new T.MeshLambertMaterial({ color: 0x1a2a4a });
    const skin = new T.MeshLambertMaterial({ color: 0xe0ac69 });
    const body = new T.Mesh(new T.BoxGeometry(0.6, 0.9, 0.34), navy);
    body.position.y = 1.15; g.add(body);
    const head = new T.Mesh(new T.BoxGeometry(0.34, 0.34, 0.34), skin);
    head.position.y = 1.78; g.add(head);
    const cap = new T.Mesh(new T.BoxGeometry(0.4, 0.14, 0.4), navy);
    cap.position.y = 1.98; g.add(cap);
    g.position.set(x, 0, z);
    scene.add(g);
    const cop = { group: g, hp: 100 };
    footCops.push(cop);
    return cop;
  }

  function wantedCarCount(wanted) {
    return wanted <= 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 4 : 6;
  }

  // Staging helpers used by shots.js: pin exact cop / heli poses for a capture.
  function ensureCops(n, px, pz) {
    while (copCars.length < n) {
      const a = rng.range(0, Math.PI * 2);
      spawnCopCar(px + Math.cos(a) * 55, pz + Math.sin(a) * 55);
    }
    while (copCars.length > n) {
      const c = copCars.pop();
      scene.remove(c.group);
    }
  }
  function placeCop(i, x, z, heading) {
    const c = copCars[i];
    if (!c) return;
    c.group.position.set(x, 0, z);
    c.group.rotation.y = heading;
    c.heading = heading;
    c.speed = 0;
  }
  function ensureFootCops(n, px, pz) {
    while (footCops.length < n) {
      const a = rng.range(0, Math.PI * 2);
      spawnFootCop(px + Math.cos(a) * 26, pz + Math.sin(a) * 26);
    }
    while (footCops.length > n) {
      const c = footCops.pop();
      scene.remove(c.group);
    }
  }
  function placeFootCop(i, x, z) {
    const c = footCops[i];
    if (!c) return;
    c.group.position.set(x, 0, z);
    c.group.rotation.y = Math.atan2(0, 1);
  }
  function placeHeli(x, z, on) {
    heliGroup.visible = on;
    spotCircle.visible = on;
    if (!on) return;
    heliGroup.position.set(x + 10, 58, z - 12);
    heliGroup.rotation.y = 0.6;
    spotCircle.position.set(x, 0.12, z);
  }

  return {
    copCars,
    footCops,
    heliGroup,
    ensureCops,
    placeCop,
    ensureFootCops,
    placeFootCop,
    placeHeli,
    update(dt, frozen, state, px, pz, playerHeading, onFoot, t) {
      if (frozen) return;
      // Flash every light bar.
      const phase = Math.floor(t * 6) % 2 === 0;
      for (const c of copCars) {
        if (c.lightBar) {
          c.lightBar.children[0].material.color.setHex(phase ? 0xff2e4d : 0x550000);
          c.lightBar.children[1].material.color.setHex(phase ? 0x220066 : 0x2e7bff);
        }
      }
      const want = state.wanted;
      const needCars = wantedCarCount(want);
      while (copCars.length < needCars) {
        const a = rng.range(0, Math.PI * 2);
        spawnCopCar(px + Math.cos(a) * 55, pz + Math.sin(a) * 55);
      }
      while (copCars.length > needCars) {
        const c = copCars.pop();
        scene.remove(c.group);
      }
      const needFoot = onFoot ? (want >= 1 ? Math.min(want, 4) : 0) : 0;
      while (footCops.length < needFoot) {
        const a = rng.range(0, Math.PI * 2);
        spawnFootCop(px + Math.cos(a) * 26, pz + Math.sin(a) * 26);
      }
      while (footCops.length > needFoot) {
        const c = footCops.pop();
        scene.remove(c.group);
      }
      // Pursuit cars steer at the player and ram.
      for (const c of copCars) {
        const dx = px - c.group.position.x;
        const dz = pz - c.group.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        const targetHeading = Math.atan2(dx, dz);
        let dh = targetHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
        const cruise = want >= 5 ? 30 : want >= 3 ? 26 : 21;
        c.speed = clamp(c.speed + (cruise - c.speed) * dt * 0.6, 0, 34);
        c.group.position.x += Math.sin(c.heading) * c.speed * dt;
        c.group.position.z += Math.cos(c.heading) * c.speed * dt;
        c.group.rotation.y = c.heading;
        if (dist < 4.5) {
          c.ram = 0.5;
          state.health = clamp(state.health - 12 * dt, 0, 100);
        }
      }
      // Foot cops run the player down.
      for (const c of footCops) {
        const dx = px - c.group.position.x;
        const dz = pz - c.group.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        c.group.position.x += (dx / dist) * 5.2 * dt;
        c.group.position.z += (dz / dist) * 5.2 * dt;
        c.group.rotation.y = Math.atan2(dx, dz);
        if (dist < 1.6) state.health = clamp(state.health - 10 * dt, 0, 100);
      }
      // Helicopter circles above at wanted 3+.
      const heliOn = want >= 3;
      heliGroup.visible = heliOn;
      spotCircle.visible = heliOn;
      if (heliOn) {
        heliAngle += dt * 0.45;
        heliGroup.position.set(px + Math.cos(heliAngle) * 26, 58, pz + Math.sin(heliAngle) * 26);
        heliGroup.rotation.y = Math.atan2(px - heliGroup.position.x, pz - heliGroup.position.z);
        rotor.rotation.y += dt * 22;
        cone.lookAt(px, 0, pz);
        spotCircle.position.set(px, 0.12, pz);
      }
    },
  };
}
