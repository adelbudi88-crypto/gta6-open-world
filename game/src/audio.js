// Radio — four WebAudio synth stations, no audio files, no network.
// C cycles stations. AudioContext is created lazily on the first user gesture
// (start screen click / keypress) so browsers never block it.
export const STATIONS = [
  { name: 'SOL FM 95.4', genre: 'SYNTHWAVE', wave: 'sawtooth', bpm: 96, root: 110 },
  { name: 'AZUL 101.1', genre: 'LATIN POP', wave: 'triangle', bpm: 112, root: 130.8 },
  { name: 'NEON 88.7', genre: 'ELECTRO', wave: 'square', bpm: 124, root: 98 },
  { name: 'HARBOUR TALK 720', genre: 'TALK', wave: 'sine', bpm: 60, root: 220 },
];

const CHORDS = [
  [0, 3, 7, 10], [0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 8],
];

export function createAudio() {
  const audio = {
    ctx: null, station: 0, playing: false, muted: false,
    _osc: [], _timer: null, _step: 0, _engine: null,
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return !!this.ctx;
    },
    start() {
      if (this.playing || !this.ensure()) return;
      this.playing = true;
      this._step = 0;
      const st = STATIONS[this.station];
      const beat = 60000 / st.bpm / 2;
      this._timer = setInterval(() => this._tick(), beat);
    },
    stop() {
      this.playing = false;
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      this._stopOsc();
    },
    _stopOsc() {
      for (const o of this._osc) { try { o.stop(); } catch { /* already stopped */ } }
      this._osc = [];
    },
    _tick() {
      if (!this.ctx || this.muted) return;
      const st = STATIONS[this.station];
      if (st.genre === 'TALK') { this._blip(440 + (this._step % 5) * 30, 0.05, 'sine', 0.02); this._step++; return; }
      const chord = CHORDS[this._step % CHORDS.length];
      const note = chord[this._step % chord.length];
      const freq = st.root * Math.pow(2, note / 12) * (this._step % 8 === 0 ? 2 : 1);
      this._blip(freq, 0.22, st.wave, 0.05);
      if (this._step % 2 === 0) this._blip(st.root / 2, 0.3, 'sine', 0.09);
      this._step++;
    },
    _blip(freq, dur, wave, vol) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
      this._osc.push(osc);
      if (this._osc.length > 24) this._osc.shift();
    },
    setStation(i) {
      this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      this._step = 0;
      return STATIONS[this.station];
    },
    nextStation() {
      return this.setStation(this.station + 1);
    },
    engine(on) {
      if (!this.ctx) return;
      if (on && !this._engine) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = 55;
        gain.gain.value = 0.015;
        osc.connect(gain).connect(this.ctx.destination);
        osc.start();
        this._engine = { osc, gain };
      } else if (!on && this._engine) {
        try { this._engine.osc.stop(); } catch { /* stopped */ }
        this._engine = null;
      }
    },
    setEngineRpm(rpm01) {
      if (this._engine && this.ctx) this._engine.osc.frequency.value = 45 + rpm01 * 160;
    },
  };
  return audio;
}
