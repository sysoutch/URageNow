import type { Message } from "discord.js";

type ChatModeRuntimeServiceDependencies = {
  canSendMessages: (channel: unknown) => boolean;
  getGuildSettings: (guildId: string) => Promise<any>;
  getChatModeChannelSettings: (settings: any, channelId: string) => any;
  evaluateChatModeMessage: (message: Message, settings: any) => Promise<{ shouldRespond: boolean; status: string; reason: string }>;
  askText: (prompt: string, options?: {
    systemPrompt?: string | null;
    statefulChatSessionId?: string | null;
    useStatefulChat?: boolean;
    resetStatefulChat?: boolean;
  }) => Promise<string>;
  buildChatModeSystemPrompt: (settings: any, channelSettings: any, context: {
    guildName: string;
    channelName: string;
  }) => string;
  buildChatModeUserPrompt: (context: {
    guildName: string;
    channelName: string;
    authorTag: string;
    authorContext: string | null;
    messageContent: string;
    repliedContent: string | null;
  }) => string;
  stripDiscrodReplyFooter: (text: string) => string | null;
  summarizeText: (value: string, maxLength?: number) => string;
  sendChunkedToTarget: (target: any, content: string) => Promise<void>;
  buildMemberPromptContext: (member: Message["member"]) => string | null;
  buildChatSelfTaskIntentPrompt: (input: {
    guildName: string;
    channelName: string;
    authorTag: string;
    authorContext: string | null;
    messageContent: string;
    repliedContent: string | null;
    allowedActionTypes: string[];
  }) => string;
  parseChatSelfTaskIntent: (raw: string) => { shouldUseSelfTask: boolean; confidence: number; requestText: string | null };
  buildPendingSelfTaskBatchForRequest: (input: {
    guildId: string;
    currentChannelId: string;
    requestedByUserId: string;
    requestedByTag: string;
    requestText: string;
  }) => Promise<any>;
  describeSelfTaskAction: (action: any) => string;
  applyPendingSelfTaskBatch: (batch: any, reason: string) => Promise<{ results: string[]; skipped: string[] }>;
  isProtectedGuildMember: (member: Message["member"]) => boolean;
  tryAnswerCachedGuildFactQuestion: (input: {
    guild: NonNullable<Message["guild"]>;
    content: string;
    authorId: string;
    messageMentions?: Message["mentions"];
  }) => Promise<string | null>;
  resolveSelfTaskReview: (reviewId: string, payload: any) => void;
  setChatModeDebugStatus: (input: any) => void;
  recordAction: (type: string, summary: string) => void;
  getClientUserId: () => string | null;
};

type ChatModeRuntimeService = {
  maybeHandleChatModeMessage: (message: Message) => Promise<boolean>;
};

