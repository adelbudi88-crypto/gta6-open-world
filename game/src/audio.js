// Procedural WebAudio: four radio stations, engine hum and police sirens.
// No audio files — everything is synthesized, so the game makes zero
// network requests. All nodes are created lazily on first user gesture.
export const STATIONS = [
  { name: 'SOL FM 95.4', genre: 'SYNTHWAVE', root: 55.0, wave: 'sawtooth', tempo: 112 },
  { name: 'AZUL BEATS 88.1', genre: 'HIP-HOP', root: 49.0, wave: 'square', tempo: 92 },
  { name: 'NEON NIGHTS 101.7', genre: 'ELECTRO', root: 65.41, wave: 'triangle', tempo: 126 },
  { name: 'PALMLINE 107.3', genre: 'REGGAETON', root: 58.27, wave: 'sawtooth', tempo: 98 },
];

const SCALES = [
  [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
  [0, 3, 5, 7, 10, 12, 15, 19, 22, 24],
  [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24],
  [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
];

export function createAudio() {
  let ctx = null;
  let radioGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let stationIndex = 0;
  let step = 0;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.05;
      radioGain.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function note(freq, when, dur, type, vol) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(radioGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function scheduleStep() {
    if (!ctx) return;
    const st = STATIONS[stationIndex];
    const scale = SCALES[stationIndex];
    const beat = 60 / st.tempo;
    const t = ctx.currentTime + 0.05;
    const deg = scale[step % scale.length];
    const freq = st.root * Math.pow(2, deg / 12);
    note(freq, t, beat * 0.9, st.wave, 0.5);
    if (step % 4 === 0) note(st.root / 2, t, beat * 1.8, 'sine', 0.7);
    if (step % 2 === 1) note(st.root * 2, t, beat * 0.4, 'square', 0.12);
    step += 1;
    radioTimer = window.setTimeout(scheduleStep, beat * 1000);
  }

  return {
    get station() { return STATIONS[stationIndex]; },
    get stationIndex() { return stationIndex; },
    start() {
      if (started) return;
      started = true;
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      scheduleStep();
    },
    nextStation() {
      stationIndex = (stationIndex + 1) % STATIONS.length;
      step = 0;
      return STATIONS[stationIndex];
    },
    setStation(i) {
      stationIndex = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      step = 0;
    },
    engine(speedKmh, on) {
      if (!ctx || !engineOsc) return;
      const target = on ? 0.015 + Math.min(speedKmh, 180) / 180 * 0.05 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.1, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ctx || !sirenOsc) return;
      sirenGain.gain.setTargetAtTime(on ? 0.02 : 0.0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(650 + 250 * Math.sin(Date.now() / 350), ctx.currentTime, 0.05);
    },
    shoot() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    },
    payout() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((f, i) => note(f, t + i * 0.09, 0.22, 'triangle', 0.25));
    },
  };
}
