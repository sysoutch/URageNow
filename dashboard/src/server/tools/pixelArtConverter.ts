import { getSharpRuntime } from "@urage/server/services/sharpRuntime";

export interface PixelArtConversion {
  data: Buffer;
  width: number;
  height: number;
  pixelSize: number;
}

function normalizePixelSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return 8;
  return Math.max(2, Math.min(256, Math.round(value as number)));
}

export async function convertImageToPixelArt(input: Buffer, pixelSize?: number): Promise<PixelArtConversion> {
  const sharp = getSharpRuntime();
  const normalizedPixelSize = normalizePixelSize(pixelSize);
  const source = sharp(input, { animated: false }).rotate();
  const metadata = await source.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192) {
    throw new Error("The source image dimensions are unsupported for pixel-art conversion.");
  }
  const reducedWidth = Math.max(1, Math.round(width / normalizedPixelSize));
  const reducedHeight = Math.max(1, Math.round(height / normalizedPixelSize));
  const data = await source
    .resize(reducedWidth, reducedHeight, { fit: "fill", kernel: "nearest" })
    .resize(width, height, { fit: "fill", kernel: "nearest" })
    .png()
    .toBuffer();
  return { data, width, height, pixelSize: normalizedPixelSize };
}