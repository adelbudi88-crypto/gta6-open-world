// HUD for Porto Azul II: every corner of the screen carries game state —
// district + flavour top-left, mission + timer top-centre, clock / cash /
// wanted / health / armour / respect top-right, minimap + route bottom-left,
// speedometer + gear + car bottom-right, radio + weapon bottom-centre.
import { fmtMoney, fmtClock, fmtTimer, clamp } from './rng.js';
import { ROAD_LINES } from './city.js';

const STAR_LIT = '★';
const STAR_DIM = '☆';

export function createHud(doc) {
  const el = (id) => doc.getElementById(id);
  const districtEl = el('district');
  const flavorEl = el('flavor');
  const missionEl = el('mission');
  const objectiveEl = el('objective');
  const timerEl = el('timer');
  const clockEl = el('clock');
  const cashEl = el('cash');
  const wantedEl = el('wanted');
  const hpFill = doc.querySelector('#hpbar > i');
  const arFill = doc.querySelector('#arbar > i');
  const respectEl = el('respect');
  const speedEl = el('speed');
  const gearEl = el('gear');
  const carNameEl = el('carname');
  const carCondEl = el('carcond');
  const radioEl = el('radio');
  const weaponEl = el('weapon');
  const bannerEl = el('banner');
  const msgEl = el('msg');
  const map = el('minimap');
  const mctx = map.getContext('2d');

  let bannerUntil = 0;
  let msgUntil = 0;

  function showBanner(chapter, title, sub, seconds) {
    bannerEl.querySelector('.chap').textContent = chapter;
    bannerEl.querySelector('.title').textContent = title;
    bannerEl.querySelector('.sub').textContent = sub;
    bannerEl.style.display = 'block';
    bannerUntil = performance.now() + seconds * 1000;
  }

  function hideBanner() { bannerEl.style.display = 'none'; }

  function showMessage(text, seconds) {
    msgEl.textContent = text;
    msgEl.style.display = 'block';
    msgUntil = performance.now() + seconds * 1000;
  }

  function drawMinimap(state, target) {
    const S = 190;
    const scale = S / 460;
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    mctx.fillStyle = '#0a0618';
    mctx.fillRect(0, 0, S, S);
    mctx.strokeStyle = '#3a2f55';
    mctx.lineWidth = 5;
    for (const line of ROAD_LINES) {
      const [x1, y1] = toMap(line, -210);
      const [x2, y2] = toMap(line, 210);
      mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x2, y2); mctx.stroke();
      const [x3, y3] = toMap(-210, line);
      const [x4, y4] = toMap(210, line);
      mctx.beginPath(); mctx.moveTo(x3, y3); mctx.lineTo(x4, y4); mctx.stroke();
    }
    // Route: L-shaped along roads from player to target.
    if (target) {
      const [px, py] = toMap(state.playerX, state.playerZ);
      const [tx, ty] = toMap(target.x, target.z);
      mctx.strokeStyle = '#ffd75e';
      mctx.lineWidth = 3;
      mctx.setLineDash([7, 5]);
      mctx.beginPath(); mctx.moveTo(px, py); mctx.lineTo(tx, py); mctx.lineTo(tx, ty); mctx.stroke();
      mctx.setLineDash([]);
      mctx.fillStyle = '#ffd75e';
      mctx.beginPath(); mctx.arc(tx, ty, 6, 0, Math.PI * 2); mctx.fill();
      mctx.fillStyle = '#0a0618';
      mctx.font = 'bold 9px Arial'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
      mctx.fillText('★', tx, ty + 0.5);
    }
    // Traffic dots.
    mctx.fillStyle = '#9aa0b0';
    for (const c of state.trafficDots || []) {
      const [dx, dy] = toMap(c.x, c.z);
      mctx.fillRect(dx - 1.5, dy - 1.5, 3, 3);
    }
    // Cop dots.
    mctx.fillStyle = '#ff2e4d';
    for (const c of state.copDots || []) {
      const [dx, dy] = toMap(c.x, c.z);
      mctx.beginPath(); mctx.arc(dx, dy, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.atan2(Math.sin(state.heading), Math.cos(state.heading)) * -1 + Math.PI);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#7df9ff';
    mctx.font = 'bold 11px Arial'; mctx.textAlign = 'center';
    mctx.fillText('N', S / 2, 12);
  }

  function update(state) {
    const now = performance.now();
    if (bannerUntil && now > bannerUntil) { hideBanner(); bannerUntil = 0; }
    if (msgUntil && now > msgUntil) { msgEl.style.display = 'none'; msgUntil = 0; }
    districtEl.textContent = state.district.name;
    flavorEl.textContent = state.district.flavor;
    missionEl.textContent = state.missionLabel;
    objectiveEl.textContent = state.objective;
    timerEl.textContent = state.missionActive ? fmtTimer(state.missionTimer) : '—';
    timerEl.style.color = state.missionTimer < 30 && state.missionActive ? '#ff5a6e' : '#7df9ff';
    clockEl.textContent = 'DAY ' + state.day + ' · ' + fmtClock(state.clockMinutes);
    cashEl.textContent = fmtMoney(state.cash);
    let stars = '';
    for (let i = 0; i < 5; i += 1) {
      stars += '<span class="' + (i < state.wanted ? 'lit' : 'dim') + '">' + (i < state.wanted ? STAR_LIT : STAR_DIM) + '</span>';
    }
    if (state.wanted >= 5) stars += ' <span class="lit">MOST WANTED</span>';
    else if (state.wanted >= 3) stars += ' <span class="lit">WANTED</span>';
    wantedEl.innerHTML = stars;
    hpFill.style.width = clamp(state.health, 0, 100) + '%';
    arFill.style.width = clamp(state.armour, 0, 100) + '%';
    respectEl.textContent = 'RESPECT LV ' + state.respect + " · BENNY'S CREW";
    if (state.onFoot) {
      speedEl.innerHTML = Math.round(state.speedKmh) + ' <small>km/h</small>';
      gearEl.textContent = 'ON FOOT';
      carNameEl.textContent = 'DAZ';
      carCondEl.textContent = 'STAMINA 100%';
    } else {
      speedEl.innerHTML = Math.round(state.speedKmh) + ' <small>km/h</small>';
      gearEl.textContent = state.gear === 0 ? 'NEUTRAL' : 'GEAR ' + state.gear;
      carNameEl.textContent = state.carName;
      carCondEl.textContent = 'CONDITION ' + Math.round(state.carCondition) + '%';
    }
    radioEl.textContent = '♪ ' + state.radioLabel;
    weaponEl.textContent = state.weaponName + ' · ' + state.ammo + ' / ' + state.ammoReserve;
    drawMinimap(state, state.target);
  }

  return { update, showBanner, hideBanner, showMessage };
}
