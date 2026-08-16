// =========================================================
// UI - DOM rendering & event handlers
// =========================================================

const ui = {
  lanes: document.getElementById('lanes'), presetGrid: document.getElementById('presetGrid'), memoryGrid: document.getElementById('memoryGrid'),
  playBtn: document.getElementById('playBtn'), stopBtn: document.getElementById('stopBtn'), clearBtn: document.getElementById('clearBtn'), randomBtn: document.getElementById('randomBtn'),
  autoRandomBtn: document.getElementById('autoRandomBtn'), duplicateBtn: document.getElementById('duplicateBtn'), chainBtn: document.getElementById('chainBtn'), patternLabel: document.getElementById('patternLabel'),
  stepLabel: document.getElementById('stepLabel'), lengthLabel: document.getElementById('lengthLabel'), led: document.getElementById('led'),
  bpm: document.getElementById('bpm'), swing: document.getElementById('swing'), volume: document.getElementById('volume'), steps: document.getElementById('steps'),
  bpmValue: document.getElementById('bpmValue'), swingValue: document.getElementById('swingValue'), volumeValue: document.getElementById('volumeValue'), stepsValue: document.getElementById('stepsValue'),
  exportBtn: document.getElementById('exportBtn'), importBtn: document.getElementById('importBtn'), saveLocalBtn: document.getElementById('saveLocalBtn'), loadLocalBtn: document.getElementById('loadLocalBtn'), ioBox: document.getElementById('ioBox'),
  // Auto Random DOM refs
  autoRandomPanel: document.getElementById('autoRandomPanel'),
  autoRandomStatus: document.getElementById('autoRandomStatus'),
  arLoops: document.getElementById('arLoops'), arLoopsValue: document.getElementById('arLoopsValue'),
  arVarietyMode: document.getElementById('arVarietyMode'),
  arIntensity: document.getElementById('arIntensity'), arIntensityValue: document.getElementById('arIntensityValue'),
  arStop: document.getElementById('arStop'), arStopValue: document.getElementById('arStopValue'),
  arScope: document.getElementById('arScope'),
  laneIntensitySliders: document.getElementById('laneIntensitySliders'),
  arLoopCount: document.getElementById('arLoopCount'),
  arLastChanged: document.getElementById('arLastChanged'),
  arLaneSelector: document.getElementById('arLaneSelector'),
  // NEW DOM refs for additional auto-random options
  arSwingVar: document.getElementById('arSwingVar'), arSwingRange: document.getElementById('arSwingRange'), arSwingRangeValue: document.getElementById('arSwingRangeValue'),
  arStepVar: document.getElementById('arStepVar'), arStepVaryAmount: document.getElementById('arStepVaryAmount'), arStepVaryAmountValue: document.getElementById('arStepVaryAmountValue'),
  arProbMode: document.getElementById('arProbMode'),
  arRandomizeOnStop: document.getElementById('arRandomizeOnStop'),
  arPatternTransition: document.getElementById('arPatternTransition'), arTransitionDuration: document.getElementById('arTransitionDuration'), arTransitionDurationValue: document.getElementById('arTransitionDurationValue'),
  arAccentChance: document.getElementById('arAccentChance'), arAccentChanceValue: document.getElementById('arAccentChanceValue'),
  arBassPulse: document.getElementById('arBassPulse'),
  arChordStab: document.getElementById('arChordStab'),
  // NEW: After X loops scheduling controls
  arFillEvery: document.getElementById('arFillEvery'), arFillEveryValue: document.getElementById('arFillEveryValue'),
  arBreakdownEvery: document.getElementById('arBreakdownEvery'), arBreakdownEveryValue: document.getElementById('arBreakdownEveryValue'),
  arBuildupEvery: document.getElementById('arBuildupEvery'), arBuildupEveryValue: document.getElementById('arBuildupEveryValue'),
  arBpmDriftStep: document.getElementById('arBpmDriftStep'), arBpmDriftStepValue: document.getElementById('arBpmDriftStepValue'),
  // NEW: Variety & mode controls
  arVarietyMode: document.getElementById('arVarietyMode'),
  arIntensity: document.getElementById('arIntensity'), arIntensityValue: document.getElementById('arIntensityValue'),
  arScope: document.getElementById('arScope'),
  arFillChance: document.getElementById('arFillChance'), arFillChanceValue: document.getElementById('arFillChanceValue'),
  // NEW: Breakdown & buildup controls
  arBreakdownMode: document.getElementById('arBreakdownMode'), arBreakdownRate: document.getElementById('arBreakdownRate'), arBreakdownRateValue: document.getElementById('arBreakdownRateValue'), arBreakdownMin: document.getElementById('arBreakdownMin'), arBreakdownMinValue: document.getElementById('arBreakdownMinValue'),
  arBuildupMode: document.getElementById('arBuildupMode'), arBuildupRate: document.getElementById('arBuildupRate'), arBuildupRateValue: document.getElementById('arBuildupRateValue'), arBuildupMax: document.getElementById('arBuildupMax'), arBuildupMaxValue: document.getElementById('arBuildupMaxValue'),
  // NEW: Groove & feel controls
  arHumanize: document.getElementById('arHumanize'), arHumanizeValue: document.getElementById('arHumanizeValue'),
  arRandomBPM: document.getElementById('arRandomBPM'), arBpmDriftRange: document.getElementById('arBpmDriftRange'), arBpmDriftRangeValue: document.getElementById('arBpmDriftRangeValue'),
  // NEW: Active modes display
  arActiveModes: document.getElementById('arActiveModes')
};

