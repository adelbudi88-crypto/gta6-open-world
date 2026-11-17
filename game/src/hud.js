// HUD: DOM overlay + canvas minimap. Every corner carries something —
// district top-left, mission banner top-center, cash/wanted/weapon/health
// top-right, round minimap bottom-left, speedometer bottom-right, radio
// bottom-center. All text in Indonesian, numbers in the winner's style.
// v2.3: same layout and element ids as v2.2, with the element lookup
// driven by a table, the update split into per-corner paint functions,
// and the minimap drawn by one painter with a small draw list.
function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function barColor(value) {
  if (value > 50) return '#3aa85a';
  if (value > 25) return '#e8a832';
  return '#c23a2e';
}

// [hud key, element id]
const ELEMENTS = [
  ['districtName', 'district-name'], ['districtFlavor', 'district-flavor'],
  ['missionChapter', 'mission-chapter'], ['missionTitle', 'mission-title'],
  ['missionCount', 'mission-count'], ['objectiveText', 'objective-text'],
  ['missionTimer', 'mission-timer'], ['objective', 'objective'],
  ['chapter', 'chapter'], ['chapterTitle', 'chapter-title'],
  ['chapterSub', 'chapter-sub'],
  ['cash', 'cash'], ['stars', 'stars'], ['wantedLabel', 'wanted-label'],
  ['weapon', 'weapon'], ['healthFill', 'health-fill'],
  ['healthText', 'health-text'], ['armourFill', 'armour-fill'],
  ['armourText', 'armour-text'], ['respectText', 'respect-text'],
  ['clock', 'clock'], ['day', 'day'], ['radioName', 'radio-name'],
  ['radioFreq', 'radio-freq'], ['speedNum', 'speed-num'],
  ['gear', 'gear'], ['carName', 'car-name'],
  ['carHealthFill', 'car-health-fill'], ['carHealthWrap', 'car-health-wrap'],
  ['speedoRing', 'speedo-ring'], ['message', 'message'],
  ['minimap', 'minimap'], ['garageHint', 'garage-hint'],
  ['screenStart', 'screen-start'], ['screenPause', 'screen-pause'],
  ['screenEnd', 'screen-end'], ['endTitle', 'end-title'],
  ['endText', 'end-text'], ['help', 'help'],
];

