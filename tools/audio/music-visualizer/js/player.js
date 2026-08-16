// =========================================================
// PLAYER - Audio playback & state management
// =========================================================

const audioUpload = document.getElementById('audioUpload');
const statusText = document.getElementById('status');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const progressBar = document.querySelector('.progress-bar');
const progressFill = document.getElementById('progressFill');
const volumeControl = document.getElementById('volumeControl');

let audioCtx, analyser, source, dataArray, gainNode;
let peaks = [];
let currentView = 'bars';
let colorMode = 'spectrum';
let isPlaying = false;
let audioBuffer = null;

audioUpload.onchange = function() {
  const files = this.files;
  if (files.length === 0) return;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    gainNode = audioCtx.createGain();
    analyser.fftSize = 256;
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    setVolume();
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const audioData = e.target.result;
    audioCtx.decodeAudioData(audioData, (buffer) => {
      audioBuffer = buffer;
      durationEl.innerText = formatTime(buffer.duration);
      statusText.innerText = 'Loaded: ' + files[0].name;
      playBtn.disabled = false;
      stopBtn.disabled = false;
      isPlaying = false;
      playBtn.innerText = '\u25b6 Play';
      resetProgress();
    });
  };
  reader.readAsArrayBuffer(files[0]);
};

function togglePlayPause() {
  if (!audioBuffer) return;

  if (isPlaying) {
    source.stop();
    isPlaying = false;
    playBtn.innerText = '\u25b6 Play';
    statusText.innerText = 'Paused';
  } else {
    source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode);
    const offset = (audioCtx.currentTime % audioBuffer.duration);
    source.start(0, offset);
    isPlaying = true;
    playBtn.innerText = '\u23f8 Pause';
    statusText.innerText = 'Playing';
    draw();
  }
}

function stopPlayback() {
  if (source) {
    source.stop();
    source = null;
  }
  isPlaying = false;
  playBtn.innerText = '\u25b6 Play';
  statusText.innerText = 'Stopped';
  resetProgress();
}

function setVolume() {
  if (gainNode) {
    gainNode.gain.value = volumeControl.value / 100;
  }
}

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function resetProgress() {
  progressFill.style.width = '0%';
  currentTimeEl.innerText = '0:00';
}

function updateProgress() {
  if (!audioBuffer || !isPlaying) return;
  const progress = (audioCtx.currentTime % audioBuffer.duration) / audioBuffer.duration;
  progressFill.style.width = (progress * 100) + '%';
  currentTimeEl.innerText = formatTime(audioCtx.currentTime % audioBuffer.duration);
}

// Volume toggle button and display updates
function initVolumeControls() {
  var volumeToggleBtn = document.getElementById('volumeToggleBtn');
  var volumePanelMain = document.getElementById('volumePanelMain');
  var volumeValueDisplay = document.getElementById('volumeValueDisplay');
  var muteBtn = document.getElementById('muteBtn');

  if (volumeToggleBtn && volumePanelMain) {
    volumeToggleBtn.addEventListener('click', function() {
      volumePanelMain.classList.toggle('visible');
    });
  }

  // Mute button toggle
  var isMuted = false;
  var prevVolume = 70;
  if (muteBtn) {
    muteBtn.addEventListener('click', function() {
      isMuted = !isMuted;
      if (isMuted) {
        prevVolume = volumeControl.value;
        volumeControl.value = 0;
        setVolume();
        muteBtn.textContent = '🔇';
        muteBtn.classList.add('muted');
        if (volumeValueDisplay) volumeValueDisplay.textContent = '0%';
      } else {
        volumeControl.value = prevVolume;
        setVolume();
        muteBtn.textContent = '🔊';
        muteBtn.classList.remove('muted');
        if (volumeValueDisplay) volumeValueDisplay.textContent = prevVolume + '%';
      }
    });
  }

  // Update volume display
  function updateVolumeDisplay() {
    if (volumeValueDisplay && volumeControl) {
      volumeValueDisplay.textContent = volumeControl.value + '%';
    }
  }
  if (volumeControl) {
    volumeControl.addEventListener('input', updateVolumeDisplay);
    updateVolumeDisplay();
  }
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVolumeControls);
} else {
  initVolumeControls();
}

