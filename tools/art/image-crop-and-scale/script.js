const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone') || document.querySelector('#crop-upload-wrapper .upload-card') || document.getElementById('crop-upload-wrapper');
const previews = document.getElementById('previews');
const dlAllBtn = document.getElementById('download-all-btn');
const modeSelect = document.getElementById('mode-select');
const globalStrategy = document.getElementById('global-strategy');
const bgPicker = document.getElementById('bg-picker');
const resetFocusBtn = document.getElementById('reset-focus');

const transparentBgEnabled = document.createElement('input');
transparentBgEnabled.type = 'checkbox';
transparentBgEnabled.id = 'transparent-bg-enabled';

const autoCropEnabled = document.createElement('input');
autoCropEnabled.type = 'checkbox';
autoCropEnabled.id = 'auto-crop-enabled';

const autoCropMode = document.createElement('select');
autoCropMode.id = 'auto-crop-mode';
autoCropMode.innerHTML = `
    <option value="tight">Crop on both axes</option>
    <option value="square">Keep square aspect ratio</option>
`;

let sourceBounds = null;
let sourceImg = null;
let customList = [];
let overrides = {};
let focusPoint = { x: 0.5, y: 0.5 };

function loadSourceImage(source) {
    return new Promise((resolve, reject) => {
        const normalizedSource = String(source || '').trim();
        if (!normalizedSource) {
            reject(new Error('No image source was provided.'));
            return;
        }
        const img = new Image();
        img.onload = () => {
            sourceImg = img;
            sourceBounds = null;
            focusPoint = { x: 0.5, y: 0.5 };
            render();
            dlAllBtn.disabled = false;
            resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = normalizedSource;
    });
}

function addTransparencyControls() {
    const bgGroup = bgPicker && bgPicker.closest('.control-group');
    if (bgGroup && !document.getElementById('transparent-bg-enabled')) {
        const row = document.createElement('label');
        row.className = 'toggle-row';
        row.htmlFor = 'transparent-bg-enabled';
        row.appendChild(transparentBgEnabled);
        row.appendChild(document.createElement('span')).textContent = 'Transparent output background';
        bgGroup.appendChild(row);
    }
}

function addAutoCropControls() {
    if (document.getElementById('auto-crop-controls')) return;

    const group = document.createElement('div');
    group.className = 'control-group';
    group.id = 'auto-crop-controls';
    group.innerHTML = `
        <label>Transparent Auto Crop</label>
        <label class="toggle-row" for="auto-crop-enabled">
            <span>Trim transparent pixels</span>
        </label>
        <label for="auto-crop-mode">Crop Shape</label>
    `;

    const toggleLabel = group.querySelector('.toggle-row');
    toggleLabel.prepend(autoCropEnabled);
    group.appendChild(autoCropMode);

    const anchor = bgPicker && bgPicker.closest('.control-group') ? bgPicker.closest('.control-group') : resetFocusBtn.parentElement;
    if (anchor && anchor.parentElement) {
        anchor.insertAdjacentElement('afterend', group);
    } else {
        document.body.prepend(group);
    }
}

function getSourceBounds() {
    if (!sourceImg || !autoCropEnabled.checked) {
        return { x: 0, y: 0, w: sourceImg.width, h: sourceImg.height };
    }

    if (sourceBounds && sourceBounds.mode === autoCropMode.value) return sourceBounds.bounds;

    const bounds = calculateOpaqueBounds(sourceImg, autoCropMode.value);
    sourceBounds = { mode: autoCropMode.value, bounds };
    return bounds;
}

function calculateOpaqueBounds(img, mode = 'tight') {
    const scanCanvas = document.createElement('canvas');
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    scanCanvas.width = img.width;
    scanCanvas.height = img.height;
    scanCtx.clearRect(0, 0, scanCanvas.width, scanCanvas.height);
    scanCtx.drawImage(img, 0, 0);

    const { data, width, height } = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 0) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        return { x: 0, y: 0, w: img.width, h: img.height };
    }

    let x = minX;
    let y = minY;
    let w = maxX - minX + 1;
    let h = maxY - minY + 1;

    if (mode === 'square') {
        const side = Math.min(Math.max(w, h), Math.min(img.width, img.height));
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        x = Math.round(Math.min(Math.max(centerX - side / 2, 0), img.width - side));
        y = Math.round(Math.min(Math.max(centerY - side / 2, 0), img.height - side));
        w = side;
        h = side;
    }

    return { x, y, w, h };
}

