import { getSharpRuntime } from "./sharpRuntime.js";

export async function stripImageMetadataToPng(input: Uint8Array | Buffer): Promise<Buffer> {
  const sharp = getSharpRuntime();
  return sharp(Buffer.from(input), { animated: false })
    .rotate()
    .png()
    .toBuffer();
}
