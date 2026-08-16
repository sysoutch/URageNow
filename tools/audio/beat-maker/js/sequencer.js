// =========================================================
// SEQUENCER - Playback scheduling & transport control
// =========================================================

function secondsPerStep() {
  return 60 / currentPattern().bpm / 4;
}

function nextStep() {
  const pattern = currentPattern();
  const stepLen = secondsPerStep();
  const swingOffset = (state.currentStep % 2 === 1) ? stepLen * (currentPattern().swing / 100) * 0.35 : 0;
  state.nextNoteTime += stepLen + swingOffset;
  
  // Detect loop wrap-around for auto-random
  const wrapped = state.currentStep >= pattern.steps;
  state.currentStep++;
  if (wrapped) {
    state.currentStep = 0;
    if (state.chainMode) state.activePattern = state.activePattern === 'A' ? 'B' : 'A';
    // Trigger auto-random loop check after wrapping
    setTimeout(() => checkLoopCompletion(), 0);
  }
}

function scheduler() {
  while (state.nextNoteTime < state.audio.currentTime + state.scheduleAheadTime) {
    const drawStep = state.currentStep;
    const drawPattern = state.activePattern;
    playStep(drawStep, state.nextNoteTime);
    const delay = Math.max(0, (state.nextNoteTime - state.audio.currentTime) * 1000);
    setTimeout(() => {
      ui.stepLabel.textContent = String(drawStep + 1);
      ui.patternLabel.textContent = drawPattern;
      ui.lengthLabel.textContent = String(currentPattern().steps);
      renderLanes(drawStep);
    }, delay);
    nextStep();
  }
  state.timerId = setTimeout(scheduler, state.lookahead);
}

function setPlayState(on) {
  state.isPlaying = on;
  ui.playBtn.textContent = on ? '❚❚ Pause' : '▶ Play';
  ui.led.classList.toggle('on', on);
}

function startPlayback() {
  ensureAudio();
  state.audio.resume();
  if (state.isPlaying) {
    clearTimeout(state.timerId);
    setPlayState(false);
    return;
  }
  state.currentStep = 0;
  state.nextNoteTime = state.audio.currentTime + 0.05;
  scheduler();
  setPlayState(true);
}

function stopPlayback() {
  clearTimeout(state.timerId);
  state.currentStep = 0;
  setPlayState(false);
  renderLanes(0);
  ui.stepLabel.textContent = '1';
}