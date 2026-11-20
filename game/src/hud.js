// HUD — all four corners, always on. Top-left district + flavor, top-center
// mission + timer, top-right clock/cash/wanted/health/armour/respect,
// bottom-left minimap + route, bottom-right speedometer + car, bottom-center
// radio. Plus chapter banners, the weapon wheel (hold Q), and flash messages.
import { STATIONS } from './audio.js';
import { WEAPONS } from './player.js';

function $(id) { return document.getElementById(id); }
function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function fmtTimer(s) {
  const t = Math.max(0, Math.ceil(s));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

export function createHud() {
  const el = {
    district: $('district-name'), flavor: $('district-flavor'),
    chapter: $('mission-chapter'), mission: $('mission-name'), timer: $('mission-timer'),
    clock: $('clock'), cash: $('cash'), wanted: $('wanted'),
    healthFill: $('health-fill'), armourFill: $('armour-fill'),
    healthNum: $('health-num'), armourNum: $('armour-num'), respect: $('respect'),
    speed: $('speed'), gear: $('gear'), carName: $('car-name'),
    radioName: $('radio-name'), radioGenre: $('radio-genre'),
    weaponName: $('weapon-name'), weaponAmmo: $('weapon-ammo'),
    hint: $('hint'), banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    flash: $('flash'), wheel: $('wheel'), minimap: $('minimap'),
    garage: $('garage'), saveNote: $('save-note'),
  };
  const mm = el.minimap ? el.minimap.getContext('2d') : null;
  let bannerTimer = null;

  const hud = {
    showBanner(title, sub, sticky) {
      if (!el.banner) return;
      el.bannerTitle.textContent = title;
      el.bannerSub.textContent = sub || '';
      el.banner.classList.add('show');
      if (bannerTimer) clearTimeout(bannerTimer);
      if (!sticky) bannerTimer = setTimeout(() => el.banner.classList.remove('show'), 4200);
    },
    hideBanner() { if (el.banner) el.banner.classList.remove('show'); },
    flash(msg) {
      if (!el.flash) return;
      el.flash.textContent = msg;
      el.flash.classList.add('show');
      setTimeout(() => el.flash.classList.remove('show'), 1800);
    },
    showWheel(show, selected) {
      if (!el.wheel) return;
      el.wheel.classList.toggle('show', !!show);
      if (show) {
        const keys = ['pistol', 'smg', 'shotgun'];
        keys.forEach((k, i) => {
          const slot = document.getElementById('wheel-' + i);
          if (slot) slot.classList.toggle('active', k === selected);
        });
      }
    },
    showGarage(show) { if (el.garage) el.garage.classList.toggle('show', !!show); },
    saved() {
      if (!el.saveNote) return;
      el.saveNote.textContent = 'SAVED';
      el.saveNote.classList.add('show');
      setTimeout(() => el.saveNote.classList.remove('show'), 1500);
    },
    update(world) {
      const s = world.state;
      const p = world.player;
      const d = world.city.districtAt(p.pos.x, p.pos.z);
      if (el.district) el.district.textContent = d.name;
      if (el.flavor) el.flavor.textContent = d.flavor;
      const cur = world.missions.current();
      if (el.chapter) el.chapter.textContent = cur.chapter + ' — ' + cur.giver.toUpperCase();
      if (el.mission) el.mission.textContent = cur.name.toUpperCase();
      if (el.timer) el.timer.textContent = world.missions.active ? fmtTimer(world.missions.timeLeft) : '—:—';
      const hh = Math.floor(s.minutes / 60) % 24;
      const mm2 = Math.floor(s.minutes % 60);
      if (el.clock) el.clock.textContent = 'DAY ' + s.day + ' · ' + String(hh).padStart(2, '0') + ':' + String(mm2).padStart(2, '0');
      if (el.cash) el.cash.textContent = fmtCash(s.cash);
      if (el.wanted) {
        const stars = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
        el.wanted.textContent = stars + (s.wanted >= 5 ? ' MOST WANTED' : s.wanted >= 3 ? ' WANTED' : '');
        el.wanted.classList.toggle('hot', s.wanted >= 3);
      }
      if (el.healthFill) el.healthFill.style.width = Math.max(0, p.health) + '%';
      if (el.armourFill) el.armourFill.style.width = Math.max(0, p.armour) + '%';
      if (el.healthNum) el.healthNum.textContent = Math.max(0, Math.round(p.health));
      if (el.armourNum) el.armourNum.textContent = Math.max(0, Math.round(p.armour));
      if (el.respect) el.respect.textContent = 'LV ' + s.respect;
      const kmh = Math.round(p.speedKmh || 0);
      if (el.speed) el.speed.textContent = kmh;
      if (el.gear) el.gear.textContent = p.onFoot ? '—' : 'GEAR ' + Math.max(1, Math.min(6, Math.floor(kmh / 24) + 1));
      if (el.carName) el.carName.textContent = (p.carName() || 'ON FOOT').toUpperCase();
      const st = STATIONS[world.audio.station];
      if (el.radioName) el.radioName.textContent = st.name;
      if (el.radioGenre) el.radioGenre.textContent = st.genre;
      if (el.weaponName) el.weaponName.textContent = p.weaponName();
      if (el.weaponAmmo) el.weaponAmmo.textContent = p.ammoText();
      if (el.hint) {
        if (p.onFoot) {
          const near = world.vehicles.nearestCar(p.pos.x, p.pos.z, 5, true);
          el.hint.textContent = near
            ? (world.vehicles.traffic.includes(near) ? 'E — STEAL CAR' : 'E — ENTER CAR')
            : 'WASD MOVE · Q WEAPON WHEEL · C RADIO · G GARAGE';
        } else {
          el.hint.textContent = 'E — EXIT CAR · Q WEAPON WHEEL · C RADIO';
        }
      }
      this.drawMinimap(world);
    },
    drawMinimap(world) {
      if (!mm || !el.minimap) return;
      const W = el.minimap.width, H = el.minimap.height;
      const p = world.player;
      const scale = W / 340;
      const toX = (x) => (x + 170) * scale;
      const toY = (z) => (z + 170) * scale;
      mm.fillStyle = 'rgba(10,10,22,0.82)';
      mm.fillRect(0, 0, W, H);
      mm.strokeStyle = 'rgba(255,255,255,0.25)';
      mm.lineWidth = 1;
      for (let i = -160; i <= 160; i += 40) {
        mm.beginPath(); mm.moveTo(toX(i), 0); mm.lineTo(toX(i), H); mm.stroke();
        mm.beginPath(); mm.moveTo(0, toY(i)); mm.lineTo(W, toY(i)); mm.stroke();
      }
      // Route to the mission target.
      const t = world.missions.current().target;
      mm.strokeStyle = '#ffd23c';
      mm.lineWidth = 2;
      mm.setLineDash([5, 4]);
      mm.beginPath();
      mm.moveTo(toX(p.pos.x), toY(p.pos.z));
      mm.lineTo(toX(t[0]), toY(t[1]));
      mm.stroke();
      mm.setLineDash([]);
      mm.fillStyle = '#ffd23c';
      mm.save();
      mm.translate(toX(t[0]), toY(t[1]));
      mm.rotate(Math.PI / 4);
      mm.fillRect(-4, -4, 8, 8);
      mm.restore();
      // Cops red, traffic grey, player white arrow.
      mm.fillStyle = '#ff3344';
      for (const c of world.police.cops) {
        if (!c.active) continue;
        mm.beginPath(); mm.arc(toX(c.mesh.position.x), toY(c.mesh.position.z), 3, 0, 7); mm.fill();
      }
      mm.fillStyle = '#ff66aa';
      for (const h of world.police.helis) {
        if (!h.active) continue;
        mm.beginPath(); mm.arc(toX(h.mesh.position.x), toY(h.mesh.position.z), 3.5, 0, 7); mm.fill();
      }
      mm.fillStyle = '#ffffff';
      mm.save();
      mm.translate(toX(p.pos.x), toY(p.pos.z));
      mm.rotate(-p.angle);
      mm.beginPath();
      mm.moveTo(7, 0); mm.lineTo(-5, -4.5); mm.lineTo(-5, 4.5); mm.closePath();
      mm.fill();
      mm.restore();
      // North tick.
      mm.fillStyle = 'rgba(255,255,255,0.7)';
      mm.font = 'bold 10px Arial';
      mm.fillText('N', W - 12, 12);
    },
  };
  return hud;
}
