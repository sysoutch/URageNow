import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GuildMember } from "discord.js";
import {
  defaultJokesFileName,
  type AutomationAction,
  type ImageAutomationPostOptions,
  type ImagePostProcessingOptions,
  type ModelAutomationPostOptions,
  type JoinAutomation,
  type ScheduledAutomation,
  listAllScheduledAutomations,
  listJoinAutomations,
  markScheduledAutomationRun
} from "@urage/shared/automation/index";
import { appConfig } from "@urage/server/config/appConfig";
import {
  readAutomationTextSourceLine,
  readAutomationTextSourceLineFromFiles
} from "@urage/server/services/automationTextLibrary";
import type { RuntimeState } from "@urage/server/runtime/runtimeState";

interface AutomationContext {
  serverName: string;
  userMention: string;
  username: string;
}

interface AutomationEngineDependencies {
  askModel: (prompt: string) => Promise<string>;
  buildGiftMessageIfAvailable?: () => Promise<string | null>;
  sendMessageToChannel: (channelId: string, content: string) => Promise<void>;
  sendTelegramMessage?: (chatId: string, text: string) => Promise<void>;
  sendTelegramPhoto?: (input: { chatId: string; imageUrl: string; caption?: string; }) => Promise<void>;
  sendMatrixMessage?: (roomId: string, text: string) => Promise<void>;
  generateImageForAutomation?: (input: {
    prompt?: string;
    autoPrompt?: boolean;
    source: "scheduled" | "join";
  }) => Promise<{
    imageUrl: string;
    prompt: string;
  }>;
  sendImageToChannel: (input: {
    channelId: string;
    prompt?: string;
    autoPrompt?: boolean;
    imageAutoFileName?: boolean;
    imageAutoDescription?: boolean;
    imageCandidateSelectionEnabled?: boolean;
    imageCandidateCount?: number;
    imageCandidateSelectionMode?: string;
    imageCandidateQueueMode?: string;
    imageCandidateProcessingMode?: string;
    imageCreateVideo?: boolean;
    imageVideoMode?: string;
    imageVideoPromptDirection?: string;
    imageVideoWorkflowSettings?: any;
    imagePostProcessingOptions?: ImagePostProcessingOptions;
    imagePostOptions?: ImageAutomationPostOptions;
    source: "scheduled" | "join";
  }) => Promise<void>;
  resolveImagePoolEntries: (poolId: string) => Promise<string[]>;
  sendModelToChannel: (input: {
    channelId: string;
    imageInput: string;
    prompt?: string;
    autoPrompt?: boolean;
    useLlmMetadata?: boolean;
    useLlmModelFileName?: boolean;
    useLlmModelDescription?: boolean;
    askLlmIfShouldBeMetallic?: boolean;
    askLlmForRealWorldHeightAndScale?: boolean;
    generationExecutionTarget?: "local" | "remote";
    metadataExecutionTarget?: "local" | "remote";
    metadataTiming?: "before" | "after" | "parallel";
    unloadLlmBeforeGenerate?: boolean;
    sendStartNotice?: boolean;
    source: "scheduled" | "join";
    modelPostOptions?: ModelAutomationPostOptions;
  }) => Promise<void>;
  runtimeState: RuntimeState;
  getGuildName: (guildId: string) => string | null;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const defaultJokesPath = path.join(dataDirectory, defaultJokesFileName);
const defaultJokesContent = [
  "Why did the Discord bot go to therapy? It had too many unresolved threads.",
  "I told my server a joke about latency. They got it eventually.",
  "Why did the mod bring a ladder? The conversation kept going over their head.",
  "My bot writes clean jokes. It has excellent prompt hygiene.",
  "Why did the channel feel calm? Because nobody started a reply chain war."
].join("\n");

function renderTemplate(text: string, context: AutomationContext): string {
  return text
    .replaceAll("{user}", context.userMention)
    .replaceAll("{username}", context.username)
    .replaceAll("{server}", context.serverName);
}

function getMinuteKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function intervalUnitToMs(unit: ScheduledAutomation["intervalUnit"]): number {
  switch (unit) {
    case "minutes":
      return 60_000;
    case "hours":
      return 60 * 60_000;
    case "days":
      return 24 * 60 * 60_000;
    case "weeks":
      return 7 * 24 * 60 * 60_000;
    default:
      return 24 * 60 * 60_000;
  }
}

function parseCronNumber(value: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`Cron value "${value}" is out of range.`);
  }
  return parsed;
}

