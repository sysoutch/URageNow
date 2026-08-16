export function createRuntimeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function buildDiscordMessageUrl(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

export function parseImageActionPayload(payload: string): { imageId: string; requesterId: string; } | null {
  const [imageIdRaw, requesterIdRaw, ...rest] = payload.split("|");
  const imageId = imageIdRaw?.trim() ?? "";
  const requesterId = requesterIdRaw?.trim() ?? "";
  if (!imageId || !requesterId || rest.length > 0) {
    return null;
  }
  return { imageId, requesterId };
}

export function parseImageAddToPoolButtonCustomId(customId: string, prefix: string): { imageId: string; requesterId: string; } | null {
  if (!customId.startsWith(prefix)) {
    return null;
  }
  return parseImageActionPayload(customId.slice(prefix.length));
}

export function trimSelectLabel(value: string, fallback: string): string {
  const normalized = value.trim() || fallback;
  return normalized.length <= 100 ? normalized : `${normalized.slice(0, 97)}...`;
}
