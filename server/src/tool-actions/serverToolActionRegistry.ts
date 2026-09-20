import path from "node:path";
import QRCode from "qrcode";
import { getSharpRuntime } from "@urage/server/services/sharpRuntime";
import type { ToolActionDependencies } from "./serverToolContracts.js";
import type { ServerToolManifest } from "./serverToolManifest.js";
import { ToolInvocationError } from "./toolInvocationError.js";
import { serverImageToolActions } from "./serverImageToolActions.js";
import { createMirroredSeamlessTexture } from "./serverSeamlessTextureAction.js";
import { createGameJuicePresets } from "./serverGameJuiceAction.js";
import { createSvgFromImage } from "./serverImageToSvgAction.js";
import { saveToolArtifact } from "./toolArtifactStore.js";
import { sliceSpritesheetGrid } from "./serverSpritesheetAction.js";
import { exportDialogueTree } from "./serverDialogueTreeAction.js";
import { exportRoadmap } from "./serverRoadmapAction.js";
import type { ManifestActionContext } from "./serverToolActionDispatcher.js";

type ManifestAction = (context: ManifestActionContext) => Promise<unknown>;

function requiredText(input: Record<string, unknown>, key: string): string {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  if (!value) throw new ToolInvocationError(400, `${key} is required.`);
  return value;
}

function boundedSize(value: unknown): number {
  if (value === undefined) return 512;
  const size = Number(value);
  if (!Number.isFinite(size)) throw new ToolInvocationError(400, "size must be a finite number.");
  return Math.max(64, Math.min(2048, Math.round(size)));
}

const MAX_BASE64_TEXT_BYTES = 1024 * 1024;

function boundedText(input: Record<string, unknown>, key: string): string {
  const text = requiredText(input, key);
  if (Buffer.byteLength(text, "utf8") > MAX_BASE64_TEXT_BYTES) {
    throw new ToolInvocationError(413, `${key} exceeds the 1 MiB server-action limit.`);
  }
  return text;
}

function normalizedBase64(value: string): string {
  const payload = value.startsWith("data:") ? value.slice(value.indexOf(",") + 1) : value;
  const compact = payload.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 === 1) {
    throw new ToolInvocationError(400, "data must be valid Base64, Base64URL, or a Base64 data URL.");
  }
  return compact.padEnd(Math.ceil(compact.length / 4) * 4, "=");
}

function decodeBase64Text(value: string): { base64: string; text: string; byteLength: number } {
  const normalized = normalizedBase64(value);
  const data = Buffer.from(normalized, "base64");
  const canonical = data.toString("base64");
  if (canonical !== normalized) throw new ToolInvocationError(400, "data contains invalid Base64 padding.");
  try {
    return { base64: canonical, text: new TextDecoder("utf-8", { fatal: true }).decode(data), byteLength: data.length };
  } catch {
    throw new ToolInvocationError(400, "Decoded data is binary, not UTF-8 text. Use the client tool for binary files.");
  }
}
function sourceImageInput(input: Record<string, unknown>): { imageId: string; imageFileName: string } {
  return { imageId: requiredText(input, "imageId"), imageFileName: requiredText(input, "imageFileName") };
}

function outputFormat(input: Record<string, unknown>): "png" | "jpeg" | "webp" {
  const value = input.format === undefined ? "png" : requiredText(input, "format");
  if (value !== "png" && value !== "jpeg" && value !== "webp") {
    throw new ToolInvocationError(400, "format must be png, jpeg, or webp.");
  }
  return value;
}

function outputQuality(input: Record<string, unknown>): number {
  if (input.quality === undefined) return 92;
  const quality = Number(input.quality);
  if (!Number.isFinite(quality)) throw new ToolInvocationError(400, "quality must be a finite number.");
  return Math.max(10, Math.min(100, Math.round(quality)));
}
function escapedHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function httpUrl(input: Record<string, unknown>, key: string): string {
  const value = requiredText(input, key);
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new ToolInvocationError(400, `${key} must be an absolute HTTP(S) URL.`);
  }
}

function createOpenGraphTags(title: string, description: string, url: string, imageUrl: string): string {
  const values = { title: escapedHtml(title), description: escapedHtml(description), url: escapedHtml(url), imageUrl: escapedHtml(imageUrl) };
  return `<title>${values.title}</title>\n<meta name="title" content="${values.title}">\n<meta name="description" content="${values.description}">\n\n<meta property="og:type" content="website">\n<meta property="og:url" content="${values.url}">\n<meta property="og:title" content="${values.title}">\n<meta property="og:description" content="${values.description}">\n<meta property="og:image" content="${values.imageUrl}">\n\n<meta property="twitter:card" content="summary_large_image">\n<meta property="twitter:url" content="${values.url}">\n<meta property="twitter:title" content="${values.title}">\n<meta property="twitter:description" content="${values.description}">\n<meta property="twitter:image" content="${values.imageUrl}">`;
}
const faviconSpecifications = [
  { fileName: "favicon-16x16.png", size: 16 },
  { fileName: "favicon-32x32.png", size: 32 },
  { fileName: "apple-touch-icon.png", size: 180 },
  { fileName: "android-chrome-192x192.png", size: 192 },
  { fileName: "android-chrome-512x512.png", size: 512 }
] as const;

function faviconWebManifest(): string {
  return JSON.stringify({
    name: "URage Toolset App",
    short_name: "URage",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    theme_color: "#00ffcc",
    background_color: "#121212",
    display: "standalone"
  }, null, 2);
}
function boundedGridDimension(input: Record<string, unknown>, key: string): number {
  const value = Number(input[key]);
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw new ToolInvocationError(400, `${key} must be an integer from 1 to 8.`);
  }
  return value;
}

function nonNegativePixelOffset(input: Record<string, unknown>, key: string): number {
  if (input[key] === undefined) return 0;
  const value = Number(input[key]);
  if (!Number.isInteger(value) || value < 0) throw new ToolInvocationError(400, `${key} must be a non-negative integer.`);
  return value;
}

async function renderImageFormat(image: any, format: "png" | "jpeg" | "webp", quality: number): Promise<Buffer> {
  if (format === "png") return image.png().toBuffer();
  if (format === "jpeg") return image.jpeg({ quality }).toBuffer();
  return image.webp({ quality }).toBuffer();
}
function hexColor(input: Record<string, unknown>, key: string, fallback: string): string {
  const value = input[key] === undefined ? fallback : requiredText(input, key);
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new ToolInvocationError(400, `${key} must be a six-digit hex color.`);
  return value;
}

function oneOf(input: Record<string, unknown>, key: string, allowed: readonly string[], fallback: string): string {
  const value = input[key] === undefined ? fallback : requiredText(input, key);
  if (!allowed.includes(value)) throw new ToolInvocationError(400, `${key} must be one of: ${allowed.join(", ")}.`);
  return value;
}

function generatedButtonCode(input: Record<string, unknown>): { html: string; css: string } {
  const text = input.text === undefined ? "Click Me" : boundedText(input, "text");
  const colorType = oneOf(input, "colorType", ["solid", "gradient"], "solid");
  const size = oneOf(input, "size", ["small", "medium", "large"], "medium");
  const animation = oneOf(input, "animation", ["none", "pulse", "bounce", "glow"], "none");
  const shape = oneOf(input, "shape", ["rounded", "square", "pill"], "rounded");
  const shadow = oneOf(input, "shadow", ["none", "small", "medium", "large"], "medium");
  const borderStyle = oneOf(input, "borderStyle", ["none", "solid", "dashed", "dotted"], "none");
  const borderWidth = input.borderWidth === undefined ? 0 : Number(input.borderWidth);
  if (!Number.isInteger(borderWidth) || borderWidth < 0 || borderWidth > 16) throw new ToolInvocationError(400, "borderWidth must be an integer from 0 to 16.");
  const color = hexColor(input, "color", "#3498db");
  const borderColor = hexColor(input, "borderColor", "#3498db");
  const gradientColors = Array.isArray(input.gradientColors) ? input.gradientColors.map((value, index) => {
    if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new ToolInvocationError(400, `gradientColors[${index}] must be a six-digit hex color.`);
    return value;
  }) : ["#3498db", "#9b59b6"];
  if (colorType === "gradient" && (gradientColors.length < 2 || gradientColors.length > 5)) throw new ToolInvocationError(400, "gradientColors must contain 2 to 5 colors.");
  const gradientDirection = oneOf(input, "gradientDirection", ["45deg", "90deg", "180deg", "circle"], "45deg");
  const glass = input.glass === true;
  const textShadow = input.textShadow === true;
  const paddings: Record<string, string> = { small: "8px 16px", medium: "12px 24px", large: "16px 32px" };
  const fontSizes: Record<string, string> = { small: "0.875rem", medium: "1rem", large: "1.25rem" };
  const radii: Record<string, string> = { rounded: "8px", square: "0px", pill: "50px" };
  const shadows: Record<string, string> = { none: "none", small: "0 2px 5px rgba(0,0,0,0.2)", medium: "0 4px 15px rgba(0,0,0,0.2)", large: "0 8px 25px rgba(0,0,0,0.3)" };
  const background = glass ? "rgba(255, 255, 255, 0.2)" : colorType === "gradient" ? (gradientDirection === "circle" ? `radial-gradient(circle, ${gradientColors.join(", ")})` : `linear-gradient(${gradientDirection}, ${gradientColors.join(", ")})`) : color;
  const animationClass = animation === "none" ? "" : ` btn-anim-${animation}`;
  const css = `.generated-button {\n    display: inline-block;\n    padding: ${paddings[size]};\n    font-size: ${fontSizes[size]};\n    font-weight: 600;\n    font-family: sans-serif;\n    text-align: center;\n    text-decoration: none;\n    cursor: pointer;\n    background: ${background};\n    color: white;\n    border-radius: ${radii[shape]};\n    border: ${borderStyle === "none" ? "none" : `${borderWidth}px ${borderStyle} ${borderColor}`};\n    box-shadow: ${shadows[shadow]};\n    text-shadow: ${textShadow ? "1px 1px 3px rgba(0,0,0,0.3)" : "none"};\n    transition: all 0.3s ease;\n}\n\n.generated-button:hover {\n    transform: translateY(-2px);\n    filter: brightness(1.1);\n    box-shadow: 0 6px 20px rgba(0,0,0,0.25);\n}\n\n.generated-button:active {\n    transform: translateY(0);\n}${animation === "none" ? "" : `\n\n@keyframes ${animation} {\n    0%, 100% { transform: scale(1); }\n    50% { transform: scale(1.05); }\n}\n.btn-anim-${animation} {\n    animation: ${animation} 1.5s infinite;\n}`}`;
  return { html: `<button class="generated-button${animationClass}">${escapedHtml(text)}</button>`, css };
}
function generatedBackgroundCss(input: Record<string, unknown>): string {
  const type = oneOf(input, "gradientType", ["linear", "radial", "conic"], "linear");
  const first = hexColor(input, "color1", "#ff7eb3");
  const second = hexColor(input, "color2", "#2575fc");
  const angle = input.angle === undefined ? 45 : Number(input.angle);
  if (!Number.isFinite(angle) || angle < 0 || angle > 360) throw new ToolInvocationError(400, "angle must be between 0 and 360.");
  const position = oneOf(input, "position", ["center", "top", "bottom", "left", "right"], "center");
  const gradient = type === "linear" ? `linear-gradient(${Math.round(angle)}deg, ${first}, ${second})` : type === "radial" ? `radial-gradient(${position}, ${first}, ${second})` : `conic-gradient(${first}, ${second})`;
  return `background: ${gradient};`;
}
function cssToScssModules(input: Record<string, unknown>): Record<string, string> {
  const css = boundedText(input, "css");
  const autoVariables = input.autoVariables !== false;
  const variables: Array<{ name: string; value: string }> = [];
  const seen = new Set<string>();
  const addValues = (values: string[], prefix: string) => {
    for (const value of values) {
      if (seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      const number = variables.filter(candidate => candidate.name.startsWith("$" + prefix + "-")).length + 1;
      variables.push({ name: "$" + prefix + "-" + number, value });
    }
  };
  addValues(css.match(/#(?:[0-9a-f]{3}){1,2}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) ?? [], "color");
  if (autoVariables) addValues(css.match(/(?<=:\s?)(?!(?:0|1px|100%)\b)(\d+(?:\.\d+)?(?:px|rem|em|vh|vw))/g) ?? [], "size");
  const files: Record<string, string> = {
    "_variables.scss": "// Variables\n" + variables.map(variable => variable.name + ": " + variable.value + ";").join("\n") + (variables.length ? "\n" : ""),
    "_reset.scss": "// Base\n",
    "_typography.scss": "// Typography\n",
    "_layout.scss": "// Layout\n",
    "_components.scss": "// Components\n"
  };
  for (const rawBlock of css.split("}")) {
    if (!rawBlock.trim() || !rawBlock.includes("{")) continue;
    let block = rawBlock.trim() + "}";
    for (const variable of variables) block = block.split(variable.value).join(variable.name);
    const selector = block.slice(0, block.indexOf("{")).trim();
    const target = /^(html|body|\*|audio|video)/.test(selector) ? "_reset.scss"
      : /^(h[1-6]|p|a|span|blockquote|li|ul|ol)/.test(selector) ? "_typography.scss"
        : /(\.container|\.grid|\.row|\.col|header|footer|nav)/.test(selector) ? "_layout.scss"
          : "_components.scss";
    files[target] += block + "\n\n";
  }
  const imports = Object.entries(files)
    .filter(([fileName, content]) => fileName !== "_variables.scss" ? content.split("\n").length > 2 : variables.length > 0)
    .map(([fileName]) => "@import '" + fileName.replace(".scss", "").replace("_", "") + "';")
    .join("\n");
  return { ...files, "main.scss": "/** Manifest **/\n\n" + imports + "\n" };
}
const manifestActions: Readonly<Record<string, ManifestAction>> = {
  async qr({ manifest, input, dependencies }) {
    const text = requiredText(input, "text");
    const size = boundedSize(input.size);
    const imageData = await QRCode.toBuffer(text, {
      type: "png",
      width: size,
      margin: 2,
      errorCorrectionLevel: "M"
    });
    const imported = await dependencies.importGeneratedImage({
      imageFileName: "qr-code.png",
      imageData,
      prompt: `QR code for ${text}`,
      width: size,
      height: size,
      model: manifest.title,
      metadata: { sourceTool: manifest.id, text, size }
    });
    dependencies.runtimeState.recordAction("dashboard:qr-code-creator", `Generated QR code ${imported.id}.`);
    return imported;
  },
  async csharpExtract({ manifest, input, dependencies }) {
    const code = boundedText(input, "code");
    const usings = (code.match(/using\s+[\w.]+;/g) ?? []).join("\n");
    const namespaceName = code.match(/namespace\s+([\w.]+)/)?.[1];
    const files: Array<{ fileName: string; content: string; type: string }> = [];
    const pattern = /(?:(?:public|internal|private|protected|static|partial|abstract)\s+)*(class|struct|enum)\s+(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      const brace = code.indexOf("{", match.index);
      if (brace < 0) continue;
      let depth = 1;
      let cursor = brace + 1;
      while (depth > 0 && cursor < code.length) {
        if (code[cursor] === "{") depth += 1;
        else if (code[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      if (depth !== 0) continue;
      const name = match[2] ?? "Extracted";
      const body = code.slice(match.index, cursor);
      const content = `${usings}${usings ? "\n\n" : ""}${namespaceName ? `namespace ${namespaceName}\n{\n` : ""}${body}${namespaceName ? "\n}" : ""}`;
      files.push({ fileName: `${name}.cs`, content, type: match[1] ?? "class" });
    }
    const artifacts = await Promise.all(files.map(file => saveToolArtifact({
      sourceToolId: manifest.id,
      fileName: file.fileName,
      mimeType: "text/plain; charset=utf-8",
      data: file.content,
      metadata: { declarationType: file.type }
    })));
    dependencies.runtimeState.recordAction("dashboard:csharp-class-extractor", `Extracted ${files.length} C# declarations.`);
    return { files, artifacts };
  },
  async htmlSeparateCombine({ manifest, input, dependencies }) {
    const mode = input.mode === undefined ? "separate" : requiredText(input, "mode");
    const html = boundedText(input, "html");
    if (mode === "separate") {
      const cssBlocks: string[] = [];
      let emittedStyleLink = false;
      let separatedHtml = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, cssBlock: string) => {
        cssBlocks.push(cssBlock.trim());
        if (emittedStyleLink) return "";
        emittedStyleLink = true;
        return '<link rel="stylesheet" href="style.css">';
      });
      const scripts: string[] = [];
      const scriptKinds = new Set<"classic" | "module">();
      let emittedScriptLink = false;
      separatedHtml = separatedHtml.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attributes: string, scriptBody: string) => {
        if (/\bsrc\s*=/i.test(attributes)) return full;
        const type = attributes.match(/\btype\s*=\s*["']?([^\s"'>]+)/i)?.[1]?.toLowerCase() ?? "";
        if (type === "importmap" || (type && !["module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"].includes(type))) return full;
        const content = scriptBody.trim();
        if (!content) return full;
        const kind = type === "module" ? "module" : "classic";
        scriptKinds.add(kind);
        scripts.push(content);
        if (emittedScriptLink) return "";
        emittedScriptLink = true;
        return kind === "module" ? '<script type="module" src="script.js"><\/script>' : '<script src="script.js"><\/script>';
      });
      if (scriptKinds.size > 1) throw new ToolInvocationError(400, "Cannot safely separate a document with mixed classic and module inline scripts.");
      const css = cssBlocks.filter(Boolean).join("\n\n");
      const js = scripts.join("\n\n");
      const files = { "index.html": separatedHtml.trim(), "style.css": css, "script.js": js };
      const artifacts = await Promise.all(Object.entries(files).map(async ([fileName, content]) => saveToolArtifact({
        sourceToolId: manifest.id,
        fileName,
        mimeType: fileName.endsWith(".html") ? "text/html; charset=utf-8" : fileName.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8",
        data: content,
        metadata: { mode, scriptKind: scriptKinds.values().next().value ?? "none" }
      })));
      dependencies.runtimeState.recordAction("dashboard:html-separator-and-combiner", "Separated HTML document.");
      return { html: files["index.html"], css, js, artifacts };
    }
    if (mode === "combine") {
      const css = typeof input.css === "string" ? input.css.trim() : "";
      const js = typeof input.js === "string" ? input.js.trim() : "";
      const moduleScript = /<script\b[^>]*\btype\s*=\s*["']module["'][^>]*\bsrc\s*=\s*["'][^"']*script\.js["'][^>]*><\/script>/i.test(html);
      let combined = html.replace(/<link[^>]*href=["'][^"']*style\.css["'][^>]*>/gi, "").replace(/<script[^>]*src=["'][^"']*script\.js["'][^>]*><\/script>/gi, "");
      if (css) combined = combined.includes("</head>") ? combined.replace("</head>", `\n<style>\n${css}\n</style>\n</head>`) : `<style>\n${css}\n</style>\n${combined}`;
      const scriptTag = moduleScript ? `<script type="module">\n${js}\n</script>` : `<script>\n${js}\n</script>`;
      if (js) combined = combined.includes("</body>") ? combined.replace("</body>", `\n${scriptTag}\n</body>`) : `${combined}\n${scriptTag}`;
      const outputHtml = combined.trim();
      const artifact = await saveToolArtifact({ sourceToolId: manifest.id, fileName: "index.html", mimeType: "text/html; charset=utf-8", data: outputHtml, metadata: { mode } });
      dependencies.runtimeState.recordAction("dashboard:html-separator-and-combiner", "Combined HTML document.");
      return { html: outputHtml, artifact };
    }
    throw new ToolInvocationError(400, "mode must be separate or combine.");
  },
  async cssBackground({ manifest, input, dependencies }) {
    const css = generatedBackgroundCss(input);
    const artifact = await saveToolArtifact({ sourceToolId: manifest.id, fileName: "background.css", mimeType: "text/css; charset=utf-8", data: css });
    dependencies.runtimeState.recordAction("dashboard:css-background-generator", "Generated CSS background.");
    return { css, artifact };
  },
  seamlessTexture: createMirroredSeamlessTexture,
  gameJuice: createGameJuicePresets,
  imageToSvg: createSvgFromImage,
  spritesheetGrid: sliceSpritesheetGrid,
  dialogueTree: exportDialogueTree,
  roadmap: exportRoadmap,
  async cssToScss({ manifest, input, dependencies }) {
    const files = cssToScssModules(input);
    const artifacts = await Promise.all(Object.entries(files).map(async ([fileName, content]) => saveToolArtifact({
      sourceToolId: manifest.id,
      fileName,
      mimeType: "text/x-scss; charset=utf-8",
      data: content,
      metadata: { module: fileName }
    })));
    dependencies.runtimeState.recordAction("dashboard:css-to-scss", "Converted CSS into " + Object.keys(files).length + " SCSS module files.");
    return { files, artifacts, sourceTool: manifest.id };
  },
  async htmlButton({ manifest, input, dependencies }) {
    const result = generatedButtonCode(input);
    const artifacts = await Promise.all([
      saveToolArtifact({ sourceToolId: manifest.id, fileName: "button.html", mimeType: "text/html; charset=utf-8", data: result.html }),
      saveToolArtifact({ sourceToolId: manifest.id, fileName: "button.css", mimeType: "text/css; charset=utf-8", data: result.css })
    ]);
    dependencies.runtimeState.recordAction("dashboard:html-button-generator", "Generated HTML button markup and CSS.");
    return { ...result, artifacts };
  },
  async pseudoAlbedo({ manifest, input, dependencies }) {
    const { imageId, imageFileName } = sourceImageInput(input);
    const sourceType = input.sourceType === undefined ? "normal" : requiredText(input, "sourceType");
    const normalFormat = input.normalFormat === undefined ? "opengl" : requiredText(input, "normalFormat");
    if ((sourceType !== "normal" && sourceType !== "height") || (normalFormat !== "opengl" && normalFormat !== "directx")) {
      throw new ToolInvocationError(400, "sourceType must be normal or height, and normalFormat must be opengl or directx.");
    }
    const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
    const converted = await serverImageToolActions.albedo(source.data, {
      sourceType,
      normalFormat,
      strength: input.strength === undefined ? undefined : Number(input.strength),
      contrast: input.contrast === undefined ? undefined : Number(input.contrast),
      softness: input.softness === undefined ? undefined : Number(input.softness),
      shadowColor: typeof input.shadowColor === "string" ? input.shadowColor : undefined,
      midColor: typeof input.midColor === "string" ? input.midColor : undefined,
      highlightColor: typeof input.highlightColor === "string" ? input.highlightColor : undefined,
      invert: input.invert === true
    });
    const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
    const imported = await dependencies.importGeneratedImage({
      imageFileName: `${sourceName}-pseudo-albedo.png`,
      imageData: converted.data,
      prompt: `Pseudo albedo generated from ${imageFileName}`,
      width: converted.width,
      height: converted.height,
      model: manifest.title,
      metadata: { sourceTool: manifest.id, sourceImageId: imageId, sourceImageFileName: imageFileName, sourceType, normalFormat }
    });
    dependencies.runtimeState.recordAction("dashboard:albedo-tools", `Generated pseudo albedo ${imported.id} from image ${imageId}.`);
    return imported;
  },
  async imageSplit({ manifest, input, dependencies }) {
    const { imageId, imageFileName } = sourceImageInput(input);
    const columns = boundedGridDimension(input, "columns");
    const rows = boundedGridDimension(input, "rows");
    if (columns * rows > 64) throw new ToolInvocationError(400, "The grid cannot contain more than 64 tiles.");
    const offsetX = nonNegativePixelOffset(input, "offsetX");
    const offsetY = nonNegativePixelOffset(input, "offsetY");
    const format = outputFormat(input);
    const quality = outputQuality(input);
    const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
    const sharp = getSharpRuntime();
    const image = sharp(source.data, { animated: false }).rotate();
    const metadata = await image.metadata();
    const width = Number(metadata.width ?? 0);
    const height = Number(metadata.height ?? 0);
    const tileWidth = Math.floor((width - offsetX) / columns);
    const tileHeight = Math.floor((height - offsetY) / rows);
    if (tileWidth < 1 || tileHeight < 1) throw new ToolInvocationError(400, "The selected offsets and grid do not leave a usable tile size.");
    const extension = format === "jpeg" ? "jpg" : format;
    const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
    const tiles: unknown[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const imageData = await renderImageFormat(
          sharp(source.data, { animated: false }).rotate().extract({ left: offsetX + column * tileWidth, top: offsetY + row * tileHeight, width: tileWidth, height: tileHeight }),
          format,
          quality
        );
        tiles.push(await dependencies.importGeneratedImage({
          imageFileName: `${sourceName}-${row + 1}-${column + 1}.${extension}`,
          imageData,
          prompt: `Tile ${row + 1},${column + 1} split from ${imageFileName}`,
          width: tileWidth,
          height: tileHeight,
          model: manifest.title,
          metadata: { sourceTool: manifest.id, sourceImageId: imageId, sourceImageFileName: imageFileName, row: row + 1, column: column + 1, rows, columns, offsetX, offsetY, format }
        }));
      }
    }
    dependencies.runtimeState.recordAction("dashboard:image-split-and-combine", `Split image ${imageId} into ${tiles.length} tiles.`);
    return { tiles, rows, columns, tileWidth, tileHeight, format };
  },
  async favicon({ manifest, input, dependencies }) {
    const { imageId, imageFileName } = sourceImageInput(input);
    const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
    const sharp = getSharpRuntime();
    const metadata = await sharp(source.data, { animated: false }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) {
      throw new ToolInvocationError(400, "The source image dimensions are unsupported for this tool.");
    }
    const icons = await Promise.all(faviconSpecifications.map(async specification => {
      const imageData = await sharp(source.data, { animated: false })
        .rotate()
        .resize(specification.size, specification.size, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
      return dependencies.importGeneratedImage({
        imageFileName: specification.fileName,
        imageData,
        prompt: `Favicon ${specification.size}x${specification.size} from ${imageFileName}`,
        width: specification.size,
        height: specification.size,
        model: manifest.title,
        metadata: { sourceTool: manifest.id, sourceImageId: imageId, sourceImageFileName: imageFileName, outputType: "favicon", size: specification.size }
      });
    }));
    dependencies.runtimeState.recordAction("dashboard:favicon-creator", `Created ${icons.length} favicon assets from image ${imageId}.`);
    return { icons, siteWebManifest: faviconWebManifest() };
  },
  async metaOg({ manifest, input, dependencies }) {
    const title = boundedText(input, "title");
    const description = boundedText(input, "description");
    const url = httpUrl(input, "url");
    const imageUrl = httpUrl(input, "imageUrl");
    const html = createOpenGraphTags(title, description, url, imageUrl);
    const artifact = await saveToolArtifact({ sourceToolId: manifest.id, fileName: "open-graph-tags.html", mimeType: "text/html; charset=utf-8", data: html, metadata: { url } });
    dependencies.runtimeState.recordAction("dashboard:meta-og-tag-generator", `Generated OG tags for ${url}.`);
    return { html, title, description, url, imageUrl, artifact };
  },
  async metadataStrip({ manifest, input, dependencies }) {
    const { imageId, imageFileName } = sourceImageInput(input);
    const format = outputFormat(input);
    const quality = outputQuality(input);
    const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
    const sharp = getSharpRuntime();
    const image = sharp(source.data, { animated: false }).rotate();
    const metadata = await image.metadata();
    const width = Number(metadata.width ?? 0);
    const height = Number(metadata.height ?? 0);
    if (!width || !height || width > 8192 || height > 8192) {
      throw new ToolInvocationError(400, "The source image dimensions are unsupported for this tool.");
    }
    const output = format === "png"
      ? image.png().toBuffer({ resolveWithObject: true })
      : format === "jpeg"
        ? image.jpeg({ quality }).toBuffer({ resolveWithObject: true })
        : image.webp({ quality }).toBuffer({ resolveWithObject: true });
    const rendered = await output;
    const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
    const imported = await dependencies.importGeneratedImage({
      imageFileName: `${sourceName}-clean.${format === "jpeg" ? "jpg" : format}`,
      imageData: rendered.data,
      prompt: `Metadata-stripped copy of ${imageFileName}`,
      width: rendered.info.width,
      height: rendered.info.height,
      model: manifest.title,
      metadata: { sourceTool: manifest.id, sourceImageId: imageId, sourceImageFileName: imageFileName, format, quality }
    });
    dependencies.runtimeState.recordAction("dashboard:image-metadata-remover", `Stripped metadata from image ${imageId} to ${imported.id}.`);
    return imported;
  },
  async base64({ input, dependencies }) {
    const mode = input.mode === undefined ? "encode" : requiredText(input, "mode");
    if (mode === "encode") {
      const text = boundedText(input, "text");
      const base64 = Buffer.from(text, "utf8").toString("base64");
      dependencies.runtimeState.recordAction("dashboard:base64-converter", `Encoded ${Buffer.byteLength(text, "utf8")} bytes of text.`);
      return { mode, base64, byteLength: Buffer.byteLength(text, "utf8") };
    }
    if (mode === "decode") {
      const encoded = boundedText(input, "data");
      const decoded = decodeBase64Text(encoded);
      dependencies.runtimeState.recordAction("dashboard:base64-converter", `Decoded ${decoded.byteLength} bytes of text.`);
      return { mode, ...decoded };
    }
    throw new ToolInvocationError(400, "mode must be encode or decode.");
  }
};

export function hasManifestAction(action: string): boolean {
  return Object.hasOwn(manifestActions, action);
}

export async function invokeManifestAction(context: ManifestActionContext): Promise<unknown> {
  const action = manifestActions[context.manifest.action];
  if (!action) throw new ToolInvocationError(404, `Server action '${context.manifest.action}' is not approved.`);
  return action(context);
}