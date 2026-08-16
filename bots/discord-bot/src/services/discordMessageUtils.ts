import type { ChatInputCommandInteraction, MessageCreateOptions, MessagePayload } from "discord.js";

export type SendableTarget = {
  send: (content: string | MessagePayload | MessageCreateOptions) => Promise<unknown>;
};

export function splitLongMessage(content: string, maxLength = 2000): string[] {
  if (content.length <= maxLength) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content.trim();

  while (remaining.length > maxLength) {
    const slice = remaining.slice(0, maxLength);
    const splitIndex = Math.max(
      slice.lastIndexOf("\n\n"),
      slice.lastIndexOf("\n"),
      slice.lastIndexOf(". "),
      slice.lastIndexOf(" ")
    );

    const boundary = splitIndex > 200 ? splitIndex : maxLength;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

export async function sendChunkedToTarget(target: SendableTarget, content: string): Promise<void> {
  for (const chunk of splitLongMessage(content, 2000)) {
    await target.send(chunk);
  }
}

export async function replyWithChunks(
  interaction: ChatInputCommandInteraction,
  content: string
): Promise<void> {
  const chunks = splitLongMessage(content, 2000);
  const [firstChunk, ...rest] = chunks;

  if (!firstChunk) {
    if (interaction.deferred) {
      await interaction.editReply("No response.");
      return;
    }

    await interaction.reply("No response.");
    return;
  }

  if (interaction.deferred) {
    await interaction.editReply(firstChunk);
  } else if (interaction.replied) {
    await interaction.followUp(firstChunk);
  } else {
    await interaction.reply(firstChunk);
  }

  for (const chunk of rest) {
    await interaction.followUp(chunk);
  }
}

export async function followUpWithChunks(
  interaction: ChatInputCommandInteraction,
  content: string
): Promise<void> {
  for (const chunk of splitLongMessage(content, 2000)) {
    await interaction.followUp({ content: chunk });
  }
}
