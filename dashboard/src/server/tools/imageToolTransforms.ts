import { getSharpRuntime } from "@urage/server/services/sharpRuntime";

interface ImageTransformResult {
  data: Buffer;
  width: number;
  height: number;
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

export async function createAsciiArt(input: Buffer, requestedColumns = 96): Promise<ImageTransformResult & { text: string; columns: number; rows: number }> {
  const sharp = getSharpRuntime();
  const metadata = await sharp(input, { animated: false }).rotate().metadata();
  const sourceWidth = Number(metadata.width || 0);
  const sourceHeight = Number(metadata.height || 0);
  if (!sourceWidth || !sourceHeight) throw new Error("The source image has unsupported dimensions.");
  const columns = Math.max(16, Math.min(160, Math.round(requestedColumns)));
  const rows = Math.max(8, Math.round(sourceHeight / sourceWidth * columns * .5));
  const pixels = await sharp(input, { animated: false }).rotate().resize(columns, rows, { fit: "fill" }).grayscale().raw().toBuffer();
  const ramp = "@%#*+=-:. ";
  const lines: string[] = [];
  for (let y = 0; y < rows; y += 1) {
    let line = "";
    for (let x = 0; x < columns; x += 1) line += ramp[Math.min(ramp.length - 1, Math.floor((pixels[y * columns + x] ?? 0) / 256 * ramp.length))] ?? " ";
    lines.push(line);
  }
  const text = lines.join("\n");
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const width = columns * 8;
  const height = rows * 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#101010"/><text x="0" y="10" fill="#f3f3f3" font-family="monospace" font-size="10" xml:space="preserve">${escaped}</text></svg>`;
  const data = await sharp(Buffer.from(svg)).png().toBuffer();
  return { data, width, height, text, columns, rows };
}