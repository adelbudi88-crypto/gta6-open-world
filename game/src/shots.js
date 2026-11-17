// Deterministic staging for screenshots: ?shot=drive|foot|chase|mission&seed=1
// Each preset puts several systems on screen at once (driving + HUD + minimap
// + mission objective; chase + wanted + cops; mission + combat).
export function applyShot(game, shot, seed) {
  const { player, police, missions, traffic, parkedCars, G, hud } = game;
  // auto-start: no start screen in shot mode
  game.startGame();
  hud.hideStart();
  G.time = 0;

  if (shot === 'drive') {
    // Daz driving a car down the main avenue, mission 1 active
    const car = parkedCars[0];
    car.stolen = true;
    car.parked = false;
    car.x = 0; car.z = 200;
    car.heading = Math.PI; // menghadap plaza (-z), tiba di tengah blok saat screenshot
    car.speed = 16;
    player.inCar = true;
    player.car = car;
    player.mesh.visible = false;
    player.x = car.x; player.z = car.z;
    G.camYaw = 0;
    // bersihkan traffic di jalan yang sama (jalan x=0 = axis 'z', line 0)
    // supaya cover shot tidak tabrakan
    for (let i = traffic.cars.length - 1; i >= 0; i--) {
      const c = traffic.cars[i];
      if (c.axis === 'z' && c.line === 0) { game.scene.remove(c.mesh); traffic.cars.splice(i, 1); }
    }
    if (missions.m.phase === 'idle') missions.start(0);
  } else if (shot === 'foot') {
    // Daz on foot on the sidewalk of the main avenue, facing Plaza Torre Azul
    player.x = 9; player.z = 100;
    player.heading = Math.PI * 0.8;
    G.camYaw = -0.51; // kamera di belakang Daz, menghadap menara plaza
    player.mesh.position.set(player.x, 0, player.z);
    if (missions.m.phase === 'idle') missions.start(0);
  } else if (shot === 'chase') {
    // police chase: Daz driving, wanted 3, cop cars right behind
    const car = parkedCars[2];
    car.stolen = true;
    car.parked = false;
    car.x = 0; car.z = 100;
    car.heading = Math.PI;
    car.speed = 20;
    player.inCar = true;
    player.car = car;
    player.mesh.visible = false;
    player.x = car.x; player.z = car.z;
    G.camYaw = 0;
    police.addWanted(50, 'shot-chase');
    missions.start(1); // ganti misi 0 yang di-start startGame() dengan misi kejar-kejaran
    // mission 2 needs a chase target: start it, then place it ahead
    if (game.chaseTarget) {
      game.chaseTarget.x = 0;
      game.chaseTarget.z = 40;
      game.chaseTarget.speed = 18;
    }
  } else if (shot === 'mission') {
    // mission 4 at the pier: thugs + Daz on foot with a gun, wanted 2
    // (thugs spawn on the first mission update tick)
    missions.m.index = 3;
    missions.start(3);
    player.x = -21; player.z = -200;
    player.heading = Math.PI;
    G.camYaw = 0;
    player.ammo = 24;
    player.mesh.position.set(player.x, 0, player.z);
    police.addWanted(25, 'shot-mission');
  }
  // HUD visible in every shot
  hud.setHelpVisible(false);
  void seed;
  void traffic;
}