function updateControls() {
  const p = currentPattern();
  ui.bpm.value = p.bpm; ui.swing.value = p.swing; ui.volume.value = p.volume; ui.steps.value = p.steps;
  ui.bpmValue.textContent = p.bpm; ui.swingValue.textContent = p.swing; ui.volumeValue.textContent = p.volume; ui.stepsValue.textContent = p.steps;
  ui.patternLabel.textContent = state.activePattern; ui.lengthLabel.textContent = p.steps;
  ui.chainBtn.classList.toggle('active', state.chainMode);
  if (state.masterGain) state.masterGain.gain.value = p.volume / 100;
}

function applyPreset(name) {
  state.patterns[state.activePattern] = clone(PRESETS[name]);
  updateControls(); renderLanes(); persistLocal();
}

function clearPattern() {
  const p = currentPattern();
  laneMeta.forEach(l => p.lanes[l.key].steps = makeSteps([], MAX_STEPS));
  renderLanes(); persistLocal();
}

// =========================================================
// AUTO RANDOM - Core randomization logic
// =========================================================

function getLaneIntensity(laneKey) {
  const override = laneIntensityOverrides[laneKey];
  if (override !== null && override !== undefined) return override;
  // Default densities per lane for realistic beats
  const defaults = { kick: 0.25, snare: 0.18, hats: 0.6, clap: 0.15, bass: 0.35, chord: 0.18, perc: 0.2, fx: 0.1 };
  return defaults[laneKey] || 0.2;
}

function shouldRandomizeLane(laneKey) {
  if (autoRandomState.scope === 'all') return true;
  if (autoRandomState.scope === 'single') return laneKey === autoRandomState.singleLane;
  if (autoRandomState.scope === 'selected') return autoRandomState.selectedLanes.includes(laneKey);
  return true;
}

function isLaneLocked(laneKey) {
  return autoRandomState.lockedLanes.includes(laneKey);
}

// Full random: re-roll every step based on intensity
function fullRandomize() {
  const p = currentPattern();
  const baseIntensity = autoRandomState.intensity / 100;
  laneMeta.forEach((lane) => {
    if (!shouldRandomizeLane(lane.key)) return;
    if (isLaneLocked(lane.key)) return;
    const density = getLaneIntensity(lane.key) * (baseIntensity / 0.5); // normalize around 50%
    p.lanes[lane.key].steps = Array.from({ length: MAX_STEPS }, (_, i) => i < p.steps && Math.random() < density);
  });
}

// Evolution: mutate a percentage of existing steps
function evolvePattern(mutationRate) {
  const p = currentPattern();
  laneMeta.forEach((lane) => {
    if (!shouldRandomizeLane(lane.key)) return;
    if (isLaneLocked(lane.key)) return;
    const density = getLaneIntensity(lane.key);
    p.lanes[lane.key].steps.forEach((active, i) => {
      if (i >= p.steps) return;
      // 30-60% chance to mutate this step
      if (Math.random() < mutationRate) {
        p.lanes[lane.key].steps[i] = Math.random() < density;
      }
    });
    // Also add new random steps at low probability
    p.lanes[lane.key].steps.forEach((_, i) => {
      if (i >= p.steps) return;
      if (!p.lanes[lane.key].steps[i] && Math.random() < 0.05) {
        p.lanes[lane.key].steps[i] = true;
      }
    });
  });
}

// Drift: shift only 1-2 steps per loop for subtle changes
function driftPattern() {
  const p = currentPattern();
  laneMeta.forEach((lane) => {
    if (!shouldRandomizeLane(lane.key)) return;
    if (isLaneLocked(lane.key)) return;
    // Pick 1-2 random steps to flip
    const shifts = 1 + Math.floor(Math.random() * 2);
    for (let s = 0; s < shifts; s++) {
      const idx = Math.floor(Math.random() * p.steps);
      p.lanes[lane.key].steps[idx] = !p.lanes[lane.key].steps[idx];
    }
  });
}

// =========================================================
// AUTO RANDOM - Breakdown / Buildup / Fill helpers
// =========================================================

function applyBreakdown() {
  const p = currentPattern();
  const rate = autoRandomState.breakdownRate || 50; // steps to clear per cycle (1-100)
  const minDensity = (autoRandomState.breakdownMin || 20) / 100; // minimum remaining density
  
  laneMeta.forEach((lane) => {
    if (!shouldRandomizeLane(lane.key)) return;
    if (isLaneLocked(lane.key)) return;
    
    const steps = p.lanes[lane.key].steps;
    let cleared = 0;
    const toClear = Math.ceil(steps.length * (rate / 100));
    
    // Randomly clear steps until we reach target
    const indices = Array.from({length: steps.length}, (_, i) => i);
    shuffle(indices);
    
    for (const idx of indices) {
      if (cleared >= toClear) break;
      if (steps[idx]) {
        // Check if this would drop below minimum density
        const activeCount = steps.filter(Boolean).length;
        if (activeCount - 1 < steps.length * minDensity) break;
        steps[idx] = false;
        cleared++;
      }
    }
  });
  
  autoRandomState.currentMode = 'breakdown';
}

function applyBuildup() {
  const p = currentPattern();
  const rate = autoRandomState.buildupRate || 50; // steps to add per cycle (1-100)
  const maxDensity = (autoRandomState.buildupMax || 80) / 100; // maximum density cap
  
  laneMeta.forEach((lane) => {
    if (!shouldRandomizeLane(lane.key)) return;
    if (isLaneLocked(lane.key)) return;
    
    const steps = p.lanes[lane.key].steps;
    const density = getLaneIntensity(lane.key);
    let added = 0;
    const toAdd = Math.ceil(steps.length * (rate / 100));
    
    const indices = Array.from({length: steps.length}, (_, i) => i);
    shuffle(indices);
    
    for (const idx of indices) {
      if (added >= toAdd) break;
      if (!steps[idx]) {
        // Check if this would exceed maximum density
        const activeCount = steps.filter(Boolean).length;
        if (activeCount + 1 > steps.length * maxDensity) break;
        if (Math.random() < density) {
          steps[idx] = true;
          added++;
        }
      }
    }
  });
  
  autoRandomState.currentMode = 'buildup';
}

