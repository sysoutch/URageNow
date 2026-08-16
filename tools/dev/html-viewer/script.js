let timeout;

if (window.registerDashboardThemeSync) window.registerDashboardThemeSync();

function debouncedUpdate() {
    document.getElementById('status').innerText = "Typing...";
    clearTimeout(timeout);
    timeout = setTimeout(update, 500);
}

function update() {
    const html = document.getElementById("html-code").value;
    const css = "<style>" + document.getElementById("css-code").value + "</style>";
    const js = "<script>" + document.getElementById("js-code").value + "<\/script>";

    const output = document.getElementById("output").contentWindow.document;

    output.open();
    output.write(html + css + js);
    output.close();

    document.getElementById('status').innerText = "Ready";
}

function buildProjectHtml() {
    const html = document.getElementById("html-code").value;
    const css = document.getElementById("css-code").value;
    const js = document.getElementById("js-code").value;
    return `${html}\n<style>\n${css}\n</style>\n<script>\n${js}\n<\/script>`;
}

function describeCurrentAssets() {
    const text = buildProjectHtml();
    return [{
        kind: 'text',
        title: 'HTML Viewer Project',
        fileName: 'html-viewer-project.html',
        mimeType: 'text/html',
        textContent: text,
        previewKind: 'text',
        previewText: text,
        sourceDetail: 'Combined HTML/CSS/JS project from HTML Viewer.',
        metadata: { sourceTool: 'html-viewer', resourceFormat: 'html' }
    }];
}

// Helper: Compress string to Base64
async function compressData(str) {
    const stream = new Blob([str]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const chunks = [];
    const reader = compressedStream.getReader();
    
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    
    const blob = new Blob(chunks);
    const arrayBuffer = await blob.arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // URL Safe
}

// Helper: Decompress Base64 to string
async function decompressData(base64) {
    // Restore Base64 padding and characters
    const basicBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    const str = atob(basicBase64);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(bytes);
    writer.close();
    
    const response = new Response(stream.readable);
    const blob = await response.blob();
    return await blob.text();
}

// 1. Updated Share Function
async function shareProject() {
    const codeState = {
        h: document.getElementById("html-code").value,
        c: document.getElementById("css-code").value,
        j: document.getElementById("js-code").value
    };

    const jsonStr = JSON.stringify(codeState);
    const compressed = await compressData(jsonStr);
    const shareUrl = `${window.location.origin}${window.location.pathname}?code=${compressed}`;

    try {
        if (navigator.share) {
            await navigator.share({ title: 'Web Playground', url: shareUrl });
        } else {
            await navigator.clipboard.writeText(shareUrl);
            alert('Compressed link copied!');
        }
    } catch (err) { console.error('Share failed', err); }
}

// 2. Updated Load Function
async function loadFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');

    if (codeParam) {
        try {
            const decoded = await decompressData(codeParam);
            const data = JSON.parse(decoded);
            document.getElementById("html-code").value = data.h || '';
            document.getElementById("css-code").value = data.c || '';
            document.getElementById("js-code").value = data.j || '';
        } catch (e) {
            console.error("Decompression failed", e);
        }
    }
    update();
}

window.onload = loadFromUrl;
window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;