export function createHud(doc) {
  const el = {};
  for (const [key, id] of ELEMENTS) el[key] = doc.getElementById(id);

  const mm = el.minimap.getContext('2d');
  let msgTimer = null;
  let chapterShownAt = null; // game time when the chapter banner appeared

  function setText(node, text) { node.textContent = text; }

  function showMessage(text, ms = 4200) {
    setText(el.message, text);
    el.message.classList.add('show');
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.message.classList.remove('show'), ms);
  }

  // Chapter banner on game time (not wall time): in slow renders the
  // wall clock runs ahead of the game, which used to hide the banner
  // before the screenshot was taken.
  function showChapter(chapter, title, now) {
    setText(el.chapterTitle, chapter);
    setText(el.chapterSub, title);
    el.chapter.classList.add('show');
    chapterShownAt = now;
  }

  function tickChapter(now) {
    if (chapterShownAt === null) return;
    if (now - chapterShownAt <= 3.6) return;
    el.chapter.classList.remove('show');
    chapterShownAt = null;
  }

  function paintWanted(s) {
    setText(el.stars, '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted));
    el.stars.style.color = s.wanted >= 5 ? '#ff4040' : s.wanted > 0 ? '#ffd23a' : '#888';
    setText(el.wantedLabel, s.wanted >= 5 ? 'MOST WANTED' : s.wanted > 0 ? `WANTED ${s.wanted}/5` : '');
    el.wantedLabel.style.color = s.wanted >= 5 ? '#ff5040' : '#ffd23a';
  }

  function paintVitals(s) {
    el.healthFill.style.width = `${Math.max(0, s.health)}%`;
    el.healthFill.style.background = barColor(s.health);
    setText(el.healthText, `${Math.ceil(Math.max(0, s.health))}`);
    el.armourFill.style.width = `${Math.max(0, s.armour)}%`;
    setText(el.armourText, `${Math.ceil(Math.max(0, s.armour))}`);
    setText(el.cash, `$${s.cash.toLocaleString('id-ID')}`);
    setText(el.weapon, s.inCar ? '' : (s.reloading ? `${s.weapon} — RELOADING…` : `${s.weapon}  ${s.mag} / ${s.reserve}`));
    setText(el.respectText, `LV ${s.respectLevel}`);
  }

  function paintMission(s) {
    const done = s.missionIndex >= s.missionTotal;
    setText(el.missionCount, done ? 'SELESAI' : `${s.missionIndex + 1}/${s.missionTotal}`);
    setText(el.missionTimer, done ? '' : fmtTime(s.missionTimeLeft));
    el.missionTimer.style.color = !done && s.missionTimeLeft < 30 ? '#ff5040' : '#fff';
  }

  function paintClockRadio(s) {
    setText(el.clock, `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`);
    setText(el.day, `DAY ${s.day}`);
    setText(el.radioName, s.radio);
    setText(el.radioFreq, s.radioFreq);
    setText(el.districtName, s.district);
    setText(el.districtFlavor, s.districtFlavor);
  }

  function paintSpeedo(s) {
    if (!s.inCar) {
      setText(el.speedNum, '0');
      setText(el.gear, 'ON FOOT');
      setText(el.carName, '');
      el.carHealthWrap.style.display = 'none';
      return;
    }
    const kmh = Math.round(Math.abs(s.speedKmh));
    setText(el.speedNum, `${kmh}`);
    setText(el.gear, `GEAR ${s.gear}`);
    setText(el.carName, s.carName || '');
    el.carHealthWrap.style.display = 'block';
    el.carHealthFill.style.width = `${Math.max(0, s.carHealth)}%`;
    el.carHealthFill.style.background = barColor(s.carHealth);
    // speed ring: 0..150 km/j maps to the 270-degree arc
    const frac = Math.min(1, kmh / 150);
    const C = 2 * Math.PI * 88;
    el.speedoRing.style.strokeDashoffset = String(C * (1 - frac * 0.75));
  }

  function drawMinimap(world) {
    // world: {city, player, cars, cops, footCops, marker, thugs, heli}
    const S = 200;
    const R = 300; // world radius shown
    const scale = S / (R * 2);
    const mapX = (x) => S / 2 + x * scale;
    const mapZ = (z) => S / 2 + z * scale;
    const dot = (x, z, color, r) => {
      mm.fillStyle = color;
      mm.beginPath();
      mm.arc(mapX(x), mapZ(z), r, 0, Math.PI * 2);
      mm.fill();
    };
    const block = (place, color, half) => {
      mm.fillStyle = color;
      mm.fillRect(mapX(place.x) - half, mapZ(place.z) - half, half * 2, half * 2);
    };
    mm.clearRect(0, 0, S, S);
    mm.save();
    mm.beginPath();
    mm.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    mm.clip();
    mm.fillStyle = 'rgba(12, 20, 16, 0.85)';
    mm.fillRect(0, 0, S, S);
    // sea (north strip)
    mm.fillStyle = '#2e7fa8';
    mm.fillRect(0, 0, S, S / 2 + world.city.seaZ * scale);
    // roads
    mm.strokeStyle = '#5a5a60';
    mm.lineWidth = 5;
    for (const x of world.city.roadsX) {
      mm.beginPath();
      mm.moveTo(mapX(x), 0);
      mm.lineTo(mapX(x), S);
      mm.stroke();
    }
    for (const z of world.city.roadsZ) {
      mm.beginPath();
      mm.moveTo(0, mapZ(z));
      mm.lineTo(S, mapZ(z));
      mm.stroke();
    }
    // landmarks
    block(world.city.park, '#3f8a3f', 14);
    block(world.city.tower, '#7fa8d8', 3);
    block(world.city.casino, '#ff3aa8', 4);
    block(world.city.garage, '#3aff7a', 4);
    // route line from player to mission marker
    const ux = mapX(world.player.x);
    const uz = mapZ(world.player.z);
    if (world.marker) {
      const mx = mapX(world.marker.x);
      const mz = mapZ(world.marker.z);
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
      mm.beginPath();
      mm.arc(mx, mz, 9 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2);
      mm.stroke();
    }
    for (const c of world.cars) dot(c.x, c.z, '#d8d8d8', 2.5);
    for (const c of world.cops) dot(c.x, c.z, '#3a6aff', 3);
    for (const c of world.footCops) dot(c.x, c.z, '#3a6aff', 2);
    for (const t of world.thugs || []) {
      if (!t.dead) dot(t.x, t.z, '#ff4040', 3);
    }
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

  function update(s) {
    paintWanted(s);
    paintVitals(s);
    paintMission(s);
    paintClockRadio(s);
    paintSpeedo(s);
  }

  const hud = {};
  hud.el = el;
  hud.showMessage = showMessage;
  hud.setObjective = (title, text) => {
    setText(el.missionTitle, title);
    setText(el.objectiveText, text);
    el.objective.classList.add('show');
  };
  hud.hideObjective = () => el.objective.classList.remove('show');
  hud.showChapter = showChapter;
  hud.tickChapter = tickChapter;
  hud.setGarageHint = (text) => {
    if (text) {
      setText(el.garageHint, text);
      el.garageHint.classList.add('show');
    } else {
      el.garageHint.classList.remove('show');
    }
  };
  hud.update = update;
  hud.drawMinimap = drawMinimap;
  hud.showStart = () => el.screenStart.classList.add('show');
  hud.hideStart = () => el.screenStart.classList.remove('show');
  hud.showPause = () => el.screenPause.classList.add('show');
  hud.hidePause = () => el.screenPause.classList.remove('show');
  hud.showEnd = (kind, text) => {
    setText(el.endTitle, kind === 'busted' ? 'TERTANGKAP!' : 'GAME OVER');
    setText(el.endText, text);
    el.screenEnd.classList.add('show');
  };
  hud.hideEnd = () => el.screenEnd.classList.remove('show');
  hud.setHelpVisible = (v) => { el.help.style.display = v ? 'block' : 'none'; };
  return hud;
}
