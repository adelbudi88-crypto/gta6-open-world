// HUD: DOM overlay + canvas minimap. All text in Indonesian.
export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    hud: $('hud'), stars: $('stars'), healthFill: $('health-fill'), healthText: $('health-text'),
    cash: $('cash'), ammo: $('ammo'), speed: $('speed'), clock: $('clock'), objective: $('objective'),
    objectiveText: $('objective-text'), message: $('message'), minimap: $('minimap'),
    start: $('screen-start'), pause: $('screen-pause'), end: $('screen-end'),
    endTitle: $('end-title'), endText: $('end-text'), help: $('help'),
    missionTitle: $('mission-title'),
  };
  const mm = el.minimap.getContext('2d');
  let msgTimer = null;

  function showMessage(text, ms = 4200) {
    el.message.textContent = text;
    el.message.classList.add('show');
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.message.classList.remove('show'), ms);
  }

  return {
    el,
    showMessage,
    setObjective(title, text) {
      el.missionTitle.textContent = title;
      el.objectiveText.textContent = text;
      el.objective.classList.add('show');
    },
    hideObjective() { el.objective.classList.remove('show'); },
    update(s) {
      el.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
      el.stars.style.color = s.wanted > 0 ? '#ffd23a' : '#888';
      el.healthFill.style.width = `${Math.max(0, s.health)}%`;
      el.healthFill.style.background = s.health > 50 ? '#3aa85a' : s.health > 25 ? '#e8a832' : '#c23a2e';
      el.healthText.textContent = `${Math.ceil(Math.max(0, s.health))}`;
      el.cash.textContent = `$${s.cash.toLocaleString('id-ID')}`;
      el.ammo.textContent = s.inCar ? '' : `Peluru: ${s.ammo}`;
      el.speed.textContent = s.inCar ? `${Math.round(Math.abs(s.speedKmh))} km/j` : '';
      const hh = String(s.hour).padStart(2, '0');
      const mm2 = String(s.minute).padStart(2, '0');
      el.clock.textContent = `${hh}:${mm2}`;
    },
    drawMinimap(world) {
      // world: {city, player, cars, cops, footCops, marker, thugs}
      const S = 190, R = 300; // world radius shown
      const scale = S / (R * 2);
      const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
      mm.clearRect(0, 0, S, S);
      mm.fillStyle = 'rgba(12, 20, 16, 0.85)';
      mm.fillRect(0, 0, S, S);
      // sea
      mm.fillStyle = '#2e7fa8';
      mm.fillRect(0, 0, S, (S / 2 + world.city.seaZ * scale));
      // roads
      mm.strokeStyle = '#5a5a60';
      mm.lineWidth = 5;
      for (const x of world.city.roadsX) {
        const [ax] = toMap(x, 0);
        mm.beginPath(); mm.moveTo(ax, 0); mm.lineTo(ax, S); mm.stroke();
      }
      for (const z of world.city.roadsZ) {
        const [, az] = toMap(0, z);
        mm.beginPath(); mm.moveTo(0, az); mm.lineTo(S, az); mm.stroke();
      }
      // park + plaza
      mm.fillStyle = '#3f8a3f';
      const [px, pz] = toMap(world.city.park.x, world.city.park.z);
      mm.fillRect(px - 14, pz - 14, 28, 28);
      mm.fillStyle = '#7fa8d8';
      const [tx, tz] = toMap(world.city.tower.x, world.city.tower.z);
      mm.fillRect(tx - 3, tz - 3, 6, 6);
      // mission marker
      if (world.marker) {
        const [mx, mz] = toMap(world.marker.x, world.marker.z);
        mm.fillStyle = '#ffd23a';
        mm.beginPath(); mm.arc(mx, mz, 5, 0, Math.PI * 2); mm.fill();
        mm.strokeStyle = '#ffd23a';
        mm.beginPath(); mm.arc(mx, mz, 9 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2); mm.stroke();
      }
      const dot = (x, z, c, r) => {
        const [dx, dz] = toMap(x, z);
        mm.fillStyle = c;
        mm.beginPath(); mm.arc(dx, dz, r, 0, Math.PI * 2); mm.fill();
      };
      for (const c of world.cars) dot(c.x, c.z, '#d8d8d8', 2.5);
      for (const c of world.cops) dot(c.x, c.z, '#3a6aff', 3);
      for (const c of world.footCops) dot(c.x, c.z, '#3a6aff', 2);
      for (const t of world.thugs || []) if (!t.dead) dot(t.x, t.z, '#ff4040', 3);
      // player arrow
      const [ux, uz] = toMap(world.player.x, world.player.z);
      mm.save();
      mm.translate(ux, uz);
      mm.rotate(Math.atan2(Math.sin(world.player.heading), Math.cos(world.player.heading)) + Math.PI);
      mm.fillStyle = '#ffffff';
      mm.beginPath();
      mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
      mm.restore();
      // border
      mm.strokeStyle = 'rgba(255,255,255,0.5)';
      mm.lineWidth = 2;
      mm.strokeRect(1, 1, S - 2, S - 2);
    },
    showStart() { el.start.classList.add('show'); },
    hideStart() { el.start.classList.remove('show'); },
    showPause() { el.pause.classList.add('show'); },
    hidePause() { el.pause.classList.remove('show'); },
    showEnd(kind, text) {
      el.endTitle.textContent = kind === 'busted' ? 'TERTANGKAP!' : 'GAME OVER';
      el.endText.textContent = text;
      el.end.classList.add('show');
    },
    hideEnd() { el.end.classList.remove('show'); },
    setHelpVisible(v) { el.help.style.display = v ? 'block' : 'none'; },
  };
}
