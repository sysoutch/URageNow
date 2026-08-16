// =========================================================
// APP - File handling, drag/drop, URL params
// =========================================================

function showMarkdownContent(markdown, title) {
    if (title) document.title = title;
    const readmeContent = document.getElementById('readmeContent');
    readmeContent.innerHTML = markdownToHtml(markdown);
    readmeContent.style.display = 'block';
    document.querySelector('.file-input').style.display = 'none';
    window.__urageMarkdownViewerCurrent = {
        markdown: String(markdown || ''),
        html: readmeContent.innerHTML,
        title: String(title || 'README Viewer').trim() || 'README Viewer'
    };
}

async function loadReadmeFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const src = String(params.get("src") || "").trim();
    if (!src) return;
    const title = String(params.get("title") || "README Viewer").trim();
    markdownBaseUrl = String(params.get("base") || src.replace(/[^/]+$/, "") || "").trim();
    document.querySelector('.file-input h2').textContent = title;
    const response = await fetch(src);
    if (!response.ok) throw new Error("Failed to load README.md");
    showMarkdownContent(await response.text(), title);
}

// Function to load and display the file
function loadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file');
        return;
    }

    if (file.name !== 'README.md' && !file.name.endsWith('.md')) {
        alert('Please select a README.md file');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        markdownBaseUrl = "";
        showMarkdownContent(e.target.result, file.name);
    };

    reader.readAsText(file);
}

// Allow drag and drop
document.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.name === 'README.md' || file.name.endsWith('.md')) {
            // Simulate file input
            const fileInput = document.getElementById('fileInput');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            loadFile();
        }
    }
});

// Initialize
if (window.registerDashboardTheme) window.registerDashboardTheme();

loadReadmeFromQuery().catch(error => {
    const readmeContent = document.getElementById('readmeContent');
    readmeContent.textContent = error && error.message ? error.message : 'Failed to load README.md';
    readmeContent.style.display = 'block';
});

function describeCurrentMarkdownAssets() {
    const current = window.__urageMarkdownViewerCurrent || null;
    if (!current || !current.markdown) return [];
    const baseName = current.title.toLowerCase().replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '') || 'readme';
    return [
        {
            kind: 'text',
            title: current.title,
            fileName: `${baseName}.md`,
            mimeType: 'text/markdown',
            textContent: current.markdown,
            previewKind: 'text',
            previewText: current.markdown,
            metadata: { sourceTool: 'markdown-viewer', format: 'markdown' }
        },
        {
            kind: 'text',
            title: `${current.title} HTML`,
            fileName: `${baseName}.html`,
            mimeType: 'text/html',
            textContent: current.html,
            previewKind: 'text',
            previewText: current.html,
            metadata: { sourceTool: 'markdown-viewer', format: 'html' }
        }
    ];
}

window.__urageToolDescribeCurrentAssets = describeCurrentMarkdownAssets;
window.__urageToolDescribeCurrentAsset = () => describeCurrentMarkdownAssets()[0] || null;
