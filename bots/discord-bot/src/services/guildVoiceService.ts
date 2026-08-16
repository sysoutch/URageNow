import type { Client } from "discord.js";
import type { DiscordGatewayAdapterCreator } from "@discordjs/voice";

type VoiceRuntime = {
  joinGuildChannel: (guildId: string, channelId: string, voiceAdapterCreator: DiscordGatewayAdapterCreator) => Promise<void>;
  disconnectGuild: (guildId: string) => void;
};

type GuildVoiceServiceDependencies = {
  client: Client;
  voiceManager: VoiceRuntime;
  isVoiceChannelType: (type: number) => boolean;
};

type GuildVoiceService = {
  joinVoiceChannelForGuild: (guildId: string, channelId: string) => Promise<void>;
  disconnectVoiceChannelForGuild: (guildId: string) => Promise<void>;
};

function resolveGuild(client: Client, guildId: string) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error("Guild not found.");
  }
  return guild;
}

export function createGuildVoiceService(dependencies: GuildVoiceServiceDependencies): GuildVoiceService {
  async function joinVoiceChannelForGuild(guildId: string, channelId: string): Promise<void> {
    const guild = resolveGuild(dependencies.client, guildId);
    const channel = await guild.channels.fetch(channelId);
    if (!channel || !dependencies.isVoiceChannelType(channel.type)) {
      throw new Error("Voice channel not found.");
    }
    await dependencies.voiceManager.joinGuildChannel(guild.id, channel.id, guild.voiceAdapterCreator);
  }

  async function disconnectVoiceChannelForGuild(guildId: string): Promise<void> {
    const guild = resolveGuild(dependencies.client, guildId);
    dependencies.voiceManager.disconnectGuild(guild.id);
  }

  return {
    joinVoiceChannelForGuild,
    disconnectVoiceChannelForGuild
  };
}
