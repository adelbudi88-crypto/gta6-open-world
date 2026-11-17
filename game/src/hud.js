// HUD: DOM overlay + canvas minimap. Every corner carries something —
// district top-left, mission banner top-center, cash/wanted/weapon/health
// top-right, round minimap bottom-left, speedometer bottom-right, radio
// bottom-center. All text in Indonesian, numbers in the winner's style.
// v2.1: same layout and element ids as v2, with the update split into
// per-corner updaters and the minimap drawn in layers (base, roads,
// landmarks, route, dots, player arrow).
const HUD_IDS = [
  'district-name', 'district-flavor',
  'mission-chapter', 'mission-title', 'mission-count', 'objective-text',
  'mission-timer', 'objective',
  'cash', 'stars', 'wanted-label',
  'weapon', 'health-fill', 'health-text',
  'armour-fill', 'armour-text',
  'respect-text',
  'clock', 'day',
  'radio-name', 'radio-freq',
  'speed-num', 'gear', 'car-name',
  'car-health-fill', 'car-health-wrap',
  'speedo-ring',
  'message', 'minimap',
  'garage-hint',
  'chapter', 'chapter-title', 'chapter-sub',
  'screen-start', 'screen-pause', 'screen-end',
  'end-title', 'end-text', 'help',
];

