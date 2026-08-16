import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import type {
  EditableModelMessage,
  ModelPostOptions,
  ModelTextureMessageLinks,
  SendableGuildChannel
} from "./modelPostTypes.js";

type ModelPostTextureUploadServiceDependencies = {
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
  asEditableModelMessage: (value: unknown) => EditableModelMessage | null;
  buildDiscordMessageUrl: (guildId: string, channelId: string, messageId: string) => string;
  sleep: (milliseconds: number) => Promise<void>;
  followUpDelayMs: number;
};

type ModelPostTextureUploadService = {
  uploadGeneratedModelTextureMessages: (input: {
    generated: GeneratedModelPublicRecord;
    options: Required<ModelPostOptions>;
    selectedChannel: SendableGuildChannel | null;
    targetChannel: SendableGuildChannel;
  }) => Promise<ModelTextureMessageLinks>;
};

export function createModelPostTextureUploadService(dependencies: ModelPostTextureUploadServiceDependencies): ModelPostTextureUploadService {
  void dependencies;

  async function uploadGeneratedModelTextureMessages(input: {
    generated: GeneratedModelPublicRecord;
    options: Required<ModelPostOptions>;
    selectedChannel: SendableGuildChannel | null;
    targetChannel: SendableGuildChannel;
  }): Promise<ModelTextureMessageLinks> {
    void input;
    return {};
  }

  return {
    uploadGeneratedModelTextureMessages
  };
}
