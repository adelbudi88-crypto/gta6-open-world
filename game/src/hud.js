// HUD: DOM overlay + canvas minimap. Every corner carries something —
// district top-left, mission banner top-center, cash/wanted/weapon/health
// top-right, round minimap bottom-left, speedometer bottom-right, radio
// bottom-center. All text in Indonesian, numbers in the winner's style.
// v2: armour bar, weapon + ammo, respect level, mission timer + counter,
// chapter banner, district + flavor, radio, gear + car name + car health,
// minimap route line to the mission marker.
export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    districtName: $('district-name'), districtFlavor: $('district-flavor'),
    missionChapter: $('mission-chapter'), missionTitle: $('mission-title'),
    missionCount: $('mission-count'), objectiveText: $('objective-text'),
    missionTimer: $('mission-timer'), objective: $('objective'),
    cash: $('cash'), stars: $('stars'), wantedLabel: $('wanted-label'),
    weapon: $('weapon'), healthFill: $('health-fill'), healthText: $('health-text'),
    armourFill: $('armour-fill'), armourText: $('armour-text'),
    respectText: $('respect-text'),
    clock: $('clock'), day: $('day'),
    radioName: $('radio-name'), radioFreq: $('radio-freq'),
    speedNum: $('speed-num'), gear: $('gear'), carName: $('car-name'),
    carHealthFill: $('car-health-fill'), carHealthWrap: $('car-health-wrap'),
    speedoRing: $('speedo-ring'),
    message: $('message'), minimap: $('minimap'),
    garageHint: $('garage-hint'),
    chapter: $('chapter'), chapterTitle: $('chapter-title'), chapterSub: $('chapter-sub'),
    start: $('screen-start'), pause: $('screen-pause'), end: $('screen-end'),
    endTitle: $('end-title'), endText: $('end-text'), help: $('help'),
  };
  const mm = el.minimap.getContext('2d');
  let msgTimer = null;
  let chapterShownAt = null; // game time when the chapter banner appeared

  function showMessage(text, ms = 4200) {
    el.message.textContent = text;
    el.message.classList.add('show');
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.message.classList.remove('show'), ms);
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
    // Chapter banner on game time (not wall time): in slow renders the
    // wall clock runs ahead of the game, which used to hide the banner
    // before the screenshot was taken.
    showChapter(chapter, title, now) {
      el.chapterTitle.textContent = chapter;
      el.chapterSub.textContent = title;
      el.chapter.classList.add('show');
      chapterShownAt = now;
    },
    tickChapter(now) {
      if (chapterShownAt !== null && now - chapterShownAt > 3.6) {
        el.chapter.classList.remove('show');
        chapterShownAt = null;
      }
    },
    setGarageHint(text) {
      if (text) {
        el.garageHint.textContent = text;
        el.garageHint.classList.add('show');
      } else {
        el.garageHint.classList.remove('show');
      }
    },
    update(s) {
      // wanted stars + MOST WANTED at 5
      el.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
      el.stars.style.color = s.wanted >= 5 ? '#ff4040' : s.wanted > 0 ? '#ffd23a' : '#888';
      el.wantedLabel.textContent = s.wanted >= 5 ? 'MOST WANTED' : s.wanted > 0 ? `WANTED ${s.wanted}/5` : '';
      el.wantedLabel.style.color = s.wanted >= 5 ? '#ff5040' : '#ffd23a';
      // health + armour
      el.healthFill.style.width = `${Math.max(0, s.health)}%`;
      el.healthFill.style.background = s.health > 50 ? '#3aa85a' : s.health > 25 ? '#e8a832' : '#c23a2e';
      el.healthText.textContent = `${Math.ceil(Math.max(0, s.health))}`;
      el.armourFill.style.width = `${Math.max(0, s.armour)}%`;
      el.armourText.textContent = `${Math.ceil(Math.max(0, s.armour))}`;
      // cash + weapon + respect
      el.cash.textContent = `$${s.cash.toLocaleString('id-ID')}`;
      el.weapon.textContent = s.inCar ? '' : (s.reloading ? `${s.weapon} — RELOADING…` : `${s.weapon}  ${s.mag} / ${s.reserve}`);
      el.respectText.textContent = `LV ${s.respectLevel}`;
      // mission banner
      el.missionCount.textContent = s.missionIndex < s.missionTotal ? `${s.missionIndex + 1}/${s.missionTotal}` : 'SELESAI';
      el.missionTimer.textContent = s.missionIndex < s.missionTotal ? fmtTime(s.missionTimeLeft) : '';
      el.missionTimer.style.color = s.missionTimeLeft < 30 && s.missionIndex < s.missionTotal ? '#ff5040' : '#fff';
      // clock + day + radio + district
      const hh = String(s.hour).padStart(2, '0');
      const mm2 = String(s.minute).padStart(2, '0');
      el.clock.textContent = `${hh}:${mm2}`;
      el.day.textContent = `DAY ${s.day}`;
      el.radioName.textContent = s.radio;
      el.radioFreq.textContent = s.radioFreq;
      el.districtName.textContent = s.district;
      el.districtFlavor.textContent = s.districtFlavor;
      // speedometer: number + gear + car + car health ring
      if (s.inCar) {
        const kmh = Math.round(Math.abs(s.speedKmh));
        el.speedNum.textContent = `${kmh}`;
        el.gear.textContent = `GEAR ${s.gear}`;
        el.carName.textContent = s.carName || '';
        el.carHealthWrap.style.display = 'block';
        el.carHealthFill.style.width = `${Math.max(0, s.carHealth)}%`;
        el.carHealthFill.style.background = s.carHealth > 50 ? '#3aa85a' : s.carHealth > 25 ? '#e8a832' : '#c23a2e';
        // speed ring: 0..150 km/j maps to the 270-degree arc
        const frac = Math.min(1, kmh / 150);
        const C = 2 * Math.PI * 88;
        el.speedoRing.style.strokeDashoffset = String(C * (1 - frac * 0.75));
      } else {
        el.speedNum.textContent = '0';
        el.gear.textContent = 'ON FOOT';
        el.carName.textContent = '';
        el.carHealthWrap.style.display = 'none';
      }
    },
    drawMinimap(world) {
      // world: {city, player, cars, cops, footCops, marker, thugs, heli}
      const S = 200, R = 300; // world radius shown
      const scale = S / (R * 2);
      const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
      mm.clearRect(0, 0, S, S);
      // round mask
      mm.save();
      mm.beginPath();
      mm.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      mm.clip();
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
      // park + plaza + casino + garage
      mm.fillStyle = '#3f8a3f';
      const [px, pz] = toMap(world.city.park.x, world.city.park.z);
      mm.fillRect(px - 14, pz - 14, 28, 28);
      mm.fillStyle = '#7fa8d8';
      const [tx, tz] = toMap(world.city.tower.x, world.city.tower.z);
      mm.fillRect(tx - 3, tz - 3, 6, 6);
      mm.fillStyle = '#ff3aa8';
      const [cx, cz] = toMap(world.city.casino.x, world.city.casino.z);
      mm.fillRect(cx - 4, cz - 4, 8, 8);
      mm.fillStyle = '#3aff7a';
      const [gx, gz] = toMap(world.city.garage.x, world.city.garage.z);
      mm.fillRect(gx - 4, gz - 4, 8, 8);
      // route line from player to mission marker
      const [ux, uz] = toMap(world.player.x, world.player.z);
      if (world.marker) {
        const [mx, mz] = toMap(world.marker.x, world.marker.z);
        mm.strokeStyle = '#ffd23a';
        mm.lineWidth = 2.5;
        mm.setLineDash([6, 4]);
        mm.beginPath(); mm.moveTo(ux, uz); mm.lineTo(mx, mz); mm.stroke();
        mm.setLineDash([]);
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
      if (world.heli) dot(world.heli.x, world.heli.z, '#ff9040', 4);
      // player arrow
      mm.save();
      mm.translate(ux, uz);
      mm.rotate(Math.atan2(Math.sin(world.player.heading), Math.cos(world.player.heading)) + Math.PI);
      mm.fillStyle = '#ffffff';
      mm.beginPath();
      mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
      mm.restore();
      mm.restore();
      // border ring
      mm.strokeStyle = 'rgba(255,255,255,0.6)';
      mm.lineWidth = 3;
      mm.beginPath();
      mm.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
      mm.stroke();
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
