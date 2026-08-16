// =========================================================
// AUDIO ENGINE - Sound synthesis & playback
// =========================================================

function ensureAudio() {
  if (state.audio) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = currentPattern().volume / 100;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 8;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(ctx.destination);
  state.audio = ctx;
  state.masterGain = master;
}

function midiToFreq(note) {
  const map = { C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 };
  const m = note.match(/^([A-G](?:#|b)?)(\d)$/);
  const midi = 12 * (Number(m[2]) + 1) + map[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function noiseBuffer(type) {
  const length = state.audio.sampleRate * 0.2;
  const buffer = state.audio.createBuffer(1, length, state.audio.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = type === 'pink' ? (last + (0.02 * white)) / 1.02 : white;
    last = data[i];
  }
  return buffer;
}

function laneAudible(laneKey) {
  const pattern = currentPattern();
  const soloed = laneMeta.some(l => pattern.lanes[l.key].solo);
  return soloed ? pattern.lanes[laneKey].solo : !pattern.lanes[laneKey].mute;
}

function laneGainValue(laneKey) {
  const pattern = currentPattern();
  return (pattern.lanes[laneKey].volume || 0) * (pattern.volume / 100);
}

// Sound synthesis functions
function playKick(time, gainMul) {
  const osc = state.audio.createOscillator();
  const gain = state.audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.9 * gainMul, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  osc.connect(gain); gain.connect(state.masterGain); osc.start(time); osc.stop(time + 0.2);
}

function playNoiseHit(time, gainMul, type, highpassFreq, length) {
  const src = state.audio.createBufferSource();
  src.buffer = noiseBuffer(type);
  const hp = state.audio.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = highpassFreq;
  const gain = state.audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.05, 0.55 * gainMul), time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  src.connect(hp); hp.connect(gain); gain.connect(state.masterGain); src.start(time); src.stop(time + length + 0.02);
}

function playHat(time, gainMul) {
  const osc1 = state.audio.createOscillator();
  const osc2 = state.audio.createOscillator();
  const hp = state.audio.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
  const gain = state.audio.createGain();
  osc1.type = 'square'; osc2.type = 'square'; osc1.frequency.value = 6400; osc2.frequency.value = 8200;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.18 * gainMul, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc1.connect(hp); osc2.connect(hp); hp.connect(gain); gain.connect(state.masterGain);
  osc1.start(time); osc2.start(time); osc1.stop(time + 0.06); osc2.stop(time + 0.06);
}

function playTone(freq, time, duration, type, gainMul, filterFreq) {
  const osc = state.audio.createOscillator();
  const gain = state.audio.createGain();
  const filt = state.audio.createBiquadFilter();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  filt.type = filterFreq ? 'lowpass' : 'allpass';
  filt.frequency.value = filterFreq || 20000;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainMul), time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(filt); filt.connect(gain); gain.connect(state.masterGain);
  osc.start(time); osc.stop(time + duration + 0.02);
}

function playChord(notes, time, duration, gainMul) {
  notes.forEach((note, i) => playTone(midiToFreq(note), time + i * 0.002, duration, 'triangle', gainMul / 2.6, 1800));
}

function playFx(time, gainMul) {
  const osc = state.audio.createOscillator();
  const gain = state.audio.createGain();
  const filter = state.audio.createBiquadFilter();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, time);
  osc.frequency.exponentialRampToValueAtTime(1200, time + 0.14);
  filter.type = 'bandpass'; filter.frequency.value = 1400; filter.Q.value = 3;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.12 * gainMul, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  osc.connect(filter); filter.connect(gain); gain.connect(state.masterGain); osc.start(time); osc.stop(time + 0.2);
}

function playStep(step, time) {
  const pattern = currentPattern();
  const chordIndex = Math.floor((step % pattern.steps) / Math.max(1, pattern.steps / 4)) % 4;
  if (pattern.lanes.kick.steps[step] && laneAudible('kick')) playKick(time, laneGainValue('kick'));
  if (pattern.lanes.snare.steps[step] && laneAudible('snare')) playNoiseHit(time, laneGainValue('snare'), 'white', 1200, 0.12);
  if (pattern.lanes.hats.steps[step] && laneAudible('hats')) playHat(time, laneGainValue('hats'));
  if (pattern.lanes.clap.steps[step] && laneAudible('clap')) playNoiseHit(time, laneGainValue('clap') * 0.8, 'pink', 900, 0.14);
  if (pattern.lanes.bass.steps[step] && laneAudible('bass')) playTone(midiToFreq(bassScale[step % bassScale.length]), time, 0.17, 'square', 0.25 * laneGainValue('bass'), 420);
  if (pattern.lanes.chord.steps[step] && laneAudible('chord')) playChord(chordBank[chordIndex], time, 0.45, 0.18 * laneGainValue('chord'));
  if (pattern.lanes.perc.steps[step] && laneAudible('perc')) playTone(880 + ((step % 4) * 120), time, 0.06, 'triangle', 0.08 * laneGainValue('perc'), 3000);
  if (pattern.lanes.fx.steps[step] && laneAudible('fx')) playFx(time, laneGainValue('fx'));
}