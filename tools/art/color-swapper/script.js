const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const slider = document.getElementById('decimateSlider');
const sliderVal = document.getElementById('sliderVal');
const presetSelect = document.getElementById('presetSelect');
const paletteGrid = document.getElementById('paletteGrid');

let originalBuffer = null; 
let selectedRGB = null;

function loadImageSource(source) {
    return new Promise((resolve, reject) => {
        const normalizedSource = String(source || '').trim();
        if (!normalizedSource) {
            reject(new Error('No image source was provided.'));
            return;
        }
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            originalBuffer = ctx.getImageData(0, 0, canvas.width, canvas.height);
            refreshPalette();
            resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = normalizedSource;
    });
}

function applyDashboardTheme(nextTheme) {
    if (typeof window.applyDashboardThemeVars === 'function') {
        window.applyDashboardThemeVars(nextTheme || document.body.getAttribute('data-dashboard-theme') || 'fire');
        return;
    }
    document.body.setAttribute('data-dashboard-theme', String(nextTheme || 'fire').trim() || 'fire');
}

const presets = {
    dmg_classic: [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]],
    pocket_silver: [[0, 0, 0], [82, 82, 82], [173, 173, 173], [255, 255, 255]],
    light_teal: [[0, 50, 50], [10, 95, 95], [30, 165, 165], [80, 230, 230]],
    pico8: [[0,0,0], [29,43,83], [126,37,83], [0,135,81], [171,82,54], [95,87,79], [194,195,199], [255,241,232], [255,0,77], [255,163,0], [255,236,39], [0,228,54], [41,173,255], [131,118,156], [255,119,168], [255,204,170]]
};

slider.oninput = () => sliderVal.innerText = slider.value + " Colors";

document.getElementById('upload').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadImageSource(URL.createObjectURL(file)).catch(error => console.error(error));
};

// NEW: EYEDROPPER LOGIC (Click on Image)
canvas.addEventListener('mousedown', (e) => {
    if (!originalBuffer) return;

    // Calculate actual pixel coordinates regardless of CSS scaling
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    // Get the color of the pixel clicked
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] < 10) return; // Skip if transparent

    const rgbStr = `${pixel[0]},${pixel[1]},${pixel[2]}`;
    
    // Find swatch in grid and trigger click
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(s => {
        if (s.dataset.rgb === rgbStr) {
            s.click();
            s.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
});

function processImage() {
    if (!originalBuffer) return;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.putImageData(originalBuffer, 0, 0);
    
    const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const targetLimit = parseInt(slider.value);
    const presetMode = presetSelect.value;

    let colorFreq = {};
    for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] < 128) continue;
        const k = `${data[i]},${data[i+1]},${data[i+2]}`;
        colorFreq[k] = (colorFreq[k] || 0) + 1;
    }

    let topColors = Object.entries(colorFreq)
        .sort((a,b) => b[1] - a[1])
        .slice(0, targetLimit)
        .map(c => c[0].split(',').map(Number));

    const finalPalette = (presetMode !== 'none') ? presets[presetMode] : topColors;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] < 128) continue;
        const closest = getNearestColor(data[i], data[i+1], data[i+2], finalPalette);
        data[i] = closest[0];
        data[i+1] = closest[1];
        data[i+2] = closest[2];
    }

    ctx.putImageData(imageData, 0, 0);
    refreshPalette();
}

function getNearestColor(r, g, b, palette) {
    let minD = Infinity, closest = palette[0];
    for (const c of palette) {
        const d = (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2;
        if (d < minD) { minD = d; closest = c; }
    }
    return closest;
}

function refreshPalette() {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const unique = new Set();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] > 128) unique.add(`${data[i]},${data[i+1]},${data[i+2]}`);
    }
    
    paletteGrid.innerHTML = '';
    unique.forEach(rgb => {
        const s = document.createElement('div');
        s.className = 'color-swatch';
        s.dataset.rgb = rgb;
        s.style.background = `rgb(${rgb})`;
        s.onclick = () => {
            document.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active'));
            s.classList.add('active');
            selectedRGB = rgb.split(',').map(Number);
        };
        paletteGrid.appendChild(s);
    });
    document.getElementById('colorCount').innerText = unique.size;
}

document.getElementById('applySwap').onclick = () => {
    if (!selectedRGB) return alert("Click the image or a swatch to select a color!");
    const hex = document.getElementById('colorPicker').value;
    const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i] === selectedRGB[0] && imgData.data[i+1] === selectedRGB[1] && imgData.data[i+2] === selectedRGB[2]) {
            imgData.data[i] = r; imgData.data[i+1] = g; imgData.data[i+2] = b;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    refreshPalette();
};

function buildCurrentAssetDescriptor() {
    if (!canvas.width || !canvas.height) throw new Error('Load an image first.');
    const dataUrl = canvas.toDataURL('image/png');
    return {
        kind: 'image',
        title: 'Color Swapped Image',
        fileName: 'arcade-asset.png',
        mimeType: 'image/png',
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        previewKind: 'image',
        previewUrl: dataUrl,
        sourceDetail: 'Processed image from Color Swapper.',
        metadata: { sourceTool: 'color-swapper' }
    };
}

function download() {
    const a = document.createElement('a');
    a.download = 'arcade-asset.png';
    a.href = buildCurrentAssetDescriptor().dataUrl;
    a.click();
}

window.addEventListener('message', (event) => {
    const message = event && event.data;
    if (message && message.type === 'tool:theme') applyDashboardTheme(message.payload && message.payload.theme);
});

if (typeof window.registerDashboardToolBridge === 'function') {
    window.registerDashboardToolBridge({
        onTheme: applyDashboardTheme,
        onLoadAsset: payload => loadImageSource(payload && (payload.dataUrl || payload.imageUrl || payload.previewImageUrl || payload.url)),
        onExportImage: buildCurrentAssetDescriptor,
        onDescribeCurrentAsset: buildCurrentAssetDescriptor
    });
}

applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