function applyFill() {
  const p = currentPattern();
  const fillChance = (autoRandomState.fillChance || 30) / 100;
  
  laneMeta.forEach((lane) => {
    if (!shouldRandomizeLane(lane.key)) return;
    if (isLaneLocked(lane.key)) return;
    
    const steps = p.lanes[lane.key].steps;
    const density = getLaneIntensity(lane.key);
    
    steps.forEach((_, i) => {
      if (!steps[i] && Math.random() < fillChance * density) {
        steps[i] = true;
      }
    });
  });
  
  autoRandomState.currentMode = 'fill';
}

function applyBpmDrift() {
  const p = currentPattern();
  const driftRange = autoRandomState.bpmDriftRange || 5; // BPM variation range
  const drift = Math.floor(Math.random() * (driftRange * 2 + 1)) - driftRange;
  p.bpm = Math.max(60, Math.min(200, p.bpm + drift));
}

function applyHumanize() {
  const p = currentPattern();
  const amount = (autoRandomState.humanizeAmount || 30) / 100;
  
  // Slightly randomize step patterns to add "human feel"
  laneMeta.forEach((lane) => {
    if (!shouldRandomizeLane(lane.key)) return;
    if (isLaneLocked(lane.key)) return;
    
    const steps = p.lanes[lane.key].steps;
    steps.forEach((active, i) => {
      if (active && Math.random() < amount * 0.1) {
        // Occasionally drop a hit for human feel
        steps[i] = false;
      } else if (!active && Math.random() < amount * 0.05) {
        // Occasionally add an off-grid hit
        steps[i] = true;
      }
    });
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// =========================================================
// AUTO RANDOM - Main randomization with scheduling modes
// =========================================================

// Main auto-random trigger — called after X loops
// SAFEGUARD: Never modifies bpm, swing, volume, or steps — only step patterns
function autoRandomize() {
  // Preserve core transport settings — random NEVER changes these
  const p = currentPattern();
  const preservedTransport = { bpm: p.bpm, swing: p.swing, volume: p.volume, steps: p.steps };
  
  const mode = autoRandomState.varietyMode;
  if (mode === 'full') {
    fullRandomize();
  } else if (mode === 'evolution') {
    // Mutation rate: 30-60% based on intensity
    const mutationRate = 0.3 + (autoRandomState.intensity / 100) * 0.3;
    evolvePattern(mutationRate);
  } else if (mode === 'drift') {
    driftPattern();
  }
  
  // NEW: Swing variation — adjust swing slightly each cycle
  if (autoRandomState.swingVariation) {
    const swingDelta = Math.floor(Math.random() * (autoRandomState.swingRange * 2 + 1)) - autoRandomState.swingRange;
    p.swing = Math.max(0, Math.min(30, p.swing + swingDelta));
  }
  
  // NEW: Step variation — slightly adjust step count within bounds
  if (autoRandomState.stepVariation) {
    const varyAmt = autoRandomState.stepVaryAmount;
    const delta = Math.floor(Math.random() * (varyAmt * 2 + 1)) - varyAmt;
    p.steps = Math.max(8, Math.min(MAX_STEPS, p.steps + delta));
  }
  
  // NEW: Bass pulse — sync bass to kick pattern for stronger low-end groove
  if (autoRandomState.bassPulse) {
    const kickSteps = p.lanes.kick.steps;
    const bassSteps = p.lanes.bass.steps;
    for (let i = 0; i < p.steps; i++) {
      // If kick hits, boost bass probability significantly
      if (kickSteps[i]) {
        bassSteps[i] = Math.random() > 0.3 ? true : false;
      } else {
        // Reduce bass on non-kick steps for punchier feel
        if (Math.random() < 0.25) bassSteps[i] = false;
      }
    }
  }
  
  // NEW: Chord stabs — add chord accents on beat boundaries (steps 0, 8, 16, 24)
  if (autoRandomState.chordStab && p.steps >= 32) {
    const beatBoundaries = [0, 8, 16, 24];
    beatBoundaries.forEach(step => {
      if (step < p.steps && Math.random() > 0.5) {
        p.lanes.chord.steps[step] = true;
      }
    });
  }
  
  // NEW: Accent chance — extra probability for percussion/fx lanes
  if (autoRandomState.accentChance > 0) {
    const accentLanes = ['perc', 'fx'];
    accentLanes.forEach(laneKey => {
      if (!shouldRandomizeLane(laneKey)) return;
      if (isLaneLocked(laneKey)) return;
      p.lanes[laneKey].steps.forEach((_, i) => {
        if (i < p.steps && Math.random() < autoRandomState.accentChance / 100) {
          p.lanes[laneKey].steps[i] = true;
        }
      });
    });
  }
  
  // NEW: BPM drift — optionally vary BPM each cycle
  if (autoRandomState.randomBPM) {
    applyBpmDrift();
  }
  
  // NEW: Humanize — add slight randomization for human feel
  if (autoRandomState.humanize) {
    applyHumanize();
  }
  
  autoRandomState.loopCount++;
  autoRandomState.lastRandomizeTime = Date.now();
  
  // Restore preserved transport settings (safety net — guarantees random never changes these)
  p.bpm = preservedTransport.bpm;
  p.swing = preservedTransport.swing;
  p.volume = preservedTransport.volume;
  p.steps = preservedTransport.steps;
  
  renderLanes();
  persistLocal();
  updateAutoRandomUI();
}

// Manual random button — SAFEGUARD: never changes bpm, swing, volume, or steps
function randomizePattern() {
  // Preserve core transport settings — random NEVER changes these
  const p = currentPattern();
  const preservedTransport = { bpm: p.bpm, swing: p.swing, volume: p.volume, steps: p.steps };
  
  // Reset auto-random state on manual random
  autoRandomState.loopCount = 0;
  laneMeta.forEach(l => p.lanes[l.key].steps = makeSteps([], MAX_STEPS));
  p.lanes.kick.steps = Array.from({length:MAX_STEPS}, (_,i)=> (i % 4 === 0 && i < p.steps) || (Math.random()>0.9 && i < p.steps));
  p.lanes.snare.steps = Array.from({length:MAX_STEPS}, (_,i)=> [4,12,20,28].includes(i) && i < p.steps);
  p.lanes.hats.steps = Array.from({length:MAX_STEPS}, (_,i)=> i < p.steps ? (i % 2 === 0 ? Math.random()>0.15 : Math.random()>0.7) : false);
  p.lanes.clap.steps = Array.from({length:MAX_STEPS}, (_,i)=> i < p.steps ? Math.random()>0.88 : false);
  p.lanes.bass.steps = Array.from({length:MAX_STEPS}, (_,i)=> i < p.steps ? Math.random()>0.58 : false);
  p.lanes.chord.steps = Array.from({length:MAX_STEPS}, (_,i)=> i < p.steps ? (i % 8 === 0 && Math.random()>0.1) : false);
  p.lanes.perc.steps = Array.from({length:MAX_STEPS}, (_,i)=> i < p.steps ? Math.random()>0.82 : false);
  p.lanes.fx.steps = Array.from({length:MAX_STEPS}, (_,i)=> i < p.steps ? Math.random()>0.93 : false);
  
  // Restore preserved transport settings (safety net)
  p.bpm = preservedTransport.bpm;
  p.swing = preservedTransport.swing;
  p.volume = preservedTransport.volume;
  p.steps = preservedTransport.steps;
  
  renderLanes(); persistLocal();
}

function toggleAutoRandom() {
  autoRandomState.enabled = !autoRandomState.enabled;
  if (autoRandomState.enabled) {
    // Start: do an initial randomization
    autoRandomize();
    ui.autoRandomBtn.classList.add('active');
    ui.autoRandomStatus.textContent = 'Active — pattern evolves every X loops';
    ui.autoRandomStatus.style.color = '#4aff82';
  } else {
    autoRandomState.loopCount = 0;
    ui.autoRandomBtn.classList.remove('active');
    ui.autoRandomStatus.textContent = 'Disabled — enable to start auto-generating patterns';
    ui.autoRandomStatus.style.color = '';
    updateAutoRandomUI();
  }
}

function stopPlayback() {
  clearTimeout(state.timerId);
  state.currentStep = 0;
  setPlayState(false);
  renderLanes(0);
  ui.stepLabel.textContent = '1';
  // If auto-random was active, reset loop count on stop
  if (autoRandomState.enabled) {
    autoRandomState.loopCount = 0;
    updateAutoRandomUI();
  }
}

// Check if a full loop has completed — called from nextStep() via sequencer
function checkLoopCompletion() {
  const p = currentPattern();
  if (!autoRandomState.enabled || !state.isPlaying) return;
  
  // When we wrap back to step 0, that's a full loop
  if (state.currentStep === 0 && state.nextNoteTime <= state.audio.currentTime + 0.01) {
    autoRandomState.loopCount++;
    
    const loopsUntil = autoRandomState.loopsUntilRandom;
    
    // Check if we should do the main randomization cycle
    if (autoRandomState.loopCount % loopsUntil === 0) {
      autoRandomize();
    }
    
    // NEW: Fill every X loops — add extra hits for energy buildup effect
    const fillEvery = autoRandomState.fillEvery || 0;
    if (fillEvery > 0 && autoRandomState.loopCount % fillEvery === 0) {
      applyFill();
    }
    
    // NEW: Breakdown every X loops — strip pattern for tension release
    const breakdownEvery = autoRandomState.breakdownEvery || 0;
    if (breakdownEvery > 0 && autoRandomState.loopCount % breakdownEvery === 0) {
      applyBreakdown();
    }
    
    // NEW: Buildup every X loops — gradually add density for energy rise
    const buildupEvery = autoRandomState.buildupEvery || 0;
    if (buildupEvery > 0 && autoRandomState.loopCount % buildupEvery === 0) {
      applyBuildup();
    }
    
    // NEW: BPM drift every X loops — slowly shift tempo for organic feel
    const bpmDriftStep = autoRandomState.bpmDriftStep || 0;
    if (bpmDriftStep > 0 && autoRandomState.loopCount % bpmDriftStep === 0) {
      applyBpmDrift();
    }
    
    // Check auto-stop
    const stopAfter = autoRandomState.autoStopAfterLoops;
    if (stopAfter > 0 && autoRandomState.loopCount >= stopAfter) {
      autoRandomState.enabled = false;
      ui.autoRandomBtn.classList.remove('active');
      ui.autoRandomStatus.textContent = 'Stopped after ' + stopAfter + ' loops';
      ui.autoRandomStatus.style.color = '';
    }
    
    updateAutoRandomUI();
  }
}

function updateAutoRandomUI() {
  const s = autoRandomState;
  ui.arLoopCount.textContent = s.loopCount;
  if (s.lastRandomizeTime > 0) {
    const ago = Math.round((Date.now() - s.lastRandomizeTime) / 1000);
    ui.arLastChanged.textContent = ago < 5 ? 'just now' : ago + 's ago';
  }
  // Update stop display
  ui.arStopValue.textContent = s.autoStopAfterLoops === 0 ? '∞' : String(s.autoStopAfterLoops);
}

function duplicateAtoB() { state.patterns.B = clone(state.patterns.A); if (state.activePattern === 'B') updateControls(); renderLanes(); persistLocal(); }
function togglePattern(name) { state.activePattern = name; updateControls(); renderLanes(); persistLocal(); }

function buildPresetCards() {
  ui.presetGrid.innerHTML = '';
  [{ name:'Pattern A', info:'Select A', onClick:()=>togglePattern('A') }, { name:'Pattern B', info:'Select B', onClick:()=>togglePattern('B') }].forEach(item => {
    const card = document.createElement('button');
    card.className = 'preset-card';
    card.innerHTML = '<strong>' + item.name + '</strong><small>' + item.info + '</small>';
    card.addEventListener('click', item.onClick);
    ui.presetGrid.appendChild(card);
  });
  Object.entries(PRESETS).forEach(([name, preset]) => {
    const card = document.createElement('button');
    card.className = 'preset-card';
    card.innerHTML = '<strong>' + name + '</strong><small>' + preset.bpm + ' BPM · ' + preset.steps + ' steps</small>';
    card.addEventListener('click', () => applyPreset(name));
    ui.presetGrid.appendChild(card);
  });
}

// =========================================================
// AUTO RANDOM - UI Rendering
// =========================================================

function renderAutoRandomLaneSelector() {
  ui.arLaneSelector.innerHTML = '<span class="dim" style="width:100%;margin-bottom:4px;">Lane controls:</span>';
  
  laneMeta.forEach((lane) => {
    const btn = document.createElement('button');
    btn.className = 'tiny-btn';
    
    if (autoRandomState.scope === 'all') {
      // Lock/Unlock button
      const isLocked = isLaneLocked(lane.key);
      btn.textContent = lane.icon + (isLocked ? '🔒' : '🔓');
      btn.title = isLocked ? 'Unlock ' + lane.label + ' from auto-random' : 'Lock ' + lane.label + ' out of auto-random';
      if (isLocked) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (isLocked) {
          autoRandomState.lockedLanes = autoRandomState.lockedLanes.filter(k => k !== lane.key);
        } else {
          autoRandomState.lockedLanes.push(lane.key);
        }
        renderAutoRandomLaneSelector();
      });
    } else if (autoRandomState.scope === 'selected') {
      // Select/Deselect button
      const isSelected = autoRandomState.selectedLanes.includes(lane.key);
      btn.textContent = lane.icon + (isSelected ? ' ✓' : ' ○');
      btn.title = isSelected ? 'Deselect ' + lane.label : 'Select ' + lane.label;
      if (isSelected) btn.classList.add('active');
      btn.addEventListener('click', () => {
        if (isSelected) {
          autoRandomState.selectedLanes = autoRandomState.selectedLanes.filter(k => k !== lane.key);
        } else {
          autoRandomState.selectedLanes.push(lane.key);
        }
        renderAutoRandomLaneSelector();
      });
    } else if (autoRandomState.scope === 'single') {
      // Single lane selector
      const isSelected = autoRandomState.singleLane === lane.key;
      btn.textContent = lane.icon + (isSelected ? ' ●' : ' ○');
      btn.title = isSelected ? 'Deselect ' + lane.label : 'Select ' + lane.label + ' for single-lane mode';
      if (isSelected) btn.classList.add('active');
      btn.addEventListener('click', () => {
        autoRandomState.singleLane = lane.key;
        renderAutoRandomLaneSelector();
      });
    }
    
    ui.arLaneSelector.appendChild(btn);
  });
}

function renderLaneIntensitySliders() {
  ui.laneIntensitySliders.innerHTML = '';
  
  laneMeta.forEach((lane) => {
    const row = document.createElement('div');
    row.className = 'mini-row';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    
    const label = document.createElement('span');
    label.style.cssText = 'font-size:12px;min-width:50px;display:flex;align-items:center;gap:4px;color:var(--muted);';
    label.innerHTML = lane.icon + ' <strong style="color:var(--text);">' + lane.label + '</strong>';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '5';
    slider.style.flex = '1';
    slider.style.accentColor = 'var(--accent)';
    
    const override = laneIntensityOverrides[lane.key];
    if (override !== null && override !== undefined) {
      slider.value = String(Math.round(override * 100));
    } else {
      // Show default as dash
      slider.value = '50';
    }
    
    const valLabel = document.createElement('span');
    valLabel.style.cssText = 'font-size:11px;min-width:32px;text-align:right;color:var(--text);';
    valLabel.textContent = override !== null && override !== undefined ? Math.round(override * 100) + '%' : 'def';
    
    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value) / 100;
      laneIntensityOverrides[lane.key] = val;
      valLabel.textContent = Math.round(val * 100) + '%';
      persistLocal();
    });
    
    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'tiny-btn';
    resetBtn.style.cssText = 'min-width:28px;font-size:9px;';
    resetBtn.textContent = override !== null && override !== undefined ? 'Rst' : '+';
    resetBtn.addEventListener('click', () => {
      laneIntensityOverrides[lane.key] = null;
      slider.value = '50';
      valLabel.textContent = 'def';
      renderLaneIntensitySliders();
      persistLocal();
    });
    
    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(valLabel);
    row.appendChild(resetBtn);
    ui.laneIntensitySliders.appendChild(row);
  });
}

