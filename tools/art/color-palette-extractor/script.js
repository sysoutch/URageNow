const fInput = document.getElementById('file-input');
const output = document.getElementById('palette-output');
const contrastList = document.getElementById('contrast-list');
const historyList = document.getElementById('history-list');
const imgPreview = document.getElementById('image-preview');
const mCanvas = document.getElementById('main-canvas');
const mCtx = mCanvas.getContext('2d', { willReadFrequently: true });

let colors = [];
let currentImgBase64 = null;

function postToolBridgeMessage(type, payload, requestId) {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage({ source: 'urage-tool', type, requestId, payload }, '*');
}

function postToolError(error, requestId) {
    const detail = error instanceof Error ? error.message : String(error || 'Tool action failed.');
    postToolBridgeMessage('tool:error', { error: detail }, requestId);
}

function readCanvasImageDataUrl() {
    if (!mCanvas.width || !mCanvas.height) throw new Error('Load an image first.');
    return mCanvas.toDataURL('image/png');
}

function buildPaletteTextureDataUrl() {
    if (colors.length === 0) throw new Error('Generate a palette first.');
    const tex = document.createElement('canvas');
    tex.width = colors.length;
    tex.height = 1;
    const ctx = tex.getContext('2d');
    colors.forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(index, 0, 1, 1);
    });
    return tex.toDataURL('image/png');
}

function loadImageSource(source, fileName) {
    return new Promise((resolve, reject) => {
        const normalizedSource = String(source || '').trim();
        if (!normalizedSource) {
            reject(new Error('No image source was provided.'));
            return;
        }
        const img = new Image();
        img.onload = () => {
            mCanvas.width = img.width;
            mCanvas.height = img.height;
            mCtx.clearRect(0, 0, img.width, img.height);
            mCtx.drawImage(img, 0, 0);
            currentImgBase64 = normalizedSource;
            imgPreview.src = normalizedSource;
            imgPreview.style.display = 'block';
            process();
            resolve({
                width: img.width,
                height: img.height,
                fileName: String(fileName || 'palette-source.png').trim() || 'palette-source.png'
            });
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = normalizedSource;
    });
}

function loadImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = re => {
        loadImageSource(re.target && re.target.result, file.name).catch(error => console.error(error));
    };
    reader.readAsDataURL(file);
}

function applyDashboardTheme(theme) {
    if (typeof window.applyDashboardThemeVars === 'function') {
        window.applyDashboardThemeVars(theme || document.body.getAttribute('data-dashboard-theme') || 'fire');
        return;
    }
    document.body.setAttribute('data-dashboard-theme', String(theme || 'fire').trim() || 'fire');
}

function clearHistory() {
    if (confirm('Permanently delete all saved analysis history?')) {
        localStorage.removeItem('arch_history');
        renderHistory();
    }
}

function saveToHistory(imgData, palette) {
    const history = JSON.parse(localStorage.getItem('arch_history') || '[]');
    if (history.length > 0 && history[0].img === imgData) return;
    history.unshift({ img: imgData, colors: palette, time: new Date().getTime() });
    if (history.length > 12) history.pop();
    localStorage.setItem('arch_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('arch_history') || '[]');
    if (history.length === 0) {
        historyList.innerHTML = '<p style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 20px;">No history records found.</p>';
        return;
    }
    historyList.innerHTML = '';
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.onclick = () => restoreHistory(item);
        const paletteDivs = item.colors.slice(0, 10).map(c => `<div style="background:${c};flex:1"></div>`).join('');
        div.innerHTML = `<img src="${item.img}" class="history-thumb"><div class="history-palette">${paletteDivs}</div>`;
        historyList.appendChild(div);
    });
}

function restoreHistory(item) {
    colors = item.colors;
    currentImgBase64 = item.img;
    imgPreview.src = item.img;
    imgPreview.style.display = 'block';
    render();
}

fInput.onchange = e => loadImageFile(e.target.files[0]);

function process() {
    const count = parseInt(document.getElementById('c-count').value, 10);
    document.getElementById('c-val').innerText = count;
    const data = mCtx.getImageData(0, 0, mCanvas.width, mCanvas.height).data;

    const map = {};
    const step = data.length > 1000000 ? 240 : 120;
    for (let i = 0; i < data.length; i += step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        map[`${r},${g},${b}`] = (map[`${r},${g},${b}`] || 0) + 1;
    }

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const final = [];
    for (const [rgb] of sorted) {
        if (final.length >= count) break;
        const cur = rgb.split(',').map(Number);
        const uniqueEnough = final.every(existing => {
            const value = existing.split(',').map(Number);
            return Math.sqrt((cur[0] - value[0]) ** 2 + (cur[1] - value[1]) ** 2 + (cur[2] - value[2]) ** 2) > 35;
        });
        if (uniqueEnough) final.push(rgb);
    }

    colors = final.map(color => {
        const rgb = color.split(',').map(Number);
        return '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
    });

    saveToHistory(currentImgBase64, colors);
    render();
}