function applyDashboardTheme(theme) {
    if (typeof window.applyDashboardThemeVars === 'function') {
        window.applyDashboardThemeVars(theme || document.body.getAttribute('data-dashboard-theme') || 'fire');
        return;
    }
    document.body.setAttribute('data-dashboard-theme', String(theme || 'fire').trim() || 'fire');
}

resetFocusBtn.onclick = () => {
    focusPoint = { x: 0.5, y: 0.5 };
    if (sourceImg) render();
};

const presets = {
    unity: [{id:'u1', name:'Cover', w:1950, h:1300},{id:'u2', name:'Social', w:1200, h:630},{id:'u3', name:'Card', w:420, h:280},{id:'u4', name:'Icon', w:160, h:160}],
    steam: [{id:'s1', name:'Main', w:616, h:353},{id:'s2', name:'Header', w:460, h:215},{id:'s3', name:'Small', w:231, h:87},{id:'s4', name:'Hero', w:1920, h:620}],
    epic: [{id:'e1', name:'Landscape', w:2560, h:1440},{id:'e2', name:'Portrait', w:1200, h:1600},{id:'e3', name:'Thumb', w:400, h:400}],
    mobile: [{id:'m1', name:'Icon', w:1024, h:1024},{id:'m2', name:'Feature', w:1024, h:500},{id:'m3', name:'Screen', w:1242, h:2208}],
    social: [{id:'so1', name:'YT Thumb', w:1280, h:720},{id:'so2', name:'X Header', w:1500, h:500},{id:'so3', name:'IG Post', w:1080, h:1080}]
};

globalStrategy.onchange = () => { if (sourceImg) render(); };
bgPicker.oninput = () => { if (sourceImg) render(); };
transparentBgEnabled.onchange = () => {
    bgPicker.disabled = transparentBgEnabled.checked;
    if (sourceImg) render();
};
autoCropEnabled.onchange = () => { sourceBounds = null; focusPoint = { x: 0.5, y: 0.5 }; if (sourceImg) render(); };
autoCropMode.onchange = () => { sourceBounds = null; focusPoint = { x: 0.5, y: 0.5 }; if (sourceImg) render(); };
addTransparencyControls();
addAutoCropControls();
modeSelect.onchange = () => {
    document.getElementById('custom-ui').style.display = modeSelect.value === 'custom' ? 'block' : 'none';
    if (sourceImg) render();
};

if (dropZone && fileInput) {
    dropZone.onclick = event => {
        if (event.target !== fileInput) fileInput.click();
    };
    dropZone.addEventListener('dragover', event => {
        event.preventDefault();
        dropZone.classList.add('dragover');
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', event => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
        const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = ev => loadSourceImage(ev.target.result).catch(error => console.error(error));
        reader.readAsDataURL(file);
    });
}
fileInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => loadSourceImage(ev.target.result).catch(error => console.error(error));
    reader.readAsDataURL(file);
};

function render() {
    previews.innerHTML = '';
    const specs = modeSelect.value === 'custom' ? customList : presets[modeSelect.value];
    if (!sourceImg) return;

    specs.forEach(spec => {
        const strategy = overrides[spec.id] || globalStrategy.value;
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.innerHTML = `
            <div class="asset-header"><strong>${spec.name}</strong><span>${spec.w}×${spec.h}</span></div>
            <div class="canvas-container" onclick="setFocus(event, '${spec.id}', ${spec.w}, ${spec.h})"><canvas id="canvas-${spec.id}"></canvas></div>
            <div class="card-actions">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <label style="font-size:0.6rem">Individual Strategy:</label>
                    <select class="strategy-select" onchange="updateOverride('${spec.id}', this.value)">
                        <option value="cover" ${strategy === 'cover' ? 'selected' : ''}>Crop</option>
                        <option value="contain" ${strategy === 'contain' ? 'selected' : ''}>Scale</option>
                    </select>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-primary" style="flex:1; font-size:0.65rem;" onclick="downloadSingle('${spec.id}', '${spec.name}')">PNG</button>
                    ${modeSelect.value === 'custom' ? `<button class="btn btn-danger" style="padding:5px;" onclick="removeCustom('${spec.id}')">Remove</button>` : ''}
                </div>
            </div>`;
        previews.appendChild(card);
        drawCrop(spec, strategy);
    });
}

window.updateOverride = (id, value) => {
    overrides[id] = value;
    render();
};

