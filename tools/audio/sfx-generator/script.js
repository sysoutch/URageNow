let waveType = 'square';
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const canvas = document.getElementById('canvas');
const canvasCtx = canvas.getContext('2d');
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;

function applyDashboardTheme(nextTheme) {
    document.body.setAttribute('data-dashboard-theme', nextTheme || 'fire');
}

function setWave(type, btn) {
    waveType = type;
    document.querySelectorAll('#waveSelectors button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function applyPreset(type) {
    const f = document.getElementById('freq');
    const d = document.getElementById('duration');
    const s = document.getElementById('slide');
    const a = document.getElementById('attack');
    const dec = document.getElementById('decay');

    if (type === 'jump') { f.value = 150; d.value = 0.6; s.value = 600; waveType = 'square'; a.value = 0.01; dec.value = 0.1; }
    else if (type === 'explosion') { f.value = 100; d.value = 1.0; s.value = -80; waveType = 'sawtooth'; a.value = 0.01; dec.value = 0.2; }
    else if (type === 'blip') { f.value = 800; d.value = 0.1; s.value = -200; waveType = 'sine'; a.value = 0.01; dec.value = 0.05; }
    else if (type === 'laser') { f.value = 1500; d.value = 0.3; s.value = -1400; waveType = 'sawtooth'; a.value = 0.01; dec.value = 0.1; }
    else if (type === 'powerup') { f.value = 400; d.value = 0.4; s.value = 800; waveType = 'triangle'; a.value = 0.02; dec.value = 0.15; }
    else if (type === 'shoot') { f.value = 1200; d.value = 0.2; s.value = -1000; waveType = 'sine'; a.value = 0.01; dec.value = 0.05; }
    else if (type === 'hit') { f.value = 200; d.value = 0.3; s.value = -100; waveType = 'square'; a.value = 0.01; dec.value = 0.1; }
    else if (type === 'bounce') { f.value = 300; d.value = 0.5; s.value = 400; waveType = 'sawtooth'; a.value = 0.01; dec.value = 0.2; }
    
    // Visual feedback for wave buttons
    const btns = document.querySelectorAll('#waveSelectors button');
    btns.forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(waveType.substring(0,3))));
    playSFX();
}

function getParams() {
    return {
        startFreq: parseFloat(document.getElementById('freq').value),
        duration: parseFloat(document.getElementById('duration').value),
        slide: parseFloat(document.getElementById('slide').value)
    };
}

function toggleLock(btn) {
    btn.classList.toggle('locked');
    
    // Only the waveform lock button shows text, others show emojis
    if (btn.id === 'lock-wave') {
        btn.innerText = btn.classList.contains('locked') ? '🔒 Unlock Waveform' : '🔒 Lock Waveform';
    } else {
        btn.innerText = btn.classList.contains('locked') ? '🔒' : '🔓';
    }
}

function randomize() {
    // Only change if NOT locked
    const freq = document.getElementById('freq');
    const duration = document.getElementById('duration');
    const slide = document.getElementById('slide');
    const attack = document.getElementById('attack');
    const decay = document.getElementById('decay');
    
    if (!document.getElementById('lock-freq').classList.contains('locked')) {
        freq.value = Math.random() * 1000 + 50;
    }
    if (!document.getElementById('lock-duration').classList.contains('locked')) {
        duration.value = Math.random() * 1.5 + 0.1;
    }
    if (!document.getElementById('lock-slide').classList.contains('locked')) {
        slide.value = Math.random() * 2000 - 1000;
    }
    if (!document.getElementById('lock-attack').classList.contains('locked')) {
        attack.value = Math.random() * 0.5;
    }
    if (!document.getElementById('lock-decay').classList.contains('locked')) {
        decay.value = Math.random() * 0.5;
    }
    
    // Only change waveform if NOT locked
    if (!document.getElementById('lock-wave').classList.contains('locked')) {
        const waves = ['square', 'sawtooth', 'sine', 'triangle'];
        const randomWave = waves[Math.floor(Math.random() * waves.length)];
        const buttons = document.querySelectorAll('#waveSelectors button');
        buttons.forEach(btn => {
            if(btn.innerText.toLowerCase().includes(randomWave.substring(0,3))) {
                setWave(randomWave, btn);
            }
        });
    }

    playSFX();
}

function savePreset() {
    const params = getParams();
    const wave = waveType;
    const attack = document.getElementById('attack').value;
    const decay = document.getElementById('decay').value;
    
    // Get preset name from user
    const name = prompt("Enter a name for this preset:", "My Preset");
    if (!name) return;
    
    // Load existing presets
    let presets = JSON.parse(localStorage.getItem('sfxPresets') || '[]');
    
    // Create preset object
    const preset = {
        name: name,
        params: params,
        wave: wave,
        attack: attack,
        decay: decay,
        timestamp: new Date().toISOString()
    };
    
    // Add to presets
    presets.push(preset);
    
    // Save back to localStorage
    localStorage.setItem('sfxPresets', JSON.stringify(presets));
    
    // Update the preset display
    updatePresetDisplay();
}

function loadPresets() {
    // This function is now replaced by the sidebar display
    updatePresetDisplay();
}

