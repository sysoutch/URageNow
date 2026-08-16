let currentData = { html: '', css: '', js: '', combined: '' };

if (window.registerDashboardThemeSync) window.registerDashboardThemeSync();

function switchTab(mode) {
    document.querySelectorAll('.mode-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(mode).classList.add('active');
    document.getElementById('tab-' + (mode === 'separator' ? 'sep' : 'comb')).classList.add('active');
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.html')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('sepInput').value = e.target.result;
        };
        reader.readAsText(file);
    }
}

function openFilePicker() {
    document.getElementById('fileInput').click();
}

function initDragAndDrop() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    
    fileInput.addEventListener('change', handleFileSelect);
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
        dropArea.style.borderColor = '#38bdf8';
    }
    
    function unhighlight() {
        dropArea.style.backgroundColor = '';
        dropArea.style.borderColor = '#38bdf8';
    }
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            const file = files[0];
            if (file.name.endsWith('.html')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('sepInput').value = e.target.result;
                };
                reader.readAsText(file);
            }
        }
    }
    dropArea.addEventListener('click', openFilePicker);
}

window.addEventListener('load', initDragAndDrop);

function escape(str) { return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Fixes indentation based on the first line's whitespace
function normalizeIndentation(str) {
    if (!str) return '';
    const lines = str.split('\n');
    // Find first line with actual content
    const firstCodedLineIndex = lines.findIndex(line => line.trim().length > 0);
    if (firstCodedLineIndex === -1) return str.trim();
    
    const firstCodedLine = lines[firstCodedLineIndex];
    const indentMatch = firstCodedLine.match(/^\s*/);
    const indentStr = indentMatch ? indentMatch[0] : '';
    
    return lines
        .map(line => line.startsWith(indentStr) ? line.substring(indentStr.length) : line.trimStart())
        .join('\n')
        .trim();
}

function normalizeEmptyLines(str) {
    if (!str) return str;
    
    // First, normalize all multiple empty lines to single empty lines
    // This handles multiple consecutive empty lines
    str = str.replace(/\n\s*\n\s*\n\s*/g, '\n\n');
    
    // Then normalize any remaining multiple empty lines
    str = str.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Remove leading and trailing whitespace/newlines
    str = str.replace(/^\s+/, '');
    str = str.replace(/\s+$/, '');
    
    return str;
}

function cleanHtmlStructure(html) {
    // Normalize multiple empty lines in the entire HTML
    html = html.replace(/\n\s*\n\s*\n\s*/g, '\n\n');
    html = html.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Ensure proper spacing around script and style tags
    html = html.replace(/<\/style>\s*\n\s*\n\s*/g, '</style>\n\n');
    html = html.replace(/<\/script>\s*\n\s*\n\s*/g, '</script>\n\n');
    
    return html;
}

function runSeparator() {
    const input = document.getElementById('sepInput').value;
    if(!input.trim()) return;

    // 1. Extract CSS
    const cssMatch = input.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    currentData.css = cssMatch ? normalizeIndentation(cssMatch[1]) : "";
    
    // Normalize empty lines in CSS
    currentData.css = normalizeEmptyLines(currentData.css);

    // 2. Extract JS and Detect Module Type
    const jsRegex = /<script(?![^>]*src)(?![^>]*type=["']importmap["'])([^>]*)>([\s\S]*?)<\/script>/gi;
    let jsArray = [];
    let isModule = false;
    let m;
    while ((m = jsRegex.exec(input)) !== null) {
        if (m[1].toLowerCase().includes('type="module"')) isModule = true;
        if (m[2].trim()) jsArray.push(normalizeIndentation(m[2]));
    }
    currentData.js = jsArray.join('\n\n');
    
    // Normalize empty lines in JS
    currentData.js = normalizeEmptyLines(currentData.js);

    // 3. Clean HTML
    const scriptTag = isModule ? '<script type="module" src="script.js"><\/script>' : '<script src="script.js"><\/script>';
    currentData.html = input
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '<link rel="stylesheet" href="style.css">')
        .replace(/<script(?![^>]*src)(?![^>]*type=["']importmap["'])[^>]*>[\s\S]*?<\/script>/gi, scriptTag)
        .trim();

    document.getElementById('outHtml').innerHTML = escape(currentData.html);
    document.getElementById('outCss').innerHTML = escape(currentData.css);
    document.getElementById('outJs').innerHTML = escape(currentData.js);
    Prism.highlightAll();
}

function runCombiner() {
    let html = document.getElementById('combHtml').value || '<!DOCTYPE html>\n<html>\n<head>\n</head>\n<body>\n</body>\n</html>';
    const css = document.getElementById('combCss').value;
    const js = document.getElementById('combJs').value;

    // Clean up any existing style and script tags that might have been added by previous operations
    // Remove any existing style.css or script.js references
    html = html.replace(/<link[^>]*href=["'][^"']*style\.css["'][^>]*>/gi, '');
    html = html.replace(/<script[^>]*src=["'][^"']*script\.js["'][^>]*><\/script>/gi, '');
    html = html.replace(/<script[^>]*type=["']module["'][^>]*><\/script>/gi, '');
    
    // Remove empty script tags that might have been created
    html = html.replace(/<script[^>]*><\/script>/gi, '');

    // Normalize empty lines in CSS and JS before adding to HTML
    const normalizedCss = normalizeEmptyLines(css);
    const normalizedJs = normalizeEmptyLines(js);

    if(normalizedCss.trim()) {
        const styleTag = `\n<style>\n${normalizedCss}\n</style>\n`;
        html = html.includes('</head>') ? html.replace('</head>', styleTag + '</head>') : html.replace('<body>', styleTag + '<body>');
    }

    if(normalizedJs.trim()) {
        // Remove type="module" from the script tag
        const scriptTag = `\n<script>\n${normalizedJs}\n<\/script>\n`;
        html = html.includes('</body>') ? html.replace('</body>', scriptTag + '</body>') : html + scriptTag;
    }

    // Clean up the final HTML structure to remove excessive empty lines
    currentData.combined = cleanHtmlStructure(html);
    document.getElementById('outCombined').innerHTML = escape(currentData.combined);
    Prism.highlightAll();
}

async function copy(type, btn) {
    const text = currentData[type];
    if(!text) return;
    try {
        await navigator.clipboard.writeText(text);
        const oldText = btn.innerText;
        btn.innerText = 'Copied!';
        btn.style.background = '#10b981';
        setTimeout(() => { btn.innerText = oldText; btn.style.background = '#475569'; }, 1200);
    } catch (err) {}
}

function download(type) {
    const content = currentData[type];
    if(!content) return;
    const names = { html: 'index.html', css: 'style.css', js: 'script.js', combined: 'project-single.html' };
    const blob = new Blob([content], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = names[type];
    a.click();
}

function describeCurrentAssets() {
    const names = { html: 'index.html', css: 'style.css', js: 'script.js', combined: 'project-single.html' };
    const mimeTypes = { html: 'text/html', css: 'text/css', js: 'text/javascript', combined: 'text/html' };
    return Object.entries(currentData)
        .filter(([, content]) => String(content || '').trim())
        .map(([type, content]) => ({
            kind: 'text',
            title: type === 'combined' ? 'Combined HTML' : type.toUpperCase() + ' Output',
            fileName: names[type] || `${type}.txt`,
            mimeType: mimeTypes[type] || 'text/plain',
            textContent: content,
            previewKind: 'text',
            previewText: content,
            sourceDetail: 'HTML separator/combiner output.',
            metadata: { sourceTool: 'html-separator-and-combiner', resourceFormat: type }
        }));
}

window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;
