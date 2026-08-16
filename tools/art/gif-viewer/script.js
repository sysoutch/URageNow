class Html5GifVideoPlayer {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#gifCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.timeline = root.querySelector('#frameTimeline');

    this.fileInput = root.querySelector('#gifFile');
    this.downloadGifButton = root.querySelector('#downloadGif');
    this.downloadFramesButton = root.querySelector('#downloadFrames');

    this.playPauseButton = root.querySelector('#playPause');
    this.restartButton = root.querySelector('#restart');
    this.scrubber = root.querySelector('#scrubber');
    this.speedSelect = root.querySelector('#speed');
    this.pingpongInput = root.querySelector('#pingpong');
    this.flipFramesButton = root.querySelector('#flipFrames');
    this.mirrorFramesButton = root.querySelector('#mirrorFrames');
    this.mirrorPositionSelect = root.querySelector('#mirrorPosition');

    this.startFrameInput = root.querySelector('#startFrame');
    this.endFrameInput = root.querySelector('#endFrame');
    this.setStartButton = root.querySelector('#setStart');
    this.setEndButton = root.querySelector('#setEnd');
    this.clearMarkersButton = root.querySelector('#clearMarkers');
    this.meta = root.querySelector('#gifMeta');

    this.frames = [];
    this.originalFile = null;
    this.sourceFrameCount = 0;
    this.frameIndex = 0;
    this.startFrame = 0;
    this.endFrame = 0;
    this.playing = false;
    this.direction = 1;
    this.playbackSpeed = 1;
    this.accumulator = 0;
    this.lastTimestamp = 0;
    this.raf = null;
    this.loadToken = 0;
    this.timelineIndexes = [];
    this.activeThumb = null;
    this.frameMemoryBudgetRatio = 0.08;
    this.minFrameMemoryBudget = 128 * 1024 * 1024;
    this.maxFrameMemoryBudget = 768 * 1024 * 1024;
    this.maxTimelineThumbs = 240;
    this.decodeYieldEvery = 12;

    this.bind();
  }

  bind() {
    this.fileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file) await this.load(file);
    });

    this.downloadGifButton.addEventListener('click', () => this.downloadGif());
    this.downloadFramesButton.addEventListener('click', () => this.downloadFrames());

    this.playPauseButton.addEventListener('click', () => {
      this.playing ? this.pause() : this.play();
    });

    this.restartButton.addEventListener('click', () => {
      this.direction = 1;
      this.goto(this.startFrame);
      this.play();
    });

    this.scrubber.addEventListener('input', () => {
      this.pause();
      this.goto(Number(this.scrubber.value));
    });

    this.speedSelect.addEventListener('change', () => {
      this.playbackSpeed = Number(this.speedSelect.value) || 1;
    });
    this.pingpongInput.addEventListener('change', () => {
      this.direction = 1;
    });

    this.flipFramesButton.addEventListener('click', () => {
      if (!this.frames.length) return;

      this.frames.reverse();

      const newStart = this.frames.length - 1 - this.endFrame;
      const newEnd = this.frames.length - 1 - this.startFrame;
      const newIndex = this.frames.length - 1 - this.frameIndex;

      this.buildTimeline();
      this.setMarkers(newStart, newEnd);
      this.goto(newIndex);
    });

    this.mirrorFramesButton.addEventListener('click', () => {
      this.mirrorFrames(this.mirrorPositionSelect.value);
    });

    this.setStartButton.addEventListener('click', () => this.setMarkers(this.frameIndex, this.endFrame));
    this.setEndButton.addEventListener('click', () => this.setMarkers(this.startFrame, this.frameIndex));
    this.clearMarkersButton.addEventListener('click', () => this.setMarkers(0, this.frames.length - 1));

    this.startFrameInput.addEventListener('change', () => this.setMarkers(Number(this.startFrameInput.value), this.endFrame));
    this.endFrameInput.addEventListener('change', () => this.setMarkers(this.startFrame, Number(this.endFrameInput.value)));
    window.addEventListener('message', (event) => this.handleDashboardMessage(event));

    const wheelHandler = (event) => {
      if (!this.frames.length) return;
      event.preventDefault();
      this.pause();
      this.goto(this.frameIndex + (event.deltaY > 0 ? 1 : -1));
    };

    this.canvas.addEventListener('wheel', wheelHandler, { passive: false });
    this.timeline.addEventListener('wheel', wheelHandler, { passive: false });

    window.addEventListener('keydown', (event) => {
      if (!this.frames.length) return;

      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.pause();
        this.goto(this.frameIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.pause();
        this.goto(this.frameIndex + 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        this.pause();
        this.goto(this.startFrame);
      } else if (event.key === 'End') {
        event.preventDefault();
        this.pause();
        this.goto(this.endFrame);
      } else if (event.key === ' ') {
        event.preventDefault();
        this.playing ? this.pause() : this.play();
      }
    });
  }

  handleDashboardMessage(event) {
    const message = event?.data || {};
    if (message.source !== 'urage-dashboard' || message.type !== 'tool:load-asset') {
      return;
    }
    this.loadDashboardAsset(message.payload || {});
  }

  async loadDashboardAsset(payload) {
    const sourceUrl = String(payload.url || payload.imageUrl || payload.previewImageUrl || payload.dataUrl || '').trim();
    if (!sourceUrl) {
      this.setStatus('GIF Viewer needs a .gif file.');
      return;
    }
    if (!this.isGifLikeSource(sourceUrl, payload.fileName || payload.imageFileName || payload.previewFileName)) {
      this.setStatus('GIF Viewer accepts animated .gif files only.');
      return;
    }
    try {
      const response = await fetch(sourceUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const fileName = String(payload.fileName || payload.imageFileName || payload.previewFileName || 'dashboard.gif').trim() || 'dashboard.gif';
      await this.load(new File([blob], fileName, { type: blob.type || 'image/gif' }));
    } catch (error) {
      console.error(error);
      this.setStatus('Could not load dashboard GIF.');
    }
  }

  async load(file) {
    if (!('ImageDecoder' in window)) {
      alert('ImageDecoder API required. Use Chrome or Edge.');
      return;
    }
    if (!this.isGifFile(file)) {
      this.setStatus('Open an animated .gif file.');
      return;
    }

    const loadToken = this.loadToken + 1;
    this.loadToken = loadToken;
    this.disposeFrames();
    this.originalFile = file;
    this.root.classList.add('is-loading');
    this.setStatus(`Loading ${file.name || 'GIF'}...`);

    let decoder = null;

    try {
      const buffer = await file.arrayBuffer();
      decoder = new ImageDecoder({ data: buffer, type: file.type || 'image/gif' });
      await decoder.tracks.ready;

      const sourceFrameCount = this.getDecoderFrameCount(decoder);
      this.sourceFrameCount = sourceFrameCount;
      let frameLimit = sourceFrameCount;

      for (let i = 0; i < sourceFrameCount; i += 1) {
        if (this.loadToken !== loadToken) {
          return;
        }

        const result = await decoder.decode({ frameIndex: i });
        const delay = Math.max(20, (result.image.duration || 100000) / 1000);
        let bitmap = null;
        try {
          bitmap = await createImageBitmap(result.image);
        } finally {
          result.image.close();
        }
        if (this.loadToken !== loadToken) {
          if (bitmap && typeof bitmap.close === 'function') bitmap.close();
          return;
        }

        if (this.frames.length === 0) {
          frameLimit = this.getDecodeFrameLimit(bitmap.width, bitmap.height, sourceFrameCount);
          this.canvas.width = bitmap.width;
          this.canvas.height = bitmap.height;
        }

        this.frames.push({ bitmap, delay });

        if (this.frames.length >= frameLimit) {
          break;
        }
        if (i % this.decodeYieldEvery === this.decodeYieldEvery - 1) {
          this.setStatus(`Decoded ${this.frames.length}/${sourceFrameCount} frames...`);
          await this.nextPaint();
        }
      }

      if (!this.frames.length) {
        throw new Error('No frames decoded.');
      }

      const max = this.frames.length - 1;
      this.scrubber.max = max;
      this.startFrameInput.max = max;
      this.endFrameInput.max = max;

      this.root.classList.add('has-gif');
      this.buildTimeline();
      this.setMarkers(0, max);
      this.goto(0);
      this.setStatus(this.getFrameStatus(sourceFrameCount));
    } catch (error) {
      console.error(error);
      this.disposeFrames();
      this.setStatus('Could not decode this GIF.');
    } finally {
      if (this.loadToken === loadToken) {
        this.root.classList.remove('is-loading');
      }
      if (decoder && typeof decoder.close === 'function') {
        decoder.close();
      }
    }
  }

  isGifFile(file) {
    return file && (String(file.type || '').toLowerCase() === 'image/gif' || /\.gif$/i.test(String(file.name || '')));
  }

  isGifLikeSource(sourceUrl, fileName = '') {
    const source = String(sourceUrl || '').split('?')[0].split('#')[0];
    const name = String(fileName || '').split('?')[0].split('#')[0];
    return /^data:image\/gif[;,]/i.test(source) || /\.gif$/i.test(source) || /\.gif$/i.test(name);
  }

  getDecoderFrameCount(decoder) {
    const count = Number(decoder.tracks.selectedTrack?.frameCount || 1);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  }

  getFrameMemoryBudget() {
    const deviceMemory = Number(navigator.deviceMemory || 4);
    const dynamicBudget = deviceMemory * 1024 * 1024 * 1024 * this.frameMemoryBudgetRatio;
    return Math.max(this.minFrameMemoryBudget, Math.min(this.maxFrameMemoryBudget, dynamicBudget));
  }

  getDecodeFrameLimit(width, height, frameCount) {
    const bytesPerFrame = Math.max(1, width * height * 4);
    const memoryLimit = Math.max(1, Math.floor(this.getFrameMemoryBudget() / bytesPerFrame));
    return Math.max(1, Math.min(frameCount, memoryLimit));
  }

  getFrameStatus(sourceFrameCount = this.sourceFrameCount || this.frames.length) {
    const timelineNote = this.timelineIndexes.length < this.frames.length
      ? ` · ${this.timelineIndexes.length} timeline thumbs`
      : '';
    const decodeNote = this.frames.length < sourceFrameCount
      ? ` · capped from ${sourceFrameCount}`
      : '';
    return this.frames.length
      ? `${this.frames.length} frames${decodeNote} · range ${this.startFrame}-${this.endFrame}${timelineNote}`
      : '0 frames';
  }

  setStatus(text) {
    this.meta.textContent = text;
  }

  nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  disposeFrames() {
    this.pause();
    const bitmaps = new Set();
    this.frames.forEach((frame) => {
      if (frame?.bitmap && !bitmaps.has(frame.bitmap)) {
        bitmaps.add(frame.bitmap);
        if (typeof frame.bitmap.close === 'function') frame.bitmap.close();
      }
    });
    this.frames = [];
    this.sourceFrameCount = 0;
    this.timelineIndexes = [];
    this.activeThumb = null;
    this.frameIndex = 0;
    this.startFrame = 0;
    this.endFrame = 0;
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.scrubber.value = 0;
    this.scrubber.max = 0;
    this.startFrameInput.value = 0;
    this.startFrameInput.max = 0;
    this.endFrameInput.value = 0;
    this.endFrameInput.max = 0;
    this.timeline.innerHTML = '';
    this.root.classList.remove('has-gif');
  }

  getTimelineIndexes() {
    if (this.frames.length <= this.maxTimelineThumbs) {
      return this.frames.map((frame, index) => index);
    }
    const indexes = [];
    const last = this.frames.length - 1;
    for (let slot = 0; slot < this.maxTimelineThumbs; slot += 1) {
      const index = Math.round((slot / (this.maxTimelineThumbs - 1)) * last);
      if (!indexes.includes(index)) indexes.push(index);
    }
    return indexes;
  }

  buildTimeline() {
    this.timeline.innerHTML = '';
    this.timelineIndexes = this.getTimelineIndexes();
    const fragment = document.createDocumentFragment();

    this.timelineIndexes.forEach((index) => {
      const frame = this.frames[index];
      const button = document.createElement('button');
      button.className = 'frame-thumb';
      button.type = 'button';
      button.title = `Frame ${index}`;
      button.dataset.frameIndex = String(index);

      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 60;

      const ctx = canvas.getContext('2d');
      const scale = Math.min(canvas.width / frame.bitmap.width, canvas.height / frame.bitmap.height);
      const w = frame.bitmap.width * scale;
      const h = frame.bitmap.height * scale;

      ctx.drawImage(frame.bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

      const label = document.createElement('div');
      label.className = 'frame-thumb__index';
      label.textContent = index;

      button.append(canvas, label);
      button.addEventListener('click', () => {
        this.pause();
        this.goto(index);
      });

      fragment.append(button);
    });

    this.timeline.append(fragment);
    this.updateActiveTimelineThumb();
  }

  setMarkers(start, end) {
    if (!this.frames.length) return;

    const max = this.frames.length - 1;
    this.startFrame = Math.max(0, Math.min(Number.isFinite(start) ? start : 0, max));
    this.endFrame = Math.max(0, Math.min(Number.isFinite(end) ? end : max, max));

    if (this.startFrame > this.endFrame) {
      [this.startFrame, this.endFrame] = [this.endFrame, this.startFrame];
    }

    this.startFrameInput.value = this.startFrame;
    this.endFrameInput.value = this.endFrame;

    if (this.frameIndex < this.startFrame || this.frameIndex > this.endFrame) {
      this.goto(this.startFrame);
    }

    this.updateTimeline();
  }

  goto(index, options = {}) {
    if (!this.frames.length) return;

    this.frameIndex = Math.max(this.startFrame, Math.min(index, this.endFrame));

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.frames[this.frameIndex].bitmap, 0, 0);

    this.scrubber.value = this.frameIndex;
    this.updateActiveTimelineThumb();

    if (options.scrollTimeline !== false) {
      this.activeThumb?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  findTimelineThumb(frameIndex) {
    const exact = this.timeline.querySelector(`[data-frame-index="${frameIndex}"]`);
    if (exact) return exact;
    return [...this.timeline.children].reduce((closest, thumb) => {
      const index = Number(thumb.dataset.frameIndex || 0);
      const distance = Math.abs(index - frameIndex);
      return !closest || distance < closest.distance ? { thumb, distance } : closest;
    }, null)?.thumb || null;
  }

  updateActiveTimelineThumb() {
    if (this.activeThumb) {
      this.activeThumb.classList.remove('active');
    }
    this.activeThumb = this.findTimelineThumb(this.frameIndex);
    if (this.activeThumb) {
      this.activeThumb.classList.add('active');
    }
  }

  updateTimeline() {
    [...this.timeline.children].forEach((thumb, index) => {
      const frameIndex = Number(thumb.dataset.frameIndex || index);
      thumb.classList.toggle('active', frameIndex === this.frameIndex);
      thumb.classList.toggle('in-range', frameIndex >= this.startFrame && frameIndex <= this.endFrame);
      thumb.classList.toggle('start', frameIndex === this.startFrame);
      thumb.classList.toggle('end', frameIndex === this.endFrame);
    });
    this.activeThumb = this.findTimelineThumb(this.frameIndex);
    if (this.activeThumb) {
      this.activeThumb.classList.add('active');
    }

    this.setStatus(this.getFrameStatus());
  }

  play() {
    if (!this.frames.length) return;

    if (this.frameIndex < this.startFrame || this.frameIndex > this.endFrame) {
      this.goto(this.startFrame);
    }

    if (this.playing) return;

    this.playing = true;
    this.playPauseButton.textContent = 'Pause';
    this.accumulator = 0;
    this.lastTimestamp = performance.now();

    const loop = (timestamp) => {
      if (!this.playing) return;

      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      this.accumulator += delta * this.playbackSpeed;

      let delay = this.frames[this.frameIndex]?.delay || 100;

      while (this.playing && this.accumulator >= delay) {
        this.accumulator -= delay;
        this.step();
        delay = this.frames[this.frameIndex]?.delay || 100;
      }

      this.raf = requestAnimationFrame(loop);
    };

    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    this.playing = false;
    this.playPauseButton.textContent = 'Play';

    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }

  step() {
    if (this.startFrame === this.endFrame) {
      this.goto(this.startFrame, { scrollTimeline: false });
      return;
    }

    let next = this.frameIndex + this.direction;

    if (this.pingpongInput.checked) {
      if (next > this.endFrame) {
        this.direction = -1;
        next = this.endFrame - 1;
      } else if (next < this.startFrame) {
        this.direction = 1;
        next = this.startFrame + 1;
      }
    } else {
      if (next > this.endFrame || next < this.startFrame) {
        next = this.startFrame;
      }

      this.direction = 1;
    }

    this.goto(next, { scrollTimeline: false });
  }

  mirrorFrames(position = 'after') {
    if (!this.frames.length) return;

    this.pause();

    const originalLength = this.frames.length;
    const originalIndex = this.frameIndex;
    const mirrored = [...this.frames].reverse();

    if (position === 'before') {
      this.frames = [...mirrored, ...this.frames];
    } else {
      this.frames = [...this.frames, ...mirrored];
    }

    const max = this.frames.length - 1;

    this.scrubber.max = max;
    this.startFrameInput.max = max;
    this.endFrameInput.max = max;

    this.direction = 1;
    this.buildTimeline();
    this.setMarkers(0, max);
    this.goto(position === 'before' ? originalIndex + originalLength : originalIndex);
  }

  async downloadGif() {
    if (!this.frames.length) {
      alert('Open a GIF first.');
      return;
    }

    const exportFrames = this.getExportFrameIndexes();

    const gifFrames = exportFrames.map((index) => {
      const frame = this.frames[index];
      const canvas = document.createElement('canvas');

      canvas.width = frame.bitmap.width;
      canvas.height = frame.bitmap.height;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(frame.bitmap, 0, 0);

      return {
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        delay: Math.max(2, Math.round((frame.delay / this.playbackSpeed) / 10))
      };
    });

    const encoder = new SimpleGifEncoder({
      width: gifFrames[0].imageData.width,
      height: gifFrames[0].imageData.height,
      repeat: 0
    });

    const blob = encoder.encode(gifFrames);

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = this.getExportGifName();
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  getExportFrameIndexes() {
    const ordered = [];

    for (let i = this.startFrame; i <= this.endFrame; i += 1) {
      ordered.push(i);
    }

    if (!this.pingpongInput.checked || ordered.length <= 2) {
      return ordered;
    }

    const bounce = ordered.slice(1, -1).reverse();
    return [...ordered, ...bounce];
  }

  getExportGifName() {
    const baseName = this.originalFile?.name
      ? this.originalFile.name.replace(/\.gif$/i, '')
      : 'animation';

    const speed = `${this.playbackSpeed}x`.replace('.', 'p');

    return `${baseName}_${speed}.gif`;
  }

  describeCurrentAsset() {
    if (!this.frames.length || !this.canvas.width || !this.canvas.height) {
      return null;
    }
    const dataUrl = this.canvas.toDataURL('image/png');
    return {
      kind: 'image',
      title: 'GIF Viewer Current Frame',
      fileName: `gif-frame-${String(this.frameIndex).padStart(4, '0')}.png`,
      mimeType: 'image/png',
      dataUrl,
      width: this.canvas.width,
      height: this.canvas.height,
      previewKind: 'image',
      previewUrl: dataUrl,
      metadata: {
        sourceTool: 'gif-viewer',
        sourceFileName: this.originalFile?.name || '',
        frameIndex: this.frameIndex,
        startFrame: this.startFrame,
        endFrame: this.endFrame,
        frameCount: this.frames.length
      }
    };
  }

  async downloadFrames() {
    if (!this.frames.length) {
      alert('Open a GIF first.');
      return;
    }

    const zip = new ZipWriter();

    for (let i = this.startFrame; i <= this.endFrame; i += 1) {
      const frame = this.frames[i];

      const canvas = document.createElement('canvas');
      canvas.width = frame.bitmap.width;
      canvas.height = frame.bitmap.height;
      canvas.getContext('2d').drawImage(frame.bitmap, 0, 0);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());

      zip.add(`frame_${String(i).padStart(4, '0')}.png`, bytes);
    }

    const zipBlob = zip.finish();
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'gif_frames.zip';
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

class ZipWriter {
  constructor() {
    this.files = [];
  }

  add(name, data) {
    this.files.push({ name, data });
  }

  finish() {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);

      const local = new Uint8Array(30 + nameBytes.length + data.length);
      const view = new DataView(local.buffer);

      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      local.set(data, 30 + nameBytes.length);
      localParts.push(local);

      const central = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(central.buffer);

      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, 0, true);
      centralView.setUint16(14, 0, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint16(30, 0, true);
      centralView.setUint16(32, 0, true);
      centralView.setUint16(34, 0, true);
      centralView.setUint16(36, 0, true);
      centralView.setUint32(38, 0, true);
      centralView.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);

      offset += local.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);

    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, this.files.length, true);
    endView.setUint16(10, this.files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    endView.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }
}

function crc32(data) {
  let crc = -1;

  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];

    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ -1) >>> 0;
}



class SimpleGifEncoder {
  constructor({ width, height, repeat = 0 }) {
    this.width = width;
    this.height = height;
    this.repeat = repeat;
    this.bytes = [];
  }

  encode(frames) {
    this.bytes = [];

    this.writeString('GIF89a');
    this.writeShort(this.width);
    this.writeShort(this.height);
    this.writeByte(0xf7);
    this.writeByte(0x00);
    this.writeByte(0x00);

    this.writeFixedPalette();
    this.writeLoopExtension(this.repeat);

    for (const frame of frames) {
      const indexed = this.indexImageData(frame.imageData);
      this.writeGraphicControlExtension(frame.delay);
      this.writeImageDescriptor();
      this.writeImageDataUncompressed(indexed, 8);
    }

    this.writeByte(0x3b);

    return new Blob([new Uint8Array(this.bytes)], { type: 'image/gif' });
  }

  writeFixedPalette() {
    for (let r = 0; r < 8; r += 1) {
      for (let g = 0; g < 8; g += 1) {
        for (let b = 0; b < 4; b += 1) {
          this.writeByte(Math.round((r / 7) * 255));
          this.writeByte(Math.round((g / 7) * 255));
          this.writeByte(Math.round((b / 3) * 255));
        }
      }
    }
  }

  indexImageData(imageData) {
    const data = imageData.data;
    const pixels = new Uint8Array(imageData.width * imageData.height);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      if (data[i + 3] < 128) {
        pixels[p] = 0;
        continue;
      }

      const r = data[i] >> 5;
      const g = data[i + 1] >> 5;
      const b = data[i + 2] >> 6;
      pixels[p] = (r << 5) | (g << 2) | b;
    }

    return pixels;
  }

  writeGraphicControlExtension(delayCs) {
    this.writeByte(0x21);
    this.writeByte(0xf9);
    this.writeByte(0x04);
    this.writeByte(0x00);
    this.writeShort(Math.max(2, delayCs));
    this.writeByte(0x00);
    this.writeByte(0x00);
  }

  writeImageDescriptor() {
    this.writeByte(0x2c);
    this.writeShort(0);
    this.writeShort(0);
    this.writeShort(this.width);
    this.writeShort(this.height);
    this.writeByte(0x00);
  }

  writeImageDataUncompressed(indices, minCodeSize) {
    this.writeByte(minCodeSize);

    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    const codeSize = minCodeSize + 1;

    const packed = [];
    let bitBuffer = 0;
    let bitCount = 0;

    const writeCode = (code) => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;

      while (bitCount >= 8) {
        packed.push(bitBuffer & 0xff);
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    };

    writeCode(clearCode);

    let emitted = 0;

    for (const index of indices) {
      writeCode(index);
      emitted += 1;

      if (emitted >= 100) {
        writeCode(clearCode);
        emitted = 0;
      }
    }

    writeCode(endCode);

    if (bitCount > 0) {
      packed.push(bitBuffer & 0xff);
    }

    for (let offset = 0; offset < packed.length; offset += 255) {
      const block = packed.slice(offset, offset + 255);
      this.writeByte(block.length);
      for (const byte of block) this.writeByte(byte);
    }

    this.writeByte(0x00);
  }

  writeLoopExtension(repeat) {
    this.writeByte(0x21);
    this.writeByte(0xff);
    this.writeByte(0x0b);
    this.writeString('NETSCAPE2.0');
    this.writeByte(0x03);
    this.writeByte(0x01);
    this.writeShort(repeat);
    this.writeByte(0x00);
  }

  writeString(text) {
    for (let i = 0; i < text.length; i += 1) this.writeByte(text.charCodeAt(i));
  }

  writeShort(value) {
    this.writeByte(value & 0xff);
    this.writeByte((value >> 8) & 0xff);
  }

  writeByte(value) {
    this.bytes.push(value & 0xff);
  }
}

window.gifPlayer = new Html5GifVideoPlayer(document.querySelector('#gifPlayer'));
window.__urageToolDescribeCurrentAsset = () => window.gifPlayer.describeCurrentAsset();
window.__urageToolDescribeCurrentAssets = () => {
  const descriptor = window.gifPlayer.describeCurrentAsset();
  return descriptor ? [descriptor] : [];
};
