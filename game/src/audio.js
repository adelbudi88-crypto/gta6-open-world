// Synthesized sound, no audio files: engine hum, sirens, gunfire, pickups
// and a four-station radio. Everything is oscillators and filtered noise
// through one master gain, created lazily so headless runs never break.
export const STATIONS = [
  { name: 'SOL FM', freq: '95.4 · SYNTHWAVE', stepMs: 240, root: 110, bass: [0, 0, 7, 0, 10, 0, 7, 5], lead: [12, 0, 15, 19, 0, 15, 12, 0] },
  { name: 'NEON 98.5', freq: '98.5 · NIGHT DRIVE', stepMs: 210, root: 87.3, bass: [0, 0, 0, 5, 3, 0, 7, 0], lead: [0, 12, 0, 10, 0, 7, 12, 0] },
  { name: 'PALM RADIO', freq: '101.2 · LATIN HEAT', stepMs: 260, root: 130.8, bass: [0, 7, 0, 5, 0, 3, 5, 7], lead: [12, 12, 0, 15, 12, 0, 10, 7] },
  { name: 'STATIC', freq: '— · NO SIGNAL', stepMs: 240, root: 110, bass: [0, 0, 0, 0, 0, 0, 0, 0], lead: [0, 0, 0, 0, 0, 0, 0, 0] },
];

function semitone(root, n) { return root * Math.pow(2, n / 12); }

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let station = 0;
  let step = 0;
  let musicTimer = null;
  let engine = null;   // { osc, gain, filter }
  let siren = null;    // { osc, gain, timer, hi }

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }

  function tone(o) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slide), t + o.dur);
    g.gain.setValueAtTime(o.vol ?? 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + o.dur + 0.03);
  }

  function noise(o) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + (o.delay || 0);
    const len = Math.floor(ctx.sampleRate * o.dur);
    const buf = ctx.createBuffer(1, Math.max(1, len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.cutoff || 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + o.dur);
  }

  function playStep() {
    const st = STATIONS[station];
    if (st.name === 'STATIC') { noise({ dur: 0.18, vol: 0.02, cutoff: 4000, filter: 'highpass' }); return; }
    const b = st.bass[step % st.bass.length];
    const l = st.lead[step % st.lead.length];
    if (b) tone({ freq: semitone(st.root, b), dur: 0.22, type: 'triangle', vol: 0.13 });
    if (l) tone({ freq: semitone(st.root, l), dur: 0.16, type: 'sine', vol: 0.05 });
    if (step % 4 === 0) tone({ freq: semitone(st.root, 24), dur: 0.05, type: 'sine', vol: 0.04 });
    step++;
  }

  function startLoop() {
    if (musicTimer) clearInterval(musicTimer);
    step = 0;
    const st = STATIONS[station];
    musicTimer = setInterval(() => { if (!muted) playStep(); }, st.stepMs);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      if (m) this.stopSiren();
    },
    isMuted() { return muted; },
    click() { tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.12 }); },
    gunshot() { noise({ dur: 0.14, vol: 0.5, cutoff: 1800 }); tone({ freq: 160, dur: 0.1, type: 'square', vol: 0.22, slide: 60 }); },
    punch() { noise({ dur: 0.08, vol: 0.35, cutoff: 500 }); },
    pickup() { tone({ freq: 660, dur: 0.09, vol: 0.28 }); tone({ freq: 990, dur: 0.14, vol: 0.28, delay: 0.09 }); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.28, delay: i * 0.11 })); },
    busted() { [392, 311, 233].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'sawtooth', vol: 0.22, delay: i * 0.18 })); },
    horn() { tone({ freq: 370, dur: 0.25, type: 'square', vol: 0.18 }); tone({ freq: 466, dur: 0.25, type: 'square', vol: 0.13 }); },
    crash() { noise({ dur: 0.25, vol: 0.5, cutoff: 700 }); },
    reload() { tone({ freq: 1200, dur: 0.04, type: 'square', vol: 0.15 }); tone({ freq: 700, dur: 0.05, type: 'square', vol: 0.18, delay: 0.12 }); },
    upgrade() { [660, 880, 1100, 1320].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.25, delay: i * 0.08 })); },
    engineStart(speed01) {
      if (!ensure() || muted) return;
      if (!engine) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 400;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(filter); filter.connect(gain); gain.connect(master);
        osc.start();
        engine = { osc, gain, filter };
      }
      const t = ctx.currentTime;
      engine.osc.frequency.setTargetAtTime(50 + speed01 * 150, t, 0.08);
      engine.filter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.08);
      engine.gain.gain.setTargetAtTime(0.04 + speed01 * 0.06, t, 0.1);
    },
    engineStop() { if (engine) engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); },
    startSiren() {
      if (!ensure() || muted || siren) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const gain = ctx.createGain();
      gain.gain.value = 0.045;
      osc.connect(gain); gain.connect(master);
      osc.start();
      let hi = false;
      const timer = setInterval(() => {
        if (!siren) return;
        hi = !hi;
        osc.frequency.setTargetAtTime(hi ? 960 : 720, ctx.currentTime, 0.05);
      }, 420);
      siren = { osc, gain, timer };
    },
    stopSiren() {
      if (!siren) return;
      clearInterval(siren.timer);
      try { siren.osc.stop(); } catch { /* already stopped */ }
      siren = null;
    },
    startMusic() { if (!ensure() || musicTimer) return; startLoop(); },
    stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; },
    stationName() { return STATIONS[station].name; },
    stationFreq() { return STATIONS[station].freq; },
    setStation(i) {
      station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      if (musicTimer) startLoop();
      return STATIONS[station].name;
    },
    cycleStation() { return this.setStation(station + 1); },
  };
}
