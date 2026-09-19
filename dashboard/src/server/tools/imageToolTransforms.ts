import { getSharpRuntime } from "@urage/server/services/sharpRuntime";

export interface ImageTransformResult {
  data: Buffer;
  width: number;
  height: number;
}

export type AsciiCharacterSet = "dense" | "blocks" | "detailed" | "classic";
export type AsciiColorMode = "mono" | "color" | "green";

export interface AsciiArtOptions {
  columns?: number;
  characterSet?: AsciiCharacterSet;
  colorMode?: AsciiColorMode;
}

interface AsciiArtResult extends ImageTransformResult {
  text: string;
  columns: number;
  rows: number;
  extension: "png" | "gif";
  frames: number;
}

const ASCII_CHARACTER_SETS: Record<AsciiCharacterSet, string> = {
  dense: "@%#*+=-:. ",
  blocks: "█▓▒░ ",
  detailed: "MWNXK0Okxdolc:,. ",
  classic: "@#S%?*+;:,.' "
};

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function normaliseColumns(value: number | undefined): number {
  return Math.max(16, Math.min(160, Math.round(value ?? 100)));
}

function normaliseCharacterSet(value: AsciiCharacterSet | undefined): AsciiCharacterSet {
  return value ?? "detailed";
}

function normaliseColorMode(value: AsciiColorMode | undefined): AsciiColorMode {
  return value ?? "color";
}

async function readRgba(input: Buffer): Promise<{ pixels: Buffer; width: number; height: number }> {
  const sharp = getSharpRuntime();
  const image = sharp(input, { animated: false }).rotate();
  const metadata = await image.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096) {
    throw new Error("The source image dimensions are unsupported for this tool.");
  }
  return { pixels: await image.ensureAlpha().raw().toBuffer(), width, height };
}

function sampleLuminance(pixels: Buffer, width: number, height: number, x: number, y: number): number {
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));
  const offset = (clampedY * width + clampedX) * 4;
  return ((pixels[offset] ?? 0) * 0.2126) + ((pixels[offset + 1] ?? 0) * 0.7152) + ((pixels[offset + 2] ?? 0) * 0.0722);
}

export async function createNormalMap(input: Buffer, strength = 2): Promise<ImageTransformResult> {
  const { pixels, width, height } = await readRgba(input);
  const output = Buffer.alloc(width * height * 4);
  const scale = Math.max(0.1, Math.min(10, strength));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (sampleLuminance(pixels, width, height, x + 1, y) - sampleLuminance(pixels, width, height, x - 1, y)) / 255 * scale;
      const dy = (sampleLuminance(pixels, width, height, x, y + 1) - sampleLuminance(pixels, width, height, x, y - 1)) / 255 * scale;
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * width + x) * 4;
      output[offset] = Math.round(((-dx / length) * .5 + .5) * 255);
      output[offset + 1] = Math.round(((-dy / length) * .5 + .5) * 255);
      output[offset + 2] = Math.round(((1 / length) * .5 + .5) * 255);
      output[offset + 3] = pixels[offset + 3] ?? 255;
    }
  }
  const data = await getSharpRuntime()(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { data, width, height };
}

function asciiCharacter(red: number, green: number, blue: number, alpha: number, characters: string): string {
  const luminance = alpha === 0 ? 255 : red * .2126 + green * .7152 + blue * .0722;
  const index = Math.min(characters.length - 1, Math.floor(((255 - luminance) / 255) * (characters.length - 1)));
  return characters[index] ?? " ";
}

function asciiFill(red: number, green: number, blue: number, alpha: number, mode: AsciiColorMode): string {
  if (mode === "green") return "#00e676";
  if (mode === "mono") return "#f3f3f3";
  return `rgba(${red},${green},${blue},${Math.max(0, Math.min(1, alpha / 255)).toFixed(3)})`;
}