progressBar.onclick = function(e) {
  if (!audioBuffer) return;
  const rect = progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const time = percent * audioBuffer.duration;
  if (source) source.stop();
  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(gainNode);
  if (isPlaying) {
    source.start(0, time);
  }
};

// =========================================================
// CUSTOM DROPDOWNS - Replace native select styling
// =========================================================

const customDropdowns = [];

function createCustomDropdown(nativeSelect) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper';
  
  const selected = document.createElement('div');
  selected.className = 'custom-select-selected';
  selected.textContent = nativeSelect.options[nativeSelect.selectedIndex].textContent;
  
  const options = document.createElement('div');
  options.className = 'custom-select-options';
  
  nativeSelect.querySelectorAll('option').forEach((option, idx) => {
    const optEl = document.createElement('div');
    optEl.className = 'custom-select-option' + (idx === nativeSelect.selectedIndex ? ' active' : '');
    optEl.textContent = option.text;
    optEl.dataset.index = idx;
    optEl.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Update the native select
      nativeSelect.selectedIndex = idx;
      
      // Update the selected display text - use textContent not innerHTML
      selected.textContent = option.text;
      
      // Update active class on options
      var allOpts = options.querySelectorAll('.custom-select-option');
      for (var oi = 0; oi < allOpts.length; oi++) {
        allOpts[oi].classList.remove('active');
      }
      optEl.classList.add('active');
      
      // Close dropdown
      options.classList.remove('open');
      
      // Dispatch change event on the native select
      nativeSelect.dispatchEvent(new Event('change'));
    });
    options.appendChild(optEl);
  });
  
  wrapper.appendChild(selected);
  wrapper.appendChild(options);
  nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
  nativeSelect.style.display = 'none';
  
  // Use mousedown to toggle before the global click can close it
  selected.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var isOpen = options.classList.toggle('open');
    for (var i = 0; i < customDropdowns.length; i++) {
      var dd = customDropdowns[i];
      if (dd !== wrapper) {
        var opts = dd.querySelector('.custom-select-options');
        if (opts) opts.classList.remove('open');
      }
    }
  });
  
  return wrapper;
}

document.querySelectorAll('select').forEach(function(sel) { createCustomDropdown(sel); });

// Use mousedown to close dropdowns when clicking outside, so it works reliably
document.addEventListener('mousedown', function(e) {
  if (!e.target.closest('.custom-select-wrapper')) {
    document.querySelectorAll('.custom-select-options.open').forEach(function(el) { el.classList.remove('open'); });
  }
});

// Theme management
function applyDashboardTheme(theme) {
  const allowed = new Set(['fire', 'water', 'nature', 'rock']);
  const nextTheme = allowed.has(String(theme || '').trim()) ? String(theme).trim() : 'fire';
  document.body.setAttribute('data-dashboard-theme', nextTheme);
}

window.addEventListener('message', function(event) {
  const message = event ? event.data : null;
  if (!message || message.source !== 'urage-dashboard') return;
  if (message.type === 'tool:theme') applyDashboardTheme(message.payload ? message.payload.theme : null);
});

window.__urageToolDescribeCurrentAsset = function() {
  if (!canvas || !canvas.width || !canvas.height) return null;
  const dataUrl = canvas.toDataURL('image/png');
  return {
    kind: 'image',
    title: 'Music Visualizer Frame',
    fileName: 'music-visualizer-frame.png',
    mimeType: 'image/png',
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    previewKind: 'image',
    previewUrl: dataUrl,
    metadata: {
      sourceTool: 'music-visualizer',
      viewType: currentView,
      colorMode,
      hasAudio: Boolean(audioBuffer),
      playing: Boolean(isPlaying)
    }
  };
};

window.__urageToolDescribeCurrentAssets = function() {
  const descriptor = window.__urageToolDescribeCurrentAsset();
  return descriptor ? [descriptor] : [];
};
