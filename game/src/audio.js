// Synthesized sound: no audio files. Engine hum, siren, gunshots,
// pickups, footsteps and a radio with 4 stations (C switches) — each
// station has its own bassline groove and tempo, all WebAudio
// oscillators/noise.
// v2.3: same stations, effects and volumes as v2.2, with the envelope
// helpers and the music loop reorganised into a small SoundBoard class
// and the public API built from it.
export const RADIO_STATIONS = [
  { name: 'SOL FM', freq: '95.4 · SYNTHWAVE', tempo: 240, bass: [110, 0, 110, 130.8, 0, 98, 0, 123.5] },
  { name: 'NEON 98.5', freq: '98.5 · NIGHT DRIVE', tempo: 210, bass: [87.3, 87.3, 0, 110, 98, 0, 123.5, 0] },
  { name: 'PALM RADIO', freq: '101.2 · LATIN HEAT', tempo: 260, bass: [130.8, 0, 98, 0, 110, 0, 146.8, 0] },
  { name: 'STATIC', freq: '— · NO SIGNAL', tempo: 240, bass: [0, 0, 0, 0, 0, 0, 0, 0] },
];

class SoundBoard {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engine = null; // {osc, gain, filter}
    this.siren = null; // {osc, gain, timer}
    this.musicTimer = null;
    this.musicStep = 0;
    this.station = 0;
    this.noiseBuf = null;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  noiseBuffer() {
    if (this.noiseBuf) return this.noiseBuf;
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  }

  // One oscillator blip: fixed frequency or a slide, exponential decay.
  tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // One filtered noise burst with an exponential decay.
  burst(dur, vol, filterFreq) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  // Notes played in order, stepMs apart.
  arpeggio(notes, stepMs, noteDur, type, vol) {
    notes.forEach((f, i) => setTimeout(() => this.tone(f, noteDur, type, vol), i * stepMs));
  }

  restartMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicStep = 0;
    const st = RADIO_STATIONS[this.station];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const f = st.bass[this.musicStep % st.bass.length];
      this.musicStep++;
      if (f) this.tone(f, 0.22, 'triangle', 0.12);
      if (this.musicStep % 4 === 0) this.tone(220, 0.06, 'sine', 0.05);
    }, st.tempo);
  }

  killSiren() {
    if (this.siren) {
      if (this.siren.timer) clearInterval(this.siren.timer);
      try { this.siren.osc.stop(); } catch { /* already stopped */ }
      this.siren = null;
    }
  }
}

export function createAudio() {
  const board = new SoundBoard();
  return {
    unlock() {
      board.ensure();
      if (board.ctx && board.ctx.state === 'suspended') board.ctx.resume();
    },
    setMuted(m) {
      board.muted = m;
      if (board.master) board.master.gain.value = m ? 0 : 0.5;
      if (m) board.killSiren();
    },
    isMuted() { return board.muted; },
    gunshot() { board.burst(0.14, 0.5, 1800); board.tone(160, 0.1, 'square', 0.25, 60); },
    punch() { board.burst(0.08, 0.35, 500); },
    pickup() { board.tone(660, 0.09, 'sine', 0.3); setTimeout(() => board.tone(990, 0.14, 'sine', 0.3), 90); },
    missionDone() { board.arpeggio([523, 659, 784, 1046], 110, 0.18, 'triangle', 0.3); },
    busted() { board.arpeggio([392, 311, 233], 180, 0.3, 'sawtooth', 0.25); },
    click() { board.tone(880, 0.05, 'square', 0.15); },
    horn() { board.tone(370, 0.25, 'square', 0.2); board.tone(466, 0.25, 'square', 0.15); },
    crash() { board.burst(0.25, 0.5, 700); },
    reload() { board.tone(1200, 0.04, 'square', 0.18); setTimeout(() => board.tone(700, 0.05, 'square', 0.2), 120); },
    upgrade() { board.arpeggio([660, 880, 1100, 1320], 80, 0.12, 'triangle', 0.28); },
    engineStart(speed01) {
      if (!board.ensure() || board.muted) return;
      if (!board.engine) {
        const osc = board.ctx.createOscillator();
        osc.type = 'sawtooth';
        const filter = board.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        const gain = board.ctx.createGain();
        gain.gain.value = 0.0;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(board.master);
        osc.start();
        board.engine = { osc, gain, filter };
      }
      const t = board.ctx.currentTime;
      const e = board.engine;
      e.osc.frequency.setTargetAtTime(50 + speed01 * 140, t, 0.08);
      e.filter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.08);
      e.gain.gain.setTargetAtTime(0.05 + speed01 * 0.06, t, 0.1);
    },
    engineStop() {
      if (board.engine) board.engine.gain.gain.setTargetAtTime(0, board.ctx.currentTime, 0.1);
    },
    startSiren() {
      if (!board.ensure() || board.muted || board.siren) return;
      const osc = board.ctx.createOscillator();
      osc.type = 'triangle';
      const gain = board.ctx.createGain();
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(board.master);
      osc.start();
      let hi = false;
      const timer = setInterval(() => {
        if (!board.siren) return;
        hi = !hi;
        osc.frequency.setTargetAtTime(hi ? 960 : 720, board.ctx.currentTime, 0.05);
      }, 420);
      board.siren = { osc, gain, timer };
    },
    stopSiren() { board.killSiren(); },
    startMusic() {
      if (!board.ensure() || board.musicTimer) return;
      board.restartMusic();
    },
    stopMusic() {
      if (board.musicTimer) clearInterval(board.musicTimer);
      board.musicTimer = null;
    },
    stationName() { return RADIO_STATIONS[board.station].name; },
    stationFreq() { return RADIO_STATIONS[board.station].freq; },
    setStation(i) {
      board.station = ((i % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
      if (board.musicTimer) board.restartMusic();
      return RADIO_STATIONS[board.station].name;
    },
    cycleStation() { return this.setStation(board.station + 1); },
  };
}
