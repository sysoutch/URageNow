(function(global) {
    'use strict';

    const PAS = global.PAS = global.PAS || {};

    PAS.State = PAS.State || {
        paletteCache: { key: null, palette: null }
    };

    function setText(el, value) {
        if (!el) return;
        el.textContent = String(value);
    }

    function clampInt(n, min, max) {
        const v = Math.round(Number(n));
        if (!Number.isFinite(v)) return min;
        return Math.min(max, Math.max(min, v));
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
            : null;
    }

    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    function downloadText(filename, text, mime) {
        const blob = new Blob([text], { type: mime || 'text/plain' });
        const link = document.createElement('a');
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }

    function downloadBytes(filename, bytes, mime) {
        const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
        const link = document.createElement('a');
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }

    function rgbKey(r, g, b) {
        return (r << 16) | (g << 8) | b;
    }

    function getRgbKeyAt(data, idx) {
        return (data[idx] << 16) | (data[idx + 1] << 8) | data[idx + 2];
    }

    PAS.util = {
        setText,
        clampInt,
        hexToRgb,
        rgbToHex,
        downloadText,
        downloadBytes,
        rgbKey,
        getRgbKeyAt
    };
})(window);

