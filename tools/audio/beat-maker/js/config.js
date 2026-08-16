// =========================================================
// CONFIGURATION & CONSTANTS
// =========================================================

const MAX_STEPS = 32;
const STORAGE_KEY = 'mini-studio-offline-v3';
const MEMORY_KEY = 'mini-studio-memory-v3';

const laneMeta = [
  { key: 'kick', label: 'Kick', icon: '🥁', hint: 'foundation', colorClass: 'kick' },
  { key: 'snare', label: 'Snare', icon: '💥', hint: 'backbeat', colorClass: 'snare' },
  { key: 'hats', label: 'Hi-Hat', icon: '✨', hint: 'rhythm sparkle', colorClass: 'hats' },
  { key: 'clap', label: 'Clap', icon: '👏', hint: 'extra snap', colorClass: 'clap' },
  { key: 'bass', label: 'Bass', icon: '🎸', hint: 'low groove', colorClass: 'bass' },
  { key: 'chord', label: 'Chord', icon: '🎹', hint: 'harmony layer', colorClass: 'chord' },
  { key: 'perc', label: 'Perc', icon: '🪘', hint: 'fill motion', colorClass: 'perc' },
  { key: 'fx', label: 'FX', icon: '🌫️', hint: 'air & accents', colorClass: 'fx' }
];

const bassScale = ['C2','D#2','G1','A#1','C2','D#2','G1','A1'];

// Helper functions needed before PRESETS IIFE evaluation
const makeSteps = (active = [], length = MAX_STEPS) => Array.from({ length }, (_, i) => active.includes(i));
const defaultLaneState = () => Object.fromEntries(laneMeta.map(l => [l.key, { steps: makeSteps([], MAX_STEPS), volume: 0.8, mute: false, solo: false }]));
const freshPattern = () => ({ bpm: 112, swing: 12, volume: 80, steps: 16, lanes: defaultLaneState() });

const chordBank = [
  ['C4','E4','G4'], ['A3','C4','E4'], ['F3','A3','C4'], ['G3','B3','D4']
];

const PRESETS = {
  'Neon Bounce': (() => { const p = freshPattern(); Object.assign(p, { bpm:112, swing:12, volume:80, steps:16 });
    p.lanes.kick.steps = makeSteps([0,4,8,12]); p.lanes.snare.steps = makeSteps([4,12]); p.lanes.hats.steps = makeSteps([2,6,10,14]);
    p.lanes.clap.steps = makeSteps([12]); p.lanes.bass.steps = makeSteps([0,3,5,7,8,11,13,15]); p.lanes.chord.steps = makeSteps([0,4,8,12]);
    p.lanes.perc.steps = makeSteps([7,15]); p.lanes.fx.steps = makeSteps([0,8]); return p; })(),
  'Lo-Fi Night': (() => { const p = freshPattern(); Object.assign(p, { bpm:84, swing:24, volume:68, steps:16 });
    p.lanes.kick.steps = makeSteps([0,7,10]); p.lanes.snare.steps = makeSteps([4,12]); p.lanes.hats.steps = makeSteps([2,3,6,8,10,11,14]);
    p.lanes.clap.steps = makeSteps([12]); p.lanes.bass.steps = makeSteps([0,2,6,8,10,14]); p.lanes.chord.steps = makeSteps([0,8]);
    p.lanes.perc.steps = makeSteps([11,15]); p.lanes.fx.steps = makeSteps([8]); return p; })(),
  'House Starter': (() => { const p = freshPattern(); Object.assign(p, { bpm:124, swing:6, volume:86, steps:16 });
    p.lanes.kick.steps = makeSteps([0,4,8,12]); p.lanes.snare.steps = makeSteps([4,12]); p.lanes.hats.steps = makeSteps([0,2,4,6,8,10,12,14]);
    p.lanes.clap.steps = makeSteps([4,12]); p.lanes.bass.steps = makeSteps([0,2,3,6,8,10,11,14]); p.lanes.chord.steps = makeSteps([0,4,8,12]);
    p.lanes.perc.steps = makeSteps([6,14]); p.lanes.fx.steps = makeSteps([15]); return p; })(),
  'Trap Minimal': (() => { const p = freshPattern(); Object.assign(p, { bpm:142, swing:18, volume:82, steps:16 });
    p.lanes.kick.steps = makeSteps([0,7,10,12]); p.lanes.snare.steps = makeSteps([4,12]); p.lanes.hats.steps = makeSteps([1,2,3,6,7,9,10,11,13,15]);
    p.lanes.clap.steps = makeSteps([4,12]); p.lanes.bass.steps = makeSteps([0,5,7,8,10,12,15]); p.lanes.chord.steps = makeSteps([0,8]);
    p.lanes.perc.steps = makeSteps([14]); p.lanes.fx.steps = makeSteps([3,11]); return p; })(),
  'Synth Drive': (() => { const p = freshPattern(); Object.assign(p, { bpm:128, swing:10, volume:84, steps:32 });
    p.lanes.kick.steps = makeSteps([0,4,8,12,16,20,24,28], MAX_STEPS); p.lanes.snare.steps = makeSteps([4,12,20,28], MAX_STEPS);
    p.lanes.hats.steps = makeSteps(Array.from({length:16}, (_,i)=>i*2), MAX_STEPS); p.lanes.clap.steps = makeSteps([12,28], MAX_STEPS);
    p.lanes.bass.steps = makeSteps([0,3,6,8,11,14,16,19,22,24,27,30], MAX_STEPS); p.lanes.chord.steps = makeSteps([0,8,16,24], MAX_STEPS);
    p.lanes.perc.steps = makeSteps([7,15,23,31], MAX_STEPS); p.lanes.fx.steps = makeSteps([0,16,31], MAX_STEPS); return p; })()
};