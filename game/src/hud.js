// DOM HUD: all four corners, minimap canvas, weapon wheel, title screen,
// pause dashboard with the turf atlas. Renders purely from the shared state.
import { DISTRICTS, stars } from './turf.js';
import { WEAPONS } from './player.js';
import { slotInfo } from './save.js';

function $(id) { return document.getElementById(id); }
function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function fmtTimer(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function fmtClock(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function createHud(state, api) {
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');
  let flashTimer = null;
  let toastTimer = null;

  function drawMinimap() {
    const S = 220, W = 560; // world -280..280
    const px = (x) => ((x + 280) / W) * S;
    const pz = (z) => ((z + 280) / W) * S;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = '#0a0e22';
    mctx.fillRect(0, 0, S, S);
    for (const d of DISTRICTS) {
      mctx.fillStyle = d.color + '33';
      mctx.fillRect(px(d.x0), pz(d.z0), px(d.x1) - px(d.x0), pz(d.z1) - pz(d.z0));
    }
    // water
    mctx.fillStyle = '#0a3a5c';
    mctx.fillRect(px(245), 0, S - px(245), S);
    // roads
    mctx.strokeStyle = 'rgba(255,255,255,.28)';
    mctx.lineWidth = 1;
    for (let c = -260; c <= 260; c += 40) {
      mctx.beginPath(); mctx.moveTo(px(c), 0); mctx.lineTo(px(c), S); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, pz(c)); mctx.lineTo(S, pz(c)); mctx.stroke();
    }
    // route to objective
    const obj = state.objectivePos || { x: -140, z: -140 };
    const pp = state.playerPos || { x: 0, z: 0 };
    mctx.strokeStyle = '#ffd75e';
    mctx.lineWidth = 2.5;
    mctx.setLineDash([6, 4]);
    mctx.beginPath(); mctx.moveTo(px(pp.x), pz(pp.z)); mctx.lineTo(px(obj.x), pz(obj.z)); mctx.stroke();
    mctx.setLineDash([]);
    // objective diamond
    mctx.fillStyle = '#ffd75e';
    mctx.beginPath();
    mctx.moveTo(px(obj.x), pz(obj.z) - 7); mctx.lineTo(px(obj.x) + 6, pz(obj.z));
    mctx.lineTo(px(obj.x), pz(obj.z) + 7); mctx.lineTo(px(obj.x) - 6, pz(obj.z));
    mctx.closePath(); mctx.fill();
    // cop dots
    mctx.fillStyle = '#ff3b30';
    for (const c of state.copPositions || []) {
      mctx.beginPath(); mctx.arc(px(c.x), pz(c.z), 3, 0, Math.PI * 2); mctx.fill();
    }
    // boat
    if (state.boatPos) {
      mctx.fillStyle = '#ffffff';
      mctx.beginPath(); mctx.arc(px(state.boatPos.x), pz(state.boatPos.z), 3.5, 0, Math.PI * 2); mctx.fill();
    }
    // player arrow
    const yaw = state.playerYaw || 0;
    mctx.fillStyle = '#ffffff';
    mctx.save();
    mctx.translate(px(pp.x), pz(pp.z));
    mctx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)));
    mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(5.5, 6); mctx.lineTo(-5.5, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  function renderTitleSlots() {
    const el = $('title-slots');
    el.innerHTML = slotInfo().map((s) => {
      if (!s.data) return '<div class="slot-save"><b>SLOT ' + s.slot + '</b><br>EMPTY</div>';
      return '<div class="slot-save"><b>SLOT ' + s.slot + '</b><br>' + fmtCash(s.data.cash) + ' · CH ' + s.data.missionNum + '/12<br>DAY ' + s.data.day + '</div>';
    }).join('');
  }

  function renderPause() {
    $('pause-stats').innerHTML =
      'CASH <b>' + fmtCash(state.cash) + '</b> &nbsp;·&nbsp; MISSIONS <b>' + (state.missionsDone || 0) + '/12</b>' +
      ' &nbsp;·&nbsp; SIDE JOBS <b>' + (state.sideJobsDone || 0) + '</b> &nbsp;·&nbsp; CARS STOLEN <b>' + (state.carsStolen || 0) + '</b>' +
      ' &nbsp;·&nbsp; RESPECT LV <b>' + state.respect + '</b><br>' +
      'CREW — Benny garage Lv ' + (state.crew?.upgrades?.engine ?? 1) + ' · Tono nitro ' + (state.crew?.nitroCharges ?? 3) + '/3 · Mara ' + (state.crew?.empLabel() ?? 'EMP READY');
    $('atlas').innerHTML = DISTRICTS.map((d) => {
      const st = state.turfStanding?.[d.name] ?? 0;
      return '<div><b style="color:' + d.color + '">' + d.name + '</b><br>' + stars(st) + ' ' + st + '/5 · ' + d.flavor + '</div>';
    }).join('');
  }

  function renderWheel() {
    const el = $('wheel');
    el.innerHTML = WEAPONS.map((w, i) => {
      const mag = state.ammo[i];
      const ammo = !isFinite(mag) ? '∞' : mag + '/' + state.ammoReserve[i];
      return '<div class="slot' + (i === state.weaponIdx ? ' sel' : '') + '"><div class="wname">' + (i + 1) + ' · ' + w.name + '</div><div class="wammo">' + ammo + '</div></div>';
    }).join('');
  }

  return {
    update() {
      const d = state.districtObj || DISTRICTS[0];
      $('district-name').textContent = d.name;
      $('district-name').style.color = d.color;
      $('district-flavor').textContent = d.flavor;
      const st = state.turfStanding?.[d.name] ?? 0;
      $('turf-line').textContent = 'TURF ' + stars(st) + ' ' + st + '/5';
      const stage = state.missionStageLabel ? ' · ' + state.missionStageLabel : '';
      $('mission-banner').textContent = 'CHAPTER ' + state.missionNum + '/12: ' + state.missionName + stage;
      $('mission-objective').textContent = state.sideJob
        ? 'SIDE JOB: ' + state.sideJob + ' — ' + fmtTimer(state.sideJobTimer || 0)
        : state.missionObjective;
      $('mission-timer').textContent = '⏱ ' + fmtTimer(state.missionTimer);
      $('clock-line').textContent = 'DAY ' + state.day + ' · ' + fmtClock(state.clock);
      $('cash-line').textContent = fmtCash(state.cash);
      $('wanted-line').textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
      $('wanted-label').textContent = state.wanted >= 5 ? '★ MOST WANTED ★' : (state.wanted >= 3 ? 'HEAT ' + state.wanted : '');
      $('health-fill').style.width = Math.max(0, state.health) + '%';
      $('armour-fill').style.width = Math.max(0, state.armour) + '%';
      $('health-num').textContent = Math.round(state.health);
      $('armour-num').textContent = Math.round(state.armour);
      $('respect-line').textContent = 'RESPECT LV ' + state.respect + ' · DAZ';
      const nitroBlocks = '▮'.repeat(state.crew?.nitroCharges ?? 0) + '▯'.repeat(3 - (state.crew?.nitroCharges ?? 0));
      $('crew-line').textContent = 'NITRO ' + nitroBlocks + ' · ' + (state.crew?.empLabel() ?? 'EMP READY');
      const w = WEAPONS[state.weaponIdx];
      const mag = state.ammo[state.weaponIdx];
      $('weapon-line').textContent = w.name + ' ' + (!isFinite(mag) ? '∞' : mag + '/' + state.ammoReserve[state.weaponIdx]);
      $('car-line').textContent = state.driving
        ? state.carName + ' · HP ' + Math.round(state.carHealth) + '%'
        : 'ON FOOT';
      $('speed-line').innerHTML = Math.round(state.speedKmh) + ' <small>km/h</small>';
      $('gear-line').textContent = 'GEAR ' + state.gear;
      const stn = state.radio || { name: 'SOL FM 95.4', genre: 'SYNTHWAVE' };
      $('radio-line').textContent = '♪ ' + stn.name + ' · ' + stn.genre;
      $('hint-line').textContent = state.hint || '';
      $('spike-warning').style.display = state.spikeWarning ? 'block' : 'none';
      $('nitro-line').style.display = state.crew?.nitroActive ? 'block' : 'none';
      const obj = state.objectivePos || { x: -140, z: -140 };
      const pp = state.playerPos || { x: 0, z: 0 };
      const dist = Math.round(Math.hypot(obj.x - pp.x, obj.z - pp.z));
      $('route-label').textContent = 'ROUTE: ' + (state.routeName || "BENNY'S GARAGE") + ' · ' + dist + 'm' +
        (state.racePos ? ' · RACE ' + state.racePos + '/6' : '');
      drawMinimap();
      if (state.wheelOpen) renderWheel();
    },
    flash(title, sub) {
      $('flash-title').textContent = title;
      $('flash-sub').textContent = sub || '';
      $('flash').style.display = 'block';
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { $('flash').style.display = 'none'; }, 2600);
    },
    toast(msg) {
      $('toast').textContent = msg;
      $('toast').style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { $('toast').style.display = 'none'; }, 2400);
    },
    showTitle(show) {
      $('title-screen').style.display = show ? 'flex' : 'none';
      if (show) renderTitleSlots();
    },
    showPause(show) {
      $('pause-screen').style.display = show ? 'flex' : 'none';
      if (show) renderPause();
    },
    showWheel(show) {
      $('wheel').style.display = show ? 'block' : 'none';
      if (show) renderWheel();
    },
    bindButtons() {
      $('btn-resume').addEventListener('click', () => api.onResume());
      $('btn-restart').addEventListener('click', () => api.onRestart());
      $('btn-title').addEventListener('click', () => api.onQuitTitle());
    },
  };
}