function fieldMatches(token: string, value: number, min: number, max: number): boolean {
  if (token === "*") {
    return true;
  }

  if (token.includes(",")) {
    return token.split(",").some(part => fieldMatches(part.trim(), value, min, max));
  }

  if (token.includes("/")) {
    const [leftRaw, stepRaw] = token.split("/");
    if (!leftRaw || !stepRaw) {
      throw new Error(`Invalid cron step token "${token}".`);
    }

    const left = leftRaw;
    const step = parseCronNumber(stepRaw, 1, max - min + 1);
    if (left === "*") {
      return (value - min) % step === 0;
    }

    if (left.includes("-")) {
      const [rangeStartRaw, rangeEndRaw] = left.split("-");
      if (!rangeStartRaw || !rangeEndRaw) {
        throw new Error(`Invalid cron range token "${token}".`);
      }
      const rangeStart = parseCronNumber(rangeStartRaw, min, max);
      const rangeEnd = parseCronNumber(rangeEndRaw, min, max);
      return value >= rangeStart && value <= rangeEnd && (value - rangeStart) % step === 0;
    }

    const base = parseCronNumber(left, min, max);
    return value === base;
  }

  if (token.includes("-")) {
    const [rangeStartRaw, rangeEndRaw] = token.split("-");
    if (!rangeStartRaw || !rangeEndRaw) {
      throw new Error(`Invalid cron range token "${token}".`);
    }
    const rangeStart = parseCronNumber(rangeStartRaw, min, max);
    const rangeEnd = parseCronNumber(rangeEndRaw, min, max);
    return value >= rangeStart && value <= rangeEnd;
  }

  return value === parseCronNumber(token, min, max);
}

export function validateCronExpression(expression: string): void {
  const tokens = expression.trim().split(/\s+/);
  if (tokens.length !== 5) {
    throw new Error("Cron must have 5 fields: minute hour day month weekday.");
  }

  const [minute, hour, day, month, weekday] = tokens;
  if (!minute || !hour || !day || !month || !weekday) {
    throw new Error("Cron must have 5 fields: minute hour day month weekday.");
  }

  fieldMatches(minute, 0, 0, 59);
  fieldMatches(hour, 0, 0, 23);
  fieldMatches(day, 1, 1, 31);
  fieldMatches(month, 1, 1, 12);
  fieldMatches(weekday, 0, 0, 6);
}

function cronMatches(expression: string, now: Date): boolean {
  const tokens = expression.trim().split(/\s+/);
  if (tokens.length !== 5) {
    return false;
  }

  const [minute, hour, day, month, weekday] = tokens;
  if (!minute || !hour || !day || !month || !weekday) {
    return false;
  }

  return fieldMatches(minute, now.getMinutes(), 0, 59)
    && fieldMatches(hour, now.getHours(), 0, 23)
    && fieldMatches(day, now.getDate(), 1, 31)
    && fieldMatches(month, now.getMonth() + 1, 1, 12)
    && fieldMatches(weekday, now.getDay(), 0, 6);
}

async function ensureDefaultJokesFile(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(defaultJokesPath, "utf8");
  } catch {
    await writeFile(defaultJokesPath, defaultJokesContent, "utf8");
  }
}

function splitNonEmptyLines(value: string): string[] {
  return value.split(/\r?\n/).map(entry => entry.trim()).filter(Boolean);
}

async function resolveActionPromptTextFileLine(action: AutomationAction, context: AutomationContext): Promise<string> {
  const fileName = action.promptTextFile?.trim() ?? "";
  if (!fileName) {
    return "";
  }
  const line = (await readAutomationTextSourceLine(fileName, action.textSourceSelectionMode)).trim();
  if (!line) {
    return "";
  }
  return renderTemplate(line, context).trim();
}