async function renderAsciiFrame(pixels: Buffer, sourceWidth: number, sourceHeight: number, columns: number, characters: string, colorMode: AsciiColorMode): Promise<{ data: Buffer; width: number; height: number; text: string }> {
  const sharp = getSharpRuntime();
  const rows = Math.max(8, Math.round(sourceHeight / sourceWidth * columns * .5));
  const sampled = await sharp(pixels, { raw: { width: sourceWidth, height: sourceHeight, channels: 4 } })
    .resize(columns, rows, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  const fontSize = 16;
  const charWidth = 9.64;
  const padding = 24;
  const width = Math.ceil(columns * charWidth + padding * 2);
  const height = rows * fontSize + padding * 2;
  const lines: string[] = [];
  const glyphs: string[] = [];

  for (let y = 0; y < rows; y += 1) {
    let line = "";
    const baseline = padding + (y + 1) * fontSize;
    for (let x = 0; x < columns; x += 1) {
      const offset = (y * columns + x) * 4;
      const red = sampled[offset] ?? 0;
      const green = sampled[offset + 1] ?? 0;
      const blue = sampled[offset + 2] ?? 0;
      const alpha = sampled[offset + 3] ?? 255;
      const character = asciiCharacter(red, green, blue, alpha, characters);
      line += character;
      glyphs.push(`<tspan x="${(padding + x * charWidth).toFixed(2)}" y="${baseline}" fill="${asciiFill(red, green, blue, alpha, colorMode)}">${escapeXml(character)}</tspan>`);
    }
    lines.push(line);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101010"/><text font-family="Courier New, Courier, monospace" font-size="${fontSize}" xml:space="preserve">${glyphs.join("")}</text></svg>`;
  return { data: await sharp(Buffer.from(svg)).png().toBuffer(), width, height, text: lines.join("\n") };
}

export async function createAsciiArt(input: Buffer, options: AsciiArtOptions = {}): Promise<AsciiArtResult> {
  const sharp = getSharpRuntime();
  const source = sharp(input, { animated: true }).rotate();
  const metadata = await source.metadata();
  const width = Number(metadata.width || 0);
  const frameHeight = Number(metadata.pageHeight || metadata.height || 0);
  const frames = Math.max(1, Number(metadata.pages || 1));
  if (!Number.isInteger(width) || !Number.isInteger(frameHeight) || width < 1 || frameHeight < 1 || width > 4096 || frameHeight > 4096) {
    throw new Error("The source image dimensions are unsupported for this tool.");
  }

  const columns = normaliseColumns(options.columns);
  const characterSet = normaliseCharacterSet(options.characterSet);
  const colorMode = normaliseColorMode(options.colorMode);
  const raw = await source.ensureAlpha().raw().toBuffer();
  const frameLength = width * frameHeight * 4;
  const rendered = [];
  for (let frame = 0; frame < frames; frame += 1) {
    rendered.push(await renderAsciiFrame(raw.subarray(frame * frameLength, (frame + 1) * frameLength), width, frameHeight, columns, ASCII_CHARACTER_SETS[characterSet], colorMode));
  }
  const first = rendered[0];
  if (!first) throw new Error("The source image does not contain a renderable frame.");
  if (frames === 1) return { ...first, columns, rows: Math.max(8, Math.round(frameHeight / width * columns * .5)), extension: "png", frames: 1 };

  const rawFrames = await Promise.all(rendered.map(frame => sharp(frame.data).ensureAlpha().raw().toBuffer()));
  const delays = Array.from({ length: frames }, (_, index) => Math.max(10, Number(metadata.delay?.[index] || metadata.delay?.[0] || 100)));
  const data = await sharp(Buffer.concat(rawFrames), { raw: { width: first.width, height: first.height * frames, channels: 4, pageHeight: first.height } })
    .gif({ loop: Number(metadata.loop || 0), delay: delays, effort: 7 }).toBuffer();
  return { data, width: first.width, height: first.height, text: first.text, columns, rows: Math.max(8, Math.round(frameHeight / width * columns * .5)), extension: "gif", frames };
}
function parseTransformHexColor(value: string, label: string): [number, number, number] {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) throw new Error(`${label} must be a six-digit hex color.`);
  return [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16)];
}

export async function replaceImageColor(input: Buffer, targetColor: string, replacementColor: string, tolerance = 0): Promise<ImageTransformResult> {
  const { pixels, width, height } = await readRgba(input);
  const target = parseTransformHexColor(targetColor, "targetColor");
  const replacement = parseTransformHexColor(replacementColor, "replacementColor");
  const limit = Math.max(0, Math.min(442, Number(tolerance) || 0));
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if ((pixels[offset + 3] ?? 0) === 0) continue;
    if (Math.hypot((pixels[offset] ?? 0) - target[0], (pixels[offset + 1] ?? 0) - target[1], (pixels[offset + 2] ?? 0) - target[2]) > limit) continue;
    pixels[offset] = replacement[0]; pixels[offset + 1] = replacement[1]; pixels[offset + 2] = replacement[2];
  }
  return { data: await getSharpRuntime()(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer(), width, height };
}

