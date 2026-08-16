(function(global) {
    'use strict';

    const PAS = global.PAS = global.PAS || {};
    const { clampInt, getRgbKeyAt } = PAS.util;

    function gradientCrush(data, width, height, steps) {
        const s = clampInt(steps, 0, 64);
        if (s <= 1) return;

        const step = 255 / (s - 1);
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a === 0) continue;

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const q = Math.max(0, Math.min(255, Math.round(y / step) * step));
            const mul = (y > 1e-6) ? (q / y) : 0;

            data[i] = clampInt(r * mul, 0, 255);
            data[i + 1] = clampInt(g * mul, 0, 255);
            data[i + 2] = clampInt(b * mul, 0, 255);
        }
    }

    const BAYER_4 = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ];

    function applyOrderedDither(data, width, height, amountPct) {
        const amount = clampInt(amountPct, 0, 100) / 100;
        if (amount <= 0) return;

        const amp = 48 * amount;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const a = data[idx + 3];
                if (a === 0) continue;

                const t = (BAYER_4[y & 3][x & 3] / 16) - 0.5;
                const d = t * amp;
                data[idx] = clampInt(data[idx] + d, 0, 255);
                data[idx + 1] = clampInt(data[idx + 1] + d, 0, 255);
                data[idx + 2] = clampInt(data[idx + 2] + d, 0, 255);
            }
        }
    }

    function applyFloydSteinbergDither(data, width, height, amountPct) {
        const amount = clampInt(amountPct, 0, 100) / 100;
        if (amount <= 0) return;

        const work = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) work[i] = data[i];
        const diffuse = (index, factor, errors) => {
            if (index < 0 || index >= work.length) return;
            if (work[index + 3] === 0) return;
            work[index] = clampInt(work[index] + errors[0] * factor, 0, 255);
            work[index + 1] = clampInt(work[index + 1] + errors[1] * factor, 0, 255);
            work[index + 2] = clampInt(work[index + 2] + errors[2] * factor, 0, 255);
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (work[idx + 3] === 0) continue;

                const original = [work[idx], work[idx + 1], work[idx + 2]];
                const quantized = original.map(channel => {
                    const snapped = (channel / 255) < 0.5 ? 0 : 255;
                    return clampInt(channel + (snapped - channel) * amount, 0, 255);
                });

                const errors = [
                    original[0] - quantized[0],
                    original[1] - quantized[1],
                    original[2] - quantized[2]
                ];

                work[idx] = quantized[0];
                work[idx + 1] = quantized[1];
                work[idx + 2] = quantized[2];

                if (x + 1 < width) diffuse(idx + 4, 7 / 16, errors);
                if (y + 1 < height) {
                    if (x > 0) diffuse(idx + (width - 1) * 4, 3 / 16, errors);
                    diffuse(idx + width * 4, 5 / 16, errors);
                    if (x + 1 < width) diffuse(idx + (width + 1) * 4, 1 / 16, errors);
                }
            }
        }

        for (let i = 0; i < data.length; i += 4) {
            data[i] = clampInt(work[i], 0, 255);
            data[i + 1] = clampInt(work[i + 1], 0, 255);
            data[i + 2] = clampInt(work[i + 2], 0, 255);
        }
    }

    function cleanDither(data, width, height, strengthPct, ditherMask) {
        const strength = clampInt(strengthPct, 0, 100) / 100;
        if (strength <= 0) return;

        const keys = new Uint32Array(width * height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            keys[p] = getRgbKeyAt(data, i);
        }

        function mark(x, y) {
            if (!ditherMask) return;
            ditherMask[y * width + x] = 255;
        }

        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const p00 = y * width + x;
                const p10 = p00 + 1;
                const p01 = p00 + width;
                const p11 = p01 + 1;

                const a = keys[p00];
                const b = keys[p10];
                const c = keys[p01];
                const d = keys[p11];

                const isChecker = (a === d && b === c && a !== b) || (a === c && b === d && a !== b);
                if (!isChecker) continue;

                let countA = 0, countB = 0;
                const ca = a;
                const cb = b;
                for (let yy = y - 1; yy <= y + 2; yy++) {
                    if (yy < 0 || yy >= height) continue;
                    for (let xx = x - 1; xx <= x + 2; xx++) {
                        if (xx < 0 || xx >= width) continue;
                        if ((xx === x || xx === x + 1) && (yy === y || yy === y + 1)) continue;
                        const k = keys[yy * width + xx];
                        if (k === ca) countA++;
                        if (k === cb) countB++;
                    }
                }
                const total = countA + countB;
                const diffRatio = total > 0 ? (Math.abs(countA - countB) / total) : 0;
                if (diffRatio < (1 - strength)) continue;

                const winner = (countB > countA) ? cb : ca;
                keys[p00] = winner; keys[p10] = winner; keys[p01] = winner; keys[p11] = winner;
                const wR = (winner >> 16) & 255;
                const wG = (winner >> 8) & 255;
                const wB = winner & 255;
                for (const p of [p00, p10, p01, p11]) {
                    const idx = p * 4;
                    data[idx] = wR; data[idx + 1] = wG; data[idx + 2] = wB;
                    mark(p % width, Math.floor(p / width));
                }
            }
        }
    }

    function despeckle(data, width, height, strengthPct, mask) {
        const strength = clampInt(strengthPct, 0, 100) / 100;
        if (strength <= 0) return;

        const keys = new Uint32Array(width * height);
        const alpha = new Uint8Array(width * height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            keys[p] = getRgbKeyAt(data, i);
            alpha[p] = data[i + 3];
        }

        const outKeys = new Uint32Array(keys);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const p = y * width + x;
                if (alpha[p] === 0) continue;

                const neigh = [
                    keys[p - width - 1], keys[p - width], keys[p - width + 1],
                    keys[p - 1], keys[p + 1],
                    keys[p + width - 1], keys[p + width], keys[p + width + 1]
                ];
                let mode = neigh[0], modeCount = 0;
                for (let i = 0; i < neigh.length; i++) {
                    const k = neigh[i];
                    let c = 0;
                    for (let j = 0; j < neigh.length; j++) if (neigh[j] === k) c++;
                    if (c > modeCount) { modeCount = c; mode = k; }
                }

                const required = Math.max(5, Math.round(8 - strength * 3));
                if (modeCount >= required && mode !== keys[p]) {
                    outKeys[p] = mode;
                    if (mask) mask[p] = 255;
                }
            }
        }

        for (let p = 0; p < outKeys.length; p++) {
            const idx = p * 4;
            const k = outKeys[p];
            data[idx] = (k >> 16) & 255;
            data[idx + 1] = (k >> 8) & 255;
            data[idx + 2] = k & 255;
        }
    }

    function removeAntiAlias(data, width, height, strengthPct, mask) {
        const strength = clampInt(strengthPct, 0, 100) / 100;
        if (strength <= 0) return;

        const keys = new Uint32Array(width * height);
        const alpha = new Uint8Array(width * height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            keys[p] = getRgbKeyAt(data, i);
            alpha[p] = data[i + 3];
        }

        const outKeys = new Uint32Array(keys);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const p = y * width + x;
                if (alpha[p] === 0) continue;

                const n = keys[p - width];
                const s = keys[p + width];
                const w = keys[p - 1];
                const e = keys[p + 1];

                const neigh = [n, s, w, e];
                let mode = neigh[0], modeCount = 0;
                for (let i = 0; i < neigh.length; i++) {
                    const k = neigh[i];
                    let c = 0;
                    for (let j = 0; j < neigh.length; j++) if (neigh[j] === k) c++;
                    if (c > modeCount) { modeCount = c; mode = k; }
                }

                const required = Math.max(3, Math.round(4 - strength));
                if (modeCount >= required && mode !== keys[p]) {
                    outKeys[p] = mode;
                    if (mask) mask[p] = 255;
                }
            }
        }

        for (let p = 0; p < outKeys.length; p++) {
            const idx = p * 4;
            const k = outKeys[p];
            data[idx] = (k >> 16) & 255;
            data[idx + 1] = (k >> 8) & 255;
            data[idx + 2] = k & 255;
        }
    }

    function removeTinyIslands(data, width, height, minSize, mask) {
        const m = clampInt(minSize, 0, 1000000);
        if (m <= 0) return;

        const keys = new Uint32Array(width * height);
        const alpha = new Uint8Array(width * height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            keys[p] = getRgbKeyAt(data, i);
            alpha[p] = data[i + 3];
        }

        const visited = new Uint8Array(width * height);
        const q = new Int32Array(width * height);

        function neighborMode(p) {
            const x = p % width;
            const y = (p / width) | 0;
            const neigh = [];
            for (let yy = y - 1; yy <= y + 1; yy++) {
                if (yy < 0 || yy >= height) continue;
                for (let xx = x - 1; xx <= x + 1; xx++) {
                    if (xx < 0 || xx >= width) continue;
                    if (xx === x && yy === y) continue;
                    const pp = yy * width + xx;
                    if (alpha[pp] === 0) continue;
                    neigh.push(keys[pp]);
                }
            }
            if (neigh.length === 0) return keys[p];

            let mode = neigh[0], modeCount = 0;
            for (let i = 0; i < neigh.length; i++) {
                const k = neigh[i];
                let c = 0;
                for (let j = 0; j < neigh.length; j++) if (neigh[j] === k) c++;
                if (c > modeCount) { modeCount = c; mode = k; }
            }
            return mode;
        }

        for (let p0 = 0; p0 < keys.length; p0++) {
            if (visited[p0]) continue;
            if (alpha[p0] === 0) { visited[p0] = 1; continue; }

            const k0 = keys[p0];
            let qh = 0, qt = 0;
            q[qt++] = p0;
            visited[p0] = 1;

            while (qh < qt) {
                const p = q[qh++];
                const x = p % width;
                const y = (p / width) | 0;
                const n4 = [
                    (x > 0) ? (p - 1) : -1,
                    (x < width - 1) ? (p + 1) : -1,
                    (y > 0) ? (p - width) : -1,
                    (y < height - 1) ? (p + width) : -1
                ];
                for (const n of n4) {
                    if (n < 0) continue;
                    if (visited[n]) continue;
                    if (alpha[n] === 0) { visited[n] = 1; continue; }
                    if (keys[n] !== k0) continue;
                    visited[n] = 1;
                    q[qt++] = n;
                }
            }

            const size = qt;
            if (size >= m) continue;

            const replacement = neighborMode(p0);
            const rr = (replacement >> 16) & 255;
            const rg = (replacement >> 8) & 255;
            const rb = replacement & 255;

            for (let i = 0; i < qt; i++) {
                const p = q[i];
                const idx = p * 4;
                data[idx] = rr;
                data[idx + 1] = rg;
                data[idx + 2] = rb;
                if (mask) mask[p] = 255;
            }
        }
    }

    function averageRgb(samples) {
        if (!samples || samples.length === 0) return { r: 0, g: 0, b: 0 };
        let r = 0, g = 0, b = 0;
        for (const sample of samples) {
            r += sample.r;
            g += sample.g;
            b += sample.b;
        }
        return {
            r: Math.round(r / samples.length),
            g: Math.round(g / samples.length),
            b: Math.round(b / samples.length)
        };
    }

    function colorDistanceSquared(a, b) {
        const dr = a.r - b.r;
        const dg = a.g - b.g;
        const db = a.b - b.b;
        return dr * dr + dg * dg + db * db;
    }

    function buildSilhouetteMask(data, width, height, detectionMode) {
        const pixels = width * height;
        const silhouette = new Uint8Array(pixels);
        let hasTransparency = false;
        for (let p = 0; p < pixels; p++) {
            if (data[p * 4 + 3] < 250) {
                hasTransparency = true;
                break;
            }
        }
        if (hasTransparency || detectionMode === 'alpha') {
            for (let p = 0; p < pixels; p++) {
                silhouette[p] = data[p * 4 + 3] >= 16 ? 1 : 0;
            }
            return silhouette;
        }

        const samples = [];
        const pushSample = (x, y) => {
            const idx = (y * width + x) * 4;
            samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
        };
        if (detectionMode === 'corners' || detectionMode === 'auto') {
            pushSample(0, 0);
            pushSample(width - 1, 0);
            pushSample(0, height - 1);
            pushSample(width - 1, height - 1);
        }
        if (detectionMode === 'edges' || (detectionMode === 'auto' && samples.length < 8)) {
            for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 12))) {
                pushSample(x, 0);
                pushSample(x, height - 1);
            }
            for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 12))) {
                pushSample(0, y);
                pushSample(width - 1, y);
            }
        }

        if (samples.length > 0 && detectionMode !== 'contrast') {
            const background = averageRgb(samples);
            const threshold = detectionMode === 'corners' ? 34 * 34 : 42 * 42;
            for (let p = 0; p < pixels; p++) {
                const idx = p * 4;
                const color = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
                silhouette[p] = colorDistanceSquared(color, background) > threshold ? 1 : 0;
            }
            return silhouette;
        }

        for (let p = 0; p < pixels; p++) {
            const idx = p * 4;
            const left = p > 0 ? (p - 1) * 4 : idx;
            const right = p + 1 < pixels ? (p + 1) * 4 : idx;
            const contrast = Math.abs(data[idx] - data[left]) + Math.abs(data[idx + 1] - data[left + 1]) + Math.abs(data[idx + 2] - data[left + 2])
                + Math.abs(data[idx] - data[right]) + Math.abs(data[idx + 1] - data[right + 1]) + Math.abs(data[idx + 2] - data[right + 2]);
            silhouette[p] = contrast > 72 ? 1 : 0;
        }
        return silhouette;
    }

    function applyOutlinePass(data, width, height, outlineRgb, mode, options, mask) {
        if (!outlineRgb) return;
        const settings = options && typeof options === 'object' ? options : {};
        const inside = mode === 'inside';
        const thickness = clampInt(settings.thickness, 1, 16);
        const silhouette = buildSilhouetteMask(data, width, height, String(settings.detection || 'auto'));
        const out = new Uint8ClampedArray(data);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const p = y * width + x;
                const isOn = silhouette[p] === 1;
                if (inside && !isOn) continue;
                if (!inside && isOn) continue;

                let edge = false;
                for (let oy = -thickness; oy <= thickness && !edge; oy++) {
                    for (let ox = -thickness; ox <= thickness; ox++) {
                        if (ox === 0 && oy === 0) continue;
                        if (Math.abs(ox) + Math.abs(oy) > thickness) continue;
                        const nx = x + ox;
                        const ny = y + oy;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        const neighborOn = silhouette[ny * width + nx] === 1;
                        if (neighborOn !== isOn) {
                            edge = true;
                            break;
                        }
                    }
                }
                if (!edge) continue;
                const idx = p * 4;
                out[idx] = outlineRgb.r;
                out[idx + 1] = outlineRgb.g;
                out[idx + 2] = outlineRgb.b;
                out[idx + 3] = 255;
                if (mask) mask[p] = 255;
            }
        }
        data.set(out);
    }

    function mergeSimilarRegions(data, width, height, threshold, minRegionSize, mask) {
        const thr = clampInt(threshold, 0, 255);
        const minSize = clampInt(minRegionSize, 1, 1 << 30);
        if (thr <= 0) return;

        const thr2 = thr * thr;
        const nPix = width * height;
        const visited = new Uint8Array(nPix);
        const stack = [];
        const region = [];

        const tryPush = (p, seedR, seedG, seedB) => {
            if (visited[p]) return;
            visited[p] = 1;
            const i = p * 4;
            const a = data[i + 3];
            if (a === 0) return;
            const dr = data[i] - seedR;
            const dg = data[i + 1] - seedG;
            const db = data[i + 2] - seedB;
            if ((dr * dr + dg * dg + db * db) <= thr2) stack.push(p);
        };

        for (let p0 = 0; p0 < nPix; p0++) {
            if (visited[p0]) continue;
            visited[p0] = 1;

            const i0 = p0 * 4;
            const a0 = data[i0 + 3];
            if (a0 === 0) continue;

            const seedR = data[i0];
            const seedG = data[i0 + 1];
            const seedB = data[i0 + 2];

            region.length = 0;
            stack.length = 0;
            stack.push(p0);

            let rSum = 0, gSum = 0, bSum = 0, n = 0;

            while (stack.length) {
                const p = stack.pop();
                region.push(p);
                const i = p * 4;
                rSum += data[i];
                gSum += data[i + 1];
                bSum += data[i + 2];
                n++;

                const x = p % width;
                const y = (p / width) | 0;

                if (x > 0) tryPush(p - 1, seedR, seedG, seedB);
                if (x + 1 < width) tryPush(p + 1, seedR, seedG, seedB);
                if (y > 0) tryPush(p - width, seedR, seedG, seedB);
                if (y + 1 < height) tryPush(p + width, seedR, seedG, seedB);
            }

            if (region.length < minSize) continue;
            if (n <= 0) continue;

            const avgR = rSum / n;
            const avgG = gSum / n;
            const avgB = bSum / n;

            // Pick an existing pixel in the region closest to the region average to avoid inventing new colors.
            let bestP = region[0];
            let bestD = Infinity;
            for (let k = 0; k < region.length; k++) {
                const p = region[k];
                const i = p * 4;
                const dr = data[i] - avgR;
                const dg = data[i + 1] - avgG;
                const db = data[i + 2] - avgB;
                const d = dr * dr + dg * dg + db * db;
                if (d < bestD) { bestD = d; bestP = p; }
            }

            const ib = bestP * 4;
            const nr = data[ib];
            const ng = data[ib + 1];
            const nb = data[ib + 2];
            const na = data[ib + 3];

            for (let k = 0; k < region.length; k++) {
                const p = region[k];
                const i = p * 4;
                const changed = (data[i] !== nr) || (data[i + 1] !== ng) || (data[i + 2] !== nb) || (data[i + 3] !== na);
                data[i] = nr;
                data[i + 1] = ng;
                data[i + 2] = nb;
                data[i + 3] = na;
                if (mask && changed) mask[p] = 255;
            }
        }
    }

    PAS.cleanup = {
        gradientCrush,
        applyOrderedDither,
        applyFloydSteinbergDither,
        cleanDither,
        despeckle,
        removeAntiAlias,
        removeTinyIslands,
        applyOutlinePass,
        mergeSimilarRegions
    };
})(window);
