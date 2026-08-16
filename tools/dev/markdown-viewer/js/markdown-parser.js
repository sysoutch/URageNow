// =========================================================
// MARKDOWN PARSER - Convert markdown to HTML
// =========================================================

let markdownBaseUrl = "";

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "")
        .replace(/'/g, "&#39;");
}

function resolveMarkdownUrl(value) {
    const source = String(value || "").trim();
    if (!source || source.startsWith("#")) return source;
    if (/^(https?:|data:|mailto:|tel:)/i.test(source)) return source;
    try {
        return new URL(source, markdownBaseUrl || window.location.href).toString();
    } catch (e) {
        return source;
    }
}

function markdownToHtml(markdown) {
    // Convert markdown to HTML
    let html = escapeHtml(markdown);

    // Convert headers (# Header)
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // Convert bold (**bold**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert italic (*italic*)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Convert inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // Convert links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, label, href) {
        return '<a href="' + resolveMarkdownUrl(href) + '" target="_blank" rel="noopener">' + label + '</a>';
    });

    // Convert images (local paths only)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, src) {
        return '<img src="' + resolveMarkdownUrl(src) + '" alt="' + alt + '">';
    });

    // Convert lists
    html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    // Convert blockquotes
    html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

    // Convert paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/^<p>/, '<p>');
    html = html.replace(/<\/p>$/, '</p>');

    // Wrap in paragraph tags
    if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>';
    }

    return html;
}