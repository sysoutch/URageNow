import { stat } from "node:fs/promises";
import path from "node:path";
import { sanitizeFileName } from "./fileNaming.js";

export async function ensureUniqueFileName(directory: string, fileName: string): Promise<string> {
  let candidate = sanitizeFileName(fileName, "asset.bin");
  let counter = 1;
  while (true) {
    try {
      await stat(path.join(directory, candidate));
      const ext = path.extname(candidate);
      const stem = path.basename(candidate, ext);
      candidate = `${stem}_${counter}${ext}`;
      counter += 1;
    } catch {
      return candidate;
    }
  }
}
