(function(global) {
    'use strict';

    const PAS = global.PAS = global.PAS || {};

    const CRC32_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c >>> 0;
        }
        return t;
    })();

    function crc32(buf) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function adler32(buf) {
        let a = 1, b = 0;
        const MOD = 65521;
        for (let i = 0; i < buf.length; i++) {
            a = (a + buf[i]) % MOD;
            b = (b + a) % MOD;
        }
        return ((b << 16) | a) >>> 0;
    }

    function u32be(n) {
        return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
    }

    function u16le(n) {
        return new Uint8Array([n & 255, (n >>> 8) & 255]);
    }

    function makeChunk(type4, data) {
        const type = new TextEncoder().encode(type4);
        const len = u32be(data.length);
        const crcBuf = new Uint8Array(type.length + data.length);
        crcBuf.set(type, 0);
        crcBuf.set(data, type.length);
        const crc = u32be(crc32(crcBuf));

        const chunk = new Uint8Array(4 + 4 + data.length + 4);
        chunk.set(len, 0);
        chunk.set(type, 4);
        chunk.set(data, 8);
        chunk.set(crc, 8 + data.length);
        return chunk;
    }

    function deflateStoredZlib(raw) {
        const blocks = [];
        blocks.push(new Uint8Array([0x78, 0x01])); // zlib header (no compression)

        let pos = 0;
        while (pos < raw.length) {
            const remaining = raw.length - pos;
            const len = Math.min(65535, remaining);
            const isFinal = (pos + len) >= raw.length;
            blocks.push(new Uint8Array([isFinal ? 0x01 : 0x00])); // BFINAL + BTYPE=00
            blocks.push(u16le(len));
            blocks.push(u16le((~len) & 0xFFFF));
            blocks.push(raw.subarray(pos, pos + len));
            pos += len;
        }

        blocks.push(u32be(adler32(raw)));
        const total = blocks.reduce((s, b) => s + b.length, 0);
        const out = new Uint8Array(total);
        let o = 0;
        for (const b of blocks) { out.set(b, o); o += b.length; }
        return out;
    }

    function extractUniquePaletteAndIndices(imageData, limit) {
        const w = imageData.width;
        const h = imageData.height;
        const data = imageData.data;
        const max = limit || 256;

        const map = new Map(); // key(u32 rgba) -> index
        const palette = [];
        const indices = new Uint8Array(w * h);

        for (let p = 0, i = 0; p < indices.length; p++, i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            const key = (((r << 24) | (g << 16) | (b << 8) | a) >>> 0);
            let idx = map.get(key);
            if (idx === undefined) {
                idx = palette.length;
                if (idx >= max) return null;
                map.set(key, idx);
                palette.push({ r, g, b, a });
            }
            indices[p] = idx;
        }

        return { palette, indices };
    }

    function encodeIndexedPng(width, height, palette, indices) {
        const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

        const ihdr = new Uint8Array(13);
        ihdr.set(u32be(width), 0);
        ihdr.set(u32be(height), 4);
        ihdr[8] = 8;  // bit depth
        ihdr[9] = 3;  // color type: indexed
        ihdr[10] = 0; // compression
        ihdr[11] = 0; // filter
        ihdr[12] = 0; // interlace

        const plte = new Uint8Array(palette.length * 3);
        const trns = new Uint8Array(palette.length);
        let anyAlpha = false;
        for (let i = 0; i < palette.length; i++) {
            const c = palette[i];
            plte[i * 3] = c.r;
            plte[i * 3 + 1] = c.g;
            plte[i * 3 + 2] = c.b;
            trns[i] = c.a;
            if (c.a !== 255) anyAlpha = true;
        }

        const raw = new Uint8Array(height * (width + 1));
        for (let y = 0; y < height; y++) {
            const row = y * (width + 1);
            raw[row] = 0; // filter 0
            raw.set(indices.subarray(y * width, (y + 1) * width), row + 1);
        }
        const z = deflateStoredZlib(raw);

        const chunks = [];
        chunks.push(makeChunk('IHDR', ihdr));
        chunks.push(makeChunk('PLTE', plte));
        if (anyAlpha) chunks.push(makeChunk('tRNS', trns));
        chunks.push(makeChunk('IDAT', z));
        chunks.push(makeChunk('IEND', new Uint8Array(0)));

        const total = sig.length + chunks.reduce((s, c) => s + c.length, 0);
        const out = new Uint8Array(total);
        let o = 0;
        out.set(sig, o); o += sig.length;
        for (const c of chunks) { out.set(c, o); o += c.length; }
        return out;
    }

    PAS.png = {
        extractUniquePaletteAndIndices,
        encodeIndexedPng
    };
})(window);