function getLum(hex) {
    const value = parseInt(hex.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function render() {
    output.innerHTML = '';
    contrastList.innerHTML = '';
    const sort = document.getElementById('sort').value;
    if (sort === 'lum') colors.sort((a, b) => getLum(b) - getLum(a));

    colors.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.style.backgroundColor = color;
        const lum = getLum(color);
        swatch.innerHTML = `<span class="swatch-hex" style="color:${lum > 0.5 ? '#000' : '#fff'}; background:${lum > 0.5 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}">${color}</span>`;
        output.appendChild(swatch);

        if (index < 8) {
            const ratio = 1.05 / (lum + 0.05);
            const item = document.createElement('div');
            item.className = `contrast-item ${ratio > 3 ? 'pass' : 'fail'}`;
            item.innerHTML = `<div style="color:${color}; font-weight:900; font-size:22px; font-family:'Inter'">Aa</div><div style="text-align:right"><div style="font-weight:700; font-size:13px">${ratio.toFixed(2)}:1</div><div style="font-size:9px; opacity:0.7">${ratio > 4.5 ? 'AAA' : ratio > 3 ? 'AA' : 'FAIL'}</div></div>`;
            contrastList.appendChild(item);
        }
    });
}

function downloadTexture() {
    if (colors.length === 0) return;
    const link = document.createElement('a');
    link.download = `palette_${Date.now()}.png`;
    link.href = buildPaletteTextureDataUrl();
    link.click();
}

function buildCurrentAssetDescriptors() {
    const descriptors = [];
    if (colors.length > 0) {
        const paletteText = JSON.stringify({ colors }, null, 2);
        const paletteDataUrl = buildPaletteTextureDataUrl();
        descriptors.push({
            kind: 'image',
            title: 'Palette Texture',
            fileName: 'palette-texture.png',
            mimeType: 'image/png',
            dataUrl: paletteDataUrl,
            width: colors.length,
            height: 1,
            previewKind: 'image',
            previewUrl: paletteDataUrl,
            sourceDetail: '1D color palette texture from Color Palette Extractor.',
            metadata: { sourceTool: 'color-palette-extractor', colorCount: colors.length }
        });
        descriptors.push({
            kind: 'text',
            title: 'Palette JSON',
            fileName: 'palette.json',
            mimeType: 'application/json',
            textContent: paletteText,
            previewKind: 'text',
            previewText: paletteText,
            sourceDetail: 'Extracted palette colors as JSON.',
            metadata: { sourceTool: 'color-palette-extractor', resourceFormat: 'palette-json' }
        });
    }
    if (mCanvas.width && mCanvas.height) {
        const sourceDataUrl = readCanvasImageDataUrl();
        descriptors.push({
            kind: 'image',
            title: 'Palette Source Preview',
            fileName: 'palette-source-preview.png',
            mimeType: 'image/png',
            dataUrl: sourceDataUrl,
            width: mCanvas.width,
            height: mCanvas.height,
            previewKind: 'image',
            previewUrl: sourceDataUrl,
            sourceDetail: 'Current source image used for palette extraction.',
            metadata: { sourceTool: 'color-palette-extractor' }
        });
    }
    return descriptors;
}

window.__urageToolDescribeCurrentAssets = buildCurrentAssetDescriptors;
window.__urageToolDescribeCurrentAsset = () => buildCurrentAssetDescriptors()[0] || null;

window.addEventListener('message', async event => {
    const message = event && event.data ? event.data : null;
    if (!message || message.source !== 'urage-dashboard') return;
    if (message.type === 'tool:theme') applyDashboardTheme(message.payload && message.payload.theme);
    if (message.type === 'tool:load-asset') {
        try {
            const payload = message.payload || {};
            await loadImageSource(payload.dataUrl || payload.url, payload.fileName);
        } catch (error) {
            postToolError(error, message.requestId);
        }
    }
    if (message.type === 'tool:request-export-image') {
        try {
            const payload = message.payload || {};
            const mode = payload.mode === 'palette-texture' ? 'palette-texture' : 'preview';
            const dataUrl = mode === 'palette-texture' ? buildPaletteTextureDataUrl() : readCanvasImageDataUrl();
            const defaultFileName = mode === 'palette-texture' ? 'palette-texture.png' : 'palette-preview.png';
            postToolBridgeMessage('tool:export-image', {
                dataUrl,
                fileName: String(payload.fileName || defaultFileName).trim() || defaultFileName,
                width: mode === 'palette-texture' ? colors.length : mCanvas.width,
                height: mode === 'palette-texture' ? 1 : mCanvas.height
            }, message.requestId);
        } catch (error) {
            postToolError(error, message.requestId);
        }
    }
});

window.onload = () => {
    applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
    renderHistory();
    const saved = localStorage.getItem('last_palette');
    if (saved) {
        colors = JSON.parse(saved);
        render();
    }
};