function camel(id) {
  return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function barColor(value) {
  return value > 50 ? '#3aa85a' : value > 25 ? '#e8a832' : '#c23a2e';
}

export function createHud(doc) {
  const el = {};
  for (const id of HUD_IDS) el[camel(id)] = doc.getElementById(id);
  const mm = el.minimap.getContext('2d');
  let msgTimer = null;
  let chapterShownAt = null; // game time when the chapter banner appeared

  function showMessage(text, ms = 4200) {
    el.message.textContent = text;
    el.message.classList.add('show');
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.message.classList.remove('show'), ms);
  }

  function updateWanted(s) {
    el.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
    el.stars.style.color = s.wanted >= 5 ? '#ff4040' : s.wanted > 0 ? '#ffd23a' : '#888';
    el.wantedLabel.textContent = s.wanted >= 5 ? 'MOST WANTED' : s.wanted > 0 ? `WANTED ${s.wanted}/5` : '';
    el.wantedLabel.style.color = s.wanted >= 5 ? '#ff5040' : '#ffd23a';
  }

  function updateVitals(s) {
    el.healthFill.style.width = `${Math.max(0, s.health)}%`;
    el.healthFill.style.background = barColor(s.health);
    el.healthText.textContent = `${Math.ceil(Math.max(0, s.health))}`;
    el.armourFill.style.width = `${Math.max(0, s.armour)}%`;
    el.armourText.textContent = `${Math.ceil(Math.max(0, s.armour))}`;
    el.cash.textContent = `$${s.cash.toLocaleString('id-ID')}`;
    el.weapon.textContent = s.inCar ? '' : (s.reloading ? `${s.weapon} — RELOADING…` : `${s.weapon}  ${s.mag} / ${s.reserve}`);
    el.respectText.textContent = `LV ${s.respectLevel}`;
  }

  function updateMission(s) {
    el.missionCount.textContent = s.missionIndex < s.missionTotal ? `${s.missionIndex + 1}/${s.missionTotal}` : 'SELESAI';
    el.missionTimer.textContent = s.missionIndex < s.missionTotal ? fmtTime(s.missionTimeLeft) : '';
    el.missionTimer.style.color = s.missionTimeLeft < 30 && s.missionIndex < s.missionTotal ? '#ff5040' : '#fff';
  }

  function updateClock(s) {
    const hh = String(s.hour).padStart(2, '0');
    const min = String(s.minute).padStart(2, '0');
    el.clock.textContent = `${hh}:${min}`;
    el.day.textContent = `DAY ${s.day}`;
    el.radioName.textContent = s.radio;
    el.radioFreq.textContent = s.radioFreq;
    el.districtName.textContent = s.district;
    el.districtFlavor.textContent = s.districtFlavor;
  }

  function updateSpeedo(s) {
    if (s.inCar) {
      const kmh = Math.round(Math.abs(s.speedKmh));
      el.speedNum.textContent = `${kmh}`;
      el.gear.textContent = `GEAR ${s.gear}`;
      el.carName.textContent = s.carName || '';
      el.carHealthWrap.style.display = 'block';
      el.carHealthFill.style.width = `${Math.max(0, s.carHealth)}%`;
      el.carHealthFill.style.background = barColor(s.carHealth);
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
  }

  function drawMinimap(world) {
    // world: {city, player, cars, cops, footCops, marker, thugs, heli}
    const S = 200;
    const R = 300; // world radius shown
    const scale = S / (R * 2);
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    mm.clearRect(0, 0, S, S);
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
      mm.beginPath();
      mm.moveTo(ax, 0);
      mm.lineTo(ax, S);
      mm.stroke();
    }
    for (const z of world.city.roadsZ) {
      const [, az] = toMap(0, z);
      mm.beginPath();
      mm.moveTo(0, az);
      mm.lineTo(S, az);
      mm.stroke();
    }
    // park + plaza + casino + garage landmarks
    const landmark = (place, color, half) => {
      const [lx, lz] = toMap(place.x, place.z);
      mm.fillStyle = color;
      mm.fillRect(lx - half, lz - half, half * 2, half * 2);
    };
    landmark(world.city.park, '#3f8a3f', 14);
    landmark(world.city.tower, '#7fa8d8', 3);
    landmark(world.city.casino, '#ff3aa8', 4);
    landmark(world.city.garage, '#3aff7a', 4);
    // route line from player to mission marker
    const [ux, uz] = toMap(world.player.x, world.player.z);
    if (world.marker) {
      const [mx, mz] = toMap(world.marker.x, world.marker.z);
      mm.strokeStyle = '#ffd23a';
      mm.lineWidth = 2.5;
      mm.setLineDash([6, 4]);
      mm.beginPath();
      mm.moveTo(ux, uz);
      mm.lineTo(mx, mz);
      mm.stroke();
      mm.setLineDash([]);
      mm.fillStyle = '#ffd23a';
      mm.beginPath();
      mm.arc(mx, mz, 5, 0, Math.PI * 2);
      mm.fill();
      mm.strokeStyle = '#ffd23a';
      mm.beginPath();
      mm.arc(mx, mz, 9 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2);
      mm.stroke();
    }
    const dot = (x, z, c, r) => {
      const [dx, dz] = toMap(x, z);
      mm.fillStyle = c;
      mm.beginPath();
      mm.arc(dx, dz, r, 0, Math.PI * 2);
      mm.fill();
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
    mm.moveTo(0, -7);
    mm.lineTo(5, 6);
    mm.lineTo(-5, 6);
    mm.closePath();
    mm.fill();
    mm.restore();
    mm.restore();
    // border ring
    mm.strokeStyle = 'rgba(255,255,255,0.6)';
    mm.lineWidth = 3;
    mm.beginPath();
    mm.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    mm.stroke();
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
      updateWanted(s);
      updateVitals(s);
      updateMission(s);
      updateClock(s);
      updateSpeedo(s);
    },
    drawMinimap,
    showStart() { el.screenStart.classList.add('show'); },
    hideStart() { el.screenStart.classList.remove('show'); },
    showPause() { el.screenPause.classList.add('show'); },
    hidePause() { el.screenPause.classList.remove('show'); },
    showEnd(kind, text) {
      el.endTitle.textContent = kind === 'busted' ? 'TERTANGKAP!' : 'GAME OVER';
      el.endText.textContent = text;
      el.screenEnd.classList.add('show');
    },
    hideEnd() { el.screenEnd.classList.remove('show'); },
    setHelpVisible(v) { el.help.style.display = v ? 'block' : 'none'; },
  };
}
