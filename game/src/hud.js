// HUD for Porto Azul II — four corners, chapter banner, minimap with route.
import { MissionManager } from './missions.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.map = $('hud-minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this.lastBanner = '';
  }

  static fmtCash(n) {
    return '$' + Math.floor(n).toLocaleString('en-US');
  }

  static stars(wanted) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < wanted ? '★' : '☆';
    return s;
  }

  update(state, world) {
    const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    set('hud-district', state.district);
    set('hud-flavor', state.flavor);
    set('hud-mission-line', `${world.missions.current.chapter} — ${world.missions.current.title.toUpperCase()} · ${world.missions.current.giver}`);
    set('hud-objective', world.missions.current.desc);
    set('hud-timer', MissionManager.fmt(state.timer));
    set('hud-clock', `DAY ${state.day} · ${state.clock}`);
    set('hud-cash', Hud.fmtCash(state.cash));
    set('hud-wanted', Hud.stars(state.wanted));
    set('hud-wanted-label', state.wanted >= 5 ? 'MOST WANTED' : state.wanted >= 3 ? 'WANTED' : 'HEAT ' + state.wanted);
    set('hud-health', `HP ${Math.round(state.health)}`);
    set('hud-armour', `ARMOUR ${Math.round(state.armour)}`);
    set('hud-respect', `RESPECT LV ${state.respect}`);
    set('hud-weapon', `${state.weapon.name} ${state.weapon.ammo}/${state.weapon.reserve}`);
    set('hud-speed', String(Math.round(state.speedKmh)));
    set('hud-gear', state.onFoot ? 'FOOT' : `GEAR ${state.gear}`);
    set('hud-car', state.onFoot ? 'ON FOOT — DAZ' : state.carName.toUpperCase());
    set('hud-radio', `♪ ${state.radio}`);

    const hp = $('hud-hp-bar');
    if (hp) hp.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    const ar = $('hud-ar-bar');
    if (ar) ar.style.width = `${Math.max(0, Math.min(100, state.armour))}%`;

    // Chapter banner: visible for a few seconds after a mission starts, and in shots.
    const banner = $('hud-chapter');
    if (banner) {
      const text = `${world.missions.current.chapter}: ${world.missions.current.title.toUpperCase()} — ${world.missions.current.giver}`;
      if (state.showBanner) {
        banner.textContent = text;
        banner.style.opacity = '1';
      } else {
        banner.style.opacity = '0';
      }
    }
    this.drawMinimap(state, world);
  }

  drawMinimap(state, world) {
    if (!this.mapCtx) return;
    const g = this.mapCtx;
    const S = 180;
    const scale = S / 420;
    const toX = (x) => (x + 210) * scale;
    const toY = (z) => (z + 210) * scale;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(12, 8, 24, 0.88)';
    g.fillRect(0, 0, S, S);
    // Roads.
    g.strokeStyle = '#5a5470';
    g.lineWidth = 3;
    for (const v of [-120, -60, 0, 60, 120]) {
      g.beginPath(); g.moveTo(toX(-210), toY(v)); g.lineTo(toX(210), toY(v)); g.stroke();
      g.beginPath(); g.moveTo(toX(v), toY(-210)); g.lineTo(toX(v), toY(210)); g.stroke();
    }
    // Route to the mission target.
    const t = world.missions.current.target;
    g.strokeStyle = '#ffd23e';
    g.lineWidth = 2.5;
    g.setLineDash([6, 4]);
    g.beginPath();
    g.moveTo(toX(state.px), toY(state.pz));
    g.lineTo(toX(t.x), toY(t.z));
    g.stroke();
    g.setLineDash([]);
    // Mission marker.
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.arc(toX(t.x), toY(t.z), 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#000';
    g.lineWidth = 1.5;
    g.stroke();
    // Cops.
    g.fillStyle = '#ff4050';
    for (const c of world.police.cars) {
      g.beginPath(); g.arc(toX(c.mesh.position.x), toY(c.mesh.position.z), 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const px = toX(state.px);
    const py = toY(state.pz);
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(Math.sin(state.heading), Math.cos(state.heading)) + Math.PI);
    g.fillStyle = '#39ff88';
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath();
    g.fill();
    g.restore();
    // North label.
    g.fillStyle = '#cfc8e8';
    g.font = 'bold 10px Arial';
    g.fillText('N', 6, 12);
  }
}
