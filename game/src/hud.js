// The whole HUD is DOM: four corners, a minimap canvas, a chapter banner
// and overlays. It reads the world every frame and never writes game state.
import { clamp, fmtCash, fmtClock, fmtTimer } from './rng.js';
import { KMH } from './vehicles.js';

export function createHud(W) {
  const $ = (id) => document.getElementById(id);
  const el = {
    district: $('hud-district'), districtSub: $('hud-district-sub'),
    mission: $('hud-mission'), objective: $('hud-objective'), timer: $('hud-timer'),
    clock: $('hud-clock'), cash: $('hud-cash'), stars: $('hud-stars'),
    wanted: $('hud-wanted'), weapon: $('hud-weapon'),
    hpFill: $('hud-hp-fill'), hpNum: $('hud-hp-num'),
    arFill: $('hud-ar-fill'), arNum: $('hud-ar-num'),
    respect: $('hud-respect'), radio: $('hud-radio'),
    speed: $('hud-speed'), gear: $('hud-gear'), carName: $('hud-car'),
    minimap: $('hud-minimap'), chapter: $('hud-chapter'),
    chapterKicker: $('hud-chapter-kicker'), chapterTitle: $('hud-chapter-title'),
    help: $('hud-help'), toast: $('hud-toast'),
    start: $('overlay-start'), pause: $('overlay-pause'), end: $('overlay-end'),
    endTitle: $('overlay-end-title'), endText: $('overlay-end-text'),
  };
  const mm = el.minimap.getContext('2d');
  let chapterT = 0;
  let toastT = 0;

  function drawMinimap() {
    const S = 200, K = S / 620;
    const px = (v) => (v + 310) * K;
    mm.fillStyle = '#0d0a18';
    mm.fillRect(0, 0, S, S);
    // Streets.
    mm.strokeStyle = '#3a3350';
    mm.lineWidth = 4;
    for (const L of W.city.streets) {
      mm.beginPath(); mm.moveTo(px(L), 0); mm.lineTo(px(L), S); mm.stroke();
      mm.beginPath(); mm.moveTo(0, px(L)); mm.lineTo(S, px(L)); mm.stroke();
    }
    // Garage + casino.
    mm.fillStyle = '#ff9a3c';
    mm.fillRect(px(W.city.garage.x) - 4, px(W.city.garage.z) - 4, 8, 8);
    mm.fillStyle = '#ff5ad0';
    mm.fillRect(px(W.city.casino.x) - 4, px(W.city.casino.z) - 4, 8, 8);
    // Route to the objective.
    const mp = W.missions.markerPos();
    if (mp) {
      mm.strokeStyle = '#ffd23c';
      mm.lineWidth = 2;
      mm.setLineDash([6, 4]);
      mm.beginPath();
      mm.moveTo(px(W.player.x), px(W.player.z));
      mm.lineTo(px(mp.x), px(mp.z));
      mm.stroke();
      mm.setLineDash([]);
      const pulse = 4 + Math.sin(W.S.time * 5) * 1.5;
      mm.fillStyle = '#ffd23c';
      mm.beginPath();
      mm.arc(px(mp.x), px(mp.z), pulse, 0, Math.PI * 2);
      mm.fill();
    }
    // Cops.
    mm.fillStyle = '#3d7bff';
    for (const c of W.police.copCars) {
      mm.beginPath(); mm.arc(px(c.x), px(c.z), 3, 0, Math.PI * 2); mm.fill();
    }
    mm.fillStyle = '#ff3b3b';
    for (const c of W.police.footCops) {
      mm.beginPath(); mm.arc(px(c.x), px(c.z), 2.5, 0, Math.PI * 2); mm.fill();
    }
    // Player arrow. Canvas y grows downward like world z, so an arrow drawn
    // pointing up must rotate by (PI - heading) to match the world forward.
    const x = px(W.player.x), y = px(W.player.z);
    mm.save();
    mm.translate(x, y);
    mm.rotate(Math.PI - W.player.heading);
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath();
    mm.fill();
    mm.restore();
  }

  return {
    showChapter(n, title) {
      el.chapterKicker.textContent = 'CHAPTER ' + n + '/5';
      el.chapterTitle.textContent = title;
      el.chapter.classList.add('show');
      chapterT = 3.2;
    },
    showToast(text) {
      el.toast.textContent = text;
      el.toast.classList.add('show');
      toastT = 2.4;
    },
    hideStart() { el.start.classList.add('hidden'); },
    showStart() { el.start.classList.remove('hidden'); },
    setHelpVisible(v) { el.help.style.display = v ? 'block' : 'none'; },
    showEnd(kind) {
      const map = {
        busted: ['BUSTED', 'The law caught up with you. $200 bail, back on the streets.'],
        wasted: ['WASTED', 'Daz went down. The city keeps moving without you.'],
        done: ['CAMPAIGN COMPLETE', 'All five chapters done. Porto Azul is yours, Daz.'],
      };
      const [t, s] = map[kind] || ['GAME OVER', ''];
      el.endTitle.textContent = t;
      el.endText.textContent = s;
      el.end.classList.remove('hidden');
    },
    hideEnd() { el.end.classList.add('hidden'); },
    update(dt) {
      const P = W.player;
      const d = W.city.districtAt(P.x, P.z);
      el.district.textContent = d.name;
      el.districtSub.textContent = d.flavor;
      const a = W.missions.active;
      if (a) {
        el.mission.textContent = 'MISI ' + a.def.chapter + ' — ' + a.def.title + ' · ' + fmtCash(a.def.payout) + '  ' + a.def.chapter + '/5';
        el.objective.textContent = a.def.objective;
        el.timer.textContent = a.timeLeft > 0 ? fmtTimer(a.timeLeft) : '';
      } else if (W.missions.done) {
        el.mission.textContent = 'CAMPAIGN COMPLETE';
        el.objective.textContent = 'Free roam — Porto Azul is yours';
        el.timer.textContent = '';
      } else {
        el.mission.textContent = 'PORTO AZUL II';
        el.objective.textContent = 'Press ENTER to start';
        el.timer.textContent = '';
      }
      el.clock.textContent = fmtClock(W.S.clockMin) + '  DAY ' + W.S.day;
      el.cash.textContent = fmtCash(P.cash);
      const st = W.police.stars();
      el.stars.textContent = '★'.repeat(st) + '☆'.repeat(5 - st);
      el.stars.classList.toggle('hot', st >= 4);
      el.wanted.textContent = st >= 5 ? 'MOST WANTED' : st > 0 ? 'WANTED ' + st + '/5' : '';
      el.weapon.textContent = 'HORNET SMG  ' + P.mag + ' / ' + P.reserve;
      el.hpFill.style.width = clamp(P.health, 0, 100) + '%';
      el.hpNum.textContent = Math.round(P.health);
      el.arFill.style.width = clamp(P.armour, 0, 100) + '%';
      el.arNum.textContent = Math.round(P.armour);
      el.respect.textContent = 'RESPECT LV ' + (1 + Math.floor(P.respect / 3));
      el.radio.textContent = W.audio.stationName() + ' · ' + W.audio.stationFreq();
      const kmh = Math.round((P.car ? Math.abs(P.car.speed) : 0) * KMH);
      el.speed.textContent = String(kmh);
      el.gear.textContent = 'GEAR ' + Math.min(6, 1 + Math.floor(kmh / 25));
      el.carName.textContent = P.car ? P.car.model.name : 'ON FOOT';
      if (chapterT > 0) {
        chapterT -= dt;
        if (chapterT <= 0) el.chapter.classList.remove('show');
      }
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) el.toast.classList.remove('show');
      }
      drawMinimap();
    },
  };
}