export async function extractImagePalette(input: Buffer, colorCount = 8): Promise<Array<{ hex: string; red: number; green: number; blue: number; pixels: number }>> {
  const { pixels } = await readRgba(input);
  const requestedCount = Math.max(2, Math.min(32, Math.round(Number(colorCount) || 8)));
  const bins = new Map<string, { red: number; green: number; blue: number; pixels: number }>();
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if ((pixels[offset + 3] ?? 0) < 128) continue;
    const red = Math.floor((pixels[offset] ?? 0) / 16) * 16 + 8;
    const green = Math.floor((pixels[offset + 1] ?? 0) / 16) * 16 + 8;
    const blue = Math.floor((pixels[offset + 2] ?? 0) / 16) * 16 + 8;
    const key = `${red},${green},${blue}`;
    const bin = bins.get(key) ?? { red, green, blue, pixels: 0 }; bin.pixels += 1; bins.set(key, bin);
  }
  return [...bins.values()].sort((left, right) => right.pixels - left.pixels).slice(0, requestedCount).map(color => ({ ...color, hex: `#${color.red.toString(16).padStart(2, "0")}${color.green.toString(16).padStart(2, "0")}${color.blue.toString(16).padStart(2, "0")}`.toUpperCase() }));
}
export async function adjustImageTransparency(input: Buffer, opacity = 100, alphaThreshold = 0, cleanupMode: "none" | "transparent" | "color" = "none", replacementColor = "#000000"): Promise<ImageTransformResult> {
  const { pixels, width, height } = await readRgba(input);
  const opacityScale = Math.max(0, Math.min(100, Number(opacity))) / 100;
  const threshold = Math.max(0, Math.min(255, Math.round(Number(alphaThreshold))));
  const replacement = parseTransformHexColor(replacementColor, "replacementColor");
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3] ?? 0;
    if (alpha < threshold && cleanupMode === "transparent") { pixels[offset + 3] = 0; continue; }
    if (alpha < threshold && cleanupMode === "color") { pixels[offset] = replacement[0]; pixels[offset + 1] = replacement[1]; pixels[offset + 2] = replacement[2]; pixels[offset + 3] = 255; continue; }
    pixels[offset + 3] = Math.round(alpha * opacityScale);
  }
  return { data: await getSharpRuntime()(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer(), width, height };
}

export async function cropAndScaleImage(input: Buffer, width: number, height: number, fit: "cover" | "contain" | "fill" = "cover", background = "#00000000"): Promise<ImageTransformResult> {
  const targetWidth = Math.max(1, Math.min(4096, Math.round(Number(width))));
  const targetHeight = Math.max(1, Math.min(4096, Math.round(Number(height))));
  if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight)) throw new Error("width and height must be finite numbers.");
  const data = await getSharpRuntime()(input, { animated: false }).rotate().resize(targetWidth, targetHeight, { fit, background }).png().toBuffer();
  return { data, width: targetWidth, height: targetHeight };
}
export async function naturalizeImage(input: Buffer, intensity = 8, seed = 1): Promise<ImageTransformResult> {
  const { pixels, width, height } = await readRgba(input);
  const amount = Math.max(0, Math.min(32, Number(intensity) || 0)); let state = (Math.floor(Number(seed) || 1) >>> 0) || 1;
  for (let offset = 0; offset < pixels.length; offset += 4) { if ((pixels[offset + 3] ?? 0) === 0) continue; state = (state * 1664525 + 1013904223) >>> 0; const noise = ((state >>> 16) / 65535 - .5) * amount; pixels[offset] = Math.max(0, Math.min(255, Math.round((pixels[offset] ?? 0) + noise))); pixels[offset + 1] = Math.max(0, Math.min(255, Math.round((pixels[offset + 1] ?? 0) + noise))); pixels[offset + 2] = Math.max(0, Math.min(255, Math.round((pixels[offset + 2] ?? 0) + noise))); }
  return { data: await getSharpRuntime()(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer(), width, height };
}

export async function toonShadeImage(input: Buffer, levels = 6): Promise<ImageTransformResult> {
  const { pixels, width, height } = await readRgba(input); const count = Math.max(2, Math.min(32, Math.round(Number(levels) || 6))); const step = 255 / (count - 1);
  for (let offset = 0; offset < pixels.length; offset += 4) { if ((pixels[offset + 3] ?? 0) === 0) continue; for (let channel = 0; channel < 3; channel += 1) pixels[offset + channel] = Math.round(Math.round((pixels[offset + channel] ?? 0) / step) * step); }
  return { data: await getSharpRuntime()(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer(), width, height };
}
export interface PseudoAlbedoOptions {
  sourceType?: "normal" | "height";
  normalFormat?: "opengl" | "directx";
  strength?: number;
  contrast?: number;
  softness?: number;
  shadowColor?: string;
  midColor?: string;
  highlightColor?: string;
  invert?: boolean;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function blurPseudoAlbedoShade(source: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius <= 0) return source;
  const intermediate = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      for (let offset = -radius; offset <= radius; offset += 1) total += source[y * width + Math.max(0, Math.min(width - 1, x + offset))] ?? 0;
      intermediate[y * width + x] = total / (radius * 2 + 1);
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      for (let offset = -radius; offset <= radius; offset += 1) total += intermediate[Math.max(0, Math.min(height - 1, y + offset)) * width + x] ?? 0;
      output[y * width + x] = total / (radius * 2 + 1);
    }
  }
  return output;
}