function updateAutoRandomPanelVisibility() {
  // Show panel always, but dim controls when disabled
  const isDisabled = !autoRandomState.enabled;
  ui.autoRandomControls.style.opacity = isDisabled ? '0.5' : '1';
  ui.arLaneSelector.style.opacity = isDisabled ? '0.5' : '1';
}

function renderMemoryGrid() {
  ui.memoryGrid.innerHTML = '';
  state.memory.forEach((slot, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'memory-slot';
    const name = slot && slot.label ? slot.label : 'Slot ' + (index + 1);
    const details = slot ? (slot.pattern.bpm + ' BPM · ' + slot.pattern.steps + ' steps') : 'Empty';
    wrap.innerHTML = '<label>' + name + '</label><div class="mini-row"><button class="tiny-btn">Load</button><button class="tiny-btn">Save</button></div><div class="footer-note">' + details + '</div>';
    const buttons = wrap.querySelectorAll('button');
    buttons[0].addEventListener('click', () => { if (slot) { state.patterns[state.activePattern] = clone(slot.pattern); updateControls(); renderLanes(); persistLocal(); } });
    buttons[1].addEventListener('click', () => { state.memory[index] = { label: 'Slot ' + (index + 1), pattern: clone(currentPattern()) }; persistMemory(); renderMemoryGrid(); });
    ui.memoryGrid.appendChild(wrap);
  });
}

function renderLanes(highlightStep) {
  const p = currentPattern();
  const activeHighlight = typeof highlightStep === 'number' ? highlightStep : state.currentStep;
  ui.lanes.innerHTML = '';
  laneMeta.forEach((lane) => {
    const row = document.createElement('div');
    row.className = 'lane';
    const laneState = p.lanes[lane.key];
    const info = document.createElement('div');
    info.className = 'lane-info';
    info.innerHTML = '<div class="lane-head"><div class="emoji">' + lane.icon + '</div><div class="lane-name"><strong>' + lane.label + '</strong><span>' + lane.hint + '</span></div></div><div class="lane-tools"><button class="tiny-btn ' + (laneState.mute ? 'active' : '') + '" data-action="mute">M</button><button class="tiny-btn ' + (laneState.solo ? 'active' : '') + '" data-action="solo">S</button><input type="range" min="0" max="1" step="0.01" value="' + laneState.volume + '" data-action="vol" /></div>';
    info.querySelector('[data-action="mute"]').addEventListener('click', () => { laneState.mute = !laneState.mute; if (laneState.mute) laneState.solo = false; renderLanes(); persistLocal(); });
    info.querySelector('[data-action="solo"]').addEventListener('click', () => { laneState.solo = !laneState.solo; if (laneState.solo) laneState.mute = false; renderLanes(); persistLocal(); });
    info.querySelector('[data-action="vol"]').addEventListener('input', (e) => { laneState.volume = Number(e.target.value); persistLocal(); });
    row.appendChild(info);
    for (let step = 0; step < p.steps; step++) {
      const btn = document.createElement('button');
      btn.className = 'step ' + lane.colorClass + (laneState.steps[step] ? ' on' : '') + ((activeHighlight === step && state.isPlaying) ? ' current' : '') + (step % 4 === 0 ? ' bar' : '');
      btn.setAttribute('aria-label', lane.label + ' step ' + (step + 1));
      btn.addEventListener('click', () => {
        laneState.steps[step] = !laneState.steps[step];
        renderLanes(activeHighlight); persistLocal();
      });
      row.appendChild(btn);
    }
    ui.lanes.appendChild(row);
  });
}

function exportJSON() {
  ui.ioBox.value = JSON.stringify({ patterns: state.patterns, activePattern: state.activePattern, chainMode: state.chainMode, memory: state.memory }, null, 2);
}

function describeCurrentAssets() {
  const text = JSON.stringify({ patterns: state.patterns, activePattern: state.activePattern, chainMode: state.chainMode, memory: state.memory }, null, 2);
  return [{
    kind: 'text',
    title: 'Beat Maker Pattern JSON',
    fileName: 'beat-maker-patterns.json',
    mimeType: 'application/json',
    textContent: text,
    previewKind: 'text',
    previewText: text,
    sourceDetail: 'Beat Maker sequencer pattern data.',
    metadata: { sourceTool: 'beat-maker', resourceFormat: 'beat-pattern-json' }
  }];
}

function importJSON() {
  try {
    const data = JSON.parse(ui.ioBox.value);
    if (data.patterns) state.patterns = data.patterns;
    if (data.activePattern) state.activePattern = data.activePattern;
    if (typeof data.chainMode === 'boolean') state.chainMode = data.chainMode;
    if (Array.isArray(data.memory)) state.memory = data.memory;
    updateControls(); renderLanes(); renderMemoryGrid(); saveAllLocal();
  } catch (e) {
    alert('That JSON could not be imported.');
  }
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ patterns: state.patterns, activePattern: state.activePattern, chainMode: state.chainMode }));
}

function persistMemory() { localStorage.setItem(MEMORY_KEY, JSON.stringify(state.memory)); }
function saveAllLocal() { persistLocal(); persistMemory(); }

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const mem = JSON.parse(localStorage.getItem(MEMORY_KEY) || 'null');
    if (saved && saved.patterns) {
      state.patterns = saved.patterns;
      state.activePattern = saved.activePattern || 'A';
      state.chainMode = !!saved.chainMode;
    }
    if (Array.isArray(mem)) state.memory = mem;
  } catch (e) {}
  updateControls(); renderLanes(); renderMemoryGrid();
}

