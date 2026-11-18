// Full four-corner HUD: district + flavour top-left, mission banner +
// timer top-center, clock/cash/wanted/health/armour/respect top-right,
// minimap + route bottom-left, speedometer + gear + car name bottom-right,
// radio bottom-center. The minimap is a live top-down canvas.
import { gearFor } from './vehicles.js';

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const districtEl = el('hud-district');
  const flavorEl = el('hud-flavor');
  const missionEl = el('hud-mission');
  const timerEl = el('hud-timer');
  const bannerEl = el('hud-banner');
  const bannerTitleEl = el('hud-banner-title');
  const bannerSubEl = el('hud-banner-sub');
  const clockEl = el('hud-clock');
  const cashEl = el('hud-cash');
  const wantedEl = el('hud-wanted');
  const healthEl = el('hud-health');
  const armourEl = el('hud-armour');
  const respectEl = el('hud-respect');
  const weaponEl = el('hud-weapon');
  const speedEl = el('hud-speed');
  const gearEl = el('hud-gear');
  const carEl = el('hud-car');
  const radioEl = el('hud-radio');
  const garageEl = el('hud-garage');
  const minimap = el('hud-minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;

  function drawMinimap(state) {
    if (!mctx) return;
    const S = 180;
    const scale = S / 520;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(8, 8, 18, 0.85)';
    mctx.fillRect(0, 0, S, S);
    mctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    mctx.lineWidth = 5;
    for (const c of [-180, -120, -60, 0, 60, 120, 180]) {
      const p = (c + 260) * scale;
      mctx.beginPath(); mctx.moveTo(p, 0); mctx.lineTo(p, S); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, p); mctx.lineTo(S, p); mctx.stroke();
    }
    // Route to the mission destination.
    const dest = state.missionDest;
    if (dest) {
      const px = (state.pos.x + 260) * scale;
      const pz = (state.pos.z + 260) * scale;
      const dx = (dest[0] + 260) * scale;
      const dz = (dest[1] + 260) * scale;
      mctx.strokeStyle = '#ffd25e';
      mctx.lineWidth = 2.5;
      mctx.setLineDash([6, 4]);
      mctx.beginPath(); mctx.moveTo(px, pz); mctx.lineTo(dx, dz); mctx.stroke();
      mctx.setLineDash([]);
      mctx.fillStyle = '#ffd25e';
      mctx.beginPath(); mctx.arc(dx, dz, 5, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#000';
      mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.arc(dx, dz, 5, 0, Math.PI * 2); mctx.stroke();
    }
    // Traffic dots.
    mctx.fillStyle = '#9be8ff';
    for (const car of state.traffic || []) {
      mctx.fillRect((car.mesh.position.x + 260) * scale - 1.5, (car.mesh.position.z + 260) * scale - 1.5, 3, 3);
    }
    // Police dots.
    mctx.fillStyle = '#ff4040';
    for (const c of state.policeCars || []) {
      if (!c.active) continue;
      mctx.beginPath(); mctx.arc((c.mesh.position.x + 260) * scale, (c.mesh.position.z + 260) * scale, 3, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow.
    const px = (state.pos.x + 260) * scale;
    const pz = (state.pos.z + 260) * scale;
    mctx.save();
    mctx.translate(px, pz);
    mctx.rotate(state.heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  return {
    update(state) {
      if (districtEl) districtEl.textContent = state.district.name;
      if (flavorEl) flavorEl.textContent = state.district.flavor;
      const m = state.mission;
      if (missionEl) missionEl.textContent = m ? `MISSION ${m.chapter}/5 — ${m.title.toUpperCase()}` : 'FREE ROAM — PRESS M FOR NEXT MISSION';
      if (timerEl) timerEl.textContent = state.missionActive ? fmtTime(state.timeLeft) : '';
      if (bannerEl) {
        bannerEl.style.opacity = state.bannerVisible ? '1' : '0';
        if (bannerTitleEl) bannerTitleEl.textContent = state.banner;
        if (bannerSubEl) bannerSubEl.textContent = state.bannerSub;
      }
      if (clockEl) clockEl.textContent = `DAY ${state.day} · ${fmtClock(state.clockMinutes)}`;
      if (cashEl) cashEl.textContent = `$${Math.floor(state.cash).toLocaleString('en-US')}`;
      if (wantedEl) {
        const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
        wantedEl.textContent = state.mostWanted ? `${stars} MOST WANTED` : `${stars} WANTED ${state.wanted}/5`;
        wantedEl.style.color = state.wanted >= 4 ? '#ff4040' : state.wanted >= 2 ? '#ffb13c' : '#ffffff';
      }
      if (healthEl) healthEl.style.width = `${Math.max(0, state.health)}%`;
      if (armourEl) armourEl.style.width = `${Math.max(0, state.armour)}%`;
      if (respectEl) respectEl.textContent = `RESPECT LV ${state.respect}`;
      if (weaponEl) weaponEl.textContent = `${state.weapon.name} ${state.weapon.mag}/${state.weapon.reserve}`;
      if (speedEl) speedEl.textContent = `${Math.round(state.speedKmh)}`;
      if (gearEl) gearEl.textContent = state.onFoot ? 'ON FOOT' : `GEAR ${gearFor(state.speedKmh)}`;
      if (carEl) carEl.textContent = state.onFoot ? 'DAZ — ON FOOT' : state.carName.toUpperCase();
      if (radioEl) radioEl.textContent = `${state.station.name} · ${state.station.genre}`;
      if (garageEl) garageEl.style.display = state.nearGarage ? 'block' : 'none';
      drawMinimap(state);
    },
  };
}
