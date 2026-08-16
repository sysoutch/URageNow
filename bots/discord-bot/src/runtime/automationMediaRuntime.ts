import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction } from "discord.js";
import { sendTelegramAdminMessage, sendTelegramAdminPhoto } from "@urage/server/services/messaging/telegramAdminClient";
import { sendMatrixAdminMessage } from "@urage/server/services/messaging/matrixAdminClient";
import type { ImageAutomationPostOptions, ImagePostProcessingOptions } from "@urage/shared/automation/index";
import type { GifFrameTransformInput, GifFrameTransformResult, GifPlaybackMode } from "../services/automationGifProcessing.js";

type AutomationMediaRuntimeInput = {
  appConfig: {
    dashboardBindHost: string;
    dashboardPort: number;
    dataDirectory: string;
    ffmpegExecutablePath: string;
    telegramAdminBaseUrl: string;
    matrixAdminBaseUrl: string;
    messengerAdminSharedSecret: string;
  };
  recordAction: (type: string, summary: string) => void;
  getGlobalSettings: () => { ffmpegExecutablePath?: string | null; };
  resolveGeneratedImageApiSourceToFilePath: (value: string) => Promise<string | null>;
  contentTypeFromImageFileExtension: (value: string) => string;
  importGeneratedImageArtifact: (input: any) => Promise<any>;
  toGeneratedImagePublicRecord: (record: any) => any;
  readGeneratedImageFile: (imageId: string, fileName: string) => Promise<{ data: Buffer; }>;
  convertImageWithPixelArtTool: (input: { data: Buffer; contentType: string; fileName: string; }) => Promise<{ data: Buffer; fileName: string; }>;
  generateImageFromPrompt: (input: any) => Promise<{ id: string; imageFileName: string; }>;
  resolveGeneratedVideoFilePath: (videoId: string, fileName: string) => Promise<string>;
  convertVideoFileToGif: (input: any) => Promise<{ data: Buffer; fileName: string; }>;
  transformGifFrames: (input: any) => Promise<{ data: Buffer; fileName: string; framesZipData?: Buffer; framesZipFileName?: string; }>;
  requireSendableChannel: (channelId: string) => Promise<{ send: (input: any) => Promise<any>; }>;
  postGeneratedImagesToChannel: (input: {
    channelId: string;
    images: Array<{ label: string; record: any; }>;
    postMode: "combined" | "separate";
    content: string;
    postOptions?: ImageAutomationPostOptions;
  }) => Promise<void>;
  generateVideoFromPromptLocal: (input: any) => Promise<any>;
  toGeneratedVideoPublicRecord: (record: any) => any;
  gifFrameDownloadPrefix: string;
};