function drawCrop(spec, strategy) {
    const canvas = document.getElementById(`canvas-${spec.id}`);
    const ctx = canvas.getContext('2d');
    canvas.width = spec.w;
    canvas.height = spec.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparentBgEnabled.checked) {
        ctx.fillStyle = bgPicker.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const bounds = getSourceBounds();
    const scale = strategy === 'cover'
        ? Math.max(spec.w / bounds.w, spec.h / bounds.h)
        : Math.min(spec.w / bounds.w, spec.h / bounds.h);

    const centerX = bounds.w * focusPoint.x;
    const centerY = bounds.h * focusPoint.y;

    let drawX = (spec.w / 2) - (centerX * scale);
    let drawY = (spec.h / 2) - (centerY * scale);

    if (strategy === 'cover') {
        drawX = Math.min(0, Math.max(drawX, spec.w - bounds.w * scale));
        drawY = Math.min(0, Math.max(drawY, spec.h - bounds.h * scale));
    } else {
        drawX = (spec.w - bounds.w * scale) / 2;
        drawY = (spec.h - bounds.h * scale) / 2;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceImg, bounds.x, bounds.y, bounds.w, bounds.h, drawX, drawY, bounds.w * scale, bounds.h * scale);
}

window.setFocus = (event, id, targetW, targetH) => {
    const strategy = overrides[id] || globalStrategy.value;
    if (strategy === 'contain') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / rect.width;
    const clickY = (event.clientY - rect.top) / rect.height;
    const bounds = getSourceBounds();
    const scale = Math.max(targetW / bounds.w, targetH / bounds.h);
    const centerX = bounds.w * focusPoint.x;
    const centerY = bounds.h * focusPoint.y;
    const drawX = Math.min(0, Math.max((targetW / 2) - (centerX * scale), targetW - bounds.w * scale));
    const drawY = Math.min(0, Math.max((targetH / 2) - (centerY * scale), targetH - bounds.h * scale));
    focusPoint.x = Math.min(1, Math.max(0, (clickX * targetW - drawX) / (scale * bounds.w)));
    focusPoint.y = Math.min(1, Math.max(0, (clickY * targetH - drawY) / (scale * bounds.h)));
    render();
};

document.getElementById('add-custom').onclick = () => {
    const w = parseInt(document.getElementById('custom-w').value, 10);
    const h = parseInt(document.getElementById('custom-h').value, 10);
    if (w > 0 && h > 0) {
        customList.push({ id: 'c' + Date.now(), name: `Custom ${w}x${h}`, w, h });
        render();
    }
};

window.removeCustom = id => {
    customList = customList.filter(item => item.id !== id);
    render();
};

window.downloadSingle = (id, name) => {
    const canvas = document.getElementById(`canvas-${id}`);
    const link = document.createElement('a');
    link.download = `${name}.png`;
    link.href = canvas.toDataURL();
    link.click();
};

dlAllBtn.onclick = async () => {
    const specs = modeSelect.value === 'custom' ? customList : presets[modeSelect.value];
    if (typeof JSZip === 'undefined') {
        specs.forEach(spec => downloadSingle(spec.id, spec.name));
        return;
    }
    const zip = new JSZip();
    for (const spec of specs) {
        const blob = await new Promise(resolve => document.getElementById(`canvas-${spec.id}`).toBlob(resolve));
        zip.file(`${spec.name}.png`, blob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'assets.zip';
    link.click();
};

function describeCurrentAssets() {
    const descriptors = [];
    previews.querySelectorAll('canvas').forEach(canvas => {
        if (!canvas.width || !canvas.height) return;
        const card = canvas.closest('.asset-card');
        const title = card && card.querySelector('strong') ? card.querySelector('strong').textContent.trim() : 'Cropped Asset';
        const dataUrl = canvas.toDataURL('image/png');
        descriptors.push({
            kind: 'image',
            title,
            fileName: `${title || 'cropped-asset'}.png`,
            mimeType: 'image/png',
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            previewKind: 'image',
            previewUrl: dataUrl,
            sourceDetail: 'Cropped/scaled image asset.',
            metadata: { sourceTool: 'image-crop-and-scale', preset: modeSelect.value }
        });
    });
    return descriptors;
}

window.addEventListener('message', event => {
    const message = event && event.data ? event.data : null;
    if (!message || message.source !== 'urage-dashboard') return;
    if (message.type === 'tool:theme') applyDashboardTheme(message.payload && message.payload.theme);
});

if (typeof window.registerDashboardToolBridge === 'function') {
    window.registerDashboardToolBridge({
        onTheme: applyDashboardTheme,
        onLoadAsset: payload => loadSourceImage(payload && (payload.dataUrl || payload.imageUrl || payload.previewImageUrl || payload.url)),
        onExportImage: () => {
            const first = describeCurrentAssets()[0];
            if (!first) throw new Error('Load an image first.');
            return first;
        },
        onDescribeCurrentAssets: describeCurrentAssets
    });
}

applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
