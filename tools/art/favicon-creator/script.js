const fileInput = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let zip = null;
let generatedIconBlobs = [];

if (window.registerDashboardThemeSync) window.registerDashboardThemeSync();

// Set canvas to high resolution for better quality
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

function loadImageSource(source) {
    return new Promise((resolve, reject) => {
        const normalizedSource = String(source || '').trim();
        if (!normalizedSource) {
            reject(new Error('No image source was provided.'));
            return;
        }
        const img = new Image();
        img.onload = async function() {
            if(img.width !== img.height) {
                document.getElementById('status').innerText = "Warning: non-square image loaded. Results may crop.";
            }
            await processImages(img);
            resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = normalizedSource;
    });
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read generated file.'));
        reader.readAsDataURL(blob);
    });
}

async function describeCurrentAssets() {
    if (!generatedIconBlobs.length) return [];
    const descriptors = [];
    for (const item of generatedIconBlobs) {
        if (!item || !item.blob) continue;
        const dataUrl = await blobToDataUrl(item.blob);
        descriptors.push({
            kind: 'image',
            title: item.name,
            fileName: item.name,
            mimeType: 'image/png',
            dataUrl,
            sourceUrl: dataUrl,
            previewKind: 'image',
            previewUrl: dataUrl,
            metadata: {
                inferenceSource: 'favicon-creator',
                outputType: 'icon'
            }
        });
    }
    if (zip) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipDataUrl = await blobToDataUrl(zipBlob);
        descriptors.unshift({
            kind: 'file',
            title: 'urage-favicon-bundle.zip',
            fileName: 'urage-favicon-bundle.zip',
            mimeType: 'application/zip',
            dataUrl: zipDataUrl,
            sourceUrl: zipDataUrl,
            previewKind: descriptors[0]?.previewKind || 'file',
            previewUrl: descriptors[0]?.previewUrl || '',
            metadata: {
                inferenceSource: 'favicon-creator',
                outputType: 'bundle',
                iconCount: generatedIconBlobs.length
            }
        });
    }
    return descriptors;
}

fileInput.onchange = function(e) {
    const file = e.target.files[0];
    if (!file || !String(file.type || '').startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        loadImageSource(event.target.result).catch(error => {
            document.getElementById('status').innerText = error.message || 'Failed to load image.';
        });
    }
    reader.readAsDataURL(file);
};

async function processImages(img) {
    zip = typeof JSZip !== 'undefined' ? new JSZip() : null;
    generatedIconBlobs = [];
    const sizes = [
        { n: 'favicon-16x16.png', s: 16, id: 'p16' },
        { n: 'favicon-32x32.png', s: 32, id: 'p32' },
        { n: 'apple-touch-icon.png', s: 180, id: 'p180' },
        { n: 'android-chrome-192x192.png', s: 192 },
        { n: 'android-chrome-512x512.png', s: 512 }
    ];

    const imgFolder = zip ? zip.folder("icons") : null;

    for (const item of sizes) {
        canvas.width = item.s;
        canvas.height = item.s;
        ctx.clearRect(0, 0, item.s, item.s);
        
        // Use high quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Calculate crop area to center the image
        const imgSize = Math.min(img.width, img.height);
        const startX = (img.width - imgSize) / 2;
        const startY = (img.height - imgSize) / 2;
        
        // For small sizes, we'll use a 4x larger canvas for rendering to improve quality
        if (item.s <= 32) {
            // Create a high-resolution canvas for small favicons
            const scale = 4;
            const highResCanvas = document.createElement('canvas');
            const highResCtx = highResCanvas.getContext('2d');
            highResCanvas.width = item.s * scale;
            highResCanvas.height = item.s * scale;
            
            // Set high quality rendering for the high-res canvas
            highResCtx.imageSmoothingEnabled = true;
            highResCtx.imageSmoothingQuality = 'high';
            
            // Draw the cropped image to the high-res canvas
            highResCtx.drawImage(img, startX, startY, imgSize, imgSize, 0, 0, highResCanvas.width, highResCanvas.height);
            
            // Draw the high-res image to the low-res canvas with high quality
            ctx.drawImage(highResCanvas, 0, 0, highResCanvas.width, highResCanvas.height, 0, 0, item.s, item.s);
        } else {
            // For larger sizes, maintain aspect ratio and center the image
            ctx.drawImage(img, startX, startY, imgSize, imgSize, 0, 0, item.s, item.s);
        }

        // Convert canvas to blob
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
        generatedIconBlobs.push({ name: item.n, blob });
        if (imgFolder) imgFolder.file(item.n, blob);

        // Update preview UI if ID exists
        if (item.id) {
            document.getElementById(item.id).src = URL.createObjectURL(blob);
        }
    }

    // Create Manifest File
    const manifest = {
        "name": "URage Toolset App",
        "short_name": "URage",
        "icons": [
            { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
            { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
        ],
        "theme_color": "#00ffcc",
        "background_color": "#121212",
        "display": "standalone"
    };
    if (zip) zip.file("site.webmanifest", JSON.stringify(manifest, null, 2));

    const previewGrid = document.getElementById('previewGrid');
    previewGrid.classList.add('visible');
    previewGrid.style.display = 'grid';

    document.getElementById('dlBtn').classList.add('visible');
    document.getElementById('dlBtn').style.display = 'block';

    document.getElementById('codeSnippet').classList.add('visible');
    document.getElementById('codeSnippet').style.display = 'block';

    document.getElementById('dropZone').style.display = 'none';

    document.getElementById('status').innerText = "Bundle ready for export!";
}

function downloadBundle() {
    if (!zip) {
        generatedIconBlobs.forEach(item => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(item.blob);
            link.download = item.name;
            link.click();
        });
        return;
    }
    zip.generateAsync({type:"blob"}).then(function(content) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = "urage-favicon-bundle.zip";
        link.click();
    });
}

if (typeof window.registerDashboardToolBridge === 'function') {
    window.registerDashboardToolBridge({
        onLoadAsset: payload => loadImageSource(payload && (payload.dataUrl || payload.imageUrl || payload.previewImageUrl || payload.url)),
        onDescribeCurrentAssets: describeCurrentAssets,
        onExportImage: async () => {
            const first = generatedIconBlobs[0];
            if (!first || !first.blob) throw new Error('Generate icons first.');
            const dataUrl = await blobToDataUrl(first.blob);
            return {
                dataUrl,
                fileName: first.name,
                width: 16,
                height: 16
            };
        }
    });
}