function pseudoAlbedoRamp(value: number, shadow: [number, number, number], mid: [number, number, number], highlight: [number, number, number]): [number, number, number] {
  const interpolation = value < .5 ? value * 2 : (value - .5) * 2;
  const start = value < .5 ? shadow : mid;
  const end = value < .5 ? mid : highlight;
  return [0, 1, 2].map(index => Math.round((start[index] ?? 0) * (1 - interpolation) + (end[index] ?? 0) * interpolation)) as [number, number, number];
}

/** Creates the browser tool's deliberately stylized, non-physical pseudo-albedo output. */
export async function createPseudoAlbedo(input: Buffer, options: PseudoAlbedoOptions = {}): Promise<ImageTransformResult> {
  const { pixels, width, height } = await readRgba(input);
  if (width > 2048 || height > 2048) throw new Error("Pseudo Albedo supports source images up to 2048 pixels per side.");
  const sourceType = options.sourceType ?? "normal";
  const normalFormat = options.normalFormat ?? "opengl";
  const strength = Math.max(0, Math.min(3, Number(options.strength ?? 1)));
  const contrast = Math.max(.2, Math.min(3, Number(options.contrast ?? 1.15)));
  const softness = Math.max(0, Math.min(6, Math.round(Number(options.softness ?? 1))));
  const inverse = options.invert ? -1 : 1;
  const shade = new Float32Array(width * height);

  if (sourceType === "normal") {
    const yMultiplier = normalFormat === "directx" ? -1 : 1;
    for (let pixel = 0, offset = 0; offset < pixels.length; pixel += 1, offset += 4) {
      const nx = (pixels[offset] ?? 0) / 255 * 2 - 1;
      const ny = ((pixels[offset + 1] ?? 0) / 255 * 2 - 1) * yMultiplier;
      const nz = (pixels[offset + 2] ?? 0) / 255 * 2 - 1;
      const slope = 1 - clampUnit(nz * .5 + .5);
      const side = clampUnit((nx * .35 + ny * .25) * .5 + .5);
      shade[pixel] = clampUnit(.55 + side * .25 - slope * .35 * strength);
    }
  } else {
    const heights = new Float32Array(width * height);
    for (let pixel = 0, offset = 0; offset < pixels.length; pixel += 1, offset += 4) heights[pixel] = ((pixels[offset] ?? 0) * .2126 + (pixels[offset + 1] ?? 0) * .7152 + (pixels[offset + 2] ?? 0) * .0722) / 255;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const left = y * width + Math.max(0, x - 1);
        const right = y * width + Math.min(width - 1, x + 1);
        const above = Math.max(0, y - 1) * width + x;
        const below = Math.min(height - 1, y + 1) * width + x;
        const dx = ((heights[right] ?? 0) - (heights[left] ?? 0)) * inverse;
        const dy = ((heights[below] ?? 0) - (heights[above] ?? 0)) * inverse;
        shade[index] = clampUnit(.55 + (heights[index] ?? 0) * inverse * .25 - Math.hypot(dx, dy) * strength * 2);
      }
    }
  }

  const shadow = parseTransformHexColor(options.shadowColor ?? "#61523f", "shadowColor");
  const mid = parseTransformHexColor(options.midColor ?? "#9c8a6d", "midColor");
  const highlight = parseTransformHexColor(options.highlightColor ?? "#d8c3a0", "highlightColor");
  const blurred = blurPseudoAlbedoShade(shade, width, height, softness);
  const output = Buffer.alloc(width * height * 4);
  for (let pixel = 0, offset = 0; pixel < blurred.length; pixel += 1, offset += 4) {
    const color = pseudoAlbedoRamp(clampUnit(((blurred[pixel] ?? 0) - .5) * contrast + .5), shadow, mid, highlight);
    output[offset] = color[0]; output[offset + 1] = color[1]; output[offset + 2] = color[2]; output[offset + 3] = 255;
  }
  return { data: await getSharpRuntime()(output, { raw: { width, height, channels: 4 } }).png().toBuffer(), width, height };
}