function attachEventHandlers() {
  ui.playBtn.addEventListener('click', startPlayback);
  ui.stopBtn.addEventListener('click', stopPlayback);
  ui.clearBtn.addEventListener('click', clearPattern);
  ui.randomBtn.addEventListener('click', randomizePattern);
  ui.autoRandomBtn.addEventListener('click', toggleAutoRandom);
  ui.duplicateBtn.addEventListener('click', duplicateAtoB);
  ui.chainBtn.addEventListener('click', () => { state.chainMode = !state.chainMode; updateControls(); persistLocal(); });
  ui.bpm.addEventListener('input', (e) => { currentPattern().bpm = Number(e.target.value); updateControls(); persistLocal(); });
  ui.swing.addEventListener('input', (e) => { currentPattern().swing = Number(e.target.value); updateControls(); persistLocal(); });
  ui.volume.addEventListener('input', (e) => { currentPattern().volume = Number(e.target.value); updateControls(); persistLocal(); });
  ui.steps.addEventListener('input', (e) => { currentPattern().steps = Number(e.target.value); updateControls(); renderLanes(); persistLocal(); });

  // Auto Random controls
  ui.arLoops.addEventListener('input', (e) => {
    autoRandomState.loopsUntilRandom = Number(e.target.value);
    ui.arLoopsValue.textContent = e.target.value;
    persistLocal();
  });
  // NEW: After X loops scheduling controls
  ui.arFillEvery?.addEventListener('input', (e) => {
    autoRandomState.fillEvery = Number(e.target.value);
    ui.arFillEveryValue.textContent = e.target.value;
    persistLocal();
  });
  ui.arBreakdownEvery?.addEventListener('input', (e) => {
    autoRandomState.breakdownEvery = Number(e.target.value);
    ui.arBreakdownEveryValue.textContent = e.target.value;
    persistLocal();
  });
  ui.arBuildupEvery?.addEventListener('input', (e) => {
    autoRandomState.buildupEvery = Number(e.target.value);
    ui.arBuildupEveryValue.textContent = e.target.value;
    persistLocal();
  });
  ui.arBpmDriftStep?.addEventListener('input', (e) => {
    autoRandomState.bpmDriftStep = Number(e.target.value);
    ui.arBpmDriftStepValue.textContent = e.target.value;
    persistLocal();
  });

  // NEW: Variety & mode controls
  ui.arVarietyMode?.addEventListener('change', () => {
    autoRandomState.varietyMode = ui.arVarietyMode.value;
    persistLocal();
  });
  ui.arIntensity?.addEventListener('input', (e) => {
    autoRandomState.intensity = Number(e.target.value);
    ui.arIntensityValue.textContent = e.target.value + '%';
    persistLocal();
  });
  ui.arScope?.addEventListener('change', () => {
    autoRandomState.scope = ui.arScope.value;
    if (autoRandomState.scope === 'single') {
      autoRandomState.selectedLanes = [];
    } else if (autoRandomState.scope === 'selected' || autoRandomState.scope === 'all') {
      autoRandomState.singleLane = null;
    }
    renderAutoRandomLaneSelector();
    persistLocal();
  });
  ui.arFillChance?.addEventListener('input', (e) => {
    autoRandomState.fillChance = Number(e.target.value);
    ui.arFillChanceValue.textContent = e.target.value + '%';
    persistLocal();
  });

  // NEW: Breakdown & buildup controls
  ui.arBreakdownMode?.addEventListener('change', () => {
    autoRandomState.breakdownMode = ui.arBreakdownMode.checked;
    ui.arBreakdownRate.disabled = !ui.arBreakdownMode.checked;
    ui.arBreakdownMin.disabled = !ui.arBreakdownMode.checked;
    persistLocal();
  });
  ui.arBreakdownRate?.addEventListener('input', (e) => {
    autoRandomState.breakdownRate = Number(e.target.value);
    ui.arBreakdownRateValue.textContent = e.target.value;
    persistLocal();
  });
  ui.arBreakdownMin?.addEventListener('input', (e) => {
    autoRandomState.breakdownMin = Number(e.target.value);
    ui.arBreakdownMinValue.textContent = e.target.value + '%';
    persistLocal();
  });
  ui.arBuildupMode?.addEventListener('change', () => {
    autoRandomState.buildupMode = ui.arBuildupMode.checked;
    ui.arBuildupRate.disabled = !ui.arBuildupMode.checked;
    ui.arBuildupMax.disabled = !ui.arBuildupMode.checked;
    persistLocal();
  });
  ui.arBuildupRate?.addEventListener('input', (e) => {
    autoRandomState.buildupRate = Number(e.target.value);
    ui.arBuildupRateValue.textContent = e.target.value;
    persistLocal();
  });
  ui.arBuildupMax?.addEventListener('input', (e) => {
    autoRandomState.buildupMax = Number(e.target.value);
    ui.arBuildupMaxValue.textContent = e.target.value + '%';
    persistLocal();
  });

  // NEW: Groove & feel controls
  ui.arHumanize?.addEventListener('change', () => {
    autoRandomState.humanize = ui.arHumanize.checked;
    const slider = document.getElementById('arHumanizeSlider');
    if (slider) slider.disabled = !ui.arHumanize.checked;
    persistLocal();
  });
  // Note: arHumanizeValue is updated via the range input below in HTML
  ui.arRandomBPM?.addEventListener('change', () => {
    autoRandomState.randomBPM = ui.arRandomBPM.checked;
    ui.arBpmDriftRange.disabled = !ui.arRandomBPM.checked;
    persistLocal();
  });
  ui.arBpmDriftRange?.addEventListener('input', (e) => {
    autoRandomState.bpmDriftRange = Number(e.target.value);
    ui.arBpmDriftRangeValue.textContent = e.target.value + ' BPM';
    persistLocal();
  });
  ui.arIntensity.addEventListener('input', (e) => {
    autoRandomState.intensity = Number(e.target.value);
    ui.arIntensityValue.textContent = e.target.value + '%';
    persistLocal();
  });
  ui.arStop.addEventListener('input', (e) => {
    autoRandomState.autoStopAfterLoops = Number(e.target.value);
    ui.arStopValue.textContent = Number(e.target.value) === 0 ? '∞' : e.target.value;
    persistLocal();
  });
  ui.arScope.addEventListener('change', () => {
    autoRandomState.scope = ui.arScope.value;
    if (autoRandomState.scope === 'single') {
      autoRandomState.selectedLanes = [];
    } else if (autoRandomState.scope === 'selected' || autoRandomState.scope === 'all') {
      autoRandomState.singleLane = null;
    }
    renderAutoRandomLaneSelector();
    persistLocal();
  });

  // NEW: Swing variation controls
  ui.arSwingVar?.addEventListener('change', () => {
    autoRandomState.swingVariation = ui.arSwingVar.checked;
    ui.arSwingRange.disabled = !ui.arSwingVar.checked;
    persistLocal();
  });
  ui.arSwingRange?.addEventListener('input', (e) => {
    autoRandomState.swingRange = Number(e.target.value);
    ui.arSwingRangeValue.textContent = e.target.value;
    persistLocal();
  });

  // NEW: Step variation controls
  ui.arStepVar?.addEventListener('change', () => {
    autoRandomState.stepVariation = ui.arStepVar.checked;
    ui.arStepVaryAmount.disabled = !ui.arStepVar.checked;
    persistLocal();
  });
  ui.arStepVaryAmount?.addEventListener('input', (e) => {
    autoRandomState.stepVaryAmount = Number(e.target.value);
    ui.arStepVaryAmountValue.textContent = e.target.value;
    persistLocal();
  });

  // NEW: Probability mode
  ui.arProbMode?.addEventListener('change', () => {
    autoRandomState.probMode = ui.arProbMode.value;
    persistLocal();
  });

  // NEW: Humanize amount slider (separate from checkbox)
  const arHumanizeSlider = document.getElementById('arHumanizeAmount');
  if (arHumanizeSlider) {
    arHumanizeSlider.addEventListener('input', (e) => {
      autoRandomState.humanizeAmount = Number(e.target.value);
      ui.arHumanizeValue.textContent = e.target.value + '%';
      persistLocal();
    });
  }

  // NEW: Randomize on stop
  ui.arRandomizeOnStop?.addEventListener('change', () => {
    autoRandomState.randomizeOnStop = ui.arRandomizeOnStop.checked;
    persistLocal();
  });

  // NEW: Pattern transition controls
  ui.arPatternTransition?.addEventListener('change', () => {
    autoRandomState.patternTransition = ui.arPatternTransition.checked;
    ui.arTransitionDuration.disabled = !ui.arPatternTransition.checked;
    persistLocal();
  });
  ui.arTransitionDuration?.addEventListener('input', (e) => {
    autoRandomState.transitionDuration = Number(e.target.value);
    ui.arTransitionDurationValue.textContent = e.target.value + 'ms';
    persistLocal();
  });

  // NEW: Accent chance
  ui.arAccentChance?.addEventListener('input', (e) => {
    autoRandomState.accentChance = Number(e.target.value);
    ui.arAccentChanceValue.textContent = e.target.value + '%';
    persistLocal();
  });

  // NEW: Bass pulse toggle
  ui.arBassPulse?.addEventListener('change', () => {
    autoRandomState.bassPulse = ui.arBassPulse.checked;
    persistLocal();
  });

  // NEW: Chord stab toggle
  ui.arChordStab?.addEventListener('change', () => {
    autoRandomState.chordStab = ui.arChordStab.checked;
    persistLocal();
  });

  // Update active modes display
  function updateActiveModes() {
    const modes = [];
    if (autoRandomState.breakdownMode) modes.push('Breakdown');
    if (autoRandomState.buildupMode) modes.push('Buildup');
    if (autoRandomState.humanize) modes.push('Humanize');
    if (autoRandomState.swingVariation) modes.push('Swing Var');
    if (autoRandomState.stepVariation) modes.push('Step Var');
    if (autoRandomState.randomBPM) modes.push('BPM Drift');
    if (autoRandomState.bassPulse) modes.push('Bass Pulse');
    if (autoRandomState.chordStab) modes.push('Chord Stab');
    if (autoRandomState.patternTransition) modes.push('Pattern Xfade');
    ui.arActiveModes.textContent = modes.length > 0 ? modes.join(', ') : 'None';
  }

  // Listen for changes on all toggle controls to update active modes display
  const modeToggleIds = [
    'arBreakdownMode', 'arBuildupMode', 'arHumanize', 'arSwingVar',
    'arStepVar', 'arRandomBPM', 'arBassPulse', 'arChordStab', 'arPatternTransition'
  ];
  modeToggleIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', updateActiveModes);
    }
  });

  // Initial active modes display
  setTimeout(updateActiveModes, 100);

  ui.exportBtn.addEventListener('click', exportJSON);
  ui.importBtn.addEventListener('click', importJSON);
  ui.saveLocalBtn.addEventListener('click', saveAllLocal);
  ui.loadLocalBtn.addEventListener('click', loadLocal);

  document.addEventListener('keydown', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    const key = e.key.toLowerCase();
    if (key === ' ') { e.preventDefault(); startPlayback(); }
    if (key === 's') stopPlayback();
    if (key === 'r') randomizePattern();
    if (key === 'c') clearPattern();
    if (key === 'a') togglePattern('A');
    if (key === 'b') togglePattern('B');
    if (/^[1-4]$/.test(key)) {
      const idx = Number(key) - 1;
      if (e.shiftKey) {
        state.memory[idx] = { label: 'Slot ' + (idx + 1), pattern: clone(currentPattern()) };
        persistMemory(); renderMemoryGrid();
      } else if (state.memory[idx]) {
        state.patterns[state.activePattern] = clone(state.memory[idx].pattern);
        updateControls(); renderLanes(); persistLocal();
      }
    }
  });

  window.addEventListener('message', (event) => {
    const message = event?.data || null;
    if (!message || message.source !== 'urage-dashboard') return;
    if (message.type === 'tool:theme') applyDashboardTheme(message.payload?.theme);
  });
}

window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;