function mergePromptWithPromptSourceLine(prompt: string, line: string): string {
  const trimmedPrompt = prompt.trim();
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return trimmedPrompt;
  }
  if (!trimmedPrompt) {
    return trimmedLine;
  }
  if (trimmedPrompt.includes("{line}")) {
    return trimmedPrompt.replaceAll("{line}", trimmedLine).trim();
  }
  return `${trimmedPrompt}\n${trimmedLine}`;
}

async function renderActionContent(
  action: AutomationAction,
  context: AutomationContext,
  askModel: (prompt: string) => Promise<string>
): Promise<string> {
  if (action.source === "template") {
    return renderTemplate(action.template, context);
  }

  if (action.source === "jokes-file") {
    await ensureDefaultJokesFile();
    return readAutomationTextSourceLineFromFiles(
      action.textFiles?.length ? action.textFiles : [action.jokesFile || defaultJokesFileName],
      action.textSourceSelectionMode
    );
  }

  return askModel(renderTemplate(action.prompt, context));
}

async function renderImageActionInput(
  action: AutomationAction,
  context: AutomationContext
): Promise<{
  prompt?: string;
  autoPrompt?: boolean;
}> {
  const promptTemplate = renderTemplate(action.prompt ?? "", context).trim();
  const promptSourceLine = await resolveActionPromptTextFileLine(action, context);
  const prompt = mergePromptWithPromptSourceLine(promptTemplate, promptSourceLine).trim();
  return {
    prompt: prompt || undefined,
    autoPrompt: action.imageAutoPrompt === true
  };
}

