const input = document.getElementById('svgInput');
const render = document.getElementById('svg-render');
const canvasSide = document.getElementById('canvas-side');
const handles = { tl: document.getElementById('h-tl'), tr: document.getElementById('h-tr'), bl: document.getElementById('h-bl'), br: document.getElementById('h-br') };

if (window.registerDashboardThemeSync) window.registerDashboardThemeSync();

let selectedEls = [], clipboard = [], currentTool = 'select';
let undoStack = [], redoStack = [], isDragging = false, activeHandle = null, dragTargets = [];
const GRID = 10;

function saveState() { 
    undoStack.push(input.value); 
    if (undoStack.length > 50) undoStack.shift(); 
    redoStack = []; 
}

function undo() { 
    if (undoStack.length > 0) { 
        input.value = undoStack.pop(); 
        updatePreview(false); 
    } 
}

function redo() { 
    if (redoStack.length > 0) { 
        input.value = redoStack.pop(); 
        updatePreview(false); 
    } 
}

function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tool-' + tool).classList.add('active');
    if (tool !== 'select') deselectAll();
}

function attachElementListeners(el) {
    el.classList.add('draggable');
    el.addEventListener('mousedown', function(e) {
        if (currentTool === 'select') {
            e.stopPropagation();
            startAction(e, this);
        }
    });
    el.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        if (el.tagName === 'text') {
            const newText = prompt('Edit text:', el.textContent);
            if (newText !== null) {
                el.textContent = newText;
                syncCode();
            }
        } else {
            toggleSelection(this, e.ctrlKey);
        }
    });
}

function updatePreview(save = true) {
    if (save) saveState();
    render.innerHTML = input.value;
    const svg = render.querySelector('svg');
    if (!svg) return;
    render.style.width = (svg.getAttribute('width') || 500) + 'px';
    render.style.height = (svg.getAttribute('height') || 500) + 'px';
    svg.querySelectorAll('*').forEach(el => {
        if (["rect", "circle", "path", "ellipse", "text", "image"].includes(el.tagName)) {
            attachElementListeners(el);
        }
    });
    updateHandlePositions();
}

