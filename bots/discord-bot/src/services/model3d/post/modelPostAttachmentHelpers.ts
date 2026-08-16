import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import { resolveOptionalGeneratedModelFilePath } from "./modelPostHelpers.js";
import type { ModelPostMessageMode, ModelPostOptions } from "./modelPostTypes.js";

type ModelPostAttachmentHelpersDependencies = {
  resolveGeneratedModelFilePath: (modelId: string, fileName: string) => Promise<string>;
};

type ModelPostAttachmentHelpers = {
  buildGeneratedModelAttachments: (
    record: GeneratedModelPublicRecord,
    mode: ModelPostMessageMode,
    options: Required<ModelPostOptions>
  ) => Promise<Array<{ attachment: string; name: string }>>;
};

export function createModelPostAttachmentHelpers(dependencies: ModelPostAttachmentHelpersDependencies): ModelPostAttachmentHelpers {
  async function buildGeneratedModelAttachments(
    record: GeneratedModelPublicRecord,
    mode: ModelPostMessageMode,
    options: Required<ModelPostOptions>
  ): Promise<Array<{ attachment: string; name: string }>> {
    const attachments: Array<{ attachment: string; name: string }> = [];
    if (options.includePreviewMedia) {
      if (record.previewGifFileName) {
        const previewGifPath = await resolveOptionalGeneratedModelFilePath(
          dependencies.resolveGeneratedModelFilePath,
          record.id,
          record.previewGifFileName,
          "preview GIF"
        );
        if (previewGifPath) {
          attachments.push({
            attachment: previewGifPath,
            name: record.previewGifFileName
          });
        }
      } else if (record.previewImageFileName) {
        const previewImagePath = await resolveOptionalGeneratedModelFilePath(
          dependencies.resolveGeneratedModelFilePath,
          record.id,
          record.previewImageFileName,
          "preview image"
        );
        if (previewImagePath) {
          attachments.push({
            attachment: previewImagePath,
            name: record.previewImageFileName
          });
        }
      }
    }
    if (mode === "public" && options.includeSourceImage) {
      const sourceImagePath = await resolveOptionalGeneratedModelFilePath(
        dependencies.resolveGeneratedModelFilePath,
        record.id,
        record.sourceImageFileName,
        "source image"
      );
      if (sourceImagePath) {
        attachments.push({
          attachment: sourceImagePath,
          name: record.sourceImageFileName
        });
      }
    }
    if (options.includeModelFile) {
      attachments.push({
        attachment: await dependencies.resolveGeneratedModelFilePath(record.id, record.modelFileName),
        name: record.modelFileName
      });
    }
    return attachments;
  }

  return {
    buildGeneratedModelAttachments
  };
}
