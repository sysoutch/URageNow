import type { MessageCreateOptions } from "discord.js";

type ModelGenerationStartNoticeServiceDependencies = {
  requireSendableChannel: (channelId: string) => Promise<{ send: (options: MessageCreateOptions) => Promise<unknown> }>;
  buildModelSourceImageAttachment: (input: { imageInput: string; fileNameHint?: string }) => Promise<{ attachment: string | Buffer; name: string }>;
  recordAction: (type: string, summary: string) => void;
};

type ModelGenerationStartNoticeService = {
  postModelGenerationStartNotice: (input: {
    channelId: string;
    imageInput: string;
    imageFileNameHint?: string;
    prompt?: string;
    requestedBy?: string;
  }) => Promise<{ messageId: string | null; messageUrl: string | null }>;
};

export function createModelGenerationStartNoticeService(dependencies: ModelGenerationStartNoticeServiceDependencies): ModelGenerationStartNoticeService {
  async function postModelGenerationStartNotice(input: {
    channelId: string;
    imageInput: string;
    imageFileNameHint?: string;
    prompt?: string;
    requestedBy?: string;
  }): Promise<{ messageId: string | null; messageUrl: string | null }> {
    const channel = await dependencies.requireSendableChannel(input.channelId);
    const promptText = input.prompt?.trim() ?? "";
    const promptLine = promptText ? `\nPrompt: \`${promptText.slice(0, 180)}\`` : "";
    const content = `🧾 I received the source image and start generating the 3D model now...${promptLine}`;
    let sent: unknown;
    try {
      const imageAttachment = await dependencies.buildModelSourceImageAttachment({
        imageInput: input.imageInput,
        fileNameHint: input.imageFileNameHint
      });
      sent = await channel.send({
        content,
        files: [imageAttachment]
      });
    } catch (error) {
      console.warn("Failed to attach source image in start notice. Sending text-only notice.", error);
      sent = await channel.send({ content });
    }
    dependencies.recordAction("model3d:start", `Posted source-image start notice in ${input.channelId} (${input.requestedBy ?? "unknown"}).`);
    const messageId = typeof (sent as { id?: unknown }).id === "string" ? (sent as { id: string }).id : null;
    const messageUrl = typeof (sent as { url?: unknown }).url === "string" ? (sent as { url: string }).url : null;
    return {
      messageId,
      messageUrl
    };
  }

  return {
    postModelGenerationStartNotice
  };
}