async function renderModelActionInput(
  action: AutomationAction,
  context: AutomationContext,
  resolveImagePoolEntries: (poolId: string) => Promise<string[]>
): Promise<{
  imageInput: string;
  prompt?: string;
  autoPrompt?: boolean;
  useLlmMetadata?: boolean;
  useLlmModelFileName?: boolean;
  useLlmModelDescription?: boolean;
  askLlmIfShouldBeMetallic?: boolean;
  askLlmForRealWorldHeightAndScale?: boolean;
  generationExecutionTarget?: "local" | "remote";
  metadataExecutionTarget?: "local" | "remote";
  metadataTiming?: "before" | "after" | "parallel";
  unloadLlmBeforeGenerate?: boolean;
  sendStartNotice?: boolean;
  modelPostOptions?: ModelAutomationPostOptions;
}> {
  const poolId = action.modelImagePoolId?.trim() ?? "";
  const poolEntries = poolId ? await resolveImagePoolEntries(poolId) : [];
  const renderedPoolEntries = poolEntries.map(entry => renderTemplate(entry, context)).map(entry => entry.trim()).filter(Boolean);
  const imageCandidates = splitNonEmptyLines(renderTemplate(action.modelImage ?? "", context)).concat(renderedPoolEntries);
  if (imageCandidates.length === 0) {
    throw new Error("3D model automation source requires a source image path/URL/data URL.");
  }
  const useRandomSource = action.modelRandomSource !== false;
  const imageInput = useRandomSource
    ? (imageCandidates[Math.floor(Math.random() * imageCandidates.length)] ?? imageCandidates[0] ?? "")
    : (imageCandidates[0] ?? "");
  if (!imageInput) {
    throw new Error("3D model automation source requires a source image path/URL/data URL.");
  }
  const promptTemplate = renderTemplate(action.prompt ?? "", context).trim();
  const promptSourceLine = await resolveActionPromptTextFileLine(action, context);
  const promptText = mergePromptWithPromptSourceLine(promptTemplate, promptSourceLine).trim();
  const useLegacyLlmMetadata = action.modelUseLlmMetadata === true;
  const useLlmModelFileName = action.modelUseLlmModelFileName === true || (useLegacyLlmMetadata && action.modelUseLlmModelFileName !== false);
  const useLlmModelDescription = action.modelUseLlmModelDescription === true || (useLegacyLlmMetadata && action.modelUseLlmModelDescription !== false);
  const metadataTiming = action.modelMetadataTiming === "after" || action.modelMetadataTiming === "parallel"
    ? action.modelMetadataTiming
    : "before";
  const modelPostOptions = action.modelPostOptions
    ? {
        targetMode: action.modelPostOptions.targetMode,
        threadNameMode: action.modelPostOptions.threadNameMode,
        threadName: renderTemplate(action.modelPostOptions.threadName, context),
        threadNameBase: renderTemplate(action.modelPostOptions.threadNameBase, context),
        modelNameSource: action.modelPostOptions.modelNameSource,
        forumChannelId: action.modelPostOptions.forumChannelId?.trim() || "",
        forumChannelName: renderTemplate(action.modelPostOptions.forumChannelName, context),
        lowPolyForumChannelId: action.modelPostOptions.lowPolyForumChannelId?.trim() || "",
        lowPolyForumChannelName: renderTemplate(action.modelPostOptions.lowPolyForumChannelName, context),
        sendInitialToSelectedChannel: action.modelPostOptions.sendInitialToSelectedChannel,
        initialExtraText: renderTemplate(action.modelPostOptions.initialExtraText, context),
        modelUploadTarget: action.modelPostOptions.modelUploadTarget,
        includeModelFile: action.modelPostOptions.includeModelFile,
        includePreviewMedia: action.modelPostOptions.includePreviewMedia,
        includeSourceImage: action.modelPostOptions.includeSourceImage,
        includeEmbed: action.modelPostOptions.includeEmbed,
        includeButtons: action.modelPostOptions.includeButtons,
        includeEmbedInInitial: action.modelPostOptions.includeEmbedInInitial,
        uploadTextureMessages: action.modelPostOptions.uploadTextureMessages,
        uploadMultiViewTextures: action.modelPostOptions.uploadMultiViewTextures,
        uploadUvMapTextures: action.modelPostOptions.uploadUvMapTextures,
        uploadNormalMapTextures: action.modelPostOptions.uploadNormalMapTextures,
        textureUploadTarget: action.modelPostOptions.textureUploadTarget,
        destinationExtraText: renderTemplate(action.modelPostOptions.destinationExtraText, context),
        sendSourceImageToSelectedChannel: action.modelPostOptions.sendSourceImageToSelectedChannel === true,
        generateLowPolyVersion: action.modelPostOptions.generateLowPolyVersion,
        lowPolyUseLlmTargetFaces: action.modelPostOptions.lowPolyUseLlmTargetFaces === true,
        lowPolyLlmDecisionSource: (action.modelPostOptions.lowPolyLlmDecisionSource === "model-render" ? "model-render" : "input-image") as "input-image" | "model-render",
        lowPolyTargetFaceCount: action.modelPostOptions.lowPolyTargetFaceCount
      }
    : undefined;
  return {
    imageInput,
    prompt: promptText || undefined,
    autoPrompt: action.modelAutoPrompt === true,
    useLlmMetadata: useLlmModelFileName || useLlmModelDescription,
    useLlmModelFileName,
    useLlmModelDescription,
    askLlmIfShouldBeMetallic: action.modelAskLlmIfShouldBeMetallic === true,
    askLlmForRealWorldHeightAndScale: action.modelAskLlmForRealWorldHeightAndScale === true,
    generationExecutionTarget: action.modelGenerationTarget === "remote" ? "remote" : "local",
    metadataExecutionTarget: action.modelMetadataTarget === "remote" ? "remote" : "local",
    metadataTiming,
    unloadLlmBeforeGenerate: action.modelUnloadLlmBeforeGenerate !== false,
    sendStartNotice: action.modelSendStartNotice !== false,
    modelPostOptions
  };
}

