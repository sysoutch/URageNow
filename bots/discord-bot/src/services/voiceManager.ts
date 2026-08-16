import {
  DiscordGatewayAdapterCreator,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus
} from "@discordjs/voice";

export class VoiceManager {
  async joinGuildChannel(
    guildId: string,
    channelId: string,
    adapterCreator: DiscordGatewayAdapterCreator
  ): Promise<void> {
    const existingConnection = getVoiceConnection(guildId);
    if (existingConnection?.joinConfig.channelId === channelId) {
      await entersState(existingConnection, VoiceConnectionStatus.Ready, 20_000);
      return;
    }

    existingConnection?.destroy();

    const connection = joinVoiceChannel({
      guildId,
      channelId,
      adapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (error) {
      connection.destroy();
      throw error;
    }
  }

  disconnectGuild(guildId: string): void {
    getVoiceConnection(guildId)?.destroy();
  }

  getConnectedChannelId(guildId: string): string | null {
    return getVoiceConnection(guildId)?.joinConfig.channelId ?? null;
  }
}
