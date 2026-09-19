import { getSharpRuntime } from "@urage/server/services/sharpRuntime";

interface ImageTransformResult {
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