import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

type PixelArtToolResult = {
  data: Buffer;
  fileName: string;
  width: number | null;
  height: number | null;
};

function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Pixel Art Converter returned an invalid image payload.");
  }
  return Buffer.from(match[1] || "", "base64");
}

function resolvePixelArtToolIndexPath(): string {
  let current = process.cwd();
  for (let depth = 0; depth < 6; depth++) {
    const candidate = path.resolve(current, "tools/art/pixel-art-converter/index.html");
    if (existsSync(candidate)) return candidate;
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  throw new Error("Pixel Art Converter tool was not found from the current workspace.");
}

export async function convertImageWithPixelArtTool(input: { data: Buffer; contentType: string; fileName: string; timeoutMs?: number }): Promise<PixelArtToolResult> {
  const timeoutMs = input.timeoutMs || 90_000;
  const toolUrl = pathToFileURL(resolvePixelArtToolIndexPath()).toString();
  const dataUrl = `data:${input.contentType || "image/png"};base64,${input.data.toString("base64")}`;
  const requestId = `automation-pixel-art-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      (window as any).__name = (fn: unknown) => fn;
      (window as any).__URAGE_PIXEL_ART_AUTOMATION_MESSAGES__ = [];
      (window as any).__URAGE_PIXEL_ART_AUTOMATION_RECEIVE__ = (message: unknown) => {
        (window as any).__URAGE_PIXEL_ART_AUTOMATION_MESSAGES__.push(message);
      };
    });
    await page.goto(toolUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForFunction(() => (window as any).__URAGE_PIXEL_ART_AUTOMATION_MESSAGES__?.some((message: any) => message?.type === "pixel-art:ready"), null, { timeout: timeoutMs });
    await page.evaluate(({ dataUrl, fileName, requestId }) => {
      window.postMessage({
        source: "urage-dashboard",
        type: "pixel-art:load-image",
        requestId,
        payload: { dataUrl, fileName, autoConvert: true }
      }, "*");
    }, { dataUrl, fileName: input.fileName || "pixel-source.png", requestId });
    await page.waitForFunction(requestId => (window as any).__URAGE_PIXEL_ART_AUTOMATION_MESSAGES__?.some((message: any) => message?.requestId === requestId && (message?.type === "pixel-art:converted" || message?.type === "pixel-art:error")), requestId, { timeout: timeoutMs });
    const message = await page.evaluate(requestId => (window as any).__URAGE_PIXEL_ART_AUTOMATION_MESSAGES__.find((entry: any) => entry?.requestId === requestId && (entry?.type === "pixel-art:converted" || entry?.type === "pixel-art:error")), requestId);
    if (message?.type === "pixel-art:error") {
      throw new Error(String(message.payload?.error || "Pixel Art Converter failed."));
    }
    const result = message?.payload || {};
    return {
      data: dataUrlToBuffer(String(result.dataUrl || "")),
      fileName: String(result.fileName || input.fileName.replace(/\.[^.]+$/, "") + "-pixel.png"),
      width: Number.isFinite(result.width) ? Number(result.width) : null,
      height: Number.isFinite(result.height) ? Number(result.height) : null
    };
  } finally {
    await browser.close();
  }
}
