// Synthesized sound: no audio files. Engine hum, siren, gunshots, pickups,
// footsteps and a radio with 4 stations (C switches) — each station has its
// own bassline groove and tempo, all WebAudio oscillators/noise.
// v2.1: same stations and effects as v2, internals reorganized around a
// single tone/noise core so every sound path goes through one envelope.
export const RADIO_STATIONS = [
  { name: 'SOL FM', freq: '95.4 · SYNTHWAVE', tempo: 240, bass: [110, 0, 110, 130.8, 0, 98, 0, 123.5] },
  { name: 'NEON 98.5', freq: '98.5 · NIGHT DRIVE', tempo: 210, bass: [87.3, 87.3, 0, 110, 98, 0, 123.5, 0] },
  { name: 'PALM RADIO', freq: '101.2 · LATIN HEAT', tempo: 260, bass: [130.8, 0, 98, 0, 110, 0, 146.8, 0] },
  { name: 'STATIC', freq: '— · NO SIGNAL', tempo: 240, bass: [0, 0, 0, 0, 0, 0, 0, 0] },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;
  let station = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function makeNoiseBuffer() {
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // One oscillator blip: fixed frequency or a slide, exponential decay.
  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // One filtered noise burst with an exponential decay.
  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  // A short arpeggio: notes played in order, stepMs apart.
  function arpeggio(notes, stepMs, noteDur, type, vol) {
    notes.forEach((f, i) => setTimeout(() => tone(f, noteDur, type, vol), i * stepMs));
  }

  function restartMusicLoop() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    musicStep = 0;
    const st = RADIO_STATIONS[station];
    musicTimer = setInterval(() => {
      if (muted) return;
      const f = st.bass[musicStep % st.bass.length];
      musicStep++;
      if (f) tone(f, 0.22, 'triangle', 0.12);
      if (musicStep % 4 === 0) tone(220, 0.06, 'sine', 0.05);
    }, st.tempo);
  }

  function killSiren() {
    if (sirenTimer) clearInterval(sirenTimer);
    sirenTimer = null;
    if (sirenOsc) {
      try { sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc = null;
    }
  }

  const api = {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      if (m) killSiren();
    },
    isMuted() { return muted; },
    gunshot() { noise(0.14, 0.5, 1800); tone(160, 0.1, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.35, 500); },
    pickup() { tone(660, 0.09, 'sine', 0.3); setTimeout(() => tone(990, 0.14, 'sine', 0.3), 90); },
    missionDone() { arpeggio([523, 659, 784, 1046], 110, 0.18, 'triangle', 0.3); },
    busted() { arpeggio([392, 311, 233], 180, 0.3, 'sawtooth', 0.25); },
    click() { tone(880, 0.05, 'square', 0.15); },
    horn() { tone(370, 0.25, 'square', 0.2); tone(466, 0.25, 'square', 0.15); },
    crash() { noise(0.25, 0.5, 700); },
    reload() { tone(1200, 0.04, 'square', 0.18); setTimeout(() => tone(700, 0.05, 'square', 0.2), 120); },
    upgrade() { arpeggio([660, 880, 1100, 1320], 80, 0.12, 'triangle', 0.28); },
    engineStart(speed01) {
      if (!ensure() || muted) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 400;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, t, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, t, 0.1);
    },
    engineStop() {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    startSiren() {
      if (!ensure() || muted || sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.05;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let hi = false;
      sirenTimer = setInterval(() => {
        if (!sirenOsc) return;
        hi = !hi;
        sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, ctx.currentTime, 0.05);
      }, 420);
    },
    stopSiren() { killSiren(); },
    startMusic() {
      if (!ensure() || musicTimer) return;
      restartMusicLoop();
    },
    stopMusic() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
    },
    stationName() { return RADIO_STATIONS[station].name; },
    stationFreq() { return RADIO_STATIONS[station].freq; },
    setStation(i) {
      station = ((i % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
      if (musicTimer) restartMusicLoop();
      return RADIO_STATIONS[station].name;
    },
    cycleStation() { return api.setStation(station + 1); },
  };
  return api;
}
