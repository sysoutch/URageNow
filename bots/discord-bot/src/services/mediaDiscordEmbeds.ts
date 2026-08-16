import { Colors, EmbedBuilder } from "discord.js";
import {
  resolveGeneratedAudioFilePath,
  resolveGeneratedImageFilePath,
  type GeneratedAudioPublicRecord,
  type GeneratedImagePublicRecord
} from "@urage/server/services/generatedMediaLibrary";

export function buildGeneratedImageEmbed(record: GeneratedImagePublicRecord): EmbedBuilder {
  const sizeText = record.width && record.height ? `${record.width} x ${record.height}` : "unknown";
  return new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("🖼️ Generated Image")
    .setDescription(record.description || record.prompt || "*No description provided*")
    .addFields(
      { name: "📐 Size", value: sizeText, inline: true },
      { name: "🎲 Seed", value: `${record.seed}`, inline: true },
      { name: "🔁 Steps", value: record.steps ? `${record.steps}` : "unknown", inline: true },
      { name: "🗂️ Filename", value: `\`${record.imageFileName}\``, inline: false },
      { name: "🧠 Model", value: record.model, inline: true }
    )
    .setImage(`attachment://${record.imageFileName}`);
}

export async function buildGeneratedImageAttachment(record: GeneratedImagePublicRecord): Promise<{ attachment: string; name: string }> {
  return { attachment: await resolveGeneratedImageFilePath(record.id, record.imageFileName), name: record.imageFileName };
}

export function buildGeneratedAudioEmbed(record: GeneratedAudioPublicRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("🎵 Generated Audio")
    .addFields(
      { name: "📝 Prompt", value: record.prompt || "*No prompt provided*", inline: false },
      { name: "⌛ Length", value: record.seconds ? `${record.seconds}s` : "unknown", inline: true },
      { name: "🎲 Seed", value: `${record.seed}`, inline: true },
      { name: "🔁 Steps", value: record.steps ? `${record.steps}` : "unknown", inline: true },
      { name: "🗂️ Filename", value: `\`${record.audioFileName}\``, inline: false },
      { name: "🧠 Model", value: record.model || "unknown", inline: true }
    );
}

export function buildGeneratedMusicEmbed(record: GeneratedAudioPublicRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("🎶 Generated Music")
    .addFields(
      { name: "🏷️ Tags", value: record.tags || "*none*", inline: false },
      { name: "📜 Lyrics", value: record.lyrics || "*none*", inline: false },
      { name: "⌛ Length", value: record.seconds ? `${record.seconds}s` : "unknown", inline: true },
      { name: "🎲 Seed", value: `${record.seed}`, inline: true },
      { name: "🗂️ Filename", value: `\`${record.audioFileName}\``, inline: false },
      { name: "🧠 Model", value: record.model || "unknown", inline: true }
    );
}

export async function buildGeneratedAudioAttachment(record: GeneratedAudioPublicRecord): Promise<{ attachment: string; name: string }> {
  return { attachment: await resolveGeneratedAudioFilePath(record.id, record.audioFileName), name: record.audioFileName };
}
