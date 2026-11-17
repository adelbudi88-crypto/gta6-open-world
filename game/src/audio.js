// Procedural sound for Porto Azul II: four radio stations built from
// WebAudio oscillators (no audio files), an engine hum that follows speed,
// and a two-tone police siren. Everything starts on the first user gesture.
import { clamp } from './rng.js';

export const STATIONS = [
  { name: 'SOL FM 95.4', genre: 'SYNTHWAVE', bpm: 96, root: 55, scale: [0, 3, 5, 7, 10, 12], wave: 'sawtooth' },
  { name: 'NEON 88.1', genre: 'ELECTRO', bpm: 122, root: 49, scale: [0, 2, 3, 7, 8, 12], wave: 'square' },
  { name: 'PALM 102.7', genre: 'LATIN', bpm: 104, root: 65.41, scale: [0, 2, 4, 7, 9, 12], wave: 'triangle' },
  { name: 'VICE 99.9', genre: 'ROCK', bpm: 132, root: 73.42, scale: [0, 5, 7, 10, 12], wave: 'sawtooth' },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let step = 0;
  let nextTime = 0;
  let timer = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function note(freq, when, dur, wave, vol) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function scheduleStep() {
    if (!ctx) return;
    const st = STATIONS[station];
    const spb = 60 / st.bpm / 2;
    while (nextTime < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4;
      const degree = st.scale[(step * 3 + bar) % st.scale.length];
      const freq = st.root * Math.pow(2, degree / 12) * (step % 16 === 0 ? 2 : 1);
      if (step % 2 === 0) note(freq, nextTime, spb * 1.8, st.wave, 0.5);
      if (step % 8 === 4) note(st.root / 2, nextTime, spb * 3, 'sine', 0.7);
      if (step % 4 === 2) note(st.root * 4, nextTime, spb * 0.4, 'square', 0.12);
      step += 1;
      nextTime += spb;
    }
  }

  function start() {
    if (started) return;
    if (!ensure()) return;
    started = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    nextTime = ctx.currentTime + 0.1;
    timer = window.setInterval(scheduleStep, 90);
  }

  function cycleStation() {
    station = (station + 1) % STATIONS.length;
    step = 0;
    return station;
  }

  function setEngine(speedKmh, driving) {
    if (!ctx || !engineOsc) return;
    const target = driving ? 0.05 + clamp(speedKmh / 180, 0, 1) * 0.06 : 0.0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(50 + speedKmh * 0.9, ctx.currentTime, 0.1);
  }

  function setSiren(on, t) {
    if (!ctx || !sirenOsc) return;
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, ctx.currentTime, 0.2);
    if (on) sirenOsc.frequency.setTargetAtTime(Math.sin(t * 2.4) > 0 ? 880 : 660, ctx.currentTime, 0.08);
  }

  function blip(freq) {
    if (!ctx) return;
    note(freq, ctx.currentTime, 0.18, 'square', 0.25);
  }

  return {
    start,
    cycleStation,
    setEngine,
    setSiren,
    blip,
    get station() { return station; },
    get stationLabel() { return STATIONS[station].name + ' · ' + STATIONS[station].genre; },
    get ready() { return started; },
  };
}
