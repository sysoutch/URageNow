let siteConfig = {
    title: 'My Project',
    desc: 'Built with StudioHTML5',
    gaId: '',
    darkMode: false
};

if (window.registerDashboardThemeSync) window.registerDashboardThemeSync();

const editor = grapesjs.init({
    container: '#gjs',
    height: '100%',
    fromElement: true,
    storageManager: { type: 'local', autosave: true },
    blockManager: { appendTo: '#blocks' },
    layerManager: { appendTo: '#layers-container' },
    styleManager: { appendTo: '#styles-container' },
    traitManager: { appendTo: '#traits-container' },
    panels: { defaults: [] },
    deviceManager: {
        devices: [
            { id: 'desktop', name: 'Desktop', width: '' },
            { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
            { id: 'mobile-portrait', name: 'Mobile', width: '320px', widthMedia: '480px' },
            { id: 'mobile-landscape', name: 'Landscape', width: '568px', widthMedia: '768px' }
        ]
    },
    plugins: ['gjs-blocks-basic'],
    canvas: {
        styles: [
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
            'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css'
        ]
    }
});

// Add JavaScript trait for elements
editor.TraitManager.addType('javascript', {
    createInput({ trait }) {
        const input = document.createElement('textarea');
        input.className = 'trait-input';
        input.placeholder = 'Enter JavaScript code. (e.g., alert("Hello!");)';
        input.style.width = '100%';
        input.style.height = '100px';
        input.style.resize = 'vertical';
        return input;
    },
    onEvent({ elInput, component, trait }) {
        const value = elInput.value;
        component.addAttributes({ 'data-js': value });
    }
});

// Add a global JavaScript trait for site-wide scripts
editor.TraitManager.addType('global-javascript', {
    createInput({ trait }) {
        const input = document.createElement('textarea');
        input.className = 'trait-input';
        input.placeholder = 'Enter global JavaScript code. (e.g., function myFunction() { ... })';
        input.style.width = '100%';
        input.style.height = '150px';
        input.style.resize = 'vertical';
        return input;
    },
    onEvent({ elInput, component, trait }) {
        const value = elInput.value;
        // Store global JS in a special attribute or in a global variable
        if (!window.globalJS) window.globalJS = '';
        window.globalJS += value + '\n';
    }
});

// Add a command to open a JavaScript editor panel
editor.Commands.add('open-js-editor', {
    run: (ed) => {
        const jsContent = window.globalJS || '';
        const jsEditor = prompt('Edit global JavaScript code:', jsContent);
        if (jsEditor !== null) {
            window.globalJS = jsEditor;
        }
    }
});

// Add transition trait with cubic-bezier, delay and behavior
editor.TraitManager.addType('transition', {
    createInput({ trait }) {
        const container = document.createElement('div');
        container.className = 'trait-transition';
        
        // Timing function dropdown
        const timingSelect = document.createElement('select');
        timingSelect.className = 'trait-input';
        timingSelect.innerHTML = `
            <option value="ease">Ease</option>
            <option value="linear">Linear</option>
            <option value="ease-in">Ease-in</option>
            <option value="ease-out">Ease-out</option>
            <option value="ease-in-out">Ease-in-out</option>
            <option value="cubic-bezier">Cubic Bezier</option>
        `;
        timingSelect.style.width = '100%';
        timingSelect.style.marginBottom = '10px';
        
        // Delay input
        const delayInput = document.createElement('input');
        delayInput.type = 'text';
        delayInput.className = 'trait-input';
        delayInput.placeholder = 'Transition delay (e.g., 0s, 0.5s)';
        delayInput.style.width = '100%';
        delayInput.style.marginBottom = '10px';
        
        // Behavior input
        const behaviorSelect = document.createElement('select');
        behaviorSelect.className = 'trait-input';
        behaviorSelect.innerHTML = `
            <option value="normal">Normal</option>
            <option value="allow-discrete">Allow Discrete</option>
            <option value="forwards">Forwards</option>
            <option value="backwards">Backwards</option>
            <option value="both">Both</option>
        `;
        behaviorSelect.style.width = '100%';
        
        container.appendChild(timingSelect);
        container.appendChild(delayInput);
        container.appendChild(behaviorSelect);
        
        return container;
    },
    onEvent({ elInput, component, trait }) {
        const timingSelect = elInput.querySelector('select');
        const delayInput = elInput.querySelector('input[type="text"]');
        const behaviorSelect = elInput.querySelectorAll('select')[1];
        
        const timing = timingSelect.value;
        const delay = delayInput.value || '0s';
        const behavior = behaviorSelect.value;
        
        // Set CSS transition properties
        const transitionValue = `${timing} ${delay} ${behavior}`;
        component.addStyle({ transition: transitionValue });
    }
});

// Make JavaScript trait available for all components
editor.on('component:add', (component) => {
    // Add JavaScript trait to all newly added components
    if (!component.getTrait('javascript')) {
        component.addTrait({
            type: 'javascript',
            name: 'javascript',
            label: 'JavaScript'
        });
    }
});

// Add a command to open a JavaScript editor panel
editor.Commands.add('open-js-editor', {
    run: (ed) => {
        const jsContent = window.globalJS || '';
        const jsEditor = prompt('Edit global JavaScript code:', jsContent);
        if (jsEditor !== null) {
            window.globalJS = jsEditor;
        }
    }
});

editor.Panels.addPanel({
    id: 'devices-panel', el: '#device-switcher',
    buttons: [
        { id: 'device-desktop', command: 'set-device-desktop', className: 'fa fa-desktop', active: true },
        { id: 'device-tablet', command: 'set-device-tablet', className: 'fa fa-tablet' },
        { id: 'device-mobile-p', command: 'set-device-mobile-portrait', className: 'fa fa-mobile' },
        { id: 'device-mobile-l', command: 'set-device-mobile-landscape', className: 'fa fa-mobile fa-rotate-90' }
    ]
});

editor.Commands.add('set-device-desktop', { run: ed => ed.setDevice('desktop') });
editor.Commands.add('set-device-tablet', { run: ed => ed.setDevice('tablet') });
editor.Commands.add('set-device-mobile-portrait', { run: ed => ed.setDevice('mobile-portrait') });
editor.Commands.add('set-device-mobile-landscape', { run: ed => ed.setDevice('mobile-landscape') });

const bm = editor.BlockManager;

bm.add('button', {
    label: '<i class="fa fa-mouse-pointer"></i><div>Button</div>',
    category: 'Basic',
    content: `<button class="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold">Click Me</button>`
});

bm.add('canvas', {
    label: '<i class="fa fa-th"></i><div>Canvas</div>',
    category: 'Basic',
    content: `<div class="w-full h-64 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
        <span class="text-gray-500">Canvas Area</span>
    </div>`
});

bm.add('hero-modern', {
    label: '<i class="fa fa-star"></i><div>Hero Section</div>',
    category: 'Layout',
    content: `<section class="py-24 bg-white text-center">
        <div class="max-w-4xl mx-auto px-6">
            <h1 class="text-6xl font-extrabold text-gray-900 leading-tight">Create something <span class="text-indigo-600">Legendary.</span></h1>
            <p class="mt-6 text-xl text-gray-600">The most powerful way to build and export production-ready HTML5 sites.</p>
            <div class="mt-10 flex justify-center gap-4">
                <button class="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold">Get Started</button>
                <button class="border border-gray-200 px-8 py-4 rounded-xl font-bold">Live Demo</button>
            </div>
        </div>
    </section>`
});

bm.add('nav-sticky', {
    label: '<i class="fa fa-window-maximize"></i><div>Sticky Nav</div>',
    category: 'Navigation',
    content: `<nav class="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-white shadow-md">
        <div class="text-xl font-bold text-blue-600">LOGO</div>
        <div class="hidden md:flex space-x-6 text-gray-600 font-medium">
            <a href="#" class="hover:text-blue-600">Home</a><a href="#" class="hover:text-blue-600">Services</a>
        </div>
        <button class="bg-blue-600 text-white px-5 py-2 rounded-lg">Action</button>
    </nav>`
});

bm.add('nav-float', {
    label: '<i class="fa fa-ellipsis-h"></i><div>Floating Nav</div>',
    category: 'Navigation',
    content: `<div class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-4xl">
        <nav class="bg-white bg-opacity-80 backdrop-filter backdrop-blur-lg border border-gray-200 rounded-2xl px-6 py-3 flex justify-between items-center shadow-xl">
            <span class="font-bold">STUDIO.</span>
            <div class="space-x-4 text-xs font-bold uppercase"><a href="#">Work</a><a href="#">About</a></div>
        </nav></div>`
});

bm.add('footer-modern', {
    label: '<i class="fa fa-arrow-down"></i><div>Footer</div>',
    category: 'Navigation',
    content: `<footer class="bg-gray-900 text-gray-300 py-12 px-8 text-center text-xs fixed bottom-0 left-0 w-full">© 2026 StudioHTML5.</footer>`
});

const tpls = {
    startup: {
        label: 'SaaS Growth', category: 'Landing', icon: 'fa-rocket',
        html: `
            <nav class="flex items-center justify-between px-12 py-6 bg-white border-b border-gray-100">
                <div class="text-2xl font-black text-indigo-600">FLOW.</div>
                <div class="space-x-8 font-medium text-gray-600"><a>Product</a><a>Pricing</a><a>Docs</a></div>
                <button class="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-indigo-200">Get Started</button>
            </nav>
            <section class="py-28 bg-white text-center">
                <div class="max-w-4xl mx-auto px-6">
                    <span class="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider">v2.0 is live</span>
                    <h1 class="text-7xl font-black text-gray-900 mt-8 mb-6 tracking-tight">Everything you need to <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-crystal-600">scale faster.</span></h1>
                    <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">Stop managing infrastructure and start building features. The all-in-one platform for modern developers.</p>
                    <div class="flex justify-center gap-4">
                        <div class="p-4 border border-gray-100 rounded-2xl shadow-sm bg-gray-50 w-40 text-left">
                            <div class="text-indigo-600 font-bold text-2xl">99.9%</div><div class="text-xs text-gray-400 font-bold uppercase">Uptime</div>
                        </div>
                        <div class="p-4 border border-gray-100 rounded-2xl shadow-sm bg-gray-50 w-40 text-left">
                            <div class="text-indigo-600 font-bold text-2xl">24/7</div><div class="text-xs text-gray-400 font-bold uppercase">Support</div>
                        </div>
                    </div>
                </div>
            </section>`,
        css: 'body{margin:0; font-family: sans-serif;}'
    },
    agency: {
        label: 'Creative Agency', category: 'Portfolio', icon: 'fa-wand-magic-sparkles',
        html: `
            <section class="bg-zinc-900 text-white min-h-screen">
                <div class="grid grid-cols-1 md:grid-cols-2">
                    <div class="h-screen flex flex-col justify-center px-20 border-r border-zinc-800">
                        <h2 class="text-indigo-500 font-mono mb-4">// Who we are</h2>
                        <h1 class="text-8xl font-black mb-8 leading-none">WE BUILD<br>DIGITAL<br>RECORDS.</h1>
                        <p class="text-zinc-400 text-lg max-w-sm">Award-winning agency specializing in high-end web experiences and brand identity.</p>
                    </div>
                    <div class="grid grid-cols-2">
                        <div class="aspect-square bg-zinc-800 flex items-center justify-center border-b border-zinc-700 font-black text-4xl text-zinc-700">WORK_01</div>
                        <div class="aspect-square bg-zinc-700 flex items-center justify-center border-b border-l border-zinc-600 font-black text-4xl text-zinc-600">WORK_02</div>
                        <div class="aspect-square bg-zinc-600 flex items-center justify-center font-black text-4xl text-zinc-500">WORK_03</div>
                        <div class="aspect-square bg-zinc-500 flex items-center justify-center border-l border-zinc-400 font-black text-4xl text-zinc-400">WORK_04</div>
                    </div>
                </div>
            </section>`,
        css: 'body{margin:0; font-family: sans-serif;}'
    },
    service: {
        label: 'Legal/Pro Service', category: 'Business', icon: 'fa-scale-balanced',
        html: `
            <div class="bg-slate-900 py-2 px-12 text-center text-xs text-slate-400 border-b border-slate-800">
                Call for a free consultation: 1-800-STUDIO-HTML
            </div>
            <nav class="bg-white py-6 px-12 flex justify-between items-center sticky top-0 z-50 shadow-sm">
                <div class="font-serif text-2xl italic font-bold">L&W Partners</div>
                <div class="flex gap-8 text-sm font-bold uppercase tracking-widest"><a>Practice Areas</a><a>Attorneys</a><a>Contact</a></div>
            </nav>
            <section class="relative h-[600px] bg-slate-100 flex items-center px-20">
                <div class="max-w-2xl">
                    <h1 class="text-6xl font-serif font-bold text-slate-900 mb-6">Expert Legal Counsel for Complex Matters.</h1>
                    <p class="text-lg text-slate-600 mb-8">With over 40 years of experience, we provide dedicated advocacy for our clients in and out of the courtroom.</p>
                    <button class="bg-slate-900 text-white px-10 py-4 font-bold uppercase tracking-widest">Our Expertise</button>
                </div>
            </section>`,
        css: 'body{margin:0; font-family: sans-serif;}'
    }
};

editor.Commands.add('open-templates', {
    run: (ed) => {
        const categories = ['All', 'Landing', 'Portfolio', 'Business'];
        
        const render = (filter = 'All') => {
            let keys = Object.keys(tpls);
            if(filter !== 'All') keys = keys.filter(k => tpls[k].category === filter);

            const tabs = categories.map(c => `<div class="tpl-tab ${filter === c ? 'active' : ''}" onclick="window.updateTplFilter('${c}')">${c}</div>`).join('');
            const cards = keys.map(k => `
                <div class="tpl-card">
                    <div class="tpl-preview-area"><i class="fa ${tpls[k].icon}"></i></div>
                    <div class="tpl-actions">
                        <button class="btn-tpl-apply" onclick="applyTpl('${k}')">Apply Template</button>
                        <button class="btn-tpl-preview" onclick="showQuickPreview('${k}')">Quick View</button>
                    </div>
                    <div class="tpl-info">
                        <div class="tpl-tag">${tpls[k].category}</div>
                        <div class="tpl-name">${tpls[k].label}</div>
                    </div>
                </div>
            `).join('');

            return `<div class="modal-body tpl-container"><div class="tpl-tabs">${tabs}</div><div class="tpl-grid">${cards}</div></div>`;
        };

        window.updateTplFilter = (c) => ed.Modal.setContent(render(c));
        ed.Modal.setTitle('Template Library').setContent(render()).open();
    }
});

window.applyTpl = (key) => {
    editor.setComponents(tpls[key].html);
    editor.setStyle(tpls[key].css);
    editor.Modal.close();
};

window.showQuickPreview = (key) => {
    const tpl = tpls[key];
    const frame = document.getElementById('preview-frame');
    const overlay = document.getElementById('tpl-full-preview');
    
    document.getElementById('preview-title').innerText = tpl.label;
    overlay.style.display = 'flex';
    
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<html><head><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"><style>${tpl.css}</style></head><body>${tpl.html}</body></html>`);
    doc.close();

    document.getElementById('preview-apply-btn').onclick = () => {
        applyTpl(key);
        overlay.style.display = 'none';
    };
};

editor.Commands.add('save-to-library', {
    run: (ed) => {
        ed.Modal.setTitle('Save Current Design to Library').setContent(`
            <div class="modal-body">
                <label>Template Name</label>
                <input id="new-tpl-name" placeholder="My Awesome Landing Page">
                <label>Category</label>
                <select id="new-tpl-cat" style="width:100%; margin-top:8px; padding:12px; background:#0f172a; border:1px solid var(--border); color:#fff; border-radius:6px;">
                    <option value="Landing">Landing</option>
                    <option value="Portfolio">Portfolio</option>
                    <option value="Business">Business</option>
                    <option value="Custom">Custom</option>
                </select>
                <button onclick="processSaveTemplate()" class="btn btn-blue" style="width:100%; margin-top:20px; justify-content:center;">Save to Library</button>
            </div>
        `).open();
    }
});

window.processSaveTemplate = () => {
    const name = document.getElementById('new-tpl-name').value || 'Untitled Design';
    const cat = document.getElementById('new-tpl-cat').value;
    const id = 'custom_' + Date.now();

    tpls[id] = {
        label: name,
        category: cat,
        icon: 'fa-floppy-disk',
        html: editor.getHtml(),
        css: editor.getCss()
    };

    alert('Saved! You can now find this in the Templates panel.');
    editor.Modal.close();
};

document.getElementById('global-settings-trigger').onclick = () => {
    editor.Modal.setTitle('Site Settings').setContent(`
        <div class="modal-body">
            <label>Site Title</label><input id="set-title" value="${siteConfig.title}">
            <label>Description</label><textarea id="set-desc" rows="2">${siteConfig.desc}</textarea>
            <label>GA ID (G-XXXXX)</label><input id="set-ga" value="${siteConfig.gaId}">
            <label style="display:flex; align-items:center; gap:10px; margin-top:15px;">
                <input type="checkbox" id="set-dark" ${siteConfig.darkMode ? 'checked' : ''} style="width:auto; margin:0;"> Dark Mode Export
            </label>
            <button onclick="saveAllSettings()" class="btn btn-blue" style="width:100%; margin-top:20px; justify-content:center;">Save All Changes</button>
        </div>
    `).open();
};

window.saveAllSettings = () => {
    siteConfig.title = document.getElementById('set-title').value;
    siteConfig.desc = document.getElementById('set-desc').value;
    siteConfig.gaId = document.getElementById('set-ga').value;
    siteConfig.darkMode = document.getElementById('set-dark').checked;
    editor.Modal.close();
};

editor.Commands.add('publish-site', {
    run: (ed) => {
        const zip = new JSZip();
        zip.file("index.html", buildExportHtml(ed));
        zip.generateAsync({type:"blob"}).then(content => saveAs(content, "project.zip"));
    }
});

function buildExportHtml(ed = editor) {
    const darkStyle = siteConfig.darkMode ? 'body{background:#121212; color:#fff;}' : '';
    let gaPart = '';
    if(siteConfig.gaId) {
        gaPart = `<script async src="https://www.googletagmanager.com/gtag/js?id=${siteConfig.gaId}"><\/script>
                  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${siteConfig.gaId}');<\/script>`;
    }
    let jsContent = '';
    const components = ed.getComponents();
    components.forEach(component => {
        const js = component.getAttributes()['data-js'];
        if (js) jsContent += js + '\n';
    });
    return `<!DOCTYPE html><html lang="en"><head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${siteConfig.title}</title>
        <meta name="description" content="${siteConfig.desc}">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
        ${gaPart}<style>${ed.getCss()}${darkStyle}</style>
    </head><body>${ed.getHtml()}<script>${jsContent}</script></body></html>`;
}

function describeCurrentAssets() {
    const text = buildExportHtml(editor);
    return [{
        kind: 'text',
        title: 'Website Builder Export',
        fileName: 'index.html',
        mimeType: 'text/html',
        textContent: text,
        previewKind: 'text',
        previewText: text,
        sourceDetail: 'Published website HTML from Website Builder.',
        metadata: { sourceTool: 'website-builder', resourceFormat: 'html' }
    }];
}

window.__urageToolDescribeCurrentAssets = describeCurrentAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentAssets()[0] || null;

editor.on('run:preview', () => {
    editor.select(); 
    const frames = editor.Canvas.getFrames();
    frames.forEach(frame => frame.el.style.pointerEvents = 'all');
    document.getElementById('back-to-editor').style.display = 'block';
    document.querySelector('.app-container').style.gridTemplateColumns = '0 1fr 0';
});

editor.on('stop:preview', () => {
    const frames = editor.Canvas.getFrames();
    frames.forEach(frame => frame.el.style.pointerEvents = 'none');
    document.getElementById('back-to-editor').style.display = 'none';
    document.querySelector('.app-container').style.gridTemplateColumns = '260px 1fr 280px';
});

document.body.insertAdjacentHTML('beforeend', `
    <div id="tpl-full-preview">
        <div class="preview-header">
            <h3 id="preview-title" style="margin:0">Template Preview</h3>
            <button class="btn btn-secondary" onclick="document.getElementById('tpl-full-preview').style.display='none'">
                <i class="fa fa-times"></i> Close Preview
            </button>
        </div>
        <div class="preview-window">
            <iframe id="preview-frame" style="width:100%; height:100%; border:none;"></iframe>
        </div>
        <button id="preview-apply-btn" class="btn btn-blue" style="margin-top:20px; padding: 12px 40px;">Use This Template</button>
    </div>

    <!-- Import HTML Panel -->
    <div id="import-html-div" class="import-html-div" style="display: none;">
        <div class="panel-header">
            <h3>Import HTML</h3>
            <button class="btn btn-secondary" onclick="toggleImportHtmlPanel()"><i class="fa fa-times"></i></button>
        </div>
        <div class="panel-body">
            <div class="import-html-content">
                <p>Upload your HTML file to import it into the editor:</p>
                <input type="file" id="html-file-input" accept=".html,.htm" style="margin: 10px 0;">
                <button class="btn btn-blue" onclick="importHtmlFile()">Import HTML</button>
            </div>
        </div>
    </div>
`);

function toggleImportHtmlPanel() {
    const importDiv = document.getElementById('import-html-div');
    if (importDiv.style.display === 'none') {
        importDiv.style.display = 'block';
    } else {
        importDiv.style.display = 'none';
    }
}

function importHtmlFile() {
    const fileInput = document.getElementById('html-file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select an HTML file to import.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            const bodyContent = doc.body.innerHTML;
            
            let cssContent = '';
            const styleElements = doc.querySelectorAll('style');
            styleElements.forEach(style => {
                cssContent += style.innerHTML;
            });
            
            const elementsWithStyles = doc.querySelectorAll('[style]');
            elementsWithStyles.forEach(element => {
                const inlineStyle = element.getAttribute('style');
                if (inlineStyle) {
                    const elementSelector = element.tagName.toLowerCase();
                    cssContent += `${elementSelector} { ${inlineStyle} }`;
                }
            });

            // Extract JavaScript content
            let jsContent = '';
            const scriptElements = doc.querySelectorAll('script');
            scriptElements.forEach(script => {
                if (script.src) {
                    // For external scripts, we could potentially load them, but for now we'll skip
                    // In a real implementation, you might want to handle external scripts differently
                } else {
                    // For inline scripts, extract the content
                    jsContent += script.innerHTML + '\n';
                }
            });

            editor.setComponents('');
            editor.setStyle('');
            
            editor.setComponents(bodyContent);
            
            if (cssContent.trim()) {
                editor.addStyle(cssContent);
            }
            
            // If there's JavaScript content, we could potentially add it to a script manager
            // For now, we'll just log it to console for debugging purposes
            if (jsContent.trim()) {
                console.log('Imported JavaScript content:', jsContent);
                // In a real implementation, you might want to add this to a script manager or editor
            }
            
            fileInput.value = '';
            toggleImportHtmlPanel();
        } catch (error) {
            console.error('Error importing HTML:', error);
            alert('Error importing HTML. Please check the file and try again.');
        }
    };
    reader.readAsText(file);
}