export function createAutomationMediaRuntime(input: AutomationMediaRuntimeInput) {
  function inferImageContentType(value: string): string {
    const normalized = String(value || "").toLowerCase();
    if (normalized.includes(".jpg") || normalized.includes(".jpeg")) return "image/jpeg";
    if (normalized.includes(".webp")) return "image/webp";
    if (normalized.includes(".gif")) return "image/gif";
    return "image/png";
  }

  function resolveDashboardPublicBaseUrl(): string {
    const host = input.appConfig.dashboardBindHost.trim() && input.appConfig.dashboardBindHost.trim() !== "0.0.0.0"
      ? input.appConfig.dashboardBindHost.trim()
      : "127.0.0.1";
    return `http://${host}:${input.appConfig.dashboardPort}`;
  }

  function resolvePublicAssetUrl(assetPath: string): string {
    const trimmed = String(assetPath || "").trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${resolveDashboardPublicBaseUrl()}${normalizedPath}`;
  }

  function resolveWorkspaceRelativeAssetPath(assetPath: string | undefined): string | undefined {
    const trimmed = String(assetPath || "").trim();
    if (!trimmed || path.isAbsolute(trimmed)) return trimmed || undefined;
    const candidates = [
      path.resolve(process.cwd(), trimmed),
      path.resolve(process.cwd(), "..", trimmed),
      path.resolve(process.cwd(), "..", "..", trimmed),
      path.resolve(path.dirname(input.appConfig.dataDirectory), trimmed)
    ];
    return candidates.find(candidate => existsSync(candidate)) || trimmed;
  }

  function sanitizeFrameDownloadId(value: string): string {
    return String(value || "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+/, "").slice(0, 120) || "frames";
  }

  function getFrameDownloadDirectory(): string {
    return path.resolve(input.appConfig.dataDirectory, "automation-frame-downloads");
  }

  async function saveGifFrameDownload(download: { id: string; data: Buffer; fileName: string; }): Promise<string> {
    const directory = getFrameDownloadDirectory();
    await mkdir(directory, { recursive: true });
    const safeId = sanitizeFrameDownloadId(download.id);
    const safeName = sanitizeFrameDownloadId(download.fileName.endsWith(".zip") ? download.fileName : `${download.fileName}.zip`);
    await writeFile(path.join(directory, `${safeId}.zip`), download.data);
    await writeFile(path.join(directory, `${safeId}.name.txt`), safeName, "utf8");
    return safeName;
  }

  async function readGifFrameDownload(id: string): Promise<{ data: Buffer; fileName: string; } | null> {
    const safeId = sanitizeFrameDownloadId(id);
    const directory = getFrameDownloadDirectory();
    const dataPath = path.join(directory, `${safeId}.zip`);
    if (!existsSync(dataPath)) return null;
    const namePath = path.join(directory, `${safeId}.name.txt`);
    const fileName = existsSync(namePath)
      ? (await readFile(namePath, "utf8")).trim()
      : `${safeId}-frames.zip`;
    return {
      data: await readFile(dataPath),
      fileName: fileName || `${safeId}-frames.zip`
    };
  }

  function buildGifFrameDownloadComponents(recordId: string): Array<ActionRowBuilder<ButtonBuilder>> {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${input.gifFrameDownloadPrefix}${recordId}`)
          .setLabel("Download Frames")
          .setStyle(ButtonStyle.Secondary)
      )
    ];
  }

  function buildGifFrameDownloadLinkComponents(url: string): Array<ActionRowBuilder<ButtonBuilder>> {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Download Frames ZIP")
          .setURL(url)
          .setStyle(ButtonStyle.Link)
      )
    ];
  }

  async function resolveVideoStartImageDataUrl(imageInput: string | undefined): Promise<string | undefined> {
    const trimmed = String(imageInput || "").trim();
    if (!trimmed) return undefined;
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) return trimmed;
    const localGeneratedImagePath = await input.resolveGeneratedImageApiSourceToFilePath(trimmed).catch(() => null);
    if (localGeneratedImagePath) {
      const contentType = input.contentTypeFromImageFileExtension(localGeneratedImagePath) || inferImageContentType(localGeneratedImagePath);
      return `data:${contentType};base64,${(await readFile(localGeneratedImagePath)).toString("base64")}`;
    }
    const targetUrl = /^https?:\/\//i.test(trimmed) ? trimmed : resolvePublicAssetUrl(trimmed);
    let response: Response;
    try {
      response = await fetch(targetUrl);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch video start image from ${targetUrl}: ${detail}`);
    }
    if (!response.ok) {
      throw new Error(`Failed to download video start image (${response.status}).`);
    }
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || inferImageContentType(targetUrl);
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error(`Video start image returned unsupported content type: ${contentType}.`);
    }
    return `data:${contentType};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  }

  const importGifAsGeneratedImage = async (runtimeInput: {
    data: Buffer;
    fileName: string;
    prompt: string;
    seed?: number;
    model?: string;
  }) => {
    const imported = await input.importGeneratedImageArtifact({
      record: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
        createdAt: new Date().toISOString(),
        prompt: runtimeInput.prompt.trim(),
        comfyPromptId: "local-video-gif",
        imageFileName: runtimeInput.fileName.endsWith(".gif") ? runtimeInput.fileName : `${runtimeInput.fileName}.gif`,
        seed: runtimeInput.seed || 0,
        steps: null,
        width: null,
        height: null,
        model: runtimeInput.model || "Media Converter",
        modelGeneratedAt: null,
        modelGeneratedModelId: null
      },
      imageData: runtimeInput.data
    });
    return input.toGeneratedImagePublicRecord(imported);
  };

  const removeBackgroundFromGifFrame = async (frame: GifFrameTransformInput): Promise<GifFrameTransformResult> => {
    const dataUrl = `data:image/png;base64,${frame.data.toString("base64")}`;
    const generated = await input.generateImageFromPrompt({
      prompt: "",
      imageInput: dataUrl,
      imageFileNameHint: frame.fileName,
      workflowPathOverride: "comfyui-workflows/image/lora_rembg.json",
      skipPromptResolution: true,
      autoPrompt: false,
      autoFileName: false,
      channelId: null,
      requestedBy: "automation"
    });
    const file = await input.readGeneratedImageFile(generated.id, generated.imageFileName);
    return {
      data: file.data,
      fileName: generated.imageFileName
    };
  };

  const convertGifFrameToPixelArt = async (frame: GifFrameTransformInput): Promise<GifFrameTransformResult> => {
    const converted = await input.convertImageWithPixelArtTool({
      data: frame.data,
      contentType: "image/png",
      fileName: frame.fileName
    });
    return {
      data: converted.data,
      fileName: converted.fileName
    };
  };

  const resolveGifPlaybackMode = (options: ImagePostProcessingOptions | undefined): GifPlaybackMode => {
    return options?.videoGifPlaybackMode === "pingpong" ? "pingpong" : "loop";
  };

  const buildGifVariantLabel = (options: ImagePostProcessingOptions | undefined): string => {
    const steps: string[] = [];
    if (options?.videoGifRemoveBackground === true) steps.push("remove-background");
    if (options?.videoGifPixelArt === true) steps.push("pixel-art");
    return steps.join(" > ");
  };

  const processGeneratedVideoFollowUp = async (runtimeInput: {
    channelId: string;
    video: any;
    postProcessingOptions?: ImagePostProcessingOptions;
    imagePostOptions?: ImageAutomationPostOptions;
    fps?: number;
    width?: number;
  }): Promise<void> => {
    const options = runtimeInput.postProcessingOptions;
    if (options?.videoConvertToGif !== true) return;
    const videoId = String(runtimeInput.video?.id || "").trim();
    const videoFileName = String(runtimeInput.video?.videoFileName || "").trim();
    if (!videoId || !videoFileName) return;
    const settings = input.getGlobalSettings();
    const ffmpegExecutablePath = settings.ffmpegExecutablePath?.trim() || input.appConfig.ffmpegExecutablePath;
    const videoPath = await input.resolveGeneratedVideoFilePath(videoId, videoFileName);
    const convertedGif = await input.convertVideoFileToGif({
      videoPath,
      sourceFileName: videoFileName,
      ffmpegExecutablePath,
      fps: runtimeInput.fps,
      width: runtimeInput.width
    });
    const playbackMode = resolveGifPlaybackMode(options);
    const postMode = options?.postMode === "separate" ? "separate" : "combined";
    const finalizeGifVariant = async (variantInput: {
      gifData: Buffer;
      sourceFileName: string;
      outputSuffix: string;
      transforms: Array<(frame: GifFrameTransformInput) => Promise<GifFrameTransformResult>>;
    }): Promise<{ data: Buffer; fileName: string; framesZipData?: Buffer; framesZipFileName?: string }> => {
      if (playbackMode === "loop" && variantInput.transforms.length === 0) {
        return {
          data: variantInput.gifData,
          fileName: variantInput.sourceFileName
        };
      }
      return input.transformGifFrames({
        gifData: variantInput.gifData,
        sourceFileName: variantInput.sourceFileName,
        outputSuffix: variantInput.outputSuffix,
        ffmpegExecutablePath,
        playbackMode,
        fps: runtimeInput.fps,
        width: runtimeInput.width,
        transforms: variantInput.transforms
      });
    };
    const baseGif = await finalizeGifVariant({
      gifData: convertedGif.data,
      sourceFileName: convertedGif.fileName,
      outputSuffix: playbackMode === "pingpong" ? "pingpong" : "gif",
      transforms: []
    });
    const gifRecord = await importGifAsGeneratedImage({
      data: baseGif.data,
      fileName: baseGif.fileName,
      prompt: String(runtimeInput.video?.prompt || ""),
      seed: Number(runtimeInput.video?.seed || 0),
      model: "Video to GIF"
    });
    await input.postGeneratedImagesToChannel({
      channelId: runtimeInput.channelId,
      images: [{ label: "Original", record: gifRecord }],
      postMode,
      content: "🎞️ Automated video GIF is ready!",
      postOptions: runtimeInput.imagePostOptions
    });
    const transforms: Array<(frame: GifFrameTransformInput) => Promise<GifFrameTransformResult>> = [];
    const suffixes: string[] = [];
    if (options.videoGifRemoveBackground === true) {
      transforms.push(removeBackgroundFromGifFrame);
      suffixes.push("rembg");
    }
    if (options.videoGifPixelArt === true) {
      transforms.push(convertGifFrameToPixelArt);
      suffixes.push("pixel");
    }
    if (transforms.length === 0) return;
    const processedGif = await finalizeGifVariant({
      gifData: convertedGif.data,
      sourceFileName: convertedGif.fileName,
      outputSuffix: [playbackMode === "pingpong" ? "pingpong" : "", ...suffixes].filter(Boolean).join("-"),
      transforms
    });
    const processedRecord = await importGifAsGeneratedImage({
      data: processedGif.data,
      fileName: processedGif.fileName,
      prompt: String(runtimeInput.video?.prompt || ""),
      seed: Number(runtimeInput.video?.seed || 0),
      model: suffixes.includes("pixel") ? "GIF Pixel Art" : "GIF Remove Background"
    });
    await input.postGeneratedImagesToChannel({
      channelId: runtimeInput.channelId,
      images: [{ label: buildGifVariantLabel(options) || "Processed", record: processedRecord }],
      postMode,
      content: suffixes.includes("pixel") ? "🎨 Pixel-art GIF version is ready!" : "✨ Transparent GIF version is ready!",
      postOptions: runtimeInput.imagePostOptions
    });
    if (processedGif.framesZipData && processedGif.framesZipFileName && suffixes.includes("pixel")) {
      await saveGifFrameDownload({
        id: processedRecord.id,
        data: processedGif.framesZipData,
        fileName: processedGif.framesZipFileName
      });
      const channel = await input.requireSendableChannel(runtimeInput.channelId);
      await channel.send({
        content: "🧩 Pixel-art GIF frame download is ready too.",
        components: buildGifFrameDownloadComponents(processedRecord.id)
      });
    }
  };

  const handleGifFrameDownloadButton = async (interaction: ButtonInteraction): Promise<void> => {
    const id = interaction.customId.slice(input.gifFrameDownloadPrefix.length).trim();
    const download = await readGifFrameDownload(id);
    if (!download) {
      await interaction.reply({
        content: "The frame download for this GIF is no longer available.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    await interaction.deferUpdate();
    const channel = interaction.channel && "send" in interaction.channel
      ? interaction.channel
      : await input.requireSendableChannel(interaction.channelId);
    const posted = await channel.send({
      content: "Processed pixel-art GIF ZIP is ready:",
      files: [{
        attachment: download.data,
        name: download.fileName
      }]
    });
    const zipUrl = posted.attachments?.first?.()?.url || posted.attachments?.at?.(0)?.url || "";
    if (zipUrl) {
      await interaction.message.edit({
        components: buildGifFrameDownloadLinkComponents(zipUrl)
      });
    }
    input.recordAction("automation:gif-frame-download", `${interaction.user.tag} downloaded frames for ${id}.`);
  };

  const sendTelegramAutomationMessage = async (chatId: string, text: string): Promise<void> => {
    await sendTelegramAdminMessage(input.appConfig.telegramAdminBaseUrl, { chatId, text }, input.appConfig.messengerAdminSharedSecret);
    input.recordAction("automation:telegram-send", `Sent Telegram automation message to ${chatId}.`);
  };

  const sendTelegramAutomationPhoto = async (runtimeInput: {
    chatId: string;
    imageUrl: string;
    caption?: string;
  }): Promise<void> => {
    try {
      await sendTelegramAdminPhoto(input.appConfig.telegramAdminBaseUrl, {
        chatId: runtimeInput.chatId,
        imageUrl: runtimeInput.imageUrl,
        caption: runtimeInput.caption
      }, input.appConfig.messengerAdminSharedSecret);
      input.recordAction("automation:telegram-photo", `Sent Telegram automation photo to ${runtimeInput.chatId}.`);
    } catch (error) {
      const fallbackText = [runtimeInput.caption?.trim() || "Automated image drop", runtimeInput.imageUrl].filter(Boolean).join("\n");
      await sendTelegramAdminMessage(input.appConfig.telegramAdminBaseUrl, {
        chatId: runtimeInput.chatId,
        text: fallbackText
      }, input.appConfig.messengerAdminSharedSecret);
      const detail = error instanceof Error ? error.message : String(error);
      input.recordAction("automation:telegram-photo-fallback", `Photo fallback to message for ${runtimeInput.chatId}: ${detail}`);
    }
  };

  const sendMatrixAutomationMessage = async (roomId: string, text: string): Promise<void> => {
    await sendMatrixAdminMessage(input.appConfig.matrixAdminBaseUrl, { roomId, text }, input.appConfig.messengerAdminSharedSecret);
    input.recordAction("automation:matrix-send", `Sent Matrix automation message to ${roomId}.`);
  };

  const generateVideoFromPromptForAutomation = async (runtimeInput: {
    prompt: string;
    negativePrompt?: string;
    frames?: number;
    fps?: number;
    width?: number;
    height?: number;
    steps?: number;
    workflowPath?: string;
    imageDataUrl?: string;
    imageFileName?: string;
    channelId?: string | null;
    contentLabel?: string;
  }) => {
    const generated = await input.generateVideoFromPromptLocal({
      prompt: runtimeInput.prompt,
      negativePrompt: runtimeInput.negativePrompt,
      frames: runtimeInput.frames,
      fps: runtimeInput.fps,
      width: runtimeInput.width,
      height: runtimeInput.height,
      steps: runtimeInput.steps,
      workflowPath: runtimeInput.workflowPath,
      imageDataUrl: await resolveVideoStartImageDataUrl(runtimeInput.imageDataUrl),
      imageFileName: runtimeInput.imageFileName
    });
    if (runtimeInput.channelId) {
      const channel = await input.requireSendableChannel(runtimeInput.channelId);
      await channel.send({
        content: "🎬 " + (runtimeInput.contentLabel?.trim() || "Automated video follow-up is ready!"),
        files: [{
          attachment: await input.resolveGeneratedVideoFilePath(generated.id, generated.videoFileName),
          name: generated.videoFileName
        }]
      });
    }
    return input.toGeneratedVideoPublicRecord(generated);
  };

  return {
    resolvePublicAssetUrl,
    resolveWorkspaceRelativeAssetPath,
    generateVideoFromPromptForAutomation,
    processGeneratedVideoFollowUp,
    handleGifFrameDownloadButton,
    sendTelegramAutomationMessage,
    sendTelegramAutomationPhoto,
    sendMatrixAutomationMessage
  };
}