export function createAutomationEngine(dependencies: AutomationEngineDependencies): {
  start: () => void;
  stop: () => void;
  handleMemberJoin: (member: GuildMember) => Promise<void>;
} {
  let intervalHandle: NodeJS.Timeout | null = null;
  let lastMinuteKey = "";

  async function runScheduledAutomation(entry: ScheduledAutomation): Promise<void> {
    const serverName = dependencies.getGuildName(entry.guildId) ?? "this server";
    const targetMessenger = entry.targetMessenger === "telegram" || entry.targetMessenger === "matrix"
      ? entry.targetMessenger
      : "discord";
    const targetId = String(entry.channelId || "").trim();
    if (!targetId) {
      throw new Error("Scheduled automation target is not set.");
    }
    const repeatCount = Math.max(1, entry.repeatCount || 1);
    const repeatDelayMs = Math.max(0, entry.repeatDelaySeconds || 0) * 1000;
    let skippedBecauseGiftUnavailable = false;
    for (let index = 0; index < repeatCount; index += 1) {
      const context: AutomationContext = {
        serverName,
        userMention: "@everyone",
        username: "everyone"
      };

      if (targetMessenger === "telegram") {
        if (entry.action.source === "model-3d") {
          throw new Error("3D model scheduled automations are not supported for Telegram yet.");
        }
        if (entry.action.source === "unity-publisher-gift") {
          if (!dependencies.buildGiftMessageIfAvailable || !dependencies.sendTelegramMessage) {
            throw new Error("Unity Publisher gift automation is not configured for Telegram.");
          }
          const message = await dependencies.buildGiftMessageIfAvailable();
          if (!message) {
            skippedBecauseGiftUnavailable = true;
            break;
          }
          await dependencies.sendTelegramMessage(targetId, message);
        } else if (entry.action.source === "image") {
          if (!dependencies.generateImageForAutomation) {
            throw new Error("Telegram image automation is not configured.");
          }
          const imageInput = await renderImageActionInput(entry.action, context);
          const generated = await dependencies.generateImageForAutomation({
            prompt: imageInput.prompt,
            autoPrompt: imageInput.autoPrompt,
            source: "scheduled"
          });
          const imageUrl = generated.imageUrl.trim();
          if (!imageUrl) {
            throw new Error("Telegram image automation did not produce an image URL.");
          }
          const caption = generated.prompt.trim()
            ? `Prompt: ${generated.prompt.trim()}`
            : "Automated image drop";
          if (dependencies.sendTelegramPhoto) {
            await dependencies.sendTelegramPhoto({
              chatId: targetId,
              imageUrl,
              caption
            });
          } else if (dependencies.sendTelegramMessage) {
            await dependencies.sendTelegramMessage(targetId, `${caption}\n${imageUrl}`);
          } else {
            throw new Error("Telegram messaging is not configured.");
          }
        } else {
          if (!dependencies.sendTelegramMessage) {
            throw new Error("Telegram messaging is not configured.");
          }
          const content = await renderActionContent(entry.action, context, dependencies.askModel);
          await dependencies.sendTelegramMessage(targetId, content);
        }
      } else if (targetMessenger === "matrix") {
        if (entry.action.source === "model-3d") {
          throw new Error("3D model scheduled automations are not supported for Matrix yet.");
        }
        if (!dependencies.sendMatrixMessage) {
          throw new Error("Matrix messaging is not configured.");
        }
        if (entry.action.source === "unity-publisher-gift") {
          if (!dependencies.buildGiftMessageIfAvailable) {
            throw new Error("Unity Publisher gift automation is not configured.");
          }
          const message = await dependencies.buildGiftMessageIfAvailable();
          if (!message) {
            skippedBecauseGiftUnavailable = true;
            break;
          }
          await dependencies.sendMatrixMessage(targetId, message);
        } else if (entry.action.source === "image") {
          if (!dependencies.generateImageForAutomation) {
            throw new Error("Matrix image automation is not configured.");
          }
          const imageInput = await renderImageActionInput(entry.action, context);
          const generated = await dependencies.generateImageForAutomation({
            prompt: imageInput.prompt,
            autoPrompt: imageInput.autoPrompt,
            source: "scheduled"
          });
          const imageUrl = generated.imageUrl.trim();
          if (!imageUrl) {
            throw new Error("Matrix image automation did not produce an image URL.");
          }
          const caption = generated.prompt.trim()
            ? `Prompt: ${generated.prompt.trim()}`
            : "Automated image drop";
          await dependencies.sendMatrixMessage(targetId, `${caption}\n${imageUrl}`);
        } else {
          const content = await renderActionContent(entry.action, context, dependencies.askModel);
          await dependencies.sendMatrixMessage(targetId, content);
        }
      } else if (entry.action.source === "model-3d") {
        const modelInput = await renderModelActionInput(entry.action, context, dependencies.resolveImagePoolEntries);
        await dependencies.sendModelToChannel({
          channelId: targetId,
          imageInput: modelInput.imageInput,
          prompt: modelInput.prompt,
          autoPrompt: modelInput.autoPrompt,
          useLlmMetadata: modelInput.useLlmMetadata,
          useLlmModelFileName: modelInput.useLlmModelFileName,
          useLlmModelDescription: modelInput.useLlmModelDescription,
          askLlmIfShouldBeMetallic: modelInput.askLlmIfShouldBeMetallic,
          askLlmForRealWorldHeightAndScale: modelInput.askLlmForRealWorldHeightAndScale,
          generationExecutionTarget: modelInput.generationExecutionTarget,
          metadataExecutionTarget: modelInput.metadataExecutionTarget,
          metadataTiming: modelInput.metadataTiming,
          unloadLlmBeforeGenerate: modelInput.unloadLlmBeforeGenerate,
          sendStartNotice: modelInput.sendStartNotice,
          source: "scheduled",
          modelPostOptions: modelInput.modelPostOptions
        });
      } else if (entry.action.source === "unity-publisher-gift") {
        if (!dependencies.buildGiftMessageIfAvailable) {
          throw new Error("Unity Publisher gift automation is not configured.");
        }
        const message = await dependencies.buildGiftMessageIfAvailable();
        if (!message) {
          skippedBecauseGiftUnavailable = true;
          break;
        }
        await dependencies.sendMessageToChannel(targetId, message);
      } else if (entry.action.source === "image") {
        const imageInput = await renderImageActionInput(entry.action, context);
        await dependencies.sendImageToChannel({
          channelId: targetId,
          prompt: imageInput.prompt,
          autoPrompt: imageInput.autoPrompt,
          imageAutoFileName: entry.action.imageAutoFileName === true,
          imageAutoDescription: entry.action.imageAutoDescription === true,
          imageCandidateSelectionEnabled: entry.action.imageCandidateSelectionEnabled === true,
          imageCandidateCount: entry.action.imageCandidateCount,
          imageCandidateSelectionMode: entry.action.imageCandidateSelectionMode,
          imageCandidateQueueMode: entry.action.imageCandidateQueueMode,
          imageCandidateProcessingMode: entry.action.imageCandidateProcessingMode,
          imageCreateVideo: entry.action.imageCreateVideo === true,
          imageVideoMode: entry.action.imageVideoMode,
          imageVideoPromptDirection: entry.action.imageVideoPromptDirection,
          imageVideoWorkflowSettings: entry.action.imageVideoWorkflowSettings,
          imagePostProcessingOptions: entry.action.imagePostProcessingOptions,
          imagePostOptions: entry.action.imagePostOptions,
          source: "scheduled"
        });
      } else {
        const content = await renderActionContent(entry.action, context, dependencies.askModel);
        await dependencies.sendMessageToChannel(targetId, content);
      }

      if (index < repeatCount - 1 && repeatDelayMs > 0) {
        await sleep(repeatDelayMs);
      }
    }
    await markScheduledAutomationRun(entry.id, new Date().toISOString());
    dependencies.runtimeState.recordAction(
      "automation:schedule",
      `${entry.name} -> ${targetMessenger}:${targetId}${repeatCount > 1 ? ` x${repeatCount} @ ${entry.repeatDelaySeconds}s` : ""}${skippedBecauseGiftUnavailable ? " (no live Unity gift found)" : ""}`
    );
  }

  function intervalMatches(entry: ScheduledAutomation, now: Date): boolean {
    const baseline = entry.lastRunAt || entry.createdAt;
    const baselineDate = baseline ? new Date(baseline) : now;
    if (Number.isNaN(baselineDate.getTime())) {
      return true;
    }

    const intervalMs = Math.max(1, entry.intervalValue || 1) * intervalUnitToMs(entry.intervalUnit);
    return now.getTime() - baselineDate.getTime() >= intervalMs;
  }

  async function tick(): Promise<void> {
    const now = new Date();
    const minuteKey = getMinuteKey(now);
    if (minuteKey === lastMinuteKey) {
      return;
    }

    lastMinuteKey = minuteKey;
    const entries = await listAllScheduledAutomations();
    for (const entry of entries) {
      if (!entry.enabled) {
        continue;
      }

      const due = entry.triggerMode === "interval"
        ? intervalMatches(entry, now)
        : cronMatches(entry.cron, now);
      if (!due) {
        continue;
      }

      const lastRunMinute = entry.lastRunAt ? getMinuteKey(new Date(entry.lastRunAt)) : "";
      if (entry.triggerMode === "cron" && lastRunMinute === minuteKey) {
        continue;
      }

      try {
        await runScheduledAutomation(entry);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown automation error";
        dependencies.runtimeState.recordAction("automation:error", `${entry.name}: ${detail}`);
        console.error("Scheduled automation failed", entry.id, detail);
      }
    }
  }

  async function runJoinAutomation(entry: JoinAutomation, member: GuildMember): Promise<void> {
    const context: AutomationContext = {
      serverName: member.guild.name,
      userMention: `<@${member.id}>`,
      username: member.user.username
    };

    if (entry.action.source === "model-3d") {
      const modelInput = await renderModelActionInput(entry.action, context, dependencies.resolveImagePoolEntries);
      await dependencies.sendModelToChannel({
        channelId: entry.channelId,
        imageInput: modelInput.imageInput,
        prompt: modelInput.prompt,
        autoPrompt: modelInput.autoPrompt,
        useLlmMetadata: modelInput.useLlmMetadata,
        useLlmModelFileName: modelInput.useLlmModelFileName,
        useLlmModelDescription: modelInput.useLlmModelDescription,
        askLlmIfShouldBeMetallic: modelInput.askLlmIfShouldBeMetallic,
        askLlmForRealWorldHeightAndScale: modelInput.askLlmForRealWorldHeightAndScale,
        generationExecutionTarget: modelInput.generationExecutionTarget,
        metadataExecutionTarget: modelInput.metadataExecutionTarget,
        metadataTiming: modelInput.metadataTiming,
        unloadLlmBeforeGenerate: modelInput.unloadLlmBeforeGenerate,
        sendStartNotice: modelInput.sendStartNotice,
        source: "join",
        modelPostOptions: modelInput.modelPostOptions
      });
    } else if (entry.action.source === "image") {
      const imageInput = await renderImageActionInput(entry.action, context);
      await dependencies.sendImageToChannel({
        channelId: entry.channelId,
        prompt: imageInput.prompt,
        autoPrompt: imageInput.autoPrompt,
        imageCandidateSelectionEnabled: entry.action.imageCandidateSelectionEnabled === true,
        imageCandidateCount: entry.action.imageCandidateCount,
        imageCandidateSelectionMode: entry.action.imageCandidateSelectionMode,
        imageCandidateQueueMode: entry.action.imageCandidateQueueMode,
        imageCandidateProcessingMode: entry.action.imageCandidateProcessingMode,
        imageCreateVideo: entry.action.imageCreateVideo === true,
        imageVideoMode: entry.action.imageVideoMode,
        imageVideoPromptDirection: entry.action.imageVideoPromptDirection,
        imageVideoWorkflowSettings: entry.action.imageVideoWorkflowSettings,
        imagePostProcessingOptions: entry.action.imagePostProcessingOptions,
        imagePostOptions: entry.action.imagePostOptions,
        source: "join"
      });
    } else {
      const content = await renderActionContent(entry.action, context, dependencies.askModel);
      await dependencies.sendMessageToChannel(entry.channelId, content);
    }

    dependencies.runtimeState.recordAction("automation:join", `${entry.name} -> ${member.user.tag}`);
  }

  async function handleMemberJoin(member: GuildMember): Promise<void> {
    const entries = await listJoinAutomations(member.guild.id);
    for (const entry of entries) {
      if (!entry.enabled) {
        continue;
      }

      setTimeout(() => {
        void runJoinAutomation(entry, member).catch(error => {
          const detail = error instanceof Error ? error.message : "Unknown join automation error";
          dependencies.runtimeState.recordAction("automation:error", `${entry.name}: ${detail}`);
        });
      }, entry.delaySeconds * 1000);
    }
  }

  function start(): void {
    if (intervalHandle) {
      return;
    }

    void ensureDefaultJokesFile();
    void tick();
    intervalHandle = setInterval(() => {
      void tick();
    }, 15_000);
  }

  function stop(): void {
    if (!intervalHandle) {
      return;
    }

    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  return {
    start,
    stop,
    handleMemberJoin
  };
}
