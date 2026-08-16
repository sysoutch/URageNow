(function(global) {
    'use strict';

    const PAS = global.PAS = global.PAS || {};
    const { clampInt, downloadText } = PAS.util;

    function samplePixels(data, width, height, maxSamples) {
        const samples = [];
        const total = width * height;
        if (total <= 0) return samples;

        const target = Math.max(256, Math.min(maxSamples, total));
        const stride = Math.max(1, Math.floor(Math.sqrt(total / target)));

        for (let y = 0; y < height; y += stride) {
            for (let x = 0; x < width; x += stride) {
                const idx = (y * width + x) * 4;
                const a = data[idx + 3];
                if (a === 0) continue;
                samples.push([data[idx], data[idx + 1], data[idx + 2]]);
                if (samples.length >= target) return samples;
            }
        }
        return samples;
    }

    function buildPaletteMedianCut(samples, k) {
        const boxes = [{ pts: samples, bounds: null }];

        function computeBounds(pts) {
            let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
            for (const p of pts) {
                const r = p[0], g = p[1], b = p[2];
                if (r < rMin) rMin = r; if (r > rMax) rMax = r;
                if (g < gMin) gMin = g; if (g > gMax) gMax = g;
                if (b < bMin) bMin = b; if (b > bMax) bMax = b;
            }
            return { rMin, rMax, gMin, gMax, bMin, bMax };
        }

        while (boxes.length < k) {
            boxes.forEach(b => { if (!b.bounds) b.bounds = computeBounds(b.pts); });
            boxes.sort((a, b) => {
                const ar = a.bounds.rMax - a.bounds.rMin;
                const ag = a.bounds.gMax - a.bounds.gMin;
                const ab = a.bounds.bMax - a.bounds.bMin;
                const br = b.bounds.rMax - b.bounds.rMin;
                const bg = b.bounds.gMax - b.bounds.gMin;
                const bb = b.bounds.bMax - b.bounds.bMin;
                return Math.max(br, bg, bb) - Math.max(ar, ag, ab);
            });

            const box = boxes.shift();
            if (!box || box.pts.length <= 1) break;

            const { rMin, rMax, gMin, gMax, bMin, bMax } = box.bounds;
            const rR = rMax - rMin;
            const gR = gMax - gMin;
            const bR = bMax - bMin;
            let axis = 0;
            if (gR >= rR && gR >= bR) axis = 1;
            else if (bR >= rR && bR >= gR) axis = 2;

            box.pts.sort((p1, p2) => p1[axis] - p2[axis]);
            const mid = Math.floor(box.pts.length / 2);
            const left = box.pts.slice(0, mid);
            const right = box.pts.slice(mid);
            boxes.push({ pts: left, bounds: null }, { pts: right, bounds: null });
        }

        const palette = [];
        for (const b of boxes) {
            let rSum = 0, gSum = 0, bSum = 0;
            for (const p of b.pts) {
                rSum += p[0]; gSum += p[1]; bSum += p[2];
            }
            const n = Math.max(1, b.pts.length);
            palette.push({ r: Math.round(rSum / n), g: Math.round(gSum / n), b: Math.round(bSum / n), a: 255 });
        }
        return palette;
    }

    function buildPaletteKMeans(samples, k) {
        if (samples.length === 0) return [];
        const centers = [];
        for (let i = 0; i < k; i++) {
            const p = samples[(i * 997) % samples.length];
            centers.push({ r: p[0], g: p[1], b: p[2] });
        }

        const iters = 10;
        for (let iter = 0; iter < iters; iter++) {
            const acc = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, n: 0 }));
            for (const p of samples) {
                let best = 0;
                let bestD = Infinity;
                for (let c = 0; c < k; c++) {
                    const dr = p[0] - centers[c].r;
                    const dg = p[1] - centers[c].g;
                    const db = p[2] - centers[c].b;
                    const d = dr * dr + dg * dg + db * db;
                    if (d < bestD) { bestD = d; best = c; }
                }
                acc[best].r += p[0];
                acc[best].g += p[1];
                acc[best].b += p[2];
                acc[best].n++;
            }
            for (let c = 0; c < k; c++) {
                if (acc[c].n > 0) {
                    centers[c].r = acc[c].r / acc[c].n;
                    centers[c].g = acc[c].g / acc[c].n;
                    centers[c].b = acc[c].b / acc[c].n;
                }
            }
        }

        return centers.map(c => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), a: 255 }));
    }

    function nearestPaletteIndex(r, g, b, palette) {
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < palette.length; i++) {
            const dr = r - palette[i].r;
            const dg = g - palette[i].g;
            const db = b - palette[i].b;
            const d = dr * dr + dg * dg + db * db;
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    function snapToPalette(data, width, height, palette, snappedMask) {
        if (!palette || palette.length === 0) return;
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            const a = data[i + 3];
            if (a === 0) continue;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const idx = nearestPaletteIndex(r, g, b, palette);
            const pr = palette[idx].r, pg = palette[idx].g, pb = palette[idx].b;
            const changed = (r !== pr) || (g !== pg) || (b !== pb);
            data[i] = pr; data[i + 1] = pg; data[i + 2] = pb;
            if (snappedMask && changed) snappedMask[p] = 255;
        }
    }

    function resolvePaletteForWork(work, width, height, paletteParams) {
        if (!paletteParams || !paletteParams.enabled) return null;

        const k = clampInt(paletteParams.size, 2, 256);
        const method = String(paletteParams.method || 'kmeans');
        const paletteKey = JSON.stringify({
            w: width, h: height,
            k,
            m: method,
            locked: !!paletteParams.locked
        });

        const cache = PAS.State.paletteCache;
        if (paletteParams.locked && cache.palette) return cache.palette;
        if (cache.key === paletteKey && cache.palette) return cache.palette;

        const samples = samplePixels(work, width, height, 20000);
        const palette = (method === 'median')
            ? buildPaletteMedianCut(samples, k)
            : buildPaletteKMeans(samples, k);
        cache.key = paletteKey;
        cache.palette = palette;
        return palette;
    }

    function exportPaletteFiles(palette) {
        if (!palette || !palette.length) return;
        const cols = Math.min(16, Math.max(1, Math.round(Math.sqrt(palette.length))));

        const gplLines = [];
        gplLines.push('GIMP Palette');
        gplLines.push('Name: URage Pixel Palette');
        gplLines.push(`Columns: ${cols}`);
        gplLines.push('#');
        for (let i = 0; i < palette.length; i++) {
            const c = palette[i];
            gplLines.push(`${c.r}\t${c.g}\t${c.b}\tColor ${i + 1}`);
        }
        downloadText('pixel-palette.gpl', gplLines.join('\n'), 'text/plain');
        downloadText('pixel-palette.json', JSON.stringify(palette, null, 2), 'application/json');
    }

    PAS.palette = {
        nearestPaletteIndex,
        snapToPalette,
        resolvePaletteForWork,
        exportPaletteFiles
    };
})(window);

