// WebAudio synth: engine hum, sirens, gunshots, explosions, radio stations.
// Everything is guarded — silence (never a crash) if audio is unavailable.
export const STATIONS = [
  { name: 'SOL FM 95.4', genre: 'SYNTHWAVE' },
  { name: 'AZUL 101.2', genre: 'LATIN POP' },
  { name: 'NEON 88.7', genre: 'ELECTRO' },
  { name: 'PIRATE 104.9', genre: 'TALK & OLDIES' },
];

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let stationIdx = 0;
  let musicTimer = null;

  function ensure() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineGain).connect(ctx.destination);
      engineOsc.start();
    } catch { /* silent */ }
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    try {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.start();
    } catch { /* silent */ }
  }

  function blip(freq, dur = 0.09, type = 'square', vol = 0.12) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* silent */ }
  }

  // Simple synthwave-ish bass arpeggio loop for the radio.
  function startMusic() {
    if (musicTimer) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    let step = 0;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      blip(bass[step % bass.length], 0.22, 'triangle', 0.05);
      if (step % 2 === 0) blip(bass[step % bass.length] * 4, 0.12, 'sine', 0.03);
      step += 1;
    }, 240);
  }

  return {
    ensure,
    get station() { return STATIONS[stationIdx]; },
    nextStation() {
      stationIdx = (stationIdx + 1) % STATIONS.length;
      blip(880, 0.08);
      return STATIONS[stationIdx];
    },
    toggleMute() { muted = !muted; return muted; },
    engine(speedKmh, driving) {
      if (!driving) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      startEngine();
      if (engineOsc && engineGain && !muted) {
        engineOsc.frequency.value = 50 + speedKmh * 0.9;
        engineGain.gain.value = 0.035 + Math.min(0.05, speedKmh * 0.0004);
      }
    },
    siren(on) {
      if (!on) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      startSiren();
      if (sirenOsc && sirenGain && !muted) {
        sirenOsc.frequency.value = 650 + Math.sin(performance.now() / 320) * 220;
        sirenGain.gain.value = 0.02;
      }
    },
    shot() { blip(220, 0.12, 'square', 0.2); blip(90, 0.1, 'sawtooth', 0.15); },
    explosion() { blip(60, 0.5, 'sawtooth', 0.25); blip(40, 0.7, 'square', 0.2); },
    cash() { blip(1320, 0.1); setTimeout(() => blip(1760, 0.14), 90); },
    startMusic,
  };
}
