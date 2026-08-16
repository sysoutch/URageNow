(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    fileInput: $('fileInput'), dropzone: $('dropzone') || document.querySelector('.upload-card-wrapper') || document.querySelector('.upload-card'), addBtn: $('addBtn'), clearBtn: $('clearBtn'), textureList: $('textureList'),
    multiMode: $('multiMode'),
    heightSource: $('heightSource'), strength: $('strength'), strengthNum: $('strengthNum'), strengthVal: $('strengthVal'), zDepth: $('zDepth'), zDepthVal: $('zDepthVal'),
    kernel: $('kernel'), blur: $('blur'), blurVal: $('blurVal'), invertX: $('invertX'), invertY: $('invertY'), tile: $('tile'), normalizeTextures: $('normalizeTextures'),
    sizeMode: $('sizeMode'), customSizeRow: $('customSizeRow'), customW: $('customW'), customH: $('customH'), format: $('format'),
    generateBtn: $('generateBtn'), downloadBtn: $('downloadBtn'), copyBtn: $('copyBtn'),
    baseCanvas: $('baseCanvas'), heightCanvas: $('heightCanvas'), normalCanvas: $('normalCanvas'),
    statTextures: $('statTextures'), statSize: $('statSize'), statKernel: $('statKernel'), statStatus: $('statStatus')
  };

  const state = { textures: [], selectedTextureId: '', lastBlob: null, lastObjectUrl: null, debounce: null, loadingPromise: null };
  const ctx = {
    base: els.baseCanvas.getContext('2d', { willReadFrequently: true }),
    height: els.heightCanvas.getContext('2d', { willReadFrequently: true }),
    normal: els.normalCanvas.getContext('2d', { willReadFrequently: true })
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const wrap = (v, max) => ((v % max) + max) % max;
  const setStatus = (msg) => { els.statStatus.textContent = msg; };
  const normalizeMultiMode = value => String(value || '').trim() === 'combined' ? 'combined' : 'each';

  function applyDashboardTheme(theme) {
    if (typeof window.applyDashboardThemeVars === 'function') {
      window.applyDashboardThemeVars(theme || document.body.getAttribute('data-dashboard-theme') || 'fire');
      return;
    }
    document.body.setAttribute('data-dashboard-theme', String(theme || 'fire').trim() || 'fire');
  }

  async function loadDashboardAsset(payload) {
    const sourceUrl = String(payload?.dataUrl || payload?.imageUrl || payload?.previewImageUrl || payload?.url || '').trim();
    if (!sourceUrl) throw new Error('Normal Map Generator needs an image source.');
    const response = await fetch(sourceUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load image (${response.status}).`);
    const blob = await response.blob();
    const fileName = String(payload?.fileName || payload?.imageFileName || payload?.previewFileName || 'dashboard-image.png').trim() || 'dashboard-image.png';
    await loadFiles([new File([blob], fileName, { type: blob.type || 'image/png' })]);
  }

  function syncLabels() {
    const strength = Number(els.strength.value);
    els.strengthVal.textContent = strength.toFixed(2);
    els.strengthNum.value = strength.toFixed(2);
    els.zDepthVal.textContent = Number(els.zDepth.value).toFixed(2);
    els.blurVal.textContent = `${els.blur.value} px`;
    els.statKernel.textContent = els.kernel.options[els.kernel.selectedIndex].text.replace(' 3×3', '');
  }

  async function loadFiles(files) {
    const images = [...files].filter(file => file.type.startsWith('image/'));
    if (!images.length) return;
    const loadingPromise = (async () => {
      setStatus('Loading');
      for (const file of images) {
        const url = URL.createObjectURL(file);
        try {
          const img = await createImageBitmap(file, { imageOrientation: 'none', premultiplyAlpha: 'none' });
          state.textures.push({ id: crypto.randomUUID(), file, name: file.name, url, img, w: img.width, h: img.height });
        } catch (err) {
          URL.revokeObjectURL(url);
          console.error(err);
        }
      }
      if (!state.selectedTextureId && state.textures[0]) state.selectedTextureId = state.textures[0].id;
      renderTextureList();
      await generate();
    })();
    state.loadingPromise = loadingPromise;
    try {
      await loadingPromise;
    } finally {
      if (state.loadingPromise === loadingPromise) state.loadingPromise = null;
    }
  }

  function renderTextureList() {
    els.textureList.innerHTML = '';
    state.textures.forEach((tex, index) => {
      const item = document.createElement('div');
      item.className = 'texture-item';
      if (tex.id === state.selectedTextureId) item.classList.add('active');
      item.innerHTML = `<img class="thumb" src="${tex.url}" alt=""><div><strong>${index === 0 ? 'Base' : 'Layer ' + index}</strong><small title="${tex.name}">${tex.name} · ${tex.w}×${tex.h}</small></div>`;
      item.addEventListener('click', () => {
        state.selectedTextureId = tex.id;
        renderTextureList();
        scheduleGenerate();
      });
      const remove = document.createElement('button');
      remove.className = 'btn danger';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => removeTexture(tex.id));
      item.appendChild(remove);
      els.textureList.appendChild(item);
    });
    els.statTextures.textContent = state.textures.length;
  }

  function removeTexture(id) {
    const index = state.textures.findIndex(t => t.id === id);
    if (index >= 0) URL.revokeObjectURL(state.textures[index].url);
    state.textures.splice(index, 1);
    if (state.selectedTextureId === id) state.selectedTextureId = state.textures[0] ? state.textures[0].id : '';
    renderTextureList();
    scheduleGenerate();
  }

  function clearTextures() {
    state.textures.forEach(t => URL.revokeObjectURL(t.url));
    state.textures = [];
    state.selectedTextureId = '';
    [els.baseCanvas, els.heightCanvas, els.normalCanvas].forEach(c => { c.width = 1; c.height = 1; });
    renderTextureList();
    els.downloadBtn.disabled = true;
    els.copyBtn.disabled = true;
    els.statSize.textContent = '—';
    setStatus('Ready');
  }

  function outputSize() {
    const base = state.textures[0];
    const mode = els.sizeMode.value;
    if (!base) return { w: 1, h: 1 };
    if (mode === 'base') return { w: base.w, h: base.h };
    if (mode === 'custom') return { w: clamp(Number(els.customW.value) || base.w, 1, 8192), h: clamp(Number(els.customH.value) || base.h, 1, 8192) };
    const n = Number(mode);
    return { w: n, h: n };
  }

  function drawSourceTextures(w, h) {
    const temp = document.createElement('canvas');
    temp.width = w;
    temp.height = h;
    const tctx = temp.getContext('2d', { willReadFrequently: true });
    const imageDatas = [];

    for (const tex of state.textures) {
      tctx.clearRect(0, 0, w, h);
      tctx.drawImage(tex.img, 0, 0, w, h);
      imageDatas.push(tctx.getImageData(0, 0, w, h));
    }

    els.baseCanvas.width = w;
    els.baseCanvas.height = h;
    ctx.base.clearRect(0, 0, w, h);
    if (state.textures[0]) ctx.base.drawImage(state.textures[0].img, 0, 0, w, h);
    return imageDatas;
  }

  function getSelectedTextures() {
    if (normalizeMultiMode(els.multiMode && els.multiMode.value) === 'combined') {
      return state.textures.slice();
    }
    if (!state.selectedTextureId) return state.textures[0] ? [state.textures[0]] : [];
    return state.textures.filter(texture => texture.id === state.selectedTextureId);
  }

  function channelHeight(data, i, mode) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255, a = data[i + 3] / 255;
    switch (mode) {
      case 'alpha': return a;
      case 'red': return r;
      case 'green': return g;
      case 'blue': return b;
      case 'max': return Math.max(r, g, b);
      case 'min': return Math.min(r, g, b);
      default: return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
  }

  function makeHeightMap(imageDatas, w, h) {
    const source = els.heightSource.value;
    const average = els.normalizeTextures.checked;
    const heights = new Float32Array(w * h);
    for (const imgData of imageDatas) {
      const data = imgData.data;
      for (let p = 0, i = 0; p < heights.length; p++, i += 4) heights[p] += channelHeight(data, i, source);
    }
    if (average && imageDatas.length > 0) for (let p = 0; p < heights.length; p++) heights[p] /= imageDatas.length;
    return Number(els.blur.value) > 0 ? boxBlur(heights, w, h, Number(els.blur.value)) : heights;
  }

  function boxBlur(src, w, h, radius) {
    if (!radius) return src;
    const tmp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    const tile = els.tile.checked;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = tile ? wrap(x + k, w) : clamp(x + k, 0, w - 1);
          sum += src[y * w + xx]; count++;
        }
        tmp[y * w + x] = sum / count;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let k = -radius; k <= radius; k++) {
          const yy = tile ? wrap(y + k, h) : clamp(y + k, 0, h - 1);
          sum += tmp[yy * w + x]; count++;
        }
        out[y * w + x] = sum / count;
      }
    }
    return out;
  }

  function sample(hm, w, h, x, y) {
    if (els.tile.checked) return hm[wrap(y, h) * w + wrap(x, w)];
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return hm[y * w + x];
  }

  function gradient(hm, w, h, x, y) {
    const kernel = els.kernel.value;
    if (kernel === 'central') {
      return {
        dx: sample(hm, w, h, x + 1, y) - sample(hm, w, h, x - 1, y),
        dy: sample(hm, w, h, x, y + 1) - sample(hm, w, h, x, y - 1)
      };
    }
    const scharr = kernel === 'scharr';
    const a = scharr ? 3 : 1, b = scharr ? 10 : 2;
    const tl = sample(hm, w, h, x - 1, y - 1), tc = sample(hm, w, h, x, y - 1), tr = sample(hm, w, h, x + 1, y - 1);
    const ml = sample(hm, w, h, x - 1, y), mr = sample(hm, w, h, x + 1, y);
    const bl = sample(hm, w, h, x - 1, y + 1), bc = sample(hm, w, h, x, y + 1), br = sample(hm, w, h, x + 1, y + 1);
    return {
      dx: (a * tr + b * mr + a * br) - (a * tl + b * ml + a * bl),
      dy: (a * bl + b * bc + a * br) - (a * tl + b * tc + a * tr)
    };
  }

  function renderHeightPreview(hm, w, h) {
    els.heightCanvas.width = w;
    els.heightCanvas.height = h;
    const img = ctx.height.createImageData(w, h);
    for (let p = 0, i = 0; p < hm.length; p++, i += 4) {
      const v = clamp(Math.round(hm[p] * 255), 0, 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.height.putImageData(img, 0, 0);
  }

  function renderNormalMap(hm, w, h) {
    els.normalCanvas.width = w;
    els.normalCanvas.height = h;
    const img = ctx.normal.createImageData(w, h);
    const strength = Number(els.strength.value);
    const zDepth = Number(els.zDepth.value);
    const invertX = els.invertX.checked;
    const invertY = els.invertY.checked;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const g = gradient(hm, w, h, x, y);
        let nx = -g.dx * strength;
        let ny = -g.dy * strength;
        let nz = zDepth;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
        let r = nx * 0.5 + 0.5;
        let gg = ny * 0.5 + 0.5;
        const b = nz * 0.5 + 0.5;
        if (invertX) r = 1 - r;
        if (invertY) gg = 1 - gg;
        const i = (y * w + x) * 4;
        img.data[i] = clamp(Math.round(r * 255), 0, 255);
        img.data[i + 1] = clamp(Math.round(gg * 255), 0, 255);
        img.data[i + 2] = clamp(Math.round(b * 255), 0, 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.normal.putImageData(img, 0, 0);
  }

  async function generate() {
    syncLabels();
    if (!state.textures.length) {
      setStatus('Add texture');
      return;
    }
    setStatus('Generating');
    await new Promise(requestAnimationFrame);
    const { w, h } = outputSize();
    const activeTextures = getSelectedTextures();
    if (activeTextures.length === 0) {
      setStatus('Select texture');
      return;
    }
    const previousTextures = state.textures;
    state.textures = activeTextures;
    const imageDatas = drawSourceTextures(w, h);
    state.textures = previousTextures;
    const hm = makeHeightMap(imageDatas, w, h);
    renderHeightPreview(hm, w, h);
    renderNormalMap(hm, w, h);
    els.statSize.textContent = `${w}×${h}`;
    els.downloadBtn.disabled = false;
    els.copyBtn.disabled = !navigator.clipboard || !window.ClipboardItem;
    els.statTextures.textContent = normalizeMultiMode(els.multiMode && els.multiMode.value) === 'combined'
      ? state.textures.length
      : activeTextures.length + ' / ' + state.textures.length;
    setStatus('Done');
  }

  function scheduleGenerate() {
    clearTimeout(state.debounce);
    state.debounce = setTimeout(generate, 140);
  }

  function download() {
    if (!state.textures.length) return;
    els.normalCanvas.toBlob(blob => {
      if (!blob) return;
      if (state.lastObjectUrl) URL.revokeObjectURL(state.lastObjectUrl);
      const ext = els.format.value === 'image/webp' ? 'webp' : 'png';
      const a = document.createElement('a');
      a.download = `normal-map-${els.normalCanvas.width}x${els.normalCanvas.height}.${ext}`;
      state.lastObjectUrl = URL.createObjectURL(blob);
      a.href = state.lastObjectUrl;
      a.click();
    }, els.format.value, 0.95);
  }
  function canvasToDataUrl(canvas, mimeType) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Export failed'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Export read failed'));
        reader.readAsDataURL(blob);
      }, mimeType || 'image/png', 0.95);
    });
  }

  async function describeCurrentAssets() {
    if (!state.textures.length) {
      if (state.loadingPromise) await state.loadingPromise;
    }
    if (!state.textures.length) return [];
    await generate();
    const mimeType = els.format.value === 'image/webp' ? 'image/webp' : 'image/png';
    const ext = mimeType === 'image/webp' ? 'webp' : 'png';
    const maps = [
      { canvas: els.normalCanvas, title: 'Normal Map', stem: 'normal-map', role: 'normal' },
      { canvas: els.heightCanvas, title: 'Height Map', stem: 'height-map', role: 'height' },
      { canvas: els.baseCanvas, title: 'Base Texture', stem: 'base-texture', role: 'base' }
    ];
    const descriptors = [];
    for (const map of maps) {
      if (!map.canvas.width || !map.canvas.height) continue;
      const dataUrl = await canvasToDataUrl(map.canvas, mimeType);
      descriptors.push({
        kind: 'image',
        title: map.title,
        fileName: `${map.stem}-${map.canvas.width}x${map.canvas.height}.${ext}`,
        mimeType,
        dataUrl,
        width: map.canvas.width,
        height: map.canvas.height,
        previewKind: 'image',
        previewUrl: dataUrl,
        sourceDetail: `${map.title} generated by Normal Map Maker.`,
        metadata: { sourceTool: 'normalmap-maker', mapRole: map.role }
      });
    }
    return descriptors;
  }

  function postDashboardMessage(type, requestId, payload) {
    window.parent.postMessage({
      source: 'urage-tool',
      type,
      requestId,
      payload: payload || {}
    }, '*');
  }

  async function exportNormalMapForDashboard(requestId) {
    try {
      if (!state.textures.length) {
        if (state.loadingPromise) {
          await state.loadingPromise;
        }
      }
      if (!state.textures.length) {
        throw new Error('Add a texture before exporting.');
      }
      await generate();
      const mimeType = els.format.value === 'image/webp' ? 'image/webp' : 'image/png';
      const ext = mimeType === 'image/webp' ? 'webp' : 'png';
      postDashboardMessage('tool:export-image', requestId, {
        dataUrl: await canvasToDataUrl(els.normalCanvas, mimeType),
        fileName: `normal-map-${els.normalCanvas.width}x${els.normalCanvas.height}.${ext}`,
        width: els.normalCanvas.width,
        height: els.normalCanvas.height
      });
    } catch (error) {
      postDashboardMessage('tool:error', requestId, {
        error: error && error.message ? error.message : 'Normal map export failed.'
      });
    }
  }

  async function copyPng() {
    if (!navigator.clipboard || !window.ClipboardItem) return;
    els.normalCanvas.toBlob(async blob => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setStatus('Copied');
        setTimeout(() => setStatus('Done'), 900);
      } catch (err) {
        console.error(err);
        setStatus('Copy failed');
      }
    }, 'image/png');
  }

  els.addBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', e => loadFiles(e.target.files));
  els.clearBtn.addEventListener('click', clearTextures);
  els.generateBtn.addEventListener('click', generate);
  els.downloadBtn.addEventListener('click', download);
  els.copyBtn.addEventListener('click', copyPng);
  els.sizeMode.addEventListener('change', () => { els.customSizeRow.hidden = els.sizeMode.value !== 'custom'; scheduleGenerate(); });
  els.multiMode.addEventListener('change', scheduleGenerate);
  els.strength.addEventListener('input', () => { els.strengthNum.value = Number(els.strength.value).toFixed(2); scheduleGenerate(); });
  els.strengthNum.addEventListener('input', () => { els.strength.value = clamp(Number(els.strengthNum.value) || 0, 0, 10); scheduleGenerate(); });

  ['heightSource','zDepth','kernel','blur','invertX','invertY','tile','normalizeTextures','customW','customH','format'].forEach(id => {
    els[id].addEventListener('input', scheduleGenerate);
    els[id].addEventListener('change', scheduleGenerate);
  });

  if (els.dropzone) {
    ['dragenter','dragover'].forEach(evt => els.dropzone.addEventListener(evt, e => { e.preventDefault(); els.dropzone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(evt => els.dropzone.addEventListener(evt, e => { e.preventDefault(); els.dropzone.classList.remove('dragover'); }));
    els.dropzone.addEventListener('drop', e => loadFiles(e.dataTransfer.files));
  }

  window.addEventListener('message', event => {
    const message = event && event.data ? event.data : null;
    if (!message || message.source !== 'urage-dashboard') return;
    if (message.type === 'tool:theme') {
      applyDashboardTheme(message.payload && message.payload.theme);
      return;
    }
    if (message.type === 'tool:request-export-image') {
      exportNormalMapForDashboard(message.requestId);
    }
  });
  if (typeof window.registerDashboardToolBridge === 'function') {
    window.registerDashboardToolBridge({
      onTheme: applyDashboardTheme,
      onLoadAsset: loadDashboardAsset,
      onExportImage: async () => {
        const descriptors = await describeCurrentAssets();
        const normalMap = descriptors.find(descriptor => descriptor.metadata?.mapRole === 'normal') || descriptors[0];
        if (!normalMap) throw new Error('Generate a normal map first.');
        return normalMap;
      },
      onDescribeCurrentAssets: describeCurrentAssets
    });
  }

  applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
  syncLabels();
  clearTextures();
})();