function updatePresetDisplay() {
    const presets = JSON.parse(localStorage.getItem('sfxPresets') || '[]');
    const presetsContainer = document.getElementById('presets-container');
    
    if (presets.length === 0) {
        presetsContainer.innerHTML = '<p>No saved presets. Save some presets to see them here!</p>';
        return;
    }
    
    let html = '<div class="presets-list">';
    presets.forEach((preset, index) => {
        const date = new Date(preset.timestamp).toLocaleDateString();
        html += `
            <div class="preset-item">
                <button class="btn-load-preset" onclick="loadPresetFromObject(${index})">
                    ${preset.name}
                </button>
                <span class="preset-date">${date}</span>
                <button class="btn-delete-preset" onclick="deletePreset(${index})">🗑️</button>
            </div>
        `;
    });
    html += '</div>';
    
    presetsContainer.innerHTML = html;
}

function loadPresetFromObject(index) {
    const presets = JSON.parse(localStorage.getItem('sfxPresets') || '[]');
    const preset = presets[index];
    
    const f = document.getElementById('freq');
    const d = document.getElementById('duration');
    const s = document.getElementById('slide');
    const a = document.getElementById('attack');
    const dec = document.getElementById('decay');
    
    f.value = preset.params.startFreq;
    d.value = preset.params.duration;
    s.value = preset.params.slide;
    a.value = preset.attack;
    dec.value = preset.decay;
    waveType = preset.wave;
    
    // Update wave buttons
    const btns = document.querySelectorAll('#waveSelectors button');
    btns.forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(waveType.substring(0,3))));
    
    playSFX();
    updatePresetDisplay();
}

function deletePreset(index) {
    let presets = JSON.parse(localStorage.getItem('sfxPresets') || '[]');
    presets.splice(index, 1);
    localStorage.setItem('sfxPresets', JSON.stringify(presets));
    updatePresetDisplay();
}

// Initialize preset display when page loads
window.addEventListener('load', function() {
    updatePresetDisplay();
});

function playSFX() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const p = {
        startFreq: parseFloat(document.getElementById('freq').value),
        duration: parseFloat(document.getElementById('duration').value),
        slide: parseFloat(document.getElementById('slide').value),
        attack: parseFloat(document.getElementById('attack').value),
        decay: parseFloat(document.getElementById('decay').value)
    };

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Frequency Slide
    osc.type = waveType;
    osc.frequency.setValueAtTime(p.startFreq, audioCtx.currentTime);
    const endFreq = Math.max(1, p.startFreq + p.slide);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + p.duration);

    // ADSR Envelope Logic
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    // Attack: Fade in to max volume
    gain.gain.linearRampToValueAtTime(0.3, now + p.attack);
    // Decay: Fade down to "sustain" level (we'll use 0.0001 for a clean tail)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + p.attack + p.decay + p.duration);

    osc.connect(gain);
    gain.connect(analyser); // From previous visualizer step
    analyser.connect(audioCtx.destination);

    osc.start();
    osc.stop(now + p.duration + p.attack + p.decay);
}

async function downloadSFX() {
    const blob = await renderSfxBlob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sfx-${Date.now()}.wav`;
    link.click();
}

async function renderSfxBlob() {
    const p = getParams();
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(1, sampleRate * p.duration, sampleRate);
    
    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();
    
    osc.type = waveType;
    osc.frequency.setValueAtTime(p.startFreq, 0);
    const endFreq = Math.max(1, p.startFreq + p.slide);
    osc.frequency.exponentialRampToValueAtTime(endFreq, p.duration);
    
    gain.gain.setValueAtTime(0.2, 0);
    gain.gain.exponentialRampToValueAtTime(0.0001, p.duration);
    
    osc.connect(gain);
    gain.connect(offlineCtx.destination);
    osc.start();
    osc.stop(p.duration);
    
    const buffer = await offlineCtx.startRendering();
    return bufferToWave(buffer, sampleRate * p.duration);
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read SFX WAV.'));
        reader.readAsDataURL(blob);
    });
}

async function describeCurrentAsset() {
    const blob = await renderSfxBlob();
    const dataUrl = await blobToDataUrl(blob);
    const params = {
        ...getParams(),
        waveType,
        attack: parseFloat(document.getElementById('attack').value),
        decay: parseFloat(document.getElementById('decay').value)
    };
    return {
        kind: 'audio',
        title: 'Generated SFX WAV',
        fileName: `sfx-${waveType}-${Math.round(params.startFreq)}hz.wav`,
        mimeType: 'audio/wav',
        dataUrl,
        previewKind: 'audio',
        previewUrl: dataUrl,
        sourceDetail: 'Generated WAV sound effect from SFX Generator.',
        metadata: { sourceTool: 'sfx-generator', params }
    };
}

function bufferToWave(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample, offset = 0, pos = 0;

    const setUint16 = d => { view.setUint16(pos, d, true); pos += 2; };
    const setUint32 = d => { view.setUint32(pos, d, true); pos += 4; };

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);

    for(i = 0; i < numOfChan; i++) channels.push(abuffer.getChannelData(i));
    while(pos < length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            view.setInt16(pos, (sample < 0 ? sample * 0x8000 : sample * 0x7FFF), true);
            pos += 2;
        }
        offset++;
    }
    return new Blob([buffer], {type: "audio/wav"});
}

function draw() {
    requestAnimationFrame(draw);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgba(15, 15, 26, 0.2)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#ff8a00';
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
    }
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
}
draw();

window.addEventListener('message', (event) => {
    const message = event && event.data;
    if (message && message.type === 'tool:theme') applyDashboardTheme(message.payload && message.payload.theme);
});

window.__urageToolDescribeCurrentAsset = describeCurrentAsset;
window.__urageToolDescribeCurrentAssets = async () => [await describeCurrentAsset()];

applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
