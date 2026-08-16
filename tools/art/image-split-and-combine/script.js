(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const els = {
    splitTab: $('tab-split'), combineTab: $('tab-combine'),
    splitPanels: [...document.querySelectorAll('[data-mode-panel="split"]')],
    combinePanels: [...document.querySelectorAll('[data-mode-panel="combine"]')],
    splitUpload: $('texture-upload'), combineUpload: $('combine-upload'),
    splitStatus: $('split-status'), combineStatus: $('combine-status'),
    splitX: $('split-x'), splitY: $('split-y'), splitOffsetX: $('split-offset-x'), splitOffsetY: $('split-offset-y'), splitPadding: $('split-padding'), edgeOnly: $('padding-edge-only'), splitOutput: $('split-output'),
    splitBtn: $('split-btn'), downloadSplitsBtn: $('download-splits-btn'), previewSplitGifBtn: $('preview-split-gif-btn'), downloadSplitGifBtn: $('download-split-gif-btn'), downloadSplitFramesBtn: $('download-split-frames-btn'), splitFrameDelay: $('split-frame-delay'),
    combineCols: $('combine-cols'), combineRows: $('combine-rows'), combinePadding: $('combine-padding'), combineCellMode: $('combine-cell-mode'), combineOutput: $('combine-output'),
    combineBtn: $('combine-btn'), downloadCombinedBtn: $('download-combined-btn'), previewCombineGifBtn: $('preview-combine-gif-btn'), downloadCombineGifBtn: $('download-combine-gif-btn'), downloadCombineFramesBtn: $('download-combine-frames-btn'), clearCombineBtn: $('clear-combine-btn'), combineFrameDelay: $('combine-frame-delay'),
    combineQueueEmpty: $('combine-queue-empty'), combineQueueList: $('combine-queue-list'),
    splitGifPreviewPanel: $('split-gif-preview-panel'), splitGifPreview: $('split-gif-preview'), combineGifPreviewPanel: $('combine-gif-preview-panel'), combineGifPreview: $('combine-gif-preview'),
    texturePreview: $('texture-preview'), originalCanvas: $('original-canvas'), splitCanvas: $('split-canvas'), inputCanvas: $('input-canvas'), combinedCanvas: $('combined-canvas')
  };

  const ctx = {
    texturePreview: els.texturePreview.getContext('2d'),
    original: els.originalCanvas.getContext('2d'),
    split: els.splitCanvas.getContext('2d'),
    input: els.inputCanvas.getContext('2d'),
    combined: els.combinedCanvas.getContext('2d')
  };

  const state = {
    mode: 'split',
    splitImage: null,
    splitName: '',
    combineImages: [],
    splitGifPreviewUrl: '',
    combineGifPreviewUrl: ''
  };
  const splitPreviewMaxSize = 1024;

  function applyDashboardTheme(theme) {
    const allowed = new Set(['fire', 'water', 'nature', 'rock']);
    const nextTheme = allowed.has(String(theme || '').trim()) ? String(theme).trim() : 'fire';
    document.body.setAttribute('data-dashboard-theme', nextTheme);
  }

  function setMode(mode) {
    state.mode = mode === 'combine' ? 'combine' : 'split';
    const splitActive = state.mode === 'split';
    els.splitTab.classList.toggle('active', splitActive);
    els.combineTab.classList.toggle('active', !splitActive);
    els.splitTab.setAttribute('aria-selected', splitActive ? 'true' : 'false');
    els.combineTab.setAttribute('aria-selected', splitActive ? 'false' : 'true');
    els.splitPanels.forEach(panel => panel.classList.toggle('hidden', !splitActive));
    els.combinePanels.forEach(panel => panel.classList.toggle('hidden', splitActive));
  }

  function setCanvasSize(canvas, width, height) {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
  }
  function getPreviewDimensions(width, height, maxSize) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);
    const limit = Math.max(64, Number(maxSize) || 1024);
    const scale = Math.min(1, limit / Math.max(safeWidth, safeHeight));
    return {
      width: Math.max(1, Math.round(safeWidth * scale)),
      height: Math.max(1, Math.round(safeHeight * scale)),
      scale
    };
  }

  function clearCanvas(context, canvas) {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = String(event.target?.result || '');
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  function downloadDataUrl(fileName, dataUrl) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  function downloadBytes(fileName, bytes, mimeType) {
    const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function extensionForFormat(format) {
    return format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png';
  }

  function mimeTypeForFormat(format) {
    return format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  }

  function getFrameDelay(input) {
    return Math.max(20, Number.parseInt(String(input?.value || '140'), 10) || 140);
  }

  function createFrameCanvas(width, height) {
    const canvas = document.createElement('canvas');
    setCanvasSize(canvas, width, height);
    return canvas;
  }

  function renderFramesToGifBlob(frames, delay) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(frames) || frames.length === 0) {
        reject(new Error('No frames are available for GIF export.'));
        return;
      }
      if (typeof window.GIF !== 'function') {
        reject(new Error('GIF renderer is not available.'));
        return;
      }
      const width = Math.max(...frames.map(frame => frame.width || 1));
      const height = Math.max(...frames.map(frame => frame.height || 1));
      const gif = new window.GIF({
        workers: 2,
        quality: 10,
        width,
        height,
        repeat: 0,
        workerScript: '/tools/art/spritesheet-utility/vendor/gif.worker.js',
        background: '#00000000'
      });
      frames.forEach(frame => {
        gif.addFrame(frame, { delay });
      });
      gif.on('finished', blob => resolve(blob));
      gif.on('abort', () => reject(new Error('GIF export was aborted.')));
      gif.render();
    });
  }

  function getSplitBaseName() {
    const rawName = String(state.splitName || 'split-image').trim();
    return rawName.replace(/\.[a-z0-9]+$/i, '') || 'split-image';
  }

  function getSplitSettings() {
    return {
      cols: Math.max(1, Number.parseInt(String(els.splitX.value || '1'), 10) || 1),
      rows: Math.max(1, Number.parseInt(String(els.splitY.value || '1'), 10) || 1),
      offsetX: Math.max(0, Number.parseInt(String(els.splitOffsetX.value || '0'), 10) || 0),
      offsetY: Math.max(0, Number.parseInt(String(els.splitOffsetY.value || '0'), 10) || 0),
      padding: Math.max(0, Number.parseInt(String(els.splitPadding.value || '0'), 10) || 0),
      edgeOnly: els.edgeOnly.checked === true
    };
  }

  function revokePreviewUrl(stateKey) {
    const currentUrl = String(state[stateKey] || '');
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      state[stateKey] = '';
    }
  }

  function resetGifPreview(panelNode, imageNode, stateKey) {
    revokePreviewUrl(stateKey);
    if (imageNode) {
      imageNode.removeAttribute('src');
    }
    if (panelNode) {
      panelNode.classList.add('hidden');
    }
  }

  function showGifPreview(panelNode, imageNode, blob, stateKey) {
    if (!panelNode || !imageNode || !blob) {
      return;
    }
    resetGifPreview(panelNode, imageNode, stateKey);
    const nextUrl = URL.createObjectURL(blob);
    state[stateKey] = nextUrl;
    imageNode.src = nextUrl;
    panelNode.classList.remove('hidden');
  }

  function drawSplitPreview() {
    if (!state.splitImage) {
      clearCanvas(ctx.split, els.splitCanvas);
      els.splitStatus.textContent = 'Waiting for source image.';
      return;
    }

    const { cols, rows, offsetX, offsetY, padding, edgeOnly } = getSplitSettings();
    const imageWidth = state.splitImage.naturalWidth;
    const imageHeight = state.splitImage.naturalHeight;
    const preview = getPreviewDimensions(imageWidth, imageHeight, splitPreviewMaxSize);
    const previewOffsetX = offsetX * preview.scale;
    const previewOffsetY = offsetY * preview.scale;
    const previewPadding = padding * preview.scale;
    const totalWidth = Math.max(1, imageWidth - offsetX);
    const totalHeight = Math.max(1, imageHeight - offsetY);
    const previewTotalWidth = Math.max(1, preview.width - previewOffsetX);
    const previewTotalHeight = Math.max(1, preview.height - previewOffsetY);
    const drawCellWidth = edgeOnly ? previewTotalWidth / cols : (previewTotalWidth - (cols + 1) * previewPadding) / cols;
    const drawCellHeight = edgeOnly ? previewTotalHeight / rows : (previewTotalHeight - (rows + 1) * previewPadding) / rows;

    setCanvasSize(els.splitCanvas, preview.width, preview.height);
    clearCanvas(ctx.split, els.splitCanvas);
    ctx.split.drawImage(state.splitImage, 0, 0, preview.width, preview.height);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const dx = edgeOnly ? previewPadding + col * drawCellWidth : previewPadding + col * (drawCellWidth + previewPadding);
        const dy = edgeOnly ? previewPadding + row * drawCellHeight : previewPadding + row * (drawCellHeight + previewPadding);
        ctx.split.strokeStyle = 'rgba(255,255,255,0.24)';
        ctx.split.lineWidth = 2;
        ctx.split.strokeRect(dx, dy, drawCellWidth, drawCellHeight);
      }
    }

    els.splitStatus.textContent = `${cols * rows} tiles previewed from ${imageWidth} × ${imageHeight}.`;
  }

  function buildSplitPreviewCanvas() {
    if (!state.splitImage) {
      return null;
    }
    const { cols, rows, offsetX, offsetY, padding, edgeOnly } = getSplitSettings();
    const imageWidth = state.splitImage.naturalWidth;
    const imageHeight = state.splitImage.naturalHeight;
    const totalWidth = Math.max(1, imageWidth - offsetX);
    const totalHeight = Math.max(1, imageHeight - offsetY);
    const drawCellWidth = edgeOnly ? totalWidth / cols : (totalWidth - (cols + 1) * padding) / cols;
    const drawCellHeight = edgeOnly ? totalHeight / rows : (totalHeight - (rows + 1) * padding) / rows;
    const canvas = createFrameCanvas(imageWidth, imageHeight);
    const context = canvas.getContext('2d');
    context.drawImage(state.splitImage, 0, 0, imageWidth, imageHeight);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const dx = edgeOnly ? padding + col * drawCellWidth : padding + col * (drawCellWidth + padding);
        const dy = edgeOnly ? padding + row * drawCellHeight : padding + row * (drawCellHeight + padding);
        context.strokeStyle = 'rgba(255,255,255,0.24)';
        context.lineWidth = 2;
        context.strokeRect(dx, dy, drawCellWidth, drawCellHeight);
      }
    }
    return canvas;
  }

  async function applySplitFile(file) {
    if (!file || !(file.type || '').startsWith('image/')) {
      return;
    }
    resetGifPreview(els.splitGifPreviewPanel, els.splitGifPreview, 'splitGifPreviewUrl');
    const image = await loadImageFromFile(file);
    state.splitImage = image;
    state.splitName = file.name || 'split-image.png';
    const preview = getPreviewDimensions(image.naturalWidth, image.naturalHeight, splitPreviewMaxSize);
    setCanvasSize(els.texturePreview, preview.width, preview.height);
    setCanvasSize(els.originalCanvas, preview.width, preview.height);
    ctx.texturePreview.clearRect(0, 0, els.texturePreview.width, els.texturePreview.height);
    ctx.original.clearRect(0, 0, els.originalCanvas.width, els.originalCanvas.height);
    ctx.texturePreview.drawImage(image, 0, 0, preview.width, preview.height);
    ctx.original.drawImage(image, 0, 0, preview.width, preview.height);
    drawSplitPreview();
  }

  async function exportSplitImages() {
    if (!state.splitImage) {
      alert('Upload a source image first.');
      return;
    }
    const { cols, rows, offsetX, offsetY } = getSplitSettings();
    const format = String(els.splitOutput.value || 'png');
    const ext = extensionForFormat(format);
    const mimeType = mimeTypeForFormat(format);
    const baseName = getSplitBaseName();
    const sourceWidth = state.splitImage.naturalWidth;
    const sourceHeight = state.splitImage.naturalHeight;
    const tileWidth = Math.max(1, Math.floor((sourceWidth - offsetX) / cols));
    const tileHeight = Math.max(1, Math.floor((sourceHeight - offsetY) / rows));
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    exportCanvas.width = tileWidth;
    exportCanvas.height = tileHeight;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        exportCtx.clearRect(0, 0, tileWidth, tileHeight);
        exportCtx.drawImage(
          state.splitImage,
          offsetX + col * tileWidth,
          offsetY + row * tileHeight,
          tileWidth,
          tileHeight,
          0,
          0,
          tileWidth,
          tileHeight
        );
        downloadDataUrl(`${baseName}-${row + 1}-${col + 1}.${ext}`, exportCanvas.toDataURL(mimeType, 0.95));
      }
    }
  }

  function buildSplitFrameCanvases() {
    if (!state.splitImage) {
      return [];
    }
    const { cols, rows, offsetX, offsetY } = getSplitSettings();
    const sourceWidth = state.splitImage.naturalWidth;
    const sourceHeight = state.splitImage.naturalHeight;
    const tileWidth = Math.max(1, Math.floor((sourceWidth - offsetX) / cols));
    const tileHeight = Math.max(1, Math.floor((sourceHeight - offsetY) / rows));
    const frames = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const frameCanvas = createFrameCanvas(tileWidth, tileHeight);
        const frameCtx = frameCanvas.getContext('2d');
        frameCtx.clearRect(0, 0, tileWidth, tileHeight);
        frameCtx.drawImage(
          state.splitImage,
          offsetX + col * tileWidth,
          offsetY + row * tileHeight,
          tileWidth,
          tileHeight,
          0,
          0,
          tileWidth,
          tileHeight
        );
        frames.push(frameCanvas);
      }
    }
    return frames;
  }

  async function exportSplitGif() {
    const frames = buildSplitFrameCanvases();
    if (frames.length === 0) {
      alert('Upload and split an image first.');
      return;
    }
    const blob = await renderFramesToGifBlob(frames, getFrameDelay(els.splitFrameDelay));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    downloadBytes(`${getSplitBaseName()}-split.gif`, bytes, 'image/gif');
  }

  async function previewSplitGif() {
    const frames = buildSplitFrameCanvases();
    if (frames.length === 0) {
      alert('Upload and split an image first.');
      return;
    }
    const blob = await renderFramesToGifBlob(frames, getFrameDelay(els.splitFrameDelay));
    showGifPreview(els.splitGifPreviewPanel, els.splitGifPreview, blob, 'splitGifPreviewUrl');
  }

  async function exportSplitFrames() {
    const frames = buildSplitFrameCanvases();
    if (frames.length === 0) {
      alert('Upload and split an image first.');
      return;
    }
    const baseName = getSplitBaseName();
    frames.forEach((canvas, index) => {
      downloadDataUrl(`${baseName}-frame-${String(index + 1).padStart(3, '0')}.png`, canvas.toDataURL('image/png'));
    });
  }

  function renderCombineQueue() {
    const hasImages = state.combineImages.length > 0;
    els.combineQueueEmpty.classList.toggle('hidden', hasImages);
    els.combineQueueList.classList.toggle('hidden', !hasImages);
    if (!hasImages) {
      els.combineQueueList.innerHTML = '';
      return;
    }
    els.combineQueueList.innerHTML = '';
    state.combineImages.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'combine-queue-item';
      row.innerHTML = `<img class="combine-queue-thumb" src="${entry.url}" alt=""><div class="combine-queue-meta"><div class="combine-queue-name">${entry.name}</div><div class="combine-queue-detail">${entry.image.naturalWidth} × ${entry.image.naturalHeight}</div></div>`;
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        URL.revokeObjectURL(entry.url);
        state.combineImages.splice(index, 1);
        renderCombineQueue();
        drawCombinePreview();
      });
      row.appendChild(removeButton);
      els.combineQueueList.appendChild(row);
    });
  }

  function getCombineSettings() {
    return {
      cols: Math.max(1, Number.parseInt(String(els.combineCols.value || '1'), 10) || 1),
      rows: Math.max(1, Number.parseInt(String(els.combineRows.value || '1'), 10) || 1),
      padding: Math.max(0, Number.parseInt(String(els.combinePadding.value || '0'), 10) || 0),
      cellMode: String(els.combineCellMode.value || 'largest')
    };
  }

  function getCombineCellSize(images, settings) {
    if (!images.length) {
      return { width: 300, height: 300 };
    }
    if (settings.cellMode === 'first') {
      return { width: images[0].image.naturalWidth, height: images[0].image.naturalHeight };
    }
    return images.reduce((acc, entry) => ({
      width: Math.max(acc.width, entry.image.naturalWidth),
      height: Math.max(acc.height, entry.image.naturalHeight)
    }), { width: 1, height: 1 });
  }

  function buildCombineResultCanvas(images) {
    const settings = getCombineSettings();
    const cell = getCombineCellSize(images, settings);
    const outputWidth = settings.cols * cell.width + Math.max(0, settings.cols - 1) * settings.padding;
    const outputHeight = settings.rows * cell.height + Math.max(0, settings.rows - 1) * settings.padding;
    const canvas = createFrameCanvas(outputWidth, outputHeight);
    const context = canvas.getContext('2d');
    images.slice(0, settings.cols * settings.rows).forEach((entry, index) => {
      const col = index % settings.cols;
      const row = Math.floor(index / settings.cols);
      const dx = col * (cell.width + settings.padding);
      const dy = row * (cell.height + settings.padding);
      const scale = Math.min(cell.width / entry.image.naturalWidth, cell.height / entry.image.naturalHeight);
      const drawWidth = Math.max(1, Math.round(entry.image.naturalWidth * scale));
      const drawHeight = Math.max(1, Math.round(entry.image.naturalHeight * scale));
      const drawX = dx + Math.round((cell.width - drawWidth) / 2);
      const drawY = dy + Math.round((cell.height - drawHeight) / 2);
      context.drawImage(entry.image, drawX, drawY, drawWidth, drawHeight);
      context.strokeStyle = 'rgba(255,255,255,0.22)';
      context.lineWidth = 2;
      context.strokeRect(dx, dy, cell.width, cell.height);
    });
    return canvas;
  }

  function drawCombineInputStrip(images) {
    if (!images.length) {
      setCanvasSize(els.inputCanvas, 300, 300);
      clearCanvas(ctx.input, els.inputCanvas);
      return;
    }
    const maxHeight = Math.max(...images.map(entry => entry.image.naturalHeight));
    const totalWidth = images.reduce((sum, entry) => sum + entry.image.naturalWidth, 0);
    const preview = getPreviewDimensions(totalWidth, maxHeight, splitPreviewMaxSize);
    setCanvasSize(els.inputCanvas, preview.width, preview.height);
    clearCanvas(ctx.input, els.inputCanvas);
    let cursorX = 0;
    images.forEach(entry => {
      const drawWidth = Math.max(1, Math.round(entry.image.naturalWidth * preview.scale));
      const drawHeight = Math.max(1, Math.round(entry.image.naturalHeight * preview.scale));
      const drawY = Math.round((preview.height - drawHeight) / 2);
      ctx.input.drawImage(entry.image, cursorX, drawY, drawWidth, drawHeight);
      cursorX += drawWidth;
    });
  }

  function drawCombinePreview() {
    const images = state.combineImages.slice();
    drawCombineInputStrip(images);
    if (!images.length) {
      setCanvasSize(els.combinedCanvas, 300, 300);
      clearCanvas(ctx.combined, els.combinedCanvas);
      els.combineStatus.textContent = 'Add source images to build an atlas.';
      return;
    }

    const settings = getCombineSettings();
    const cell = getCombineCellSize(images, settings);
    const outputWidth = settings.cols * cell.width + Math.max(0, settings.cols - 1) * settings.padding;
    const outputHeight = settings.rows * cell.height + Math.max(0, settings.rows - 1) * settings.padding;
    const preview = getPreviewDimensions(outputWidth, outputHeight, splitPreviewMaxSize);
    setCanvasSize(els.combinedCanvas, preview.width, preview.height);
    clearCanvas(ctx.combined, els.combinedCanvas);

    images.slice(0, settings.cols * settings.rows).forEach((entry, index) => {
      const col = index % settings.cols;
      const row = Math.floor(index / settings.cols);
      const dx = (col * (cell.width + settings.padding)) * preview.scale;
      const dy = (row * (cell.height + settings.padding)) * preview.scale;
      const scale = Math.min(cell.width / entry.image.naturalWidth, cell.height / entry.image.naturalHeight);
      const drawWidth = Math.max(1, Math.round(entry.image.naturalWidth * scale * preview.scale));
      const drawHeight = Math.max(1, Math.round(entry.image.naturalHeight * scale * preview.scale));
      const drawX = dx + Math.round(((cell.width * preview.scale) - drawWidth) / 2);
      const drawY = dy + Math.round(((cell.height * preview.scale) - drawHeight) / 2);
      ctx.combined.drawImage(entry.image, drawX, drawY, drawWidth, drawHeight);
      ctx.combined.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.combined.lineWidth = 2;
      ctx.combined.strokeRect(dx, dy, cell.width * preview.scale, cell.height * preview.scale);
    });

    const used = Math.min(images.length, settings.cols * settings.rows);
    els.combineStatus.textContent = `${used} images placed into ${settings.cols} × ${settings.rows}.`;
  }

  function buildCombineFrameCanvases() {
    const images = state.combineImages.slice();
    if (!images.length) {
      return [];
    }
    const settings = getCombineSettings();
    const cell = getCombineCellSize(images, settings);
    return images.map(entry => {
      const frameCanvas = createFrameCanvas(cell.width, cell.height);
      const frameCtx = frameCanvas.getContext('2d');
      frameCtx.clearRect(0, 0, cell.width, cell.height);
      const scale = Math.min(cell.width / entry.image.naturalWidth, cell.height / entry.image.naturalHeight);
      const drawWidth = Math.max(1, Math.round(entry.image.naturalWidth * scale));
      const drawHeight = Math.max(1, Math.round(entry.image.naturalHeight * scale));
      const drawX = Math.round((cell.width - drawWidth) / 2);
      const drawY = Math.round((cell.height - drawHeight) / 2);
      frameCtx.drawImage(entry.image, drawX, drawY, drawWidth, drawHeight);
      return frameCanvas;
    });
  }

  async function exportCombineGif() {
    const frames = buildCombineFrameCanvases();
    if (frames.length === 0) {
      alert('Add images to the queue first.');
      return;
    }
    const blob = await renderFramesToGifBlob(frames, getFrameDelay(els.combineFrameDelay));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    downloadBytes('combined-queue.gif', bytes, 'image/gif');
  }

  async function previewCombineGif() {
    const frames = buildCombineFrameCanvases();
    if (frames.length === 0) {
      alert('Add images to the queue first.');
      return;
    }
    const blob = await renderFramesToGifBlob(frames, getFrameDelay(els.combineFrameDelay));
    showGifPreview(els.combineGifPreviewPanel, els.combineGifPreview, blob, 'combineGifPreviewUrl');
  }

  async function exportCombineFrames() {
    const frames = buildCombineFrameCanvases();
    if (frames.length === 0) {
      alert('Add images to the queue first.');
      return;
    }
    frames.forEach((canvas, index) => {
      downloadDataUrl(`combine-frame-${String(index + 1).padStart(3, '0')}.png`, canvas.toDataURL('image/png'));
    });
  }

  async function addCombineFiles(fileList) {
    resetGifPreview(els.combineGifPreviewPanel, els.combineGifPreview, 'combineGifPreviewUrl');
    const files = Array.from(fileList || []).filter(file => (file.type || '').startsWith('image/'));
    for (const file of files) {
      const image = await loadImageFromFile(file);
      state.combineImages.push({
        id: crypto.randomUUID(),
        name: file.name || 'combine-image.png',
        image,
        url: URL.createObjectURL(file)
      });
    }
    renderCombineQueue();
    drawCombinePreview();
  }
  async function fetchDashboardAssetBlob(payload) {
    const dataUrl = String(payload?.dataUrl || '').trim();
    if (/^data:image\//i.test(dataUrl)) {
      const response = await fetch(dataUrl);
      if (!response.ok) {
        throw new Error('Failed to decode dashboard image payload.');
      }
      return await response.blob();
    }
    const imageUrl = String(payload?.imageUrl || payload?.previewImageUrl || '').trim();
    if (!imageUrl) {
      throw new Error('No dashboard image payload was provided.');
    }
    const response = await fetch(imageUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load dashboard image (${response.status}).`);
    }
    return await response.blob();
  }
  async function loadDashboardImagePayload(payload) {
    const blob = await fetchDashboardAssetBlob(payload);
    const fileName = String(payload?.imageFileName || payload?.fileName || payload?.previewFileName || 'dashboard-image.png').trim() || 'dashboard-image.png';
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    if (state.mode === 'combine') {
      await addCombineFiles([file]);
      els.combineStatus.textContent = `Loaded ${file.name} from dashboard into the queue.`;
      return;
    }
    await applySplitFile(file);
    els.splitStatus.textContent = `Loaded ${file.name} from dashboard.`;
  }
  window.__imageSplitAndCombineLoadAssetPayload = loadDashboardImagePayload;

  function clearCombineImages() {
    resetGifPreview(els.combineGifPreviewPanel, els.combineGifPreview, 'combineGifPreviewUrl');
    state.combineImages.forEach(entry => URL.revokeObjectURL(entry.url));
    state.combineImages = [];
    renderCombineQueue();
    drawCombinePreview();
  }

  function downloadCombinedImage() {
    if (!state.combineImages.length) {
      alert('Add images to combine first.');
      return;
    }
    const format = String(els.combineOutput.value || 'png');
    const ext = extensionForFormat(format);
    const mimeType = mimeTypeForFormat(format);
    const canvas = buildCombineResultCanvas(state.combineImages.slice());
    downloadDataUrl(`combined-atlas.${ext}`, canvas.toDataURL(mimeType, 0.95));
  }

  async function handlePaste(event) {
    const items = Array.from(event.clipboardData?.items || []);
    const imageFiles = items.filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
    if (!imageFiles.length) {
      return;
    }
    event.preventDefault();
    if (state.mode === 'combine') {
      await addCombineFiles(imageFiles);
      return;
    }
    await applySplitFile(imageFiles[0]);
  }

  function bindSplitControls() {
    els.splitUpload.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      await applySplitFile(file);
    });
    els.splitBtn.addEventListener('click', drawSplitPreview);
    els.downloadSplitsBtn.addEventListener('click', () => {
      void exportSplitImages();
    });
    els.previewSplitGifBtn.addEventListener('click', () => {
      void previewSplitGif();
    });
    els.downloadSplitGifBtn.addEventListener('click', () => {
      void exportSplitGif();
    });
    els.downloadSplitFramesBtn.addEventListener('click', () => {
      void exportSplitFrames();
    });
    [els.splitX, els.splitY, els.splitOffsetX, els.splitOffsetY, els.splitPadding, els.edgeOnly].forEach(node => {
      const handlePreviewRefresh = () => {
        resetGifPreview(els.splitGifPreviewPanel, els.splitGifPreview, 'splitGifPreviewUrl');
        drawSplitPreview();
      };
      node.addEventListener('input', handlePreviewRefresh);
      node.addEventListener('change', handlePreviewRefresh);
    });
  }

  function bindCombineControls() {
    els.combineUpload.addEventListener('change', async event => {
      await addCombineFiles(event.target.files);
      event.target.value = '';
    });
    els.combineBtn.addEventListener('click', drawCombinePreview);
    els.downloadCombinedBtn.addEventListener('click', downloadCombinedImage);
    els.previewCombineGifBtn.addEventListener('click', () => {
      void previewCombineGif();
    });
    els.downloadCombineGifBtn.addEventListener('click', () => {
      void exportCombineGif();
    });
    els.downloadCombineFramesBtn.addEventListener('click', () => {
      void exportCombineFrames();
    });
    els.clearCombineBtn.addEventListener('click', clearCombineImages);
    [els.combineCols, els.combineRows, els.combinePadding, els.combineCellMode].forEach(node => {
      const handlePreviewRefresh = () => {
        resetGifPreview(els.combineGifPreviewPanel, els.combineGifPreview, 'combineGifPreviewUrl');
        drawCombinePreview();
      };
      node.addEventListener('input', handlePreviewRefresh);
      node.addEventListener('change', handlePreviewRefresh);
    });
  }

  function bindTabs() {
    els.splitTab.addEventListener('click', () => setMode('split'));
    els.combineTab.addEventListener('click', () => setMode('combine'));
  }

  function bindDashboardTheme() {
    if (typeof window.registerDashboardThemeSync === 'function') {
      window.registerDashboardThemeSync(themeName => applyDashboardTheme(themeName));
      return;
    }
    window.addEventListener('message', event => {
      const message = event?.data || null;
      if (!message || message.source !== 'urage-dashboard') {
        return;
      }
      if (message.type === 'tool:theme') {
        applyDashboardTheme(message.payload?.theme);
      }
    });
  }

  function postDashboardMessage(type, payload, requestId) {
    if (!window.parent || window.parent === window) {
      return;
    }
    window.parent.postMessage({
      source: 'urage-tool',
      type,
      requestId: requestId || '',
      payload: payload || {}
    }, '*');
  }

  function getProcessedCanvasForCurrentMode() {
    if (state.mode === 'combine') {
      return state.combineImages.length > 0 ? buildCombineResultCanvas(state.combineImages.slice()) : null;
    }
    return state.splitImage ? buildSplitPreviewCanvas() : null;
  }

  function getProcessedFileNameForCurrentMode() {
    if (state.mode === 'combine') {
      return 'combined-atlas.png';
    }
    return `${getSplitBaseName()}-split-preview.png`;
  }

  function exportProcessedImageToDashboard(requestId) {
    const canvas = getProcessedCanvasForCurrentMode();
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      postDashboardMessage('tool:error', {
        error: 'This tool has no processed image ready yet.'
      }, requestId);
      return;
    }
    postDashboardMessage('tool:export-image', {
      kind: 'image',
      dataUrl: canvas.toDataURL('image/png'),
      fileName: getProcessedFileNameForCurrentMode(),
      width: canvas.width,
      height: canvas.height,
      sourceToolMode: state.mode
    }, requestId);
  }

  function describeCurrentAssets() {
    if (state.mode === 'split') {
      const { cols } = getSplitSettings();
      const frames = buildSplitFrameCanvases();
      const baseName = getSplitBaseName();
      return frames.map((canvas, index) => {
        const row = Math.floor(index / cols) + 1;
        const col = index % cols + 1;
        const fileName = `${baseName}-split-${row}-${col}.png`;
        const dataUrl = canvas.toDataURL('image/png');
        return {
          kind: 'image',
          title: `Split ${index + 1} of ${frames.length}`,
          fileName,
          mimeType: 'image/png',
          dataUrl,
          width: canvas.width,
          height: canvas.height,
          previewKind: 'image',
          previewUrl: dataUrl,
          sourceDetail: `Split output ${index + 1} of ${frames.length} (row ${row}, column ${col}).`,
          metadata: {
            sourceTool: 'image-split-and-combine',
            mode: 'split',
            splitIndex: index + 1,
            splitRow: row,
            splitColumn: col
          }
        };
      });
    }
    const canvas = getProcessedCanvasForCurrentMode();
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      return [];
    }
    const fileName = getProcessedFileNameForCurrentMode();
    const dataUrl = canvas.toDataURL('image/png');
    return [{
      kind: 'image',
      title: 'Combined Atlas',
      fileName,
      mimeType: 'image/png',
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      previewKind: 'image',
      previewUrl: dataUrl,
      sourceDetail: 'Combined atlas from Image Split + Combine.',
      metadata: {
        sourceTool: 'image-split-and-combine',
        mode: state.mode
      }
    }];
  }

  function bindDashboardToolMessages() {
    window.addEventListener('message', event => {
      const message = event?.data || null;
      if (!message || message.source !== 'urage-dashboard') {
        return;
      }
      if (message.type === 'tool:load-asset') {
        void loadDashboardImagePayload(message.payload).catch(error => {
          const detail = error instanceof Error ? error.message : 'Failed to load dashboard image.';
          if (state.mode === 'combine') {
            els.combineStatus.textContent = detail;
          } else {
            els.splitStatus.textContent = detail;
          }
        });
        return;
      }
      if (message.type === 'tool:request-export-image') {
        exportProcessedImageToDashboard(String(message.requestId || '').trim());
      }
    });
  }

  window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
  window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;

  function init() {
    applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
    resetGifPreview(els.splitGifPreviewPanel, els.splitGifPreview, 'splitGifPreviewUrl');
    resetGifPreview(els.combineGifPreviewPanel, els.combineGifPreview, 'combineGifPreviewUrl');
    bindTabs();
    bindSplitControls();
    bindCombineControls();
    bindDashboardTheme();
    bindDashboardToolMessages();
    document.addEventListener('paste', event => {
      void handlePaste(event);
    });
    setMode('split');
    drawSplitPreview();
    drawCombinePreview();
  }

  init();
})();