export function createChatModeRuntimeService(dependencies: ChatModeRuntimeServiceDependencies): ChatModeRuntimeService {
  async function maybeHandleChatModeSelfTask(message: Message, settings: any, repliedContent: string | null): Promise<boolean> {
    if (!settings.botSafetyAllowChatSelfTasks || !message.guild || !dependencies.canSendMessages(message.channel)) {
      return false;
    }
    try {
      const rawIntent = await dependencies.askText(dependencies.buildChatSelfTaskIntentPrompt({
        guildName: message.guild.name,
        channelName: "name" in message.channel && typeof message.channel.name === "string" ? message.channel.name : "chat",
        authorTag: message.author.tag,
        authorContext: dependencies.buildMemberPromptContext(message.member),
        messageContent: message.content.trim() || "[attachment-only message]",
        repliedContent,
        allowedActionTypes: settings.selfTaskAllowedActionTypes
      }));
      const intent = dependencies.parseChatSelfTaskIntent(rawIntent);
      if (!intent.shouldUseSelfTask || (intent.confidence * 100) < settings.botSafetyChatSelfTaskMinConfidence) {
        return false;
      }
      const batch = await dependencies.buildPendingSelfTaskBatchForRequest({
        guildId: message.guild.id,
        currentChannelId: message.channelId,
        requestedByUserId: message.author.id,
        requestedByTag: message.author.tag,
        requestText: intent.requestText || message.content.trim()
      });
      const previewOnly = settings.botSafetySuggestOnly || settings.selfTaskDryRunOnly || (settings.botSafetyChatSelfTasksAdminOnly && !dependencies.isProtectedGuildMember(message.member));
      if (previewOnly) {
        if (batch.reviewId) {
          dependencies.resolveSelfTaskReview(batch.reviewId, {
            status: "approved",
            resolutionNote: settings.selfTaskDryRunOnly ? "Previewed from chat mode only because dry run is enabled." : settings.botSafetySuggestOnly ? "Previewed from chat mode only because suggest-only safety is enabled." : "Previewed from chat mode only because chat self tasks are restricted to protected members."
          });
        }
        await dependencies.sendChunkedToTarget(message.channel, `<@${message.author.id}> LazyDev recognized that as a server task request, but safety mode kept it as a preview only.\n\n` + `Confidence: ${(intent.confidence * 100).toFixed(0)}%\n` + `Planned actions:\n${batch.actions.length > 0 ? batch.actions.map((action: any, index: number) => `${index + 1}. ${dependencies.describeSelfTaskAction(action)}`).join("\n") : "No safe action was planned."}`);
        dependencies.recordAction("chat-mode:self-task-preview", `guild=${message.guild.id} user=${message.author.tag} confidence=${(intent.confidence * 100).toFixed(0)}`);
        dependencies.setChatModeDebugStatus({
          guildId: message.guild.id,
          channelId: message.channelId,
          status: "responded",
          reason: settings.selfTaskDryRunOnly ? "recognized a self task request but dry run kept it preview-only" : settings.botSafetySuggestOnly ? "recognized a self task request but suggest-only kept it preview-only" : "recognized a self task request but auto-run is restricted to protected members",
          username: message.author.tag,
          userId: message.author.id,
          messagePreview: dependencies.summarizeText(message.content.trim() || "[attachment-only message]", 120)
        });
        return true;
      }
      const { results, skipped } = await dependencies.applyPendingSelfTaskBatch(batch, `chat mode ${message.author.tag}`);
      await dependencies.sendChunkedToTarget(message.channel, `<@${message.author.id}> LazyDev recognized that as a server task request and ran it.\n\n` + `Executed:\n${results.length > 0 ? results.join("\n") : "Nothing was executed."}\n\n` + `Skipped:\n${skipped.length > 0 ? skipped.join("\n") : "Nothing skipped."}`);
      dependencies.recordAction("chat-mode:self-task-run", `guild=${message.guild.id} user=${message.author.tag} confidence=${(intent.confidence * 100).toFixed(0)} executed=${results.length}`);
      dependencies.setChatModeDebugStatus({
        guildId: message.guild.id,
        channelId: message.channelId,
        status: "responded",
        reason: `recognized and executed a self task request at ${(intent.confidence * 100).toFixed(0)}% confidence`,
        username: message.author.tag,
        userId: message.author.id,
        messagePreview: dependencies.summarizeText(message.content.trim() || "[attachment-only message]", 120)
      });
      return true;
    } catch (error) {
      dependencies.recordAction("chat-mode:self-task-error", `guild=${message.guild?.id ?? "unknown"} user=${message.author.tag} error=${error instanceof Error ? error.message : "unknown"}`);
      return false;
    }
  }

  async function maybeHandleChatModeMessage(message: Message): Promise<boolean> {
    if (!message.guild || !message.member || message.author.bot || !dependencies.canSendMessages(message.channel)) {
      return false;
    }
    const settings = await dependencies.getGuildSettings(message.guild.id);
    const channelSettings = dependencies.getChatModeChannelSettings(settings, message.channelId);
    if (!channelSettings) {
      dependencies.setChatModeDebugStatus({
        guildId: message.guild.id,
        channelId: message.channelId,
        status: "ignored",
        reason: "chat mode is disabled for this channel",
        username: message.author.tag,
        userId: message.author.id,
        messagePreview: dependencies.summarizeText(message.content.trim() || "[attachment-only message]", 120)
      });
      return false;
    }
    if (settings.botMode === "act-on-itself" && !settings.autonomousReplyToMentions) {
      dependencies.setChatModeDebugStatus({
        guildId: message.guild.id,
        channelId: message.channelId,
        status: "ignored",
        reason: "autonomous mode replies to mentions are disabled",
        username: message.author.tag,
        userId: message.author.id,
        messagePreview: dependencies.summarizeText(message.content.trim() || "[attachment-only message]", 120)
      });
      return false;
    }
    const decision = await dependencies.evaluateChatModeMessage(message, settings);
    dependencies.setChatModeDebugStatus({
      guildId: message.guild.id,
      channelId: message.channelId,
      status: decision.status,
      reason: decision.reason,
      username: message.author.tag,
      userId: message.author.id,
      messagePreview: dependencies.summarizeText(message.content.trim() || "[attachment-only message]", 120)
    });
    if (!decision.shouldRespond) {
      return false;
    }
    let repliedContent: string | null = null;
    if (message.reference?.messageId) {
      try {
        const reference = await message.fetchReference();
        if (reference.author.id === dependencies.getClientUserId()) {
          repliedContent = dependencies.stripDiscrodReplyFooter(reference.content);
        }
      } catch {
        repliedContent = null;
      }
    }
    const handledAsTask = await maybeHandleChatModeSelfTask(message, settings, repliedContent);
    if (handledAsTask) {
      return true;
    }
    const cachedFactAnswer = await dependencies.tryAnswerCachedGuildFactQuestion({
      guild: message.guild,
      content: message.content,
      authorId: message.author.id,
      messageMentions: message.mentions
    });
    if (cachedFactAnswer) {
      await dependencies.sendChunkedToTarget(message.channel, `<@${message.author.id}> ${cachedFactAnswer}\n\n-# Chat mode reply from Discrod`);
      dependencies.setChatModeDebugStatus({
        guildId: message.guild.id,
        channelId: message.channelId,
        status: "responded",
        reason: "answered from cached guild facts",
        username: message.author.tag,
        userId: message.author.id,
        messagePreview: dependencies.summarizeText(message.content.trim() || "[attachment-only message]", 120)
      });
      dependencies.recordAction("chat-mode:cached-fact", `guild=${message.guild.id} channel=${message.channelId} user=${message.author.tag}`);
      return true;
    }
    const promptContext = {
      guildName: message.guild.name,
      channelName: "name" in message.channel && typeof message.channel.name === "string" ? message.channel.name : "chat",
      authorTag: message.author.tag,
      authorContext: dependencies.buildMemberPromptContext(message.member),
      messageContent: message.content.trim() || "[attachment-only message]",
      repliedContent
    };
    const systemPrompt = dependencies.buildChatModeSystemPrompt(settings, channelSettings, {
      guildName: promptContext.guildName,
      channelName: promptContext.channelName
    });
    const prompt = dependencies.buildChatModeUserPrompt(promptContext);
    let answer: string;
    try {
      answer = await dependencies.askText(prompt, {
        systemPrompt,
        statefulChatSessionId: `chat-mode:${message.guild.id}:${message.channelId}:${message.author.id}`,
        useStatefulChat: true
      });
    } catch (error) {
      dependencies.setChatModeDebugStatus({
        guildId: message.guild.id,
        channelId: message.channelId,
        status: "error",
        reason: error instanceof Error ? error.message : "Rod request failed",
        username: message.author.tag,
        userId: message.author.id,
        messagePreview: dependencies.summarizeText(message.content.trim() || "[attachment-only message]", 120)
      });
      throw error;
    }
    const prefix = settings.botMode === "act-on-user-behalf" ? `Proxy ${settings.botActingPreset} mode` : settings.botMode === "act-on-itself" ? "Autonomous mode" : "Chat mode";
    const cleanedAnswer = dependencies.stripDiscrodReplyFooter(answer) ?? answer.trim();
    await dependencies.sendChunkedToTarget(message.channel, `<@${message.author.id}> ${cleanedAnswer}\n\n-# ${prefix} reply from Discrod`);
    dependencies.setChatModeDebugStatus({
      guildId: message.guild.id,
      channelId: message.channelId,
      status: "responded",
      reason: `replied in ${settings.botMode} mode`,
      username: message.author.tag,
      userId: message.author.id,
      messagePreview: dependencies.summarizeText(message.content.trim() || "[attachment-only message]", 120)
    });
    dependencies.recordAction("chat-mode", `guild=${message.guild.id} channel=${message.channelId} user=${message.author.tag} mode=${settings.botMode}`);
    return true;
  }

  return {
    maybeHandleChatModeMessage
  };
}
