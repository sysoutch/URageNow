import { getSharpRuntime } from "./sharpRuntime.js";

export async function stripImageMetadataToPng(input: Uint8Array | Buffer): Promise<Buffer> {
  const sharp = getSharpRuntime();
  return sharp(Buffer.from(input), { animated: false })
    .rotate()
    .png()
    .toBuffer();
}

export async function stripImageMetadataPreservingAnimation(input: Uint8Array | Buffer): Promise<{ data: Buffer; extension: "png" | "gif" }> {
  const sharp = getSharpRuntime();
  const image = sharp(Buffer.from(input), { animated: true }).rotate();
  const metadata = await image.metadata();
  if (Number(metadata.pages || 1) > 1) {
    return {
      data: await image.gif({ loop: Number(metadata.loop || 0), delay: metadata.delay?.map((delay: number) => Math.max(10, delay)) }).toBuffer(),
      extension: "gif"
    };
  }
  return { data: await image.png().toBuffer(), extension: "png" };
}