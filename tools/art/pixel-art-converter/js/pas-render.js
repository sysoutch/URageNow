(function(global) {
    'use strict';

    const PAS = global.PAS = global.PAS || {};
    const { clampInt } = PAS.util;
    const { forEachBlock, fillRectData } = PAS.grid;

    function getDominantColorInRect(data, startX, startY, width, height, blockW, blockH, options) {
        const colorTolerance = options ? clampInt(options.colorTolerance, 0, 64) : 0;
        const inset = options ? clampInt(options.inset, 0, 256) : 0;
        const alphaCutoff = options ? clampInt(options.alphaCutoff, 0, 255) : 1;
        const sampleStep = options ? clampInt(options.sampleStep, 1, 16) : 1;
        const minOpaquePct = options ? clampInt(options.minOpaquePct, 0, 100) : 0;

        const minDim = Math.min(blockW, blockH);
        const effectiveInset = Math.max(0, Math.min(inset, Math.floor((minDim - 1) / 2)));
        const yEnd = blockH - effectiveInset;
        const xEnd = blockW - effectiveInset;

        const quantize = (v) => {
            if (colorTolerance <= 0) return v;
            const q = Math.round(v / colorTolerance) * colorTolerance;
            return Math.max(0, Math.min(255, q));
        };

        const buckets = new Map(); // key (0xRRGGBB) => { sampleCount, weight, rSum, gSum, bSum, aSum }
        let bestKey = null;
        let bestWeight = -1;
        let totalSamples = 0;
        let opaqueSamples = 0;

        for (let y = effectiveInset; y < yEnd && startY + y < height; y += sampleStep) {
            for (let x = effectiveInset; x < xEnd && startX + x < width; x += sampleStep) {
                const idx = ((startY + y) * width + (startX + x)) * 4;
                const a = data[idx + 3];
                totalSamples++;
                if (a < alphaCutoff) continue;
                opaqueSamples++;

                const r0 = data[idx];
                const g0 = data[idx + 1];
                const b0 = data[idx + 2];
                const r = quantize(r0);
                const g = quantize(g0);
                const b = quantize(b0);
                const key = (r << 16) | (g << 8) | b;

                const weight = Math.max(1, a);
                let bucket = buckets.get(key);
                if (!bucket) {
                    bucket = { sampleCount: 0, weight: 0, rSum: 0, gSum: 0, bSum: 0, aSum: 0 };
                    buckets.set(key, bucket);
                }

                bucket.sampleCount++;
                bucket.weight += weight;
                bucket.rSum += r0 * weight;
                bucket.gSum += g0 * weight;
                bucket.bSum += b0 * weight;
                bucket.aSum += a;

                if (bucket.weight > bestWeight) {
                    bestWeight = bucket.weight;
                    bestKey = key;
                }
            }
        }

        if (minOpaquePct > 0 && totalSamples > 0) {
            const pct = (opaqueSamples * 100) / totalSamples;
            if (pct < minOpaquePct) return { r: 0, g: 0, b: 0, a: 0 };
        }
        if (bestKey === null) return { r: 0, g: 0, b: 0, a: 0 };
        const best = buckets.get(bestKey);
        return {
            r: Math.round(best.rSum / Math.max(1, best.weight)),
            g: Math.round(best.gSum / Math.max(1, best.weight)),
            b: Math.round(best.bSum / Math.max(1, best.weight)),
            a: Math.round(best.aSum / Math.max(1, best.sampleCount))
        };
    }
    function bleedTransparentEdgeColors(data, width, height, options) {
        const minOpaqueAlpha = clampInt(options?.minOpaqueAlpha, 0, 255);
        const maxEdgeAlpha = clampInt(options?.maxEdgeAlpha, 0, 255);
        const searchRadius = clampInt(options?.searchRadius, 1, 8);
        const source = new Uint8ClampedArray(data);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const alpha = source[idx + 3];
                if (alpha <= 0 || alpha >= maxEdgeAlpha) {
                    continue;
                }
                let weightTotal = 0;
                let rTotal = 0;
                let gTotal = 0;
                let bTotal = 0;
                for (let offsetY = -searchRadius; offsetY <= searchRadius; offsetY++) {
                    const sampleY = y + offsetY;
                    if (sampleY < 0 || sampleY >= height) {
                        continue;
                    }
                    for (let offsetX = -searchRadius; offsetX <= searchRadius; offsetX++) {
                        const sampleX = x + offsetX;
                        if (sampleX < 0 || sampleX >= width || (offsetX === 0 && offsetY === 0)) {
                            continue;
                        }
                        const sampleIdx = (sampleY * width + sampleX) * 4;
                        const sampleAlpha = source[sampleIdx + 3];
                        if (sampleAlpha < minOpaqueAlpha) {
                            continue;
                        }
                        const distance = Math.abs(offsetX) + Math.abs(offsetY);
                        const distanceWeight = 1 / Math.max(1, distance);
                        const weight = sampleAlpha * distanceWeight;
                        weightTotal += weight;
                        rTotal += source[sampleIdx] * weight;
                        gTotal += source[sampleIdx + 1] * weight;
                        bTotal += source[sampleIdx + 2] * weight;
                    }
                }
                if (weightTotal <= 0) {
                    continue;
                }
                data[idx] = Math.round(rTotal / weightTotal);
                data[idx + 1] = Math.round(gTotal / weightTotal);
                data[idx + 2] = Math.round(bTotal / weightTotal);
            }
        }
    }

    function renderPixelArt(srcCanvas, dstCanvas, params) {
        const width = srcCanvas.width;
        const height = srcCanvas.height;
        if (!width || !height) return null;

        const srcCtx = srcCanvas.getContext('2d');
        const dstCtx = dstCanvas.getContext('2d');

        const pixelSize = clampInt(params.pixelSize, 1, 2048);
        const blockSize = clampInt(params.blockSize, 1, 2048);
        const offsetX = clampInt(params.offsetX || 0, 0, 2048);
        const offsetY = clampInt(params.offsetY || 0, 0, 2048);

        const removeBg = !!params.removeBg;
        const forceOpaqueBlocks = params.forceOpaqueBlocks !== false;
        const bgRgb = params.bgRgb;
        const bgMatch = clampInt(params.bgMatch, 0, 255);

        const sampling = params.sampling || { colorTolerance: 0, inset: 0, alphaCutoff: 1, sampleStep: 1 };
        const cleanup = params.cleanup || {};
        const paletteParams = params.palette || { enabled: false };
        const wantMasks = params.wantMasks || {};

        dstCanvas.width = width;
        dstCanvas.height = height;
        dstCtx.clearRect(0, 0, width, height);

        const srcImageData = srcCtx.getImageData(0, 0, width, height);
        const srcData = srcImageData.data;

        let work = new Uint8ClampedArray(srcData); // copy
        bleedTransparentEdgeColors(work, width, height, {
            minOpaqueAlpha: 224,
            maxEdgeAlpha: 254,
            searchRadius: 2
        });

        const snappedMask = wantMasks.snapped ? new Uint8Array(width * height) : null;
        const aaMask = wantMasks.aa ? new Uint8Array(width * height) : null;
        const ditherMask = wantMasks.dither ? new Uint8Array(width * height) : null;
        const islandMask = wantMasks.islands ? new Uint8Array(width * height) : null;
        const outlineMask = wantMasks.outline ? new Uint8Array(width * height) : null;

        if (cleanup.gradientSteps && cleanup.gradientSteps > 1) PAS.cleanup.gradientCrush(work, width, height, cleanup.gradientSteps);
        if (cleanup.applyDitherAmount && cleanup.applyDitherAmount > 0) {
            if (cleanup.applyDitherMode === 'floyd-steinberg') PAS.cleanup.applyFloydSteinbergDither(work, width, height, cleanup.applyDitherAmount);
            else PAS.cleanup.applyOrderedDither(work, width, height, cleanup.applyDitherAmount);
        }
        if (cleanup.mergeSimilar && cleanup.mergeSimilar.enabled) {
            PAS.cleanup.mergeSimilarRegions(work, width, height, cleanup.mergeSimilar.threshold, cleanup.mergeSimilar.minSize, null);
        }

        const palette = PAS.palette.resolvePaletteForWork(work, width, height, paletteParams);
        if (palette && palette.length) PAS.palette.snapToPalette(work, width, height, palette, snappedMask);

        if (cleanup.ditherCleanupStrength && cleanup.ditherCleanupStrength > 0) PAS.cleanup.cleanDither(work, width, height, cleanup.ditherCleanupStrength, ditherMask);
        if (cleanup.despeckleStrength && cleanup.despeckleStrength > 0) PAS.cleanup.despeckle(work, width, height, cleanup.despeckleStrength, null);
        if (cleanup.islandMinSize && cleanup.islandMinSize > 0) PAS.cleanup.removeTinyIslands(work, width, height, cleanup.islandMinSize, islandMask);
        if (cleanup.aaStrength && cleanup.aaStrength > 0) PAS.cleanup.removeAntiAlias(work, width, height, cleanup.aaStrength, aaMask);
        if (cleanup.outline && cleanup.outline.enabled) PAS.cleanup.applyOutlinePass(work, width, height, cleanup.outline.color, cleanup.outline.mode, cleanup.outline, outlineMask);

        // Stage 1: pre-pixelate
        let stage = work;
        if (pixelSize > 1) {
            const stageSampling = { ...sampling, inset: 0 };
            const stageData = new Uint8ClampedArray(stage.length);
            forEachBlock(width, height, pixelSize, offsetX % pixelSize, offsetY % pixelSize, (x0, y0, bw, bh) => {
                const c = getDominantColorInRect(stage, x0, y0, width, height, bw, bh, stageSampling);
                if (forceOpaqueBlocks && c.a > 0) c.a = 255;
                fillRectData(stageData, width, x0, y0, bw, bh, c.r, c.g, c.b, c.a);
            });
            stage = stageData;
        }

        // Stage 2: block merge
        const out = new Uint8ClampedArray(stage.length);
        forEachBlock(width, height, blockSize, offsetX % blockSize, offsetY % blockSize, (x0, y0, bw, bh) => {
            let c = getDominantColorInRect(stage, x0, y0, width, height, bw, bh, sampling);

            if (palette && palette.length) {
                const pi = PAS.palette.nearestPaletteIndex(c.r, c.g, c.b, palette);
                c = { r: palette[pi].r, g: palette[pi].g, b: palette[pi].b, a: c.a };
            }
            if (forceOpaqueBlocks && c.a > 0) c.a = 255;

            if (removeBg && bgRgb) {
                if (Math.abs(c.r - bgRgb.r) < bgMatch && Math.abs(c.g - bgRgb.g) < bgMatch && Math.abs(c.b - bgRgb.b) < bgMatch) {
                    return;
                }
            }
            fillRectData(out, width, x0, y0, bw, bh, c.r, c.g, c.b, c.a);
        });

        dstCtx.putImageData(new ImageData(out, width, height), 0, 0);

        return {
            width,
            height,
            srcData,
            outData: out,
            palette,
            masks: { snappedMask, aaMask, ditherMask, islandMask, outlineMask }
        };
    }

    function renderPixelArtSpriteSheet(srcCanvas, dstCanvas, params, sheet, renderPaletteSwatches) {
        const width = srcCanvas.width;
        const height = srcCanvas.height;
        if (!width || !height) return null;

        const cellW = clampInt(sheet.cellW, 1, width);
        const cellH = clampInt(sheet.cellH, 1, height);
        const gapX = clampInt(sheet.gapX, 0, 2048);
        const gapY = clampInt(sheet.gapY, 0, 2048);

        const srcCtx = srcCanvas.getContext('2d');
        const srcImageData = srcCtx.getImageData(0, 0, width, height);
        const srcData = srcImageData.data;

        // Start with original pixels so gaps/margins stay intact.
        const out = new Uint8ClampedArray(srcData);

        dstCanvas.width = width;
        dstCanvas.height = height;

        // Build palette once for the full sheet if locked.
        if (params.palette && params.palette.enabled && params.palette.locked) {
            const work = new Uint8ClampedArray(srcData);
            const palette = PAS.palette.resolvePaletteForWork(work, width, height, params.palette);
            if (palette && renderPaletteSwatches) renderPaletteSwatches(palette);
        }

        const tmpIn = document.createElement('canvas');
        const tmpOut = document.createElement('canvas');
        const inCtx = tmpIn.getContext('2d');

        for (let y = 0; y + cellH <= height; y += (cellH + gapY)) {
            for (let x = 0; x + cellW <= width; x += (cellW + gapX)) {
                tmpIn.width = cellW;
                tmpIn.height = cellH;
                tmpOut.width = cellW;
                tmpOut.height = cellH;

                const cellImg = srcCtx.getImageData(x, y, cellW, cellH);
                inCtx.putImageData(cellImg, 0, 0);

                const meta = renderPixelArt(tmpIn, tmpOut, params);
                if (!meta) continue;

                // Copy cell output into sheet output
                for (let cy = 0; cy < cellH; cy++) {
                    const srcRow = cy * cellW * 4;
                    const dstRow = ((y + cy) * width + x) * 4;
                    out.set(meta.outData.subarray(srcRow, srcRow + cellW * 4), dstRow);
                }
            }
        }

        dstCanvas.getContext('2d').putImageData(new ImageData(out, width, height), 0, 0);
        return { width, height, srcData, outData: out, palette: PAS.State.paletteCache.palette, masks: {} };
    }

    function renderOverlay(overlayCanvas, meta, mode, opacityPct) {
        if (!overlayCanvas) return;
        if (!meta || !meta.width || !meta.height) return;

        const modeKey = String(mode || 'none');
        const opacity = clampInt(opacityPct, 0, 100) / 100;
        if (modeKey === 'none' || opacity <= 0) {
            overlayCanvas.classList.add('hidden');
            return;
        }

        overlayCanvas.width = meta.width;
        overlayCanvas.height = meta.height;
        overlayCanvas.classList.remove('hidden');
        const ctx = overlayCanvas.getContext('2d');

        const out = new Uint8ClampedArray(meta.width * meta.height * 4);
        const a = Math.round(255 * opacity);

        if (modeKey === 'diff') {
            for (let i = 0; i < meta.outData.length; i += 4) {
                const changed = meta.outData[i] !== meta.srcData[i]
                    || meta.outData[i + 1] !== meta.srcData[i + 1]
                    || meta.outData[i + 2] !== meta.srcData[i + 2]
                    || meta.outData[i + 3] !== meta.srcData[i + 3];
                if (!changed) continue;
                out[i] = 255; out[i + 1] = 64; out[i + 2] = 64; out[i + 3] = a;
            }
        } else {
            let mask = null;
            let color = { r: 120, g: 200, b: 255 };
            if (modeKey === 'snapped') { mask = meta.masks.snappedMask; color = { r: 120, g: 200, b: 255 }; }
            if (modeKey === 'aa') { mask = meta.masks.aaMask; color = { r: 255, g: 120, b: 220 }; }
            if (modeKey === 'dither') { mask = meta.masks.ditherMask; color = { r: 255, g: 210, b: 120 }; }
            if (modeKey === 'islands') { mask = meta.masks.islandMask; color = { r: 160, g: 255, b: 160 }; }
            if (modeKey === 'outline') { mask = meta.masks.outlineMask; color = { r: 255, g: 255, b: 160 }; }
            if (!mask) {
                overlayCanvas.classList.add('hidden');
                return;
            }
            for (let p = 0; p < mask.length; p++) {
                if (!mask[p]) continue;
                const i = p * 4;
                out[i] = color.r; out[i + 1] = color.g; out[i + 2] = color.b; out[i + 3] = a;
            }
        }

        ctx.clearRect(0, 0, meta.width, meta.height);
        ctx.putImageData(new ImageData(out, meta.width, meta.height), 0, 0);
    }

    PAS.render = {
        renderPixelArt,
        renderPixelArtSpriteSheet,
        renderOverlay
    };
})(window);
