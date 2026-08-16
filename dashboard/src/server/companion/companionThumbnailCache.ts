import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {appConfig} from "@urage/server/config/appConfig";
import {getSharpRuntime} from "@urage/server/services/sharpRuntime";

const thumbnailDirectory = path.resolve(appConfig.dataDirectory, "companion-thumbnails");

export async function getCompanionThumbnail(identity: string, source: Buffer): Promise<Buffer> {
  const contentHash = createHash("sha256").update(identity).update(source).digest("hex");
  const thumbnailPath = path.join(thumbnailDirectory, `${contentHash}.jpg`);
  try {
    return await readFile(thumbnailPath);
  } catch {
    const thumbnail = await getSharpRuntime()(source)
      .rotate()
      .resize(320, 240, {fit: "cover", position: "centre", withoutEnlargement: true})
      .jpeg({quality: 76, mozjpeg: true})
      .toBuffer();
    await mkdir(thumbnailDirectory, {recursive: true});
    await writeFile(thumbnailPath, thumbnail);
    return thumbnail;
  }
}
