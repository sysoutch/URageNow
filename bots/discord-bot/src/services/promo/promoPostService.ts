type PromoPostServiceDependencies = {
  sendMessageToChannel: (channelId: string, content: string) => Promise<void>;
  buildGiftMessage: () => Promise<string>;
  requireSendableChannel: (channelId: string) => Promise<unknown>;
  buildHumbleMessages: () => Promise<string[]>;
  sendChunkedToChannel: (channel: any, content: string) => Promise<void>;
};

type PromoPostService = {
  postGiftToChannel: (channelId: string) => Promise<void>;
  postHumbleToChannel: (channelId: string) => Promise<void>;
};

export function createPromoPostService(dependencies: PromoPostServiceDependencies): PromoPostService {
  async function postGiftToChannel(channelId: string): Promise<void> {
    await dependencies.sendMessageToChannel(channelId, await dependencies.buildGiftMessage());
  }

  async function postHumbleToChannel(channelId: string): Promise<void> {
    const channel = await dependencies.requireSendableChannel(channelId);
    const messages = await dependencies.buildHumbleMessages();
    for (const messageText of messages) {
      await dependencies.sendChunkedToChannel(channel, messageText);
    }
  }

  return {
    postGiftToChannel,
    postHumbleToChannel
  };
}
