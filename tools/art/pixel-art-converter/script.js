/* Pixel Art Converter UI glue.
 * Heavy image work lives in art/pixel-art-converter/js/pas-*.js (window.PAS).
 */
(function () {
    'use strict';

    const PAS = window.PAS;
    if (!PAS || !PAS.render || !PAS.util) {
        console.error('PAS modules not loaded.');
        return;
    }

    const $ = (id) => document.getElementById(id);
    const { setText, clampInt, hexToRgb, rgbToHex, downloadBytes } = PAS.util;

    const els = {
        previewModeTwoBtn: $('previewModeTwoBtn'),
        previewModeRevealBtn: $('previewModeRevealBtn'),

        fileInput: $('fileInput'),
        clearBatchBtn: $('clearBatchBtn'),
        batchQueue: $('batchQueue'),
        imagePoolSelect: $('imagePoolSelect'),
        imagePoolImageSelect: $('imagePoolImageSelect'),
        refreshImagePoolsBtn: $('refreshImagePoolsBtn'),
        loadPoolImageBtn: $('loadPoolImageBtn'),
        imagePoolHint: $('imagePoolHint'),

        quickPresetSelect: $('quickPresetSelect'),
        applyPresetBtn: $('applyPresetBtn'),
        resetPresetBtn: $('resetPresetBtn'),
        quickPresetHint: $('quickPresetHint'),

        pixelSizeSlider: $('pixelSizeSlider'),
        pixelSizeValue: $('pixelSizeValue'),
        autoScaleCheckbox: $('autoScaleCheckbox'),
        autoPixelSizeBasisSelect: $('autoPixelSizeBasisSelect'),
        autoConvertCheckbox: $('autoConvertCheckbox'),

        blockSizeSlider: $('blockSizeSlider'),
        blockSizeValue: $('blockSizeValue'),

        advancedSamplingCheckbox: $('advancedSamplingCheckbox'),
        advancedSamplingPanel: $('advancedSamplingPanel'),
        colorToleranceSlider: $('colorToleranceSlider'),
        colorToleranceValue: $('colorToleranceValue'),
        blockInsetSlider: $('blockInsetSlider'),
        blockInsetValue: $('blockInsetValue'),
        alphaCutoffSlider: $('alphaCutoffSlider'),
        alphaCutoffValue: $('alphaCutoffValue'),
        sampleStepSlider: $('sampleStepSlider'),
        sampleStepValue: $('sampleStepValue'),

        offsetXSlider: $('offsetXSlider'),
        offsetXValue: $('offsetXValue'),
        offsetYSlider: $('offsetYSlider'),
        offsetYValue: $('offsetYValue'),
        detectGridBtn: $('detectGridBtn'),
        lockGridCheckbox: $('lockGridCheckbox'),
        preResizeCheckbox: $('preResizeCheckbox'),
        preResizeLinkCheckbox: $('preResizeLinkCheckbox'),
        preResizeXSlider: $('preResizeXSlider'),
        preResizeXValue: $('preResizeXValue'),
        preResizeYSlider: $('preResizeYSlider'),
        preResizeYValue: $('preResizeYValue'),
        preResizeMethodSelect: $('preResizeMethodSelect'),
        snapToBlocksBtn: $('snapToBlocksBtn'),

        paletteEnableCheckbox: $('paletteEnableCheckbox'),
        palettePresetSelect: $('palettePresetSelect'),
        palettePresetHint: $('palettePresetHint'),
        paletteSizeSlider: $('paletteSizeSlider'),
        paletteSizeValue: $('paletteSizeValue'),
        paletteMethodSelect: $('paletteMethodSelect'),
        lockPaletteCheckbox: $('lockPaletteCheckbox'),
        paletteSwatches: $('paletteSwatches'),
        exportPaletteBtn: $('exportPaletteBtn'),
        exportIndexedBtn: $('exportIndexedBtn'),

        gradientCrushCheckbox: $('gradientCrushCheckbox'),
        valueStepsSlider: $('valueStepsSlider'),
        valueStepsValue: $('valueStepsValue'),
        mergeSimilarCheckbox: $('mergeSimilarCheckbox'),
        mergeThresholdSlider: $('mergeThresholdSlider'),
        mergeThresholdValue: $('mergeThresholdValue'),
        mergeMinSizeSlider: $('mergeMinSizeSlider'),
        mergeMinSizeValue: $('mergeMinSizeValue'),
        despeckleCheckbox: $('despeckleCheckbox'),
        despeckleSlider: $('despeckleSlider'),
        despeckleValue: $('despeckleValue'),
        islandsCheckbox: $('islandsCheckbox'),
        islandsSlider: $('islandsSlider'),
        islandsValue: $('islandsValue'),
        aaRemoveCheckbox: $('aaRemoveCheckbox'),
        aaStrengthSlider: $('aaStrengthSlider'),
        aaStrengthValue: $('aaStrengthValue'),
        ditherCleanupCheckbox: $('ditherCleanupCheckbox'),
        ditherStrengthSlider: $('ditherStrengthSlider'),
        ditherStrengthValue: $('ditherStrengthValue'),
        applyDitherCheckbox: $('applyDitherCheckbox'),
        applyDitherModeSelect: $('applyDitherModeSelect'),
        applyDitherSlider: $('applyDitherSlider'),
        applyDitherValue: $('applyDitherValue'),
        outlineCheckbox: $('outlineCheckbox'),
        outlineColorPicker: $('outlineColorPicker'),
        outlineModeSelect: $('outlineModeSelect'),
        outlineThicknessSlider: $('outlineThicknessSlider'),
        outlineThicknessValue: $('outlineThicknessValue'),
        outlineDetectionSelect: $('outlineDetectionSelect'),

        spriteSheetCheckbox: $('spriteSheetCheckbox'),
        cellWSlider: $('cellWSlider'),
        cellWValue: $('cellWValue'),
        cellHSlider: $('cellHSlider'),
        cellHValue: $('cellHValue'),
        gapXSlider: $('gapXSlider'),
        gapXValue: $('gapXValue'),
        gapYSlider: $('gapYSlider'),
        gapYValue: $('gapYValue'),

        bgColorPicker: $('bgColorPicker'),
        pickColorBtn: $('pickColorBtn'),
        forceOpaqueBlocksCheckbox: $('forceOpaqueBlocksCheckbox'),
        removeBgCheckbox: $('removeBgCheckbox'),
        bgMatchSlider: $('bgMatchSlider'),
        bgMatchValue: $('bgMatchValue'),
        preserveTransparencyCheckbox: $('preserveTransparencyCheckbox'),
        minOpaqueSlider: $('minOpaqueSlider'),
        minOpaqueValue: $('minOpaqueValue'),

        fastPreviewCheckbox: $('fastPreviewCheckbox'),
        targetResCheckbox: $('targetResCheckbox'),
        targetMaxSlider: $('targetMaxSlider'),
        targetMaxValue: $('targetMaxValue'),
        targetResampleSelect: $('targetResampleSelect'),
        outputResolutionSelect: $('outputResolutionSelect'),
        previewMaxSlider: $('previewMaxSlider'),
        previewMaxValue: $('previewMaxValue'),
        exportQualitySelect: $('exportQualitySelect'),
        overlayModeSelect: $('overlayModeSelect'),
        overlayOpacitySlider: $('overlayOpacitySlider'),
        overlayOpacityValue: $('overlayOpacityValue'),
        revealSlider: $('revealSlider'),
        revealValue: $('revealValue'),
        gifFrameStripCard: $('gifFrameStripCard'),
        gifFrameStrip: $('gifFrameStrip'),
        gifPlaybackToggleBtn: $('gifPlaybackToggleBtn'),
        gifFrameStripMeta: $('gifFrameStripMeta'),

        convertBtn: $('convertBtn'),
        downloadBtn: $('downloadBtn'),
        downloadAllBtn: $('downloadAllBtn'),
        downloadScaledBtn: $('downloadScaledBtn'),
        downloadGifBtn: $('downloadGifBtn'),
        downloadFramesBtn: $('downloadFramesBtn'),

        previewInfo: $('previewInfo'),

        originalCanvas: $('originalCanvas'),
        pixelCanvas: $('pixelCanvas'),
        overlayCanvas: $('overlayCanvas'),
        compareCanvas: $('compareCanvas'),
        originalWrap: $('originalWrap'),
        pixelWrap: $('pixelWrap'),
        compareWrap: $('compareWrap')
    };

    const state = {
        imageName: 'pixel-art',
        imageLoaded: false,
        lastPreviewMeta: null,
        lastPreviewParamsKey: '',
        previewBase: null, // cached scaled canvas for fast preview
        previewBaseKey: '',
        preResizeBase: null,
        preResizeBaseKey: '',
        imageNonce: 0,
        isPickingColor: false,
        pendingTimer: null,
        lockedGrid: { size: null, ox: null, oy: null },
        dashboardImagePools: [],
        animationFrames: [],
        animationPreviewTimer: null,
        animationPreviewIndex: 0,
        animationPreviewName: '',
        animationPreviewPaused: false,
        revealPercent: 50,
        previewViewMode: 'two',
        batchImages: [],
        activeBatchImageId: ''
    };

    if (els.revealSlider) {
        els.revealSlider.hidden = true;
        els.revealSlider.style.display = 'none';
        els.revealSlider.setAttribute('aria-hidden', 'true');
        els.revealSlider.tabIndex = -1;
    }

    const defaults = {};
    const UI_PRESETS = window.PAS_PIXEL_ART_UI_PRESETS || {};
    const PALETTE_PRESETS = UI_PRESETS.palettePresets || {};

    function setCanvasHidden(canvas, hidden) {
        if (!canvas) return;
        if (hidden) canvas.classList.add('hidden');
        else canvas.classList.remove('hidden');
    }
    function setDashboardRevealOnlyMode(enabled) {
        if (!document || !document.body) return;
        document.body.classList.toggle('dashboard-reveal-only', enabled === true);
        if (enabled === true) setPreviewViewMode('reveal');
    }
    function setPreviewViewMode(mode) {
        const normalizedMode = mode === 'reveal' ? 'reveal' : 'two';
        state.previewViewMode = normalizedMode;
        if (document && document.body) {
            document.body.classList.toggle('preview-mode-two', normalizedMode === 'two');
            document.body.classList.toggle('preview-mode-reveal', normalizedMode === 'reveal');
        }
        const twoButton = els.previewModeTwoBtn;
        const revealButton = els.previewModeRevealBtn;
        if (twoButton) {
            const active = normalizedMode === 'two';
            twoButton.classList.toggle('active', active);
            twoButton.setAttribute('aria-selected', active ? 'true' : 'false');
        }
        if (revealButton) {
            const active = normalizedMode === 'reveal';
            revealButton.classList.toggle('active', active);
            revealButton.setAttribute('aria-selected', active ? 'true' : 'false');
        }
    }
    function getContainDrawRect(srcWidth, srcHeight, dstWidth, dstHeight) {
        const sourceW = Math.max(1, Number(srcWidth) || 1);
        const sourceH = Math.max(1, Number(srcHeight) || 1);
        const targetW = Math.max(1, Number(dstWidth) || 1);
        const targetH = Math.max(1, Number(dstHeight) || 1);
        const sourceAspect = sourceW / sourceH;
        const targetAspect = targetW / targetH;
        if (sourceAspect >= targetAspect) {
            const width = targetW;
            const height = Math.max(1, Math.round(width / sourceAspect));
            return { x: 0, y: Math.round((targetH - height) / 2), width, height };
        }
        const height = targetH;
        const width = Math.max(1, Math.round(height * sourceAspect));
        return { x: Math.round((targetW - width) / 2), y: 0, width, height };
    }
    function setRevealPercent(value, options) {
        const revealPercent = clampInt(value, 0, 100);
        state.revealPercent = revealPercent;
        if (els.revealSlider && String(els.revealSlider.value) !== String(revealPercent)) {
            els.revealSlider.value = String(revealPercent);
        }
        setText(els.revealValue, String(revealPercent));
        if (!options || options.render !== false) renderRevealComparison();
    }
    function renderGifFrameStrip() {
        if (!els.gifFrameStripCard || !els.gifFrameStrip || !els.gifFrameStripMeta) return;
        const hasFrames = Array.isArray(state.animationFrames) && state.animationFrames.length > 1;
        els.gifFrameStripCard.classList.toggle('hidden', !hasFrames);
        els.gifFrameStrip.innerHTML = '';
        syncGifPreviewPlaybackButton();
        if (!hasFrames) {
            els.gifFrameStripMeta.textContent = 'Frame 1 / 1';
            return;
        }
        const activeIndex = clampInt(state.animationPreviewIndex, 0, state.animationFrames.length - 1);
        els.gifFrameStripMeta.textContent = `Frame ${activeIndex + 1} / ${state.animationFrames.length}`;
        state.animationFrames.forEach((frame, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'gif-frame-thumb' + (index === activeIndex ? ' active' : '');
            button.title = `Show frame ${index + 1}`;
            const canvas = document.createElement('canvas');
            const maxThumb = 64;
            const scale = Math.min(maxThumb / Math.max(1, frame.canvas.width), maxThumb / Math.max(1, frame.canvas.height), 1);
            canvas.width = Math.max(1, Math.round(frame.canvas.width * scale));
            canvas.height = Math.max(1, Math.round(frame.canvas.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(frame.canvas, 0, 0, canvas.width, canvas.height);
            const label = document.createElement('div');
            label.className = 'gif-frame-thumb-label';
            label.textContent = `${index + 1} · ${Math.max(20, frame.delay || 100)}ms`;
            button.appendChild(canvas);
            button.appendChild(label);
            button.addEventListener('click', () => {
                const shouldResumePlayback = state.animationPreviewPaused !== true;
                stopGifPreviewPlayback();
                showAnimationPreviewFrame(index, { restartPlayback: shouldResumePlayback });
            });
            els.gifFrameStrip.appendChild(button);
        });
    }
    function showAnimationPreviewFrame(index, options) {
        if (!Array.isArray(state.animationFrames) || state.animationFrames.length === 0) return;
        const nextIndex = clampInt(index, 0, state.animationFrames.length - 1);
        const frame = state.animationFrames[nextIndex];
        state.animationPreviewIndex = nextIndex;
        if (frame && frame.canvas) {
            setOriginalCanvasFromCanvas(frame.canvas, state.animationPreviewName || state.imageName, {
                renderPreview: true,
                skipAutoScale: true,
                keepAnimationTimer: true,
                preserveReveal: true
            });
        }
        renderGifFrameStrip();
        if (options && options.restartPlayback === true) scheduleNextGifPreviewFrame();
    }
    function setRevealPercentFromClientX(clientX) {
        if (!els.compareCanvas) return;
        const rect = els.compareCanvas.getBoundingClientRect();
        if (!rect || rect.width <= 0) return;
        const ratio = (Number(clientX) - rect.left) / rect.width;
        const percent = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
        setRevealPercent(percent);
    }

    function applyDashboardTheme(theme) {
        if (typeof window.applyDashboardThemeVars === 'function') {
            window.applyDashboardThemeVars(theme || document.body.getAttribute('data-dashboard-theme') || 'fire');
            return;
        }
        document.body.setAttribute('data-dashboard-theme', String(theme || 'fire').trim() || 'fire');
    }

    function updateReadouts() {
        setText(els.pixelSizeValue, els.pixelSizeSlider ? els.pixelSizeSlider.value : '');
        setText(els.blockSizeValue, els.blockSizeSlider ? els.blockSizeSlider.value : '');
        setText(els.colorToleranceValue, els.colorToleranceSlider ? els.colorToleranceSlider.value : '');
        setText(els.blockInsetValue, els.blockInsetSlider ? els.blockInsetSlider.value : '');
        setText(els.alphaCutoffValue, els.alphaCutoffSlider ? els.alphaCutoffSlider.value : '');
        setText(els.sampleStepValue, els.sampleStepSlider ? els.sampleStepSlider.value : '');
        setText(els.offsetXValue, els.offsetXSlider ? els.offsetXSlider.value : '');
        setText(els.offsetYValue, els.offsetYSlider ? els.offsetYSlider.value : '');
        setText(els.preResizeXValue, els.preResizeXSlider ? els.preResizeXSlider.value : '');
        setText(els.preResizeYValue, els.preResizeYSlider ? els.preResizeYSlider.value : '');
        setText(els.paletteSizeValue, els.paletteSizeSlider ? els.paletteSizeSlider.value : '');
        setText(els.valueStepsValue, els.valueStepsSlider ? els.valueStepsSlider.value : '');
        setText(els.mergeThresholdValue, els.mergeThresholdSlider ? els.mergeThresholdSlider.value : '');
        setText(els.mergeMinSizeValue, els.mergeMinSizeSlider ? els.mergeMinSizeSlider.value : '');
        setText(els.despeckleValue, els.despeckleSlider ? els.despeckleSlider.value : '');
        setText(els.islandsValue, els.islandsSlider ? els.islandsSlider.value : '');
        setText(els.aaStrengthValue, els.aaStrengthSlider ? els.aaStrengthSlider.value : '');
        setText(els.ditherStrengthValue, els.ditherStrengthSlider ? els.ditherStrengthSlider.value : '');
        setText(els.applyDitherValue, els.applyDitherSlider ? els.applyDitherSlider.value : '');
        setText(els.outlineThicknessValue, els.outlineThicknessSlider ? els.outlineThicknessSlider.value : '');
        setText(els.bgMatchValue, els.bgMatchSlider ? els.bgMatchSlider.value : '');
        setText(els.minOpaqueValue, els.minOpaqueSlider ? els.minOpaqueSlider.value : '');
        setText(els.targetMaxValue, els.targetMaxSlider ? els.targetMaxSlider.value : '');
        setText(els.previewMaxValue, els.previewMaxSlider ? els.previewMaxSlider.value : '');
        setText(els.overlayOpacityValue, els.overlayOpacitySlider ? els.overlayOpacitySlider.value : '');
        const revealPercent = clampInt(els.revealSlider ? els.revealSlider.value : state.revealPercent, 0, 100);
        setRevealPercent(revealPercent, { render: false });

        if (els.advancedSamplingPanel && els.advancedSamplingCheckbox) {
            els.advancedSamplingPanel.style.display = els.advancedSamplingCheckbox.checked ? 'block' : 'none';
        }

        // Link/disable Y scale when requested.
        if (els.preResizeYSlider && els.preResizeLinkCheckbox) {
            els.preResizeYSlider.disabled = !!els.preResizeLinkCheckbox.checked;
        }
    }

    function getPreResizeSettings() {
        const enabled = !!(els.preResizeCheckbox && els.preResizeCheckbox.checked);
        const link = !!(els.preResizeLinkCheckbox && els.preResizeLinkCheckbox.checked);
        const xPct = clampInt(els.preResizeXSlider ? els.preResizeXSlider.value : 100, 10, 1000);
        const yPct = clampInt(els.preResizeYSlider ? els.preResizeYSlider.value : xPct, 10, 1000);
        const smooth = !els.preResizeMethodSelect || String(els.preResizeMethodSelect.value) !== 'nearest';
        return {
            enabled,
            link,
            sx: xPct / 100,
            sy: (link ? xPct : yPct) / 100,
            smooth
        };
    }

    function getCanvasIdentityKey(canvas) {
        if (canvas === els.originalCanvas) return 'orig';
        if (canvas === state.previewBase) return `preview:${state.previewBaseKey}`;
        return `tmp:${canvas.width}x${canvas.height}`;
    }

    function resampleCanvasCached(srcCanvas, w, h, smooth, cacheKeyPrefix) {
        const key = `${cacheKeyPrefix}:${state.imageNonce}:${getCanvasIdentityKey(srcCanvas)}->${w}x${h}:${smooth ? 's' : 'n'}`;
        if (state.preResizeBase && state.preResizeBaseKey === key) return state.preResizeBase;

        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = !!smooth;
        ctx.imageSmoothingQuality = smooth ? 'high' : 'low';
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(srcCanvas, 0, 0, w, h);

        state.preResizeBase = c;
        state.preResizeBaseKey = key;
        return c;
    }

    function applyPreResizeIfEnabled(srcCanvas) {
        const s = getPreResizeSettings();
        if (!s.enabled) {
            state.preResizeBase = null;
            state.preResizeBaseKey = '';
            return srcCanvas;
        }

        const w = Math.max(1, Math.round(srcCanvas.width * s.sx));
        const h = Math.max(1, Math.round(srcCanvas.height * s.sy));
        if (w === srcCanvas.width && h === srcCanvas.height) return srcCanvas;
        return resampleCanvasCached(srcCanvas, w, h, s.smooth, 'preResize');
    }

    function renderPaletteSwatches(palette) {
        if (!els.paletteSwatches) return;
        els.paletteSwatches.innerHTML = '';
        if (!palette || !palette.length) return;
        for (const c of palette) {
            const d = document.createElement('div');
            d.className = 'palette-swatch';
            d.style.background = `rgb(${c.r},${c.g},${c.b})`;
            els.paletteSwatches.appendChild(d);
        }
    }

    function presetPaletteToRgba(presetId) {
        const p = PALETTE_PRESETS[presetId];
        if (!p) return null;
        const out = [];
        for (const h of p.hex) {
            const rgb = hexToRgb(h);
            if (!rgb) continue;
            out.push({ r: rgb.r, g: rgb.g, b: rgb.b, a: 255 });
        }
        return out;
    }

    function getPalettePresetId() {
        if (!els.palettePresetSelect) return 'auto';
        return String(els.palettePresetSelect.value || 'auto');
    }

    function applyPalettePresetIfAny(options) {
        const forceEnable = !!(options && options.forceEnable);
        const id = getPalettePresetId();
        if (!id || id === 'auto') {
            // If we were previously on a preset, drop the cached forced palette so auto mode can rebuild.
            if (PAS.State.paletteCache && PAS.State.paletteCache.key && String(PAS.State.paletteCache.key).startsWith('preset:')) {
                PAS.State.paletteCache.key = null;
                PAS.State.paletteCache.palette = null;
            }
            if (els.paletteMethodSelect) els.paletteMethodSelect.disabled = false;
            if (els.paletteSizeSlider) els.paletteSizeSlider.disabled = false;
            if (els.lockPaletteCheckbox) els.lockPaletteCheckbox.disabled = false;
            if (els.palettePresetHint) els.palettePresetHint.textContent = 'Presets force a fixed palette (useful for perfecting AI pixel art).';
            return;
        }

        const pal = presetPaletteToRgba(id);
        if (!pal || pal.length === 0) return;

        // Force snapping to the preset palette by seeding the locked cache.
        PAS.State.paletteCache.key = `preset:${id}:${pal.length}`;
        PAS.State.paletteCache.palette = pal;

        if (forceEnable && els.paletteEnableCheckbox) els.paletteEnableCheckbox.checked = true;
        if (els.lockPaletteCheckbox) { els.lockPaletteCheckbox.checked = true; els.lockPaletteCheckbox.disabled = true; }
        if (els.paletteSizeSlider) { els.paletteSizeSlider.value = String(pal.length); els.paletteSizeSlider.disabled = true; }
        if (els.paletteMethodSelect) { els.paletteMethodSelect.value = 'kmeans'; els.paletteMethodSelect.disabled = true; }

        if (els.palettePresetHint) {
            els.palettePresetHint.textContent = `${PALETTE_PRESETS[id].name} preset loaded (${pal.length} colors). Palette is locked.`;
        }
    }

    function forceRerender() {
        state.lastPreviewMeta = null;
        state.lastPreviewParamsKey = '';
        renderPreview();
    }

    function captureDefaultsOnce() {
        if (defaults._captured) return;
        defaults._captured = true;

        const controls = [
            'pixelSizeSlider', 'autoScaleCheckbox', 'autoConvertCheckbox',
            'blockSizeSlider', 'advancedSamplingCheckbox', 'colorToleranceSlider', 'blockInsetSlider', 'alphaCutoffSlider', 'sampleStepSlider',
            'offsetXSlider', 'offsetYSlider', 'lockGridCheckbox',
            'preResizeCheckbox', 'preResizeLinkCheckbox', 'preResizeXSlider', 'preResizeYSlider', 'preResizeMethodSelect',
            'paletteEnableCheckbox', 'palettePresetSelect', 'paletteSizeSlider', 'paletteMethodSelect', 'lockPaletteCheckbox',
            'gradientCrushCheckbox', 'valueStepsSlider',
            'mergeSimilarCheckbox', 'mergeThresholdSlider', 'mergeMinSizeSlider',
            'despeckleCheckbox', 'despeckleSlider',
            'islandsCheckbox', 'islandsSlider',
            'aaRemoveCheckbox', 'aaStrengthSlider',
            'ditherCleanupCheckbox', 'ditherStrengthSlider',
            'applyDitherCheckbox', 'applyDitherModeSelect', 'applyDitherSlider',
            'outlineCheckbox', 'outlineColorPicker', 'outlineModeSelect',
            'spriteSheetCheckbox', 'cellWSlider', 'cellHSlider', 'gapXSlider', 'gapYSlider',
            'bgColorPicker', 'removeBgCheckbox', 'bgMatchSlider',
            'forceOpaqueBlocksCheckbox', 'preserveTransparencyCheckbox', 'minOpaqueSlider',
            'fastPreviewCheckbox', 'targetResCheckbox', 'targetMaxSlider', 'targetResampleSelect',
            'outputResolutionSelect', 'previewMaxSlider', 'exportQualitySelect',
            'overlayModeSelect', 'overlayOpacitySlider'
        ];

        for (const k of controls) {
            const el = els[k];
            if (!el) continue;
            defaults[k] = { value: el.value, checked: el.checked, disabled: el.disabled };
        }
    }

    function restoreDefaults() {
        for (const k of Object.keys(defaults)) {
            if (k === '_captured') continue;
            const el = els[k];
            const d = defaults[k];
            if (!el || !d) continue;
            if (typeof d.value !== 'undefined') el.value = d.value;
            if (typeof d.checked !== 'undefined' && typeof el.checked !== 'undefined') el.checked = d.checked;
            if (typeof d.disabled !== 'undefined') el.disabled = d.disabled;
        }

        // Clear any preset palette cache.
        PAS.State.paletteCache.key = null;
        PAS.State.paletteCache.palette = null;

        updateReadouts();
        applyPalettePresetIfAny();
        forceRerender();
    }

    function applyQuickPresetConfig(config) {
        if (!config) {
            return;
        }
        for (const [key, value] of Object.entries(config.checked || {})) {
            if (els[key]) els[key].checked = !!value;
        }
        for (const [key, value] of Object.entries(config.values || {})) {
            if (els[key]) els[key].value = String(value);
        }
    }

    function openPresetSections(presetId) {
        const commonSections = ['gridDetails', 'samplingDetails', 'paletteDetails', 'cleanupDetails', 'exportDetails'];
        const optionalSections = presetId === 'sprite_clean' ? ['spriteSheetDetails'] : [];
        for (const id of [...commonSections, ...optionalSections]) {
            const section = document.getElementById(id);
            if (section && section.tagName === 'DETAILS') section.open = true;
        }
    }

    function applyQuickPreset(presetId) {
        const id = String(presetId || 'none');
        if (id === 'none') return;
        const preset = UI_PRESETS.quickPresets && UI_PRESETS.quickPresets[id];
        if (!preset) {
            return;
        }
        applyQuickPresetConfig(UI_PRESETS.commonQuickPreset);
        applyQuickPresetConfig(preset);
        openPresetSections(id);
        applyPalettePresetIfAny();
        updateReadouts();
        forceRerender();
    }

    function getSamplingParams() {
        const preserve = !!(els.preserveTransparencyCheckbox && els.preserveTransparencyCheckbox.checked);
        const minOpaquePct = preserve ? clampInt(els.minOpaqueSlider ? els.minOpaqueSlider.value : 0, 0, 100) : 0;
        if (!els.advancedSamplingCheckbox || !els.advancedSamplingCheckbox.checked) {
            return { colorTolerance: 0, inset: 0, alphaCutoff: 1, sampleStep: 1, minOpaquePct };
        }
        return {
            colorTolerance: clampInt(els.colorToleranceSlider.value, 0, 64),
            inset: clampInt(els.blockInsetSlider.value, 0, 256),
            alphaCutoff: clampInt(els.alphaCutoffSlider.value, 0, 255),
            sampleStep: clampInt(els.sampleStepSlider.value, 1, 32),
            minOpaquePct
        };
    }

    function getCleanupParams() {
        const outlineEnabled = !!(els.outlineCheckbox && els.outlineCheckbox.checked);
        const outlineColor = (outlineEnabled && els.outlineColorPicker) ? els.outlineColorPicker.value : '#000000';
        const outlineMode = (outlineEnabled && els.outlineModeSelect) ? els.outlineModeSelect.value : 'inside';
        const outlineThickness = outlineEnabled && els.outlineThicknessSlider ? clampInt(els.outlineThicknessSlider.value, 1, 16) : 1;
        const outlineDetection = outlineEnabled && els.outlineDetectionSelect ? String(els.outlineDetectionSelect.value || 'auto') : 'auto';

        return {
            gradientSteps: (els.gradientCrushCheckbox && els.gradientCrushCheckbox.checked) ? clampInt(els.valueStepsSlider.value, 0, 64) : 0,
            mergeSimilar: (els.mergeSimilarCheckbox && els.mergeSimilarCheckbox.checked) ? {
                enabled: true,
                threshold: clampInt(els.mergeThresholdSlider.value, 0, 255),
                minSize: clampInt(els.mergeMinSizeSlider.value, 1, 1 << 30)
            } : { enabled: false },
            despeckleStrength: (els.despeckleCheckbox && els.despeckleCheckbox.checked) ? clampInt(els.despeckleSlider.value, 0, 100) : 0,
            islandMinSize: (els.islandsCheckbox && els.islandsCheckbox.checked) ? clampInt(els.islandsSlider.value, 0, 256) : 0,
            aaStrength: (els.aaRemoveCheckbox && els.aaRemoveCheckbox.checked) ? clampInt(els.aaStrengthSlider.value, 0, 100) : 0,
            ditherCleanupStrength: (els.ditherCleanupCheckbox && els.ditherCleanupCheckbox.checked) ? clampInt(els.ditherStrengthSlider.value, 0, 100) : 0,
            applyDitherAmount: (els.applyDitherCheckbox && els.applyDitherCheckbox.checked) ? clampInt(els.applyDitherSlider.value, 0, 100) : 0,
            applyDitherMode: (els.applyDitherCheckbox && els.applyDitherCheckbox.checked && els.applyDitherModeSelect) ? String(els.applyDitherModeSelect.value || 'ordered') : 'ordered',
            outline: outlineEnabled
                ? { enabled: true, color: outlineColor, mode: outlineMode, thickness: outlineThickness, detection: outlineDetection }
                : { enabled: false }
        };
    }

    function getPaletteParams() {
        const enabled = !!(els.paletteEnableCheckbox && els.paletteEnableCheckbox.checked);
        if (!enabled) return { enabled: false };
        return {
            enabled: true,
            size: clampInt(els.paletteSizeSlider.value, 2, 256),
            method: String(els.paletteMethodSelect ? els.paletteMethodSelect.value : 'kmeans'),
            locked: !!(els.lockPaletteCheckbox && els.lockPaletteCheckbox.checked)
        };
    }

    function getSpriteSheetParams() {
        const enabled = !!(els.spriteSheetCheckbox && els.spriteSheetCheckbox.checked);
        if (!enabled) return null;
        return {
            cellW: clampInt(els.cellWSlider.value, 1, 8192),
            cellH: clampInt(els.cellHSlider.value, 1, 8192),
            gapX: clampInt(els.gapXSlider.value, 0, 2048),
            gapY: clampInt(els.gapYSlider.value, 0, 2048)
        };
    }

    function computeScaleToMaxSide(w, h, maxSide) {
        if (!w || !h) return 1;
        const m = Math.max(w, h);
        if (m <= maxSide) return 1;
        return maxSide / m;
    }

    function drawScaledCanvas(srcCanvas, scale, smoothing) {
        const w = srcCanvas.width;
        const h = srcCanvas.height;
        const sw = Math.max(1, Math.round(w * scale));
        const sh = Math.max(1, Math.round(h * scale));
        const key = `${w}x${h}@${sw}x${sh}:${smoothing ? 's' : 'n'}`;
        if (state.previewBase && state.previewBaseKey === key) return state.previewBase;

        const c = document.createElement('canvas');
        c.width = sw;
        c.height = sh;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = !!smoothing;
        ctx.imageSmoothingQuality = smoothing ? 'high' : 'low';
        ctx.clearRect(0, 0, sw, sh);
        ctx.drawImage(srcCanvas, 0, 0, sw, sh);

        state.previewBase = c;
        state.previewBaseKey = key;
        return c;
    }

    function getPreviewInputCanvas() {
        const base = els.originalCanvas;
        if (!base || !state.imageLoaded) return null;

        if (!els.fastPreviewCheckbox || !els.fastPreviewCheckbox.checked) {
            state.previewBase = null;
            state.previewBaseKey = '';
            return base;
        }

        const maxSide = clampInt(els.previewMaxSlider.value, 128, 8192);
        const scale = computeScaleToMaxSide(base.width, base.height, maxSide);
        if (scale >= 1) return base;
        return drawScaledCanvas(base, scale, true);
    }

    function buildWorkCanvasForPreview() {
        const previewInput = getPreviewInputCanvas();
        if (!previewInput) return null;

        // Step 1: optional pre-resize (grid drift fixer)
        let workCanvas = applyPreResizeIfEnabled(previewInput);

        // Step 2: optional normalization (target resolution)
        if (els.targetResCheckbox && els.targetResCheckbox.checked) {
            workCanvas = buildTargetNormalizedCanvas(workCanvas).canvas;
        }

        const scaleX = workCanvas.width / els.originalCanvas.width;
        const scaleY = workCanvas.height / els.originalCanvas.height;
        return { previewInput, workCanvas, scaleX, scaleY };
    }

    function buildTargetNormalizedCanvas(srcCanvas) {
        const maxSide = clampInt(els.targetMaxSlider.value, 16, 8192);
        const scale = computeScaleToMaxSide(srcCanvas.width, srcCanvas.height, maxSide);
        if (scale >= 1) return { canvas: srcCanvas, scale: 1 };

        const w = Math.max(1, Math.round(srcCanvas.width * scale));
        const h = Math.max(1, Math.round(srcCanvas.height * scale));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        const mode = els.targetResampleSelect ? String(els.targetResampleSelect.value) : 'smooth';
        const smooth = (mode !== 'nearest');
        ctx.imageSmoothingEnabled = smooth;
        ctx.imageSmoothingQuality = smooth ? 'high' : 'low';
        ctx.drawImage(srcCanvas, 0, 0, w, h);
        return { canvas: c, scale };
    }

    function getRenderParamsForScale(scaleX, scaleY) {
        const sx = Number(scaleX) || 1;
        const sy = Number(scaleY) || 1;
        const slen = Math.sqrt(Math.max(1e-9, sx * sy)); // scalar for lengths when scale is non-uniform

        const size = (v) => Math.max(1, Math.round(v * slen));
        const offX = (v) => Math.max(0, Math.round(v * sx));
        const offY = (v) => Math.max(0, Math.round(v * sy));

        const bgRgb = hexToRgb(els.bgColorPicker ? els.bgColorPicker.value : '#ffffff');
        const bgMatchPct = clampInt(els.bgMatchSlider ? els.bgMatchSlider.value : 30, 0, 100);
        const bgMatch = Math.round(bgMatchPct * 2.55);

        const wantMasks = {
            snapped: (els.overlayModeSelect && els.overlayModeSelect.value === 'snapped'),
            aa: (els.overlayModeSelect && els.overlayModeSelect.value === 'aa'),
            dither: (els.overlayModeSelect && els.overlayModeSelect.value === 'dither'),
            islands: (els.overlayModeSelect && els.overlayModeSelect.value === 'islands'),
            outline: (els.overlayModeSelect && els.overlayModeSelect.value === 'outline')
        };

        const samplingRaw = getSamplingParams();
        const sampling = {
            colorTolerance: samplingRaw.colorTolerance,
            inset: size(samplingRaw.inset),
            alphaCutoff: samplingRaw.alphaCutoff,
            sampleStep: clampInt(samplingRaw.sampleStep, 1, 32) // keep relative to output density
        };

        const pixelSize = size(clampInt(els.pixelSizeSlider.value, 1, 2048));
        const blockSize = size(clampInt(els.blockSizeSlider.value, 1, 2048));

        return {
            pixelSize,
            blockSize,
            offsetX: offX(clampInt(els.offsetXSlider.value, 0, 2048)),
            offsetY: offY(clampInt(els.offsetYSlider.value, 0, 2048)),
            sampling,
            cleanup: getCleanupParams(),
            palette: getPaletteParams(),
            removeBg: !!(els.removeBgCheckbox && els.removeBgCheckbox.checked),
            forceOpaqueBlocks: !(els.forceOpaqueBlocksCheckbox && els.forceOpaqueBlocksCheckbox.checked === false),
            bgRgb,
            bgMatch,
            wantMasks
        };
    }

    function updatePreviewInfo(meta, srcCanvas, workCanvas, scaleToOrig) {
        if (!els.previewInfo) return;
        if (!meta) {
            els.previewInfo.textContent = '';
            return;
        }
        const p = [];
        p.push(`${meta.width}x${meta.height}`);
        if (srcCanvas && workCanvas && srcCanvas !== workCanvas) {
            p.push(`work: ${workCanvas.width}x${workCanvas.height}`);
        }
        if (scaleToOrig && Math.abs(scaleToOrig - 1) > 1e-3) {
            p.push(`scale: ${scaleToOrig.toFixed(3)}`);
        }
        if (meta.palette && meta.palette.length) p.push(`palette: ${meta.palette.length}`);
        els.previewInfo.textContent = p.join(' • ');
    }

    function renderRevealComparison() {
        if (!els.compareCanvas || !els.originalCanvas || !els.pixelCanvas) return;
        const sourceReady = state.imageLoaded && els.originalCanvas.width > 0 && els.originalCanvas.height > 0;
        const pixelReady = !!state.lastPreviewMeta && els.pixelCanvas.width > 0 && els.pixelCanvas.height > 0;
        if (!sourceReady || !pixelReady) {
            setCanvasHidden(els.compareCanvas, true);
            return;
        }
        const outW = Math.max(1, els.originalCanvas.width);
        const outH = Math.max(1, els.originalCanvas.height);
        if (els.compareCanvas.width !== outW || els.compareCanvas.height !== outH) {
            els.compareCanvas.width = outW;
            els.compareCanvas.height = outH;
        }
        const revealPercent = clampInt(els.revealSlider ? els.revealSlider.value : state.revealPercent, 0, 100);
        state.revealPercent = revealPercent;
        setText(els.revealValue, String(revealPercent));
        const splitX = Math.round((outW * revealPercent) / 100);
        const ctx = els.compareCanvas.getContext('2d');
        ctx.clearRect(0, 0, outW, outH);
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, outW, outH);
        ctx.imageSmoothingEnabled = false;
        const sourceRect = getContainDrawRect(els.originalCanvas.width, els.originalCanvas.height, outW, outH);
        const pixelRect = getContainDrawRect(els.pixelCanvas.width, els.pixelCanvas.height, outW, outH);
        if (splitX > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, splitX, outH);
            ctx.clip();
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(els.originalCanvas, 0, 0, els.originalCanvas.width, els.originalCanvas.height, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height);
            ctx.restore();
        }
        if (splitX < outW) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(splitX, 0, outW - splitX, outH);
            ctx.clip();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(els.pixelCanvas, 0, 0, els.pixelCanvas.width, els.pixelCanvas.height, pixelRect.x, pixelRect.y, pixelRect.width, pixelRect.height);
            ctx.restore();
        }
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = Math.max(1, Math.round(outW / 480));
        ctx.beginPath();
        ctx.moveTo(splitX + 0.5, 0);
        ctx.lineTo(splitX + 0.5, outH);
        ctx.stroke();
        ctx.restore();
        setCanvasHidden(els.compareCanvas, false);
    }

    function renderPreview() {
        if (!state.imageLoaded) return;

        // Ensure preset palettes are applied before rendering.
        applyPalettePresetIfAny();

        const w = buildWorkCanvasForPreview();
        if (!w) return;
        const { previewInput, workCanvas, scaleX, scaleY } = w;
        const params = getRenderParamsForScale(scaleX, scaleY);
        const paramsKey = JSON.stringify({
            w: workCanvas.width,
            h: workCanvas.height,
            params,
            sheet: getSpriteSheetParams()
        });

        // Avoid re-render if nothing relevant changed (common when just moving overlay opacity).
        if (paramsKey === state.lastPreviewParamsKey && state.lastPreviewMeta) {
            PAS.render.renderOverlay(
                els.overlayCanvas,
                state.lastPreviewMeta,
                els.overlayModeSelect ? els.overlayModeSelect.value : 'none',
                els.overlayOpacitySlider ? els.overlayOpacitySlider.value : 0
            );
            renderRevealComparison();
            return;
        }
        state.lastPreviewParamsKey = paramsKey;

        const sheet = getSpriteSheetParams();
        const meta = sheet
            ? PAS.render.renderPixelArtSpriteSheet(workCanvas, els.pixelCanvas, params, sheet, renderPaletteSwatches)
            : PAS.render.renderPixelArt(workCanvas, els.pixelCanvas, params);

        state.lastPreviewMeta = meta;
        setCanvasHidden(els.pixelCanvas, !meta);
        setCanvasHidden(els.overlayCanvas, true);

        if (meta && meta.palette && meta.palette.length) renderPaletteSwatches(meta.palette);
        if (meta) {
            PAS.render.renderOverlay(
                els.overlayCanvas,
                meta,
                els.overlayModeSelect ? els.overlayModeSelect.value : 'none',
                els.overlayOpacitySlider ? els.overlayOpacitySlider.value : 0
            );
        }

        updatePreviewInfo(meta, previewInput, workCanvas, scaleX);
        renderRevealComparison();

        if (els.downloadBtn) els.downloadBtn.style.display = meta ? 'flex' : 'none';
        if (els.downloadAllBtn) els.downloadAllBtn.style.display = meta && state.batchImages.length > 1 ? 'flex' : 'none';
        if (els.downloadScaledBtn) els.downloadScaledBtn.style.display = meta ? 'flex' : 'none';
    }

    function scheduleConvert() {
        updateReadouts();
        applyPalettePresetIfAny();
        if (!els.autoConvertCheckbox || !els.autoConvertCheckbox.checked) return;
        if (state.pendingTimer) clearTimeout(state.pendingTimer);
        state.pendingTimer = setTimeout(() => {
            state.pendingTimer = null;
            renderPreview();
        }, 80);
    }

    function getAutoPixelBasisDimension(width, height) {
        const smallerSide = Math.min(width, height);
        const largerSide = Math.max(width, height);
        const averageSide = Math.round((width + height) / 2);
        const basis = String(els.autoPixelSizeBasisSelect ? els.autoPixelSizeBasisSelect.value : 'smaller-side');
        if (basis === 'larger-side') return largerSide;
        if (basis === 'average-side') return averageSide;
        return smallerSide;
    }

    function setAutoPixelSizeForLargeImages() {
        if (!state.imageLoaded) return;
        if (!els.autoScaleCheckbox || !els.autoScaleCheckbox.checked) return;
        const w = els.originalCanvas.width;
        const h = els.originalCanvas.height;
        const basisDimension = getAutoPixelBasisDimension(w, h);
        const guess = clampInt(Math.round(basisDimension / 128), 1, 64);
        els.pixelSizeSlider.value = String(guess);
        if (els.blockSizeSlider) els.blockSizeSlider.value = String(guess);
        updateReadouts();
        scheduleConvert();
    }

    function isGifFile(file) {
        const name = String(file && file.name ? file.name : '').toLowerCase();
        const type = String(file && file.type ? file.type : '').toLowerCase();
        return type === 'image/gif' || name.endsWith('.gif');
    }

    function syncAnimationButtons() {
        const hasAnimation = state.animationFrames.length > 1;
        if (els.downloadGifBtn) els.downloadGifBtn.style.display = hasAnimation ? 'flex' : 'none';
        if (els.downloadFramesBtn) els.downloadFramesBtn.style.display = hasAnimation ? 'flex' : 'none';
    }
    function syncGifPreviewPlaybackButton() {
        if (!els.gifPlaybackToggleBtn) return;
        const hasAnimation = state.animationFrames.length > 1;
        els.gifPlaybackToggleBtn.classList.toggle('hidden', !hasAnimation);
        els.gifPlaybackToggleBtn.textContent = state.animationPreviewPaused === true ? 'Play' : 'Pause';
        els.gifPlaybackToggleBtn.setAttribute('aria-pressed', state.animationPreviewPaused === true ? 'false' : 'true');
    }
    function setGifPreviewPlaybackPaused(paused) {
        state.animationPreviewPaused = paused === true;
        if (state.animationPreviewPaused) {
            stopGifPreviewPlayback();
            renderGifFrameStrip();
            return;
        }
        renderGifFrameStrip();
        scheduleNextGifPreviewFrame();
    }

    function stopGifPreviewPlayback() {
        if (state.animationPreviewTimer) {
            clearTimeout(state.animationPreviewTimer);
            state.animationPreviewTimer = null;
        }
    }

    function scheduleNextGifPreviewFrame() {
        if (!state.animationFrames || state.animationFrames.length <= 1 || state.animationPreviewPaused === true) return;
        const frame = state.animationFrames[state.animationPreviewIndex] || state.animationFrames[0];
        const delay = Math.max(20, frame && frame.delay ? frame.delay : 100);
        state.animationPreviewTimer = setTimeout(playNextGifPreviewFrame, delay);
    }

    function playNextGifPreviewFrame() {
        if (!state.animationFrames || state.animationFrames.length <= 1 || state.animationPreviewPaused === true) {
            stopGifPreviewPlayback();
            return;
        }
        const nextIndex = (state.animationPreviewIndex + 1) % state.animationFrames.length;
        showAnimationPreviewFrame(nextIndex);
        scheduleNextGifPreviewFrame();
    }

    function startGifPreviewPlayback() {
        stopGifPreviewPlayback();
        if (!state.animationFrames || state.animationFrames.length <= 1) {
            state.animationPreviewPaused = false;
            renderGifFrameStrip();
            return;
        }
        state.animationPreviewPaused = false;
        state.animationPreviewIndex = clampInt(state.animationPreviewIndex, 0, state.animationFrames.length - 1);
        state.animationPreviewName = state.imageName || 'pixel-art';
        renderGifFrameStrip();
        scheduleNextGifPreviewFrame();
    }

    function setOriginalCanvasFromCanvas(sourceCanvas, imageName, options) {
        const shouldRender = !(options && options.renderPreview === false);
        const c = els.originalCanvas;
        c.width = sourceCanvas.width;
        c.height = sourceCanvas.height;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0);
        state.imageName = (imageName || state.imageName || 'pixel-art').replace(/\.[^.]+$/, '');
        state.imageLoaded = true;
        state.imageNonce++;
        state.previewBase = null;
        state.previewBaseKey = '';
        state.preResizeBase = null;
        state.preResizeBaseKey = '';
        state.lastPreviewMeta = null;
        state.lastPreviewParamsKey = '';
        setCanvasHidden(els.originalCanvas, false);
        setCanvasHidden(els.pixelCanvas, true);
        setCanvasHidden(els.overlayCanvas, true);
        setCanvasHidden(els.compareCanvas, true);
        if (!(options && options.preserveReveal === true)) setRevealPercent(50, { render: false });
        if (els.downloadBtn) els.downloadBtn.style.display = 'none';
        if (els.downloadScaledBtn) els.downloadScaledBtn.style.display = 'none';
        syncAnimationButtons();
        if (!(options && options.skipAutoScale === true)) setAutoPixelSizeForLargeImages();
        if (shouldRender) renderPreview();
    }

    async function loadStaticImageFile(file, options) {
        if (!file) return;
        const imageName = (file.name || 'pixel-art').replace(/\.[^.]+$/, '');
        const img = new Image();
        img.decoding = 'async';
        const url = URL.createObjectURL(file);

        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(e);
            img.src = url;
        }).finally(() => URL.revokeObjectURL(url));

        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);

        if (!(options && options.keepAnimation)) {
            stopGifPreviewPlayback();
            state.animationFrames = [];
            state.animationPreviewPaused = false;
        }
        setOriginalCanvasFromCanvas(c, imageName, options);
    }

    async function decodeGifFrames(file) {
        if (typeof ImageDecoder !== 'function') {
            return [];
        }
        const decoder = new ImageDecoder({
            data: await file.arrayBuffer(),
            type: 'image/gif'
        });
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const frameCount = Math.min(120, Math.max(1, track && Number.isFinite(track.frameCount) ? track.frameCount : 1));
        const frames = [];
        for (let index = 0; index < frameCount; index += 1) {
            const decoded = await decoder.decode({ frameIndex: index });
            const image = decoded.image;
            const canvas = document.createElement('canvas');
            canvas.width = image.displayWidth || image.codedWidth;
            canvas.height = image.displayHeight || image.codedHeight;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0);
            frames.push({
                canvas,
                delay: Math.max(20, Math.round((image.duration || 100000) / 1000))
            });
            if (typeof image.close === 'function') image.close();
        }
        if (typeof decoder.close === 'function') decoder.close();
        return frames;
    }

    async function loadGifFile(file) {
        state.imageName = (file.name || 'pixel-art').replace(/\.[^.]+$/, '');
        let frames = [];
        try {
            frames = await decodeGifFrames(file);
        } catch {
            frames = [];
        }
        if (frames.length <= 1) {
            state.animationFrames = [];
            await loadStaticImageFile(file);
            setImagePoolHint('Animated GIF decoding is unavailable here, loaded the first frame.');
            return;
        }
        state.animationFrames = frames;
        state.animationPreviewIndex = 0;
        state.animationPreviewPaused = false;
        setOriginalCanvasFromCanvas(frames[0].canvas, state.imageName);
        renderGifFrameStrip();
        startGifPreviewPlayback();
        setImagePoolHint(`Loaded GIF with ${frames.length} frames. Save GIF returns an animated pixel-art GIF; Save Frames exports PNG frames.`);
    }

    function createBatchImageDescriptor(file) {
        return {
            id: 'batch-' + Date.now() + '-' + Math.random().toString(16).slice(2),
            file,
            name: String(file && file.name ? file.name : 'pixel-art').trim() || 'pixel-art',
            size: Number(file && file.size ? file.size : 0),
            type: String(file && file.type ? file.type : '').trim()
        };
    }

    function formatBatchSize(bytes) {
        const value = Number(bytes) || 0;
        if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB';
        if (value >= 1024) return Math.round(value / 1024) + ' KB';
        return value + ' B';
    }

    async function loadBatchImageById(batchImageId) {
        const entry = state.batchImages.find(item => item.id === batchImageId) || null;
        if (!entry || !entry.file) return;
        state.activeBatchImageId = entry.id;
        renderBatchQueue();
        await loadImageFile(entry.file, { fromBatchQueue: true });
    }

    function renderBatchQueue() {
        if (!els.batchQueue) return;
        els.batchQueue.innerHTML = '';
        for (const entry of state.batchImages) {
            const item = document.createElement('div');
            item.className = 'batch-item' + (entry.id === state.activeBatchImageId ? ' active' : '');
            const main = document.createElement('div');
            main.className = 'batch-item-main';
            const name = document.createElement('div');
            name.className = 'batch-item-name';
            name.textContent = entry.name;
            const meta = document.createElement('div');
            meta.className = 'batch-item-meta';
            meta.textContent = `${formatBatchSize(entry.size)}${entry.type ? ' • ' + entry.type : ''}`;
            main.appendChild(name);
            main.appendChild(meta);
            const actions = document.createElement('div');
            actions.className = 'batch-item-actions';
            const useButton = document.createElement('button');
            useButton.type = 'button';
            useButton.className = 'batch-mini-btn';
            useButton.textContent = 'Use';
            useButton.addEventListener('click', () => {
                void loadBatchImageById(entry.id);
            });
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'batch-mini-btn';
            removeButton.textContent = '×';
            removeButton.title = 'Remove from batch';
            removeButton.addEventListener('click', () => {
                state.batchImages = state.batchImages.filter(item => item.id !== entry.id);
                if (state.activeBatchImageId === entry.id) {
                    state.activeBatchImageId = state.batchImages[0] ? state.batchImages[0].id : '';
                    if (state.activeBatchImageId) {
                        void loadBatchImageById(state.activeBatchImageId);
                    }
                }
                renderBatchQueue();
            });
            actions.appendChild(useButton);
            actions.appendChild(removeButton);
            item.appendChild(main);
            item.appendChild(actions);
            els.batchQueue.appendChild(item);
        }
        if (els.clearBatchBtn) els.clearBatchBtn.style.display = state.batchImages.length > 0 ? 'flex' : 'none';
    }

    function clearBatchQueue() {
        state.batchImages = [];
        state.activeBatchImageId = '';
        renderBatchQueue();
    }

    async function loadImageFiles(files, options) {
        const nextFiles = Array.from(files || []).filter(Boolean);
        if (nextFiles.length === 0) return;
        const append = !!(options && options.append === true);
        const descriptors = nextFiles.map(createBatchImageDescriptor);
        state.batchImages = append ? state.batchImages.concat(descriptors) : descriptors;
        if (!state.activeBatchImageId) state.activeBatchImageId = state.batchImages[0] ? state.batchImages[0].id : '';
        renderBatchQueue();
        const firstToLoad = descriptors[0] && descriptors[0].file ? descriptors[0] : null;
        if (firstToLoad && (!append || !state.imageLoaded)) {
            state.activeBatchImageId = firstToLoad.id;
            await loadImageFile(firstToLoad.file, { fromBatchQueue: true });
        }
    }

    async function loadImageFile(file, options) {
        if (!file) return;
        if (!(options && options.fromBatchQueue === true)) {
            state.batchImages = [createBatchImageDescriptor(file)];
            state.activeBatchImageId = state.batchImages[0].id;
            renderBatchQueue();
        }
        if (isGifFile(file)) {
            await loadGifFile(file);
            return;
        }
        state.animationFrames = [];
        state.animationPreviewPaused = false;
        renderGifFrameStrip();
        await loadStaticImageFile(file);
    }

    function setImagePoolHint(text) {
        if (els.imagePoolHint) els.imagePoolHint.textContent = text;
    }

    function postDashboardMessage(type, payload, requestId) {
        const message = {
            source: 'pixel-art-converter',
            type,
            requestId: requestId || '',
            payload: payload || {}
        };
        if (typeof window.__URAGE_PIXEL_ART_AUTOMATION_RECEIVE__ === 'function') {
            window.__URAGE_PIXEL_ART_AUTOMATION_RECEIVE__(message);
        }
        if (!window.parent || window.parent === window) return;
        window.parent.postMessage(message, '*');
    }

    function postToolBridgeMessage(type, payload, requestId) {
        if (!window.parent || window.parent === window) return;
        window.parent.postMessage({
            source: 'urage-tool',
            type,
            requestId: requestId || '',
            payload: payload || {}
        }, '*');
    }

    function normalizeDashboardImagePools(pools) {
        if (!Array.isArray(pools)) return [];
        return pools.map(pool => ({
            id: String(pool.id || '').trim(),
            name: String(pool.name || 'Image Pool').trim() || 'Image Pool',
            images: Array.isArray(pool.images) ? pool.images : []
        })).filter(pool => pool.id);
    }

    function renderDashboardImagePools(pools) {
        state.dashboardImagePools = normalizeDashboardImagePools(pools);
        if (!els.imagePoolSelect || !els.imagePoolImageSelect) return;
        els.imagePoolSelect.innerHTML = '';
        if (state.dashboardImagePools.length === 0) {
            els.imagePoolSelect.appendChild(new Option('No dashboard pools loaded', ''));
            els.imagePoolImageSelect.innerHTML = '';
            els.imagePoolImageSelect.appendChild(new Option('Select a pool first', ''));
            setImagePoolHint('No image pools are available from the dashboard yet.');
            return;
        }
        for (const pool of state.dashboardImagePools) {
            els.imagePoolSelect.appendChild(new Option(`${pool.name} (${pool.images.length})`, pool.id));
        }
        renderDashboardImagePoolImages();
        setImagePoolHint('Loaded dashboard image pools. Pick a pool image and load it into the converter.');
    }

    function renderDashboardImagePoolImages() {
        if (!els.imagePoolSelect || !els.imagePoolImageSelect) return;
        const poolId = String(els.imagePoolSelect.value || '').trim();
        const pool = state.dashboardImagePools.find(entry => entry.id === poolId) || state.dashboardImagePools[0] || null;
        els.imagePoolImageSelect.innerHTML = '';
        if (!pool || pool.images.length === 0) {
            els.imagePoolImageSelect.appendChild(new Option('No images in this pool', ''));
            return;
        }
        pool.images.forEach((image, index) => {
            const label = String(image.fileName || image.name || image.source || image.url || `Image ${index + 1}`).trim();
            const option = new Option(label.length > 70 ? `${label.slice(0, 67)}...` : label, String(index));
            els.imagePoolImageSelect.appendChild(option);
        });
    }

    async function requestDashboardImagePools() {
        setImagePoolHint('Requesting dashboard image pools...');
        postDashboardMessage('pixel-art:request-image-pools', {});
        try {
            const response = await fetch('/api/image-pools');
            if (!response.ok) return;
            const pools = await response.json();
            const fallbackPools = normalizeDashboardImagePools(pools).map(pool => ({
                ...pool,
                images: pool.images.map((source, index) => ({
                    source,
                    url: String(source || '').trim(),
                    fileName: `pool-image-${index + 1}.png`
                }))
            }));
            if (state.dashboardImagePools.length === 0) {
                renderDashboardImagePools(fallbackPools);
            }
        } catch {}
    }

    async function loadImageUrl(url, fileName) {
        const sourceUrl = String(url || '').trim();
        if (!sourceUrl) throw new Error('No image URL was provided.');
        const response = await fetch(sourceUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to fetch image (${response.status}).`);
        const blob = await response.blob();
        await loadImageFile(new File([blob], fileName || 'pixel-source.png', { type: blob.type || 'image/png' }));
    }

    async function loadSelectedDashboardPoolImage() {
        if (!els.imagePoolSelect || !els.imagePoolImageSelect) return;
        const pool = state.dashboardImagePools.find(entry => entry.id === String(els.imagePoolSelect.value || '').trim()) || null;
        const imageIndex = Number.parseInt(String(els.imagePoolImageSelect.value || ''), 10);
        const image = pool && Number.isFinite(imageIndex) ? pool.images[imageIndex] : null;
        if (!image) {
            setImagePoolHint('Select an image pool entry first.');
            return;
        }
        try {
            await loadImageUrl(image.url || image.source || '', image.fileName || `pool-image-${imageIndex + 1}.png`);
            setImagePoolHint('Loaded pool image into the converter.');
        } catch (error) {
            setImagePoolHint('Pool image load failed: ' + (error && error.message ? error.message : String(error)));
        }
    }

    async function loadDataUrl(dataUrl, fileName) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await loadImageFile(new File([blob], fileName || 'pixel-source.png', { type: blob.type || 'image/png' }));
    }

    async function convertForDashboard(requestId, fileNameBase) {
        if (state.animationFrames && state.animationFrames.length > 1) {
            const animation = await renderAnimationForExport();
            if (!animation) throw new Error('Animated GIF conversion did not produce output frames.');
            const payload = {
                dataUrl: animation.dataUrl,
                fileName: `${fileNameBase || state.imageName || 'pixel-art'}-pixel.gif`,
                width: animation.width,
                height: animation.height,
                frames: animation.frames
            };
            postDashboardMessage('pixel-art:converted', payload, requestId);
            return payload;
        }
        const result = await renderForExport();
        if (!result || !result.canvas) throw new Error('Pixel conversion did not produce an output canvas.');
        const payload = {
            dataUrl: result.canvas.toDataURL('image/png'),
            fileName: `${fileNameBase || state.imageName || 'pixel-art'}-pixel.png`,
            width: result.canvas.width,
            height: result.canvas.height
        };
        postDashboardMessage('pixel-art:converted', payload, requestId);
        return payload;
    }

    async function exportProcessedImageToDashboard(requestId) {
        const rendered = await renderForExport();
        if (!rendered || !rendered.canvas) {
            postToolBridgeMessage('tool:error', {
                error: 'This tool has no processed image ready yet.'
            }, requestId);
            return;
        }
        postToolBridgeMessage('tool:export-image', {
            kind: 'image',
            dataUrl: rendered.canvas.toDataURL('image/png'),
            fileName: `${state.imageName || 'pixel-art'}-pixel.png`,
            width: rendered.canvas.width,
            height: rendered.canvas.height,
            sourceToolMode: state.previewViewMode
        }, requestId);
    }

    async function describeCurrentAssets() {
        if (state.animationFrames && state.animationFrames.length > 1) {
            const animation = await renderAnimationForExport();
            if (!animation) return [];
            return [{
                kind: 'gif',
                title: 'Pixel Art GIF',
                fileName: `${state.imageName || 'pixel-art'}-pixel.gif`,
                mimeType: 'image/gif',
                dataUrl: animation.dataUrl,
                width: animation.width,
                height: animation.height,
                previewKind: 'gif',
                previewUrl: animation.dataUrl,
                sourceDetail: 'Animated pixel-art conversion.',
                metadata: { sourceTool: 'pixel-art-converter', frames: animation.frames, mode: state.previewViewMode }
            }];
        }
        const rendered = await renderForExport();
        if (!rendered || !rendered.canvas) return [];
        const dataUrl = rendered.canvas.toDataURL('image/png');
        return [{
            kind: 'image',
            title: 'Pixel Art Image',
            fileName: `${state.imageName || 'pixel-art'}-pixel.png`,
            mimeType: 'image/png',
            dataUrl,
            width: rendered.canvas.width,
            height: rendered.canvas.height,
            previewKind: 'image',
            previewUrl: dataUrl,
            sourceDetail: 'Processed pixel-art conversion.',
            metadata: { sourceTool: 'pixel-art-converter', mode: state.previewViewMode }
        }];
    }

    async function loadDashboardImagePayload(payload, requestId) {
        setDashboardRevealOnlyMode(payload.focusReveal === true);
        try {
            if (payload.dataUrl) {
                await loadDataUrl(payload.dataUrl, payload.fileName);
            } else {
                await loadImageUrl(payload.url, payload.fileName);
            }
            postDashboardMessage('pixel-art:loaded', {
                fileName: String(payload.fileName || state.imageName || 'pixel-art').trim() || 'pixel-art'
            }, requestId);
            if (payload.autoConvert !== false) {
                return await convertForDashboard(requestId, String(payload.fileName || state.imageName || 'pixel-art').replace(/\.[^.]+$/, ''));
            }
            return { loaded: true };
        } catch (error) {
            postDashboardMessage('pixel-art:error', {
                error: error && error.message ? error.message : String(error)
            }, requestId);
            throw error;
        }
    }

    async function handleDashboardMessage(event) {
        const message = event && event.data ? event.data : null;
        if (!message || message.source !== 'urage-dashboard') return;
        if (message.type === 'tool:theme') {
            applyDashboardTheme(message.payload && message.payload.theme);
            return;
        }
        if (message.type === 'pixel-art:image-pools') {
            renderDashboardImagePools(message.payload && message.payload.pools);
            return;
        }
        if (message.type === 'tool:request-export-image') {
            await exportProcessedImageToDashboard(String(message.requestId || '').trim());
            return;
        }
        if (message.type !== 'pixel-art:load-image') return;
        const requestId = String(message.requestId || '').trim();
        const payload = message.payload || {};
        await loadDashboardImagePayload(payload, requestId).catch(() => {});
    }

    function getCanvasBlob(canvas, mime) {
        return new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), mime || 'image/png');
        });
    }

    async function downloadPngFromCanvas(canvas, filenameBase) {
        const blob = await getCanvasBlob(canvas, 'image/png');
        if (!blob) return;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        downloadBytes(`${filenameBase}.png`, bytes, 'image/png');
    }

    function scaleCanvasNearest(srcCanvas, scale) {
        const s = Math.max(1, Math.round(scale));
        const out = document.createElement('canvas');
        out.width = Math.max(1, srcCanvas.width * s);
        out.height = Math.max(1, srcCanvas.height * s);
        const ctx = out.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(srcCanvas, 0, 0, out.width, out.height);
        return out;
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to read GIF data.'));
            reader.readAsDataURL(blob);
        });
    }

    function encodeGifFromCanvases(frames) {
        return new Promise((resolve, reject) => {
            if (typeof GIF !== 'function') {
                reject(new Error('GIF encoder is unavailable.'));
                return;
            }
            const width = Math.max(...frames.map(frame => frame.canvas.width));
            const height = Math.max(...frames.map(frame => frame.canvas.height));
            const gif = new GIF({
                workers: 2,
                quality: 10,
                width,
                height,
                workerScript: '/vendor/gif.worker.js'
            });
            frames.forEach(frame => {
                const composed = document.createElement('canvas');
                composed.width = width;
                composed.height = height;
                const ctx = composed.getContext('2d');
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(frame.canvas, 0, 0);
                gif.addFrame(ctx, { copy: true, delay: Math.max(20, frame.delay || 100) });
            });
            gif.on('finished', blob => resolve(blob));
            gif.on('abort', () => reject(new Error('GIF export was aborted.')));
            gif.render();
        });
    }

    async function renderAnimationForExport() {
        if (!state.animationFrames || state.animationFrames.length <= 1) return null;
        const name = state.imageName || 'pixel-art';
        const outputs = [];
        const shouldRestartPreview = state.animationPreviewPaused !== true && state.animationFrames.length > 1;
        stopGifPreviewPlayback();
        for (const frame of state.animationFrames) {
            setOriginalCanvasFromCanvas(frame.canvas, name, { renderPreview: false, skipAutoScale: true, preserveReveal: true });
            const rendered = await renderForExport();
            if (!rendered || !rendered.canvas) continue;
            outputs.push({
                canvas: rendered.canvas,
                delay: Math.max(20, frame.delay || 100)
            });
        }
        if (state.animationFrames[0]) {
            setOriginalCanvasFromCanvas(state.animationFrames[0].canvas, name, { renderPreview: true, skipAutoScale: true, preserveReveal: true });
        }
        if (shouldRestartPreview) startGifPreviewPlayback();
        if (outputs.length === 0) return null;
        const gifBlob = await encodeGifFromCanvases(outputs);
        const frames = outputs.map((frame, index) => ({
            dataUrl: frame.canvas.toDataURL('image/png'),
            fileName: `${name}-pixel-frame-${String(index + 1).padStart(3, '0')}.png`,
            width: frame.canvas.width,
            height: frame.canvas.height,
            delay: frame.delay
        }));
        return {
            blob: gifBlob,
            dataUrl: await blobToDataUrl(gifBlob),
            frames,
            width: outputs[0].canvas.width,
            height: outputs[0].canvas.height
        };
    }

    async function renderForExport() {
        if (!state.imageLoaded) return null;

        // Ensure preset palettes are available for export even if preview wasn't rendered.
        applyPalettePresetIfAny();

        const quality = els.exportQualitySelect ? els.exportQualitySelect.value : 'original';
        const src = (quality === 'preview') ? getPreviewInputCanvas() : els.originalCanvas;
        if (!src) return null;

        const preResizeEnabled = !!(els.preResizeCheckbox && els.preResizeCheckbox.checked);
        const targetEnabled = !!(els.targetResCheckbox && els.targetResCheckbox.checked);
        const outputRes = els.outputResolutionSelect ? String(els.outputResolutionSelect.value || 'original') : 'original';

        let work = applyPreResizeIfEnabled(src);
        if (targetEnabled) {
            work = buildTargetNormalizedCanvas(work).canvas;
        }

        const scaleX = work.width / els.originalCanvas.width;
        const scaleY = work.height / els.originalCanvas.height;
        const params = getRenderParamsForScale(scaleX, scaleY);
        const sheet = getSpriteSheetParams();

        const out = document.createElement('canvas');
        const meta = sheet
            ? PAS.render.renderPixelArtSpriteSheet(work, out, params, sheet, null)
            : PAS.render.renderPixelArt(work, out, params);

        if (!meta) return null;

        // Optionally upscale back to original dimensions (only when we intentionally normalized to target res,
        // and only when exporting from the original image at original quality).
        const canUpscaleBack = (outputRes === 'original')
            && (quality === 'original')
            && targetEnabled
            && !preResizeEnabled
            && (src === els.originalCanvas);

        if (canUpscaleBack) {
            const sx = els.originalCanvas.width / out.width;
            const sy = els.originalCanvas.height / out.height;
            const s = Math.max(1, Math.round(Math.min(sx, sy)));
            if (s > 1) {
                const up = scaleCanvasNearest(out, s);
                return { canvas: up, meta, workScale: scaleX, note: 'upscaled' };
            }
        }

        return { canvas: out, meta, workScale: scaleX, note: 'native' };
    }

    async function onDownload() {
        const r = await renderForExport();
        if (!r) return;
        await downloadPngFromCanvas(r.canvas, `${state.imageName}-pixel`);
    }

    async function onDownloadAll() {
        if (!Array.isArray(state.batchImages) || state.batchImages.length <= 1) {
            await onDownload();
            return;
        }
        const originalBatchId = state.activeBatchImageId;
        const originalAnimationFrames = state.animationFrames.slice();
        const shouldRestartPreview = state.animationPreviewPaused !== true && state.animationFrames.length > 1;
        stopGifPreviewPlayback();
        for (const entry of state.batchImages) {
            if (!entry || !entry.file) continue;
            await loadBatchImageById(entry.id);
            const rendered = await renderForExport();
            if (!rendered || !rendered.canvas) continue;
            await downloadPngFromCanvas(rendered.canvas, `${state.imageName}-pixel`);
        }
        if (originalBatchId) {
            await loadBatchImageById(originalBatchId);
        }
        state.animationFrames = originalAnimationFrames;
        if (shouldRestartPreview && state.animationFrames.length > 1) startGifPreviewPlayback();
    }

    async function onDownload4kScale() {
        const r = await renderForExport();
        if (!r) return;

        const maxSide = Math.max(r.canvas.width, r.canvas.height);
        const targetMax = 4096;
        const factor = Math.max(1, Math.floor(targetMax / maxSide));
        const scaled = scaleCanvasNearest(r.canvas, factor);
        await downloadPngFromCanvas(scaled, `${state.imageName}-pixel-${factor}x`);
    }

    async function onDownloadGif() {
        const animation = await renderAnimationForExport();
        if (!animation || !animation.blob) return;
        const bytes = new Uint8Array(await animation.blob.arrayBuffer());
        downloadBytes(`${state.imageName || 'pixel-art'}-pixel.gif`, bytes, 'image/gif');
    }

    async function onDownloadFrames() {
        const animation = await renderAnimationForExport();
        if (!animation || !animation.frames) return;
        for (const frame of animation.frames) {
            const blob = await (await fetch(frame.dataUrl)).blob();
            const bytes = new Uint8Array(await blob.arrayBuffer());
            downloadBytes(frame.fileName, bytes, 'image/png');
        }
    }

    async function onExportIndexedPng() {
        const r = await renderForExport();
        if (!r) return;

        const ctx = r.canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, r.canvas.width, r.canvas.height);
        const extracted = PAS.png.extractUniquePaletteAndIndices(imageData, 256);
        if (!extracted) {
            alert('Indexed export failed: more than 256 unique colors.');
            return;
        }
        const bytes = PAS.png.encodeIndexedPng(r.canvas.width, r.canvas.height, extracted.palette, extracted.indices);
        downloadBytes(`${state.imageName}-indexed.png`, bytes, 'image/png');
    }

    function onExportPalette() {
        const p = (state.lastPreviewMeta && state.lastPreviewMeta.palette) ? state.lastPreviewMeta.palette : PAS.State.paletteCache.palette;
        PAS.palette.exportPaletteFiles(p);
    }

    function setPickingMode(on) {
        state.isPickingColor = !!on;
        if (els.pickColorBtn) {
            els.pickColorBtn.textContent = state.isPickingColor ? 'Click image...' : 'Sample Eye-dropper';
        }
        if (els.originalCanvas) {
            els.originalCanvas.style.cursor = state.isPickingColor ? 'crosshair' : '';
        }
    }

    function onPickFromCanvas(ev) {
        if (!state.isPickingColor) return;
        if (!state.imageLoaded) return;
        if (!els.originalCanvas) return;

        const rect = els.originalCanvas.getBoundingClientRect();
        const x = Math.floor((ev.clientX - rect.left) * (els.originalCanvas.width / rect.width));
        const y = Math.floor((ev.clientY - rect.top) * (els.originalCanvas.height / rect.height));
        const ctx = els.originalCanvas.getContext('2d');
        const d = ctx.getImageData(clampInt(x, 0, els.originalCanvas.width - 1), clampInt(y, 0, els.originalCanvas.height - 1), 1, 1).data;
        if (d[3] === 0) return; // ignore fully transparent samples
        if (els.bgColorPicker) els.bgColorPicker.value = rgbToHex(d[0], d[1], d[2]);
        setPickingMode(false);
        scheduleConvert();
    }

    function onDetectGrid() {
        if (!state.imageLoaded) return;
        if (els.lockGridCheckbox && els.lockGridCheckbox.checked && state.lockedGrid.size !== null) return;

        const w = buildWorkCanvasForPreview();
        if (!w) return;
        const src = w.workCanvas;
        const ctx = src.getContext('2d');
        const imgData = ctx.getImageData(0, 0, src.width, src.height);
        const currentSize = clampInt(els.blockSizeSlider.value, 1, 64);

        const best = PAS.grid.detectGridFromImageData(imgData, {
            currentSize,
            minSize: 2,
            maxSize: 64,
            tolerance: clampInt(els.colorToleranceSlider ? els.colorToleranceSlider.value : 8, 0, 64),
            maxBlocks: 140
        });

        const sx = w.scaleX || 1;
        const sy = w.scaleY || 1;
        const slen = Math.sqrt(Math.max(1e-9, sx * sy));
        const sizeOrig = Math.max(1, Math.round(best.size / slen));
        const oxOrig = Math.max(0, Math.round(best.ox / sx)) % sizeOrig;
        const oyOrig = Math.max(0, Math.round(best.oy / sy)) % sizeOrig;

        if (els.blockSizeSlider) els.blockSizeSlider.value = String(sizeOrig);
        if (els.offsetXSlider) els.offsetXSlider.value = String(oxOrig);
        if (els.offsetYSlider) els.offsetYSlider.value = String(oyOrig);

        if (els.lockGridCheckbox && els.lockGridCheckbox.checked) {
            state.lockedGrid = { size: sizeOrig, ox: oxOrig, oy: oyOrig };
        } else {
            state.lockedGrid = { size: null, ox: null, oy: null };
        }

        scheduleConvert();
    }

    function onGridLockChange() {
        if (!els.lockGridCheckbox || !els.lockGridCheckbox.checked) {
            state.lockedGrid = { size: null, ox: null, oy: null };
            return;
        }
        state.lockedGrid = {
            size: clampInt(els.blockSizeSlider.value, 1, 2048),
            ox: clampInt(els.offsetXSlider.value, 0, 2048),
            oy: clampInt(els.offsetYSlider.value, 0, 2048)
        };
    }

    function bind(el, ev, fn) {
        if (!el) return;
        el.addEventListener(ev, fn);
    }

    function bindAll() {
        bind(els.previewModeTwoBtn, 'click', () => setPreviewViewMode('two'));
        bind(els.previewModeRevealBtn, 'click', () => setPreviewViewMode('reveal'));
        bind(els.gifPlaybackToggleBtn, 'click', () => {
            if (!state.animationFrames || state.animationFrames.length <= 1) return;
            setGifPreviewPlaybackPaused(state.animationPreviewPaused !== true);
        });
        bind(els.fileInput, 'change', (e) => {
            void loadImageFiles(e.target.files, { append: true });
            if (e.target) e.target.value = '';
        });
        bind(els.clearBatchBtn, 'click', () => {
            clearBatchQueue();
        });
        bind(els.refreshImagePoolsBtn, 'click', requestDashboardImagePools);
        bind(els.imagePoolSelect, 'change', renderDashboardImagePoolImages);
        bind(els.loadPoolImageBtn, 'click', loadSelectedDashboardPoolImage);
        bind(els.applyPresetBtn, 'click', () => applyQuickPreset(els.quickPresetSelect ? els.quickPresetSelect.value : 'none'));
        bind(els.resetPresetBtn, 'click', restoreDefaults);
        bind(els.quickPresetSelect, 'change', () => {
            if (!els.quickPresetHint || !els.quickPresetSelect) return;
            const id = String(els.quickPresetSelect.value || 'none');
            const hints = {
                none: 'One-click starting points for common AI pixel-art issues.',
                true_pixel: 'Downsamples, palette-snaps, removes fake anti-aliasing, and exports a real low-resolution pixel image.',
                ai_mild: 'Mild cleanup + palette snapping. Good first try for AI pixel art.',
                ai_strong: 'Aggressive cleanup for messy AI images. Expect loss of detail.',
                palette_only: 'Only snaps colors to a palette (kills near-duplicates).',
                sprite_clean: 'Sprite-friendly cleanup with no added dithering.'
            };
            els.quickPresetHint.textContent = hints[id] || hints.none;
        });

        const scheduleOnInput = (el) => { bind(el, 'input', scheduleConvert); bind(el, 'change', scheduleConvert); };
        const renderOnInput = (el) => { bind(el, 'input', () => { updateReadouts(); renderPreview(); }); bind(el, 'change', () => { updateReadouts(); renderPreview(); }); };
        [
            els.pixelSizeSlider, els.autoScaleCheckbox, els.autoPixelSizeBasisSelect, els.autoConvertCheckbox,
            els.blockSizeSlider,
            els.advancedSamplingCheckbox, els.colorToleranceSlider, els.blockInsetSlider, els.alphaCutoffSlider, els.sampleStepSlider,
            els.offsetXSlider, els.offsetYSlider,
            els.preResizeCheckbox, els.preResizeXSlider, els.preResizeYSlider, els.preResizeLinkCheckbox, els.preResizeMethodSelect,
            els.paletteEnableCheckbox, els.paletteSizeSlider, els.paletteMethodSelect, els.lockPaletteCheckbox,
            els.gradientCrushCheckbox, els.valueStepsSlider, els.mergeSimilarCheckbox, els.mergeThresholdSlider, els.mergeMinSizeSlider, els.despeckleCheckbox, els.despeckleSlider,
            els.islandsCheckbox, els.islandsSlider,
            els.aaRemoveCheckbox, els.aaStrengthSlider,
            els.ditherCleanupCheckbox, els.ditherStrengthSlider,
            els.applyDitherCheckbox, els.applyDitherModeSelect, els.applyDitherSlider,
            els.outlineCheckbox, els.outlineColorPicker, els.outlineModeSelect, els.outlineThicknessSlider, els.outlineDetectionSelect,
            els.spriteSheetCheckbox, els.cellWSlider, els.cellHSlider, els.gapXSlider, els.gapYSlider,
            els.bgColorPicker, els.removeBgCheckbox, els.bgMatchSlider, els.preserveTransparencyCheckbox, els.minOpaqueSlider,
            els.fastPreviewCheckbox, els.targetResCheckbox, els.targetMaxSlider, els.targetResampleSelect,
            els.outputResolutionSelect, els.previewMaxSlider, els.exportQualitySelect
        ].forEach(scheduleOnInput);

        // Palette presets should apply immediately even when Auto-convert is off.
        bind(els.palettePresetSelect, 'change', () => {
            applyPalettePresetIfAny({ forceEnable: true });
            updateReadouts();
            forceRerender();
        });

        // Overlay is a visualization control: update even when Auto-convert is off.
        renderOnInput(els.overlayModeSelect);
        renderOnInput(els.overlayOpacitySlider);
        bind(els.revealSlider, 'input', () => {
            updateReadouts();
            setRevealPercent(els.revealSlider ? els.revealSlider.value : state.revealPercent);
        });
        bind(els.revealSlider, 'change', () => {
            updateReadouts();
            setRevealPercent(els.revealSlider ? els.revealSlider.value : state.revealPercent);
        });
        let revealPointerActive = false;
        const onRevealPointerDown = event => {
            if (!event || !els.compareCanvas || els.compareCanvas.classList.contains('hidden')) return;
            revealPointerActive = true;
            if (typeof event.preventDefault === 'function') event.preventDefault();
            if (event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
                try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
            }
            setRevealPercentFromClientX(event.clientX);
        };
        const onRevealPointerMove = event => {
            if (!revealPointerActive) return;
            if (typeof event.preventDefault === 'function') event.preventDefault();
            setRevealPercentFromClientX(event.clientX);
        };
        const onRevealPointerUp = event => {
            if (!revealPointerActive) return;
            revealPointerActive = false;
            if (event && event.currentTarget && typeof event.currentTarget.releasePointerCapture === 'function' && typeof event.pointerId === 'number') {
                try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
            }
        };
        bind(els.compareWrap, 'pointerdown', onRevealPointerDown);
        bind(els.compareWrap, 'pointermove', onRevealPointerMove);
        bind(els.compareWrap, 'pointerup', onRevealPointerUp);
        bind(els.compareWrap, 'pointercancel', onRevealPointerUp);
        bind(els.compareWrap, 'pointerleave', onRevealPointerUp);

        bind(els.detectGridBtn, 'click', onDetectGrid);
        bind(els.lockGridCheckbox, 'change', onGridLockChange);

        bind(els.preResizeLinkCheckbox, 'change', () => {
            if (!els.preResizeLinkCheckbox.checked) {
                updateReadouts();
                scheduleConvert();
                return;
            }
            if (els.preResizeXSlider && els.preResizeYSlider) {
                els.preResizeYSlider.value = els.preResizeXSlider.value;
            }
            updateReadouts();
            scheduleConvert();
        });
        bind(els.preResizeXSlider, 'input', () => {
            if (els.preResizeLinkCheckbox && els.preResizeLinkCheckbox.checked && els.preResizeYSlider) {
                els.preResizeYSlider.value = els.preResizeXSlider.value;
            }
        });
        bind(els.snapToBlocksBtn, 'click', () => {
            if (!state.imageLoaded) return;
            const bs = clampInt(els.blockSizeSlider.value, 1, 4096);
            const w0 = els.originalCanvas.width;
            const h0 = els.originalCanvas.height;
            if (!w0 || !h0 || bs <= 0) return;

            const roundTo = (v) => Math.max(bs, Math.round(v / bs) * bs);
            const wT = roundTo(w0);
            const hT = roundTo(h0);
            const sx = wT / w0;
            const sy = hT / h0;

            if (els.preResizeCheckbox) els.preResizeCheckbox.checked = true;

            if (els.preResizeLinkCheckbox && els.preResizeLinkCheckbox.checked) {
                // Uniform: pick the closer of snapping width or height.
                const sW = (Math.max(bs, Math.round(w0 / bs) * bs)) / w0;
                const sH = (Math.max(bs, Math.round(h0 / bs) * bs)) / h0;
                const s = (Math.abs(sW - 1) <= Math.abs(sH - 1)) ? sW : sH;
                if (els.preResizeXSlider) els.preResizeXSlider.value = String(clampInt(Math.round(s * 100), 80, 120));
                if (els.preResizeYSlider) els.preResizeYSlider.value = els.preResizeXSlider.value;
            } else {
                if (els.preResizeXSlider) els.preResizeXSlider.value = String(clampInt(Math.round(sx * 100), 80, 120));
                if (els.preResizeYSlider) els.preResizeYSlider.value = String(clampInt(Math.round(sy * 100), 80, 120));
            }

            updateReadouts();
            scheduleConvert();
        });

        bind(els.pickColorBtn, 'click', () => setPickingMode(!state.isPickingColor));
        bind(els.originalCanvas, 'click', onPickFromCanvas);

        bind(els.convertBtn, 'click', () => {
            updateReadouts();
            renderPreview();
        });

        bind(els.downloadBtn, 'click', onDownload);
        bind(els.downloadAllBtn, 'click', onDownloadAll);
        bind(els.downloadScaledBtn, 'click', onDownload4kScale);
        bind(els.downloadGifBtn, 'click', onDownloadGif);
        bind(els.downloadFramesBtn, 'click', onDownloadFrames);
        bind(els.exportPaletteBtn, 'click', onExportPalette);
        bind(els.exportIndexedBtn, 'click', onExportIndexedPng);

        bind(els.autoScaleCheckbox, 'change', () => setAutoPixelSizeForLargeImages());
        bind(els.autoPixelSizeBasisSelect, 'change', () => setAutoPixelSizeForLargeImages());
    }

    window.__pixelArtToolReady = false;
    window.__pixelArtLoadImagePayload = loadDashboardImagePayload;
    window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
    window.__urageToolDescribeCurrentAsset = async () => (await describeCurrentAssets())[0] || null;
    applyDashboardTheme(document.body.getAttribute('data-dashboard-theme') || 'fire');
    setPreviewViewMode('two');
    updateReadouts();
    window.addEventListener('message', event => {
        void handleDashboardMessage(event);
    });
    bindAll();
    captureDefaultsOnce();
    applyPalettePresetIfAny();
    updateReadouts();
    setImagePoolHint('Dashboard image pools load on demand. Use Refresh pools when you need them.');
    window.__pixelArtToolReady = true;
    postDashboardMessage('pixel-art:ready', {});
})();
