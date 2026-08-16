function createDashboardPresentationHelpers() {
  const languageLabels = {
    cs: "C#",
    csharp: "C#",
    css: "CSS",
    html: "HTML",
    js: "JavaScript",
    javascript: "JavaScript",
    json: "JSON",
    jsx: "JSX",
    scss: "SCSS",
    ts: "TypeScript",
    tsx: "TSX",
    xml: "XML"
  };
  const syntaxLanguageAliases = {
    csharp: "cs",
    htm: "html",
    javascript: "js",
    jsx: "js",
    sass: "scss",
    tsx: "ts",
    typescript: "ts",
    xml: "html"
  };
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function normalizeCodeLanguage(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/^\./, "").split(/\s+/)[0] || "text";
    return syntaxLanguageAliases[raw] || raw;
  }
  function getCodeLanguageLabel(language) {
    const normalized = normalizeCodeLanguage(language);
    return languageLabels[normalized] || normalized.toUpperCase();
  }
  function pushSyntaxRanges(ranges, text, pattern, type) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text))) {
      const value = match[0];
      if (!value) {
        pattern.lastIndex += 1;
        continue;
      }
      ranges.push({ start: match.index, end: match.index + value.length, type });
    }
  }
  function rangesOverlap(left, right) {
    return left.start < right.end && right.start < left.end;
  }
  function collectSyntaxRanges(text, language) {
    const normalized = normalizeCodeLanguage(language);
    const ranges = [];
    pushSyntaxRanges(ranges, text, /\/\*[\s\S]*?\*\/|\/\/[^\n\r]*/g, "comment");
    pushSyntaxRanges(ranges, text, /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, "string");
    pushSyntaxRanges(ranges, text, /\b\d+(?:\.\d+)?\b/g, "number");
    if (normalized === "html") {
      pushSyntaxRanges(ranges, text, /<\/?[A-Za-z][\w:-]*/g, "tag");
      pushSyntaxRanges(ranges, text, /\s[A-Za-z_:][\w:.-]*(?=\s*=)/g, "attr");
    } else if (normalized === "css" || normalized === "scss") {
      pushSyntaxRanges(ranges, text, /[#.][A-Za-z_-][\w-]*/g, "selector");
      pushSyntaxRanges(ranges, text, /--?[A-Za-z_-][\w-]*(?=\s*:)/g, "property");
      pushSyntaxRanges(ranges, text, /\b(?:@media|@supports|@keyframes|from|to|important)\b/g, "keyword");
    } else {
      pushSyntaxRanges(ranges, text, /\b(?:abstract|async|await|break|case|catch|class|const|continue|default|delegate|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|interface|internal|let|namespace|new|null|out|override|private|protected|public|readonly|return|set|static|string|struct|switch|this|throw|true|try|typeof|using|var|void|while|yield)\b/g, "keyword");
      pushSyntaxRanges(ranges, text, /\b[A-Za-z_$][\w$]*(?=\s*\()/g, "function");
    }
    const sorted = ranges
      .sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start))
      .reduce((kept, range) => kept.some(existing => rangesOverlap(existing, range)) ? kept : kept.concat(range), []);
    return sorted;
  }
  function renderHighlightedCode(code, language) {
    const text = String(code ?? "");
    const ranges = collectSyntaxRanges(text, language);
    let cursor = 0;
    let html = "";
    ranges.forEach(range => {
      html += escapeHtml(text.slice(cursor, range.start));
      html += "<span class=\"syntax-token syntax-" + escapeHtml(range.type) + "\">" + escapeHtml(text.slice(range.start, range.end)) + "</span>";
      cursor = range.end;
    });
    return html + escapeHtml(text.slice(cursor));
  }
  function renderCodeBlockHtml(code, language) {
    const normalizedLanguage = normalizeCodeLanguage(language);
    const label = getCodeLanguageLabel(normalizedLanguage);
    return [
      "<figure class=\"markdown-code-block\" data-language=\"" + escapeHtml(normalizedLanguage) + "\">",
      "<figcaption class=\"markdown-code-header\"><span>" + escapeHtml(label) + "</span></figcaption>",
      "<pre><code class=\"language-" + escapeHtml(normalizedLanguage) + "\">" + renderHighlightedCode(code, normalizedLanguage) + "</code></pre>",
      "</figure>"
    ].join("");
  }
  function createMarkdownRenderer() {
    if (!window.marked || typeof window.marked.Renderer !== "function") {
      return null;
    }
    const renderer = new window.marked.Renderer();
    renderer.code = function(token, language) {
      if (token && typeof token === "object" && "text" in token) {
        return renderCodeBlockHtml(token.text, token.lang);
      }
      return renderCodeBlockHtml(token, language);
    };
    return renderer;
  }
  function renderMarkdownHtml(value) {
    const source = String(value ?? "").trim();
    if (!source) {
      return "<div class='markdown-empty'>No content.</div>";
    }
    const parser = window.marked && typeof window.marked.parse === "function"
      ? window.marked
      : null;
    const renderer = createMarkdownRenderer();
    const rawHtml = parser
      ? parser.parse(source, { breaks: true, gfm: true, renderer })
      : "<p>" + escapeHtml(source).replace(/\n/g, "<br>") + "</p>";
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
      return window.DOMPurify.sanitize(rawHtml);
    }
    return rawHtml;
  }
  function renderMarkdownInto(target, value, emptyText) {
    const element = typeof target === "string" ? document.getElementById(target) : target;
    if (!element) {
      return;
    }
    const source = String(value ?? "").trim();
    element.classList.add("markdown-surface");
    element.innerHTML = source
      ? renderMarkdownHtml(source)
      : "<div class='markdown-empty'>" + escapeHtml(emptyText || "No content.") + "</div>";
  }
  function setOutput(text) {
    renderMarkdownInto("main-output", text, "Ready.");
  }
  function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : "Unknown";
  }
  function clearChildren(node) {
    if (!node) {
      return;
    }
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }
  function setElementValue(id, value) {
    const node = document.getElementById(id);
    if (node && typeof node.value === "string") {
      node.value = value;
    }
  }
  function setElementChecked(id, checked) {
    const node = document.getElementById(id);
    if (node && typeof node.checked === "boolean") {
      node.checked = checked;
    }
  }
  return {
    escapeHtml,
    renderCodeBlockHtml,
    renderHighlightedCode,
    renderMarkdownHtml,
    renderMarkdownInto,
    setOutput,
    formatDateTime,
    clearChildren,
    setElementValue,
    setElementChecked
  };
}
