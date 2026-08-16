(function(global) {
    'use strict';

    const PAS = global.PAS = global.PAS || {};
    const { clampInt, rgbKey } = PAS.util;

    function forEachBlock(width, height, blockSize, offsetX, offsetY, cb) {
        const s = Math.max(1, blockSize);
        const ox = offsetX | 0;
        const oy = offsetY | 0;

        const minBx = Math.floor((0 - ox) / s);
        const maxBx = Math.floor(((width - 1) - ox) / s);
        const minBy = Math.floor((0 - oy) / s);
        const maxBy = Math.floor(((height - 1) - oy) / s);

        for (let by = minBy; by <= maxBy; by++) {
            const startY = by * s + oy;
            const y0 = Math.max(0, startY);
            const y1 = Math.min(height, startY + s);
            const bh = y1 - y0;
            if (bh <= 0) continue;

            for (let bx = minBx; bx <= maxBx; bx++) {
                const startX = bx * s + ox;
                const x0 = Math.max(0, startX);
                const x1 = Math.min(width, startX + s);
                const bw = x1 - x0;
                if (bw <= 0) continue;

                cb(x0, y0, bw, bh);
            }
        }
    }

    function fillRectData(out, width, x0, y0, bw, bh, r, g, b, a) {
        for (let y = 0; y < bh; y++) {
            let rowIdx = ((y0 + y) * width + x0) * 4;
            for (let x = 0; x < bw; x++) {
                out[rowIdx] = r;
                out[rowIdx + 1] = g;
                out[rowIdx + 2] = b;
                out[rowIdx + 3] = a;
                rowIdx += 4;
            }
        }
    }

    function blockDominanceScore(data, width, height, x0, y0, bw, bh, tol) {
        const tolerance = clampInt(tol, 0, 64);
        const sampleStep = Math.max(1, Math.round(Math.min(bw, bh) / 6));

        const quantize = (v) => {
            if (tolerance <= 0) return v;
            const q = Math.round(v / tolerance) * tolerance;
            return Math.max(0, Math.min(255, q));
        };

        const counts = new Map();
        let total = 0;
        let best = 0;
        for (let y = 0; y < bh; y += sampleStep) {
            for (let x = 0; x < bw; x += sampleStep) {
                const idx = ((y0 + y) * width + (x0 + x)) * 4;
                const a = data[idx + 3];
                if (a === 0) continue;
                const r = quantize(data[idx]);
                const g = quantize(data[idx + 1]);
                const b = quantize(data[idx + 2]);
                const key = rgbKey(r, g, b);
                const c = (counts.get(key) || 0) + 1;
                counts.set(key, c);
                total++;
                if (c > best) best = c;
            }
        }
        return total > 0 ? (best / total) : 0;
    }

    function detectGridFromImageData(imageData, options) {
        const w = imageData.width;
        const h = imageData.height;
        const data = imageData.data;

        const cur = clampInt(options && options.currentSize ? options.currentSize : 8, 1, 64);
        const minSize = clampInt(options && options.minSize ? options.minSize : 2, 1, 64);
        const maxSize = clampInt(options && options.maxSize ? options.maxSize : 32, 1, 128);
        const tol = clampInt(options && options.tolerance ? options.tolerance : 8, 0, 64);
        const maxBlocks = clampInt(options && options.maxBlocks ? options.maxBlocks : 120, 20, 1000);

        const candidates = [];
        for (let s = minSize; s <= maxSize; s++) candidates.push(s);
        if (!candidates.includes(cur)) candidates.push(cur);

        let best = { score: -1, size: cur, ox: 0, oy: 0 };
        for (const s of candidates) {
            const step = Math.max(1, Math.round(s / 4));
            for (let oy = 0; oy < s; oy += step) {
                for (let ox = 0; ox < s; ox += step) {
                    let score = 0;
                    let n = 0;
                    forEachBlock(w, h, s, ox, oy, (x0, y0, bw, bh) => {
                        if (n >= maxBlocks) return;
                        score += blockDominanceScore(data, w, h, x0, y0, bw, bh, tol);
                        n++;
                    });
                    if (n > 0) score /= n;
                    if (score > best.score) best = { score, size: s, ox, oy };
                }
            }
        }

        const s = best.size;
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const ox = (best.ox + dx + s) % s;
                const oy = (best.oy + dy + s) % s;
                let score = 0;
                let n = 0;
                forEachBlock(w, h, s, ox, oy, (x0, y0, bw, bh) => {
                    if (n >= maxBlocks) return;
                    score += blockDominanceScore(data, w, h, x0, y0, bw, bh, tol);
                    n++;
                });
                if (n > 0) score /= n;
                if (score > best.score) best = { score, size: s, ox, oy };
            }
        }

        return best;
    }

    PAS.grid = {
        forEachBlock,
        fillRectData,
        detectGridFromImageData
    };
})(window);