function loadDashboardImagePayload(payload) {
    const dataUrl = String(payload && (payload.dataUrl || payload.imageUrl || payload.previewImageUrl) || '').trim();
    if (!dataUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const width = img.naturalWidth || img.width || 512;
        const height = img.naturalHeight || img.height || 512;
        saveState();
        input.value = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><image href="${dataUrl.replace(/"/g, '&quot;')}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></svg>`;
        updatePreview(false);
    };
    img.src = dataUrl;
}

window.addEventListener('message', event => {
    const message = event && event.data ? event.data : null;
    if (!message || message.source !== 'urage-dashboard' || message.type !== 'tool:load-asset') return;
    loadDashboardImagePayload(message.payload || {});
});

// --- RESIZE LOGIC (WITH GRID) ---
Object.keys(handles).forEach(key => {
    handles[key].onmousedown = (e) => {
        e.stopPropagation();
        if (selectedEls.length !== 1) return;
        
        const el = selectedEls[0];
        const svg = render.querySelector('svg');
        const pt = getSVGPoint(e, svg);
        
        // Store original dimensions/positions based on element type
        dragTargets = [{
            el: el,
            startX: pt.x,
            startY: pt.y,
            originalX: parseFloat(el.getAttribute('x') || el.getAttribute('cx') || 0),
            originalY: parseFloat(el.getAttribute('y') || el.getAttribute('cy') || 0),
            originalWidth: parseFloat(el.getAttribute('width') || el.getAttribute('r') || 0),
            originalHeight: parseFloat(el.getAttribute('height') || el.getAttribute('r') || 0),
            originalCx: parseFloat(el.getAttribute('cx') || 0),
            originalCy: parseFloat(el.getAttribute('cy') || 0),
            isRect: el.tagName === 'rect',
            isCircle: el.tagName === 'circle',
            isPath: el.tagName === 'path'
        }];
        
        activeHandle = key;
        window.onmousemove = doResize; 
        window.onmouseup = endResize;
    };
});

function doResize(e) {
    if (!activeHandle || dragTargets.length === 0) return;
    const pt = getSVGPoint(e, render.querySelector('svg'));
    const t = dragTargets[0];
    let dx = pt.x - t.startX, dy = pt.y - t.startY;
    if (e.ctrlKey) { dx = Math.round(dx / GRID) * GRID; dy = Math.round(dy / GRID) * GRID; }

    if (t.isRect) {
        // Rectangle resizing
        let newX = t.originalX, newY = t.originalY;
        let newWidth = t.originalWidth, newHeight = t.originalHeight;

        if (activeHandle.includes('l')) { newX = t.originalX + dx; newWidth = t.originalWidth - dx; }
        if (activeHandle.includes('r')) { newWidth = t.originalWidth + dx; }
        if (activeHandle.includes('t')) { newY = t.originalY + dy; newHeight = t.originalHeight - dy; }
        if (activeHandle.includes('b')) { newHeight = t.originalHeight + dy; }

        if (newWidth > 5 && newHeight > 5) {
            t.el.setAttribute('x', newX);
            t.el.setAttribute('y', newY);
            t.el.setAttribute('width', newWidth);
            t.el.setAttribute('height', newHeight);
        }
    } else if (t.isCircle) {
        // Circle resizing: set radius to distance from center to mouse
        const cx = parseFloat(t.el.getAttribute('cx'));
        const cy = parseFloat(t.el.getAttribute('cy'));
        const dist = Math.sqrt(Math.pow(pt.x - cx, 2) + Math.pow(pt.y - cy, 2));
        if (dist > 2 && dist < 500) {
            t.el.setAttribute('r', dist);
        }
    } else if (t.isPath) {
        // Path resizing - simple approach using x,y attributes
        let newX = t.originalX, newY = t.originalY;
        let newWidth = t.originalWidth, newHeight = t.originalHeight;

        if (activeHandle.includes('l')) { newX = t.originalX + dx; newWidth = t.originalWidth - dx; }
        if (activeHandle.includes('r')) { newWidth = t.originalWidth + dx; }
        if (activeHandle.includes('t')) { newY = t.originalY + dy; newHeight = t.originalHeight - dy; }
        if (activeHandle.includes('b')) { newHeight = t.originalHeight + dy; }

        if (newWidth > 5 && newHeight > 5) {
            if (t.el.hasAttribute('x')) {
                t.el.setAttribute('x', newX);
                t.el.setAttribute('y', newY);
            }
            // For paths, we can also update width/height if they exist
            if (t.el.hasAttribute('width')) {
                t.el.setAttribute('width', newWidth);
                t.el.setAttribute('height', newHeight);
            }
        }
    } else if (t.el.tagName === 'ellipse') {
        // Ellipse resizing: set rx and ry to distance from center to mouse
        const cx = parseFloat(t.el.getAttribute('cx'));
        const cy = parseFloat(t.el.getAttribute('cy'));
        let newRx = Math.abs(pt.x - cx);
        let newRy = Math.abs(pt.y - cy);
        if (newRx > 2 && newRy > 2 && newRx < 500 && newRy < 500) {
            t.el.setAttribute('rx', newRx);
            t.el.setAttribute('ry', newRy);
        }
    }

    updateHandlePositions();
    syncCode(false);
}

function endResize() {
    if (activeHandle) {
        saveState();
        activeHandle = null;
        window.onmousemove = null;
        window.onmouseup = null;
    }
}

// --- DRAG LOGIC (WITH GRID) ---
function startAction(e, el) {
    e.stopPropagation();
    if (!selectedEls.includes(el)) toggleSelection(el, e.ctrlKey);
    
    const svg = render.querySelector('svg'); 
    const pt = getSVGPoint(e, svg);
    isDragging = true;
    
    // Store original positions for all selected elements
    dragTargets = selectedEls.map(tgt => {
        const isC = tgt.tagName === 'circle';
        const isP = tgt.tagName === 'path';
        const isE = tgt.tagName === 'ellipse';
        
        return { 
            el: tgt, 
            offsetX: pt.x - (parseFloat(tgt.getAttribute('x') || tgt.getAttribute('cx') || 0)),
            offsetY: pt.y - (parseFloat(tgt.getAttribute('y') || tgt.getAttribute('cy') || 0)),
            originalX: parseFloat(tgt.getAttribute('x') || tgt.getAttribute('cx') || 0),
            originalY: parseFloat(tgt.getAttribute('y') || tgt.getAttribute('cy') || 0),
            isCircle: isC,
            isPath: isP,
            isEllipse: isE
        };
    });
    
    window.onmousemove = (ev) => {
        const p = getSVGPoint(ev, svg);
        dragTargets.forEach(tgt => {
            let newX = p.x - tgt.offsetX;
            let newY = p.y - tgt.offsetY;
            if (ev.ctrlKey) {
                newX = Math.round(newX / GRID) * GRID;
                newY = Math.round(newY / GRID) * GRID;
            }
            
            if (tgt.isCircle) {
                tgt.el.setAttribute('cx', newX);
                tgt.el.setAttribute('cy', newY);
            } else if (tgt.isPath) {
                // For paths, try to update x/y attributes
                if (tgt.el.hasAttribute('x') || tgt.el.hasAttribute('y')) {
                    tgt.el.setAttribute('x', newX);
                    tgt.el.setAttribute('y', newY);
                } else {
                    // If no x/y, use transform
                    const currentTransform = tgt.el.getAttribute('transform') || '';
                    const newTransform = currentTransform.replace(/translate\([^)]*\)/g, '');
                    tgt.el.setAttribute('transform', newTransform + ` translate(${newX},${newY})`);
                }
            } else if (tgt.isEllipse) {
                // For ellipses, update cx and cy but keep rx and ry
                const cx = parseFloat(tgt.el.getAttribute('cx') || 0);
                const cy = parseFloat(tgt.el.getAttribute('cy') || 0);
                const rx = parseFloat(tgt.el.getAttribute('rx') || 0);
                const ry = parseFloat(tgt.el.getAttribute('ry') || 0);
                
                tgt.el.setAttribute('cx', newX);
                tgt.el.setAttribute('cy', newY);
                // Keep the same radius
                tgt.el.setAttribute('rx', rx);
                tgt.el.setAttribute('ry', ry);
            } else {
                tgt.el.setAttribute('x', newX);
                tgt.el.setAttribute('y', newY);
            }
        });
        updateHandlePositions(); 
        syncCode(false);
    };
    
    window.onmouseup = endDrag;
}

function endDrag() {
    if (isDragging) {
        saveState();
        isDragging = false;
        window.onmousemove = null;
        window.onmouseup = null;
    }
}

function updateHandlePositions() {
    const svg = render.querySelector('svg');
    if (!svg || selectedEls.length !== 1) {
        Object.values(handles).forEach(handle => handle.style.display = 'none');
        return;
    }
    
    const el = selectedEls[0];
    const rect = el.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    
    // Calculate positions relative to SVG
    const offsetX = svgRect.left - canvasSide.getBoundingClientRect().left;
    const offsetY = svgRect.top - canvasSide.getBoundingClientRect().top;
    
    try {
        if (el.tagName === 'rect') {
            const x = parseFloat(el.getAttribute('x') || 0);
            const y = parseFloat(el.getAttribute('y') || 0);
            const width = parseFloat(el.getAttribute('width') || 0);
            const height = parseFloat(el.getAttribute('height') || 0);
            
            // Position handles at corners
            const tl = {x: x, y: y};
            const tr = {x: x + width, y: y};
            const bl = {x: x, y: y + height};
            const br = {x: x + width, y: y + height};
            
            // Apply offsets to account for SVG positioning
            handles.tl.style.left = (tl.x + offsetX - 5) + 'px';
            handles.tl.style.top = (tl.y + offsetY - 5) + 'px';
            
            handles.tr.style.left = (tr.x + offsetX - 5) + 'px';
            handles.tr.style.top = (tr.y + offsetY - 5) + 'px';
            
            handles.bl.style.left = (bl.x + offsetX - 5) + 'px';
            handles.bl.style.top = (bl.y + offsetY - 5) + 'px';
            
            handles.br.style.left = (br.x + offsetX - 5) + 'px';
            handles.br.style.top = (br.y + offsetY - 5) + 'px';
            
            // Show handles
            Object.values(handles).forEach(handle => handle.style.display = 'block');
        } else if (el.tagName === 'circle') {
            const cx = parseFloat(el.getAttribute('cx') || 0);
            const cy = parseFloat(el.getAttribute('cy') || 0);
            const r = parseFloat(el.getAttribute('r') || 0);
            
            // Position handles at corners of bounding box
            const x = cx - r;
            const y = cy - r;
            const width = r * 2;
            const height = r * 2;
            
            const tl = {x: x, y: y};
            const tr = {x: x + width, y: y};
            const bl = {x: x, y: y + height};
            const br = {x: x + width, y: y + height};
            
            handles.tl.style.left = (tl.x + offsetX - 5) + 'px';
            handles.tl.style.top = (tl.y + offsetY - 5) + 'px';
            
            handles.tr.style.left = (tr.x + offsetX - 5) + 'px';
            handles.tr.style.top = (tr.y + offsetY - 5) + 'px';
            
            handles.bl.style.left = (bl.x + offsetX - 5) + 'px';
            handles.bl.style.top = (bl.y + offsetY - 5) + 'px';
            
            handles.br.style.left = (br.x + offsetX - 5) + 'px';
            handles.br.style.top = (br.y + offsetY - 5) + 'px';
            
            // Show handles
            Object.values(handles).forEach(handle => handle.style.display = 'block');
        } else if (el.tagName === 'path') {
            // For paths, use bounding box
            const bbox = el.getBBox();
            const x = bbox.x;
            const y = bbox.y;
            const width = bbox.width;
            const height = bbox.height;
            
            const tl = {x: x, y: y};
            const tr = {x: x + width, y: y};
            const bl = {x: x, y: y + height};
            const br = {x: x + width, y: y + height};
            
            handles.tl.style.left = (tl.x + offsetX - 5) + 'px';
            handles.tl.style.top = (tl.y + offsetY - 5) + 'px';
            
            handles.tr.style.left = (tr.x + offsetX - 5) + 'px';
            handles.tr.style.top = (tr.y + offsetY - 5) + 'px';
            
            handles.bl.style.left = (bl.x + offsetX - 5) + 'px';
            handles.bl.style.top = (bl.y + offsetY - 5) + 'px';
            
            handles.br.style.left = (br.x + offsetX - 5) + 'px';
            handles.br.style.top = (br.y + offsetY - 5) + 'px';
            
            // Show handles
            Object.values(handles).forEach(handle => handle.style.display = 'block');
        } else if (el.tagName === 'ellipse') {
            // For ellipses, use bounding box
            const cx = parseFloat(el.getAttribute('cx') || 0);
            const cy = parseFloat(el.getAttribute('cy') || 0);
            const rx = parseFloat(el.getAttribute('rx') || 0);
            const ry = parseFloat(el.getAttribute('ry') || 0);
            
            // Position handles at corners of bounding box
            const x = cx - rx;
            const y = cy - ry;
            const width = rx * 2;
            const height = ry * 2;
            
            const tl = {x: x, y: y};
            const tr = {x: x + width, y: y};
            const bl = {x: x, y: y + height};
            const br = {x: x + width, y: y + height};
            
            handles.tl.style.left = (tl.x + offsetX - 5) + 'px';
            handles.tl.style.top = (tl.y + offsetY - 5) + 'px';
            
            handles.tr.style.left = (tr.x + offsetX - 5) + 'px';
            handles.tr.style.top = (tr.y + offsetY - 5) + 'px';
            
            handles.bl.style.left = (bl.x + offsetX - 5) + 'px';
            handles.bl.style.top = (bl.y + offsetY - 5) + 'px';
            
            handles.br.style.left = (br.x + offsetX - 5) + 'px';
            handles.br.style.top = (br.y + offsetY - 5) + 'px';
            
            // Show handles
            Object.values(handles).forEach(handle => handle.style.display = 'block');
        } else {
            // For other elements (like line, polygon, etc.), just hide handles
            Object.values(handles).forEach(handle => handle.style.display = 'none');
        }
    } catch (e) {
        // If there's an error, hide handles
        Object.values(handles).forEach(handle => handle.style.display = 'none');
    }
}

// --- EVENTS ---
canvasSide.ondragover = (e) => { e.preventDefault(); };

canvasSide.ondrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/xml' || file.type === 'image/svg+xml' || file.name.endsWith('.svg'))) {
        const reader = new FileReader();
        reader.onload = (event) => {
            input.value = event.target.result;
            updatePreview();
        };
        reader.readAsText(file);
    }
};

window.onkeydown = (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key === 'z') { 
        e.preventDefault(); 
        undo(); 
    }
    if (isCtrl && e.key === 'y') { 
        e.preventDefault(); 
        redo(); 
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEls.length > 0) {
            selectedEls.forEach(el => el.remove());
            selectedEls = [];
            updateHandlePositions();
            syncCode();
        }
    }
};

function toggleSelection(el, multi) {
    if (!multi) {
        selectedEls.forEach(e => e.classList.remove('selected'));
        selectedEls = [];
    }
    
    if (selectedEls.includes(el)) {
        selectedEls = selectedEls.filter(e => e !== el);
        el.classList.remove('selected');
    } else {
        selectedEls.push(el);
        el.classList.add('selected');
    }
    
    document.getElementById('sel-count').innerText = `${selectedEls.length} selected`;
    document.getElementById('controls').style.display = selectedEls.length > 0 ? 'block' : 'none';

    if (selectedEls.length === 1) {
        const target = selectedEls[0];
        const fill = target.getAttribute('fill') || '#000000';
        const stroke = target.getAttribute('stroke') || '#000000';
        const strokeWidth = target.getAttribute('stroke-width') || '1';
        
        document.getElementById('fillPicker').value = fill;
        document.getElementById('strokePicker').value = stroke;
        document.getElementById('strokeWidth').value = strokeWidth;
    }

    updateHandlePositions();
}

function deselectAll() { 
    selectedEls.forEach(el => el.classList.remove('selected'));
    selectedEls = []; 
    updateHandlePositions(); 
}

function syncCode(save = true) {
    const clone = render.querySelector('svg').cloneNode(true);
    clone.querySelectorAll('*').forEach(el => {
        if (el.classList) el.classList.remove('selected');
    });
    input.value = new XMLSerializer().serializeToString(clone);
    if (save) saveState();
}

function getSVGPoint(e, svg) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function moveLayer(dir) { 
    if (selectedEls.length === 0) return;
    const svg = render.querySelector('svg');
    selectedEls.forEach(el => {
        if (dir === 'front') {
            svg.appendChild(el);
        } else if (dir === 'back') {
            svg.insertBefore(el, svg.firstChild);
        }
    });
    syncCode(); 
}

render.onmousedown = (e) => {
    if (currentTool === 'select' || e.target === render) return;
    const svg = render.querySelector('svg');
    const pt = getSVGPoint(e, svg);
    let newEl;

    if (currentTool === 'rect') {
        newEl = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
        newEl.setAttribute("x", pt.x - 25);
        newEl.setAttribute("y", pt.y - 25);
        newEl.setAttribute("width", 50);
        newEl.setAttribute("height", 50);
        newEl.setAttribute("fill", "#007acc");
    } else if (currentTool === 'circle') {
        newEl = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
        newEl.setAttribute("cx", pt.x);
        newEl.setAttribute("cy", pt.y);
        newEl.setAttribute("r", 25);
        newEl.setAttribute("fill", "#007acc");
    } else if (currentTool === 'ellipse') {
        newEl = document.createElementNS("http://www.w3.org/2000/svg", 'ellipse');
        newEl.setAttribute("cx", pt.x);
        newEl.setAttribute("cy", pt.y);
        newEl.setAttribute("rx", 35);
        newEl.setAttribute("ry", 20);
        newEl.setAttribute("fill", "#007acc");
    } else if (currentTool === 'text') {
        newEl = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        newEl.setAttribute("x", pt.x);
        newEl.setAttribute("y", pt.y);
        newEl.setAttribute("fill", "#222");
        newEl.setAttribute("font-size", "24");
        newEl.setAttribute("font-family", "Arial, sans-serif");
        newEl.textContent = "Text";
    }

    if (newEl) {
        attachElementListeners(newEl);
        svg.appendChild(newEl);
        syncCode();
        deselectAll();
        toggleSelection(newEl, false);
    }
};

document.getElementById('fillPicker').oninput = (e) => { 
    selectedEls.forEach(el => el.setAttribute('fill', e.target.value)); 
    syncCode(); 
};

document.getElementById('strokePicker').oninput = (e) => { 
    selectedEls.forEach(el => el.setAttribute('stroke', e.target.value)); 
    syncCode(); 
};

document.getElementById('strokeWidth').oninput = (e) => { 
    selectedEls.forEach(el => el.setAttribute('stroke-width', e.target.value)); 
    syncCode(); 
};

function describeCurrentAssets() {
    const svgText = input.value || '';
    return [{
        kind: 'text',
        title: 'Edited SVG',
        fileName: 'edited-vector.svg',
        mimeType: 'image/svg+xml',
        textContent: svgText,
        previewKind: 'text',
        previewText: svgText,
        sourceDetail: 'Current SVG document from SVG Editor.',
        metadata: { sourceTool: 'svg-editor', resourceFormat: 'svg' }
    }];
}

window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;

updatePreview();
setInterval(updateHandlePositions, 50);
