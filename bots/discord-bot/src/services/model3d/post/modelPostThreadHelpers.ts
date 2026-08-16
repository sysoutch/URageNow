import type { Client } from "discord.js";
import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import type { ModelPostOptions } from "./modelPostTypes.js";
import {
  buildDefaultThreadName,
  escapeRegex,
  toReadableModelName
} from "./modelPostHelpers.js";

export function resolveThreadNameFromOptions(record: GeneratedModelPublicRecord, options: Required<ModelPostOptions>, existingNames: string[]): string {
  if (options.threadNameMode === "increment") {
    const base = options.threadNameBase.trim() || "Day";
    const matcher = new RegExp(`^${escapeRegex(base)}\\s+(\\d+)$`, "i");
    let maxFound = 0;
    for (const name of existingNames) {
      const matched = name.match(matcher);
      const parsed = matched?.[1] ? Number.parseInt(matched[1], 10) : Number.NaN;
      if (Number.isFinite(parsed) && parsed > maxFound) {
        maxFound = parsed;
      }
    }
    return `${base} ${maxFound + 1}`;
  }
  if (options.threadNameMode === "model-name") {
    const fromLlm = toReadableModelName(record.modelFileName);
    const fromFileName = toReadableModelName(record.sourceImageFileName);
    return options.modelNameSource === "filename"
      ? (fromFileName || fromLlm || buildDefaultThreadName())
      : (fromLlm || fromFileName || buildDefaultThreadName());
  }
  return options.threadName.trim() || buildDefaultThreadName();
}

export async function listThreadNamesForParent(client: Client, guildId: string, parentChannelId: string): Promise<string[]> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return [];
  }
  const channels = guild.channels.cache.size > 0 ? guild.channels.cache : await guild.channels.fetch();
  const names: string[] = [];
  for (const entry of channels.values()) {
    if (!entry || !entry.isThread()) {
      continue;
    }
    if (entry.parentId !== parentChannelId) {
      continue;
    }
    names.push(entry.name);
  }
  return names;
}
