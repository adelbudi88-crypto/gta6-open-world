// Procedural WebAudio for Porto Azul II — 4 radio stations, engine hum, sirens.
// No audio files: everything is synthesized. Silent until the first user gesture.
const STATIONS = [
  { name: 'SOL FM 95.4', genre: 'SYNTHWAVE', root: 110, scale: [0, 3, 5, 7, 10], bpm: 112, wave: 'sawtooth' },
  { name: 'PALM 88.1', genre: 'LATIN POP', root: 130.81, scale: [0, 2, 4, 7, 9], bpm: 96, wave: 'triangle' },
  { name: 'VICE 101.7', genre: 'ELECTRO', root: 98, scale: [0, 3, 6, 10], bpm: 128, wave: 'square' },
  { name: 'AZUL TALK 740', genre: 'TALK', root: 220, scale: [0, 5, 7], bpm: 60, wave: 'sine' },
];

export const RADIO_NAMES = STATIONS.map((s) => `${s.name} ${s.genre}`);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.step = 0;
    this.timer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.sirenHigh = false;
    this.muted = false;
  }

  // Call from a user gesture (click / keypress). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.startRadio();
      this.startEngine();
      return true;
    } catch (e) {
      return false;
    }
  }

  setStation(i) {
    this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }

  stationName() {
    const s = STATIONS[this.station];
    return `${s.name} ${s.genre}`;
  }

  startRadio() {
    if (this.timer) return;
    this.timer = setInterval(() => this.scheduleStep(), 240);
  }

  scheduleStep() {
    if (!this.ctx || this.muted) return;
    const s = STATIONS[this.station];
    const t = this.ctx.currentTime + 0.05;
    const degree = s.scale[this.step % s.scale.length];
    const octave = Math.floor(this.step / s.scale.length) % 2;
    const freq = s.root * Math.pow(2, degree / 12 + octave);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = s.wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
    // Bass pulse every 4 steps.
    if (this.step % 4 === 0) {
      const b = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      b.type = 'sine';
      b.frequency.value = s.root / 2;
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      b.connect(bg).connect(this.ctx.destination);
      b.start(t);
      b.stop(t + 0.32);
    }
    this.step += 1;
  }

  startEngine() {
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
    } catch (e) { /* ignore */ }
  }

  setEngine(speedKmh, on) {
    if (!this.ctx || !this.engineOsc) return;
    const target = on && !this.muted ? 0.015 + Math.min(0.05, speedKmh / 4000) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(45 + speedKmh * 0.9, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      try {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 750;
        this.sirenGain.gain.value = this.muted ? 0 : 0.02;
        this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
        this.sirenOsc.start();
        this.sirenTimer = setInterval(() => {
          if (!this.sirenOsc) return;
          this.sirenHigh = !this.sirenHigh;
          this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 950 : 700, this.ctx.currentTime, 0.05);
        }, 420);
      } catch (e) { /* ignore */ }
    } else if (!on && this.sirenOsc) {
      clearInterval(this.sirenTimer);
      try { this.sirenOsc.stop(); } catch (e) {}
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }
}
