import { GuildMember, MessageFlags, type Interaction, type Message } from "discord.js";

type DiscordEventRuntimeInput = {
  client: {
    channels: {
      fetch: (channelId: string) => Promise<any>;
    };
  };
  runtimeState: {
    recordAction: (type: string, detail: string) => void;
    recordGuildSignal: (guildId: string, signalType: "message" | "member-join" | "member-leave" | "interaction" | "moderation", detail: string) => void;
  };
  canSendMessages: (channel: any) => boolean;
  summarizeText: (value: string) => string;
  refreshConfiguredMemberCounters: () => Promise<void>;
  runAutonomousHeartbeatPass: () => Promise<void>;
  cacheGuildMember: (member: any) => Promise<void>;
  updateMemberCounterChannelForGuild: (guildId: string) => Promise<void>;
  getGuildSettings: (guildId: string) => Promise<any>;
  renderWelcomeMessage: (template: string, input: {
    userMention: string;
    username: string;
    serverName: string;
  }) => string;
  sendChunkedToChannel: (channel: any, content: string) => Promise<void>;
  automationEngine: {
    handleMemberJoin: (member: any) => Promise<void>;
  };
  removeCachedGuildUser: (guildId: string, userId: string) => Promise<void>;
  selfTaskApprovePrefix: string;
  selfTaskCancelPrefix: string;
  imageGenerate3dPrefix: string;
  imageNewPrefix: string;
  imageNewPromptPrefix: string;
  modelActionPrefixes: string[];
  moderationVetoPrefix: string;
  honeypotVerifyPrefix: string;
  imageAddToPoolButtonPrefix: string;
  imageAddToPoolSelectPrefix: string;
  gifFrameDownloadPrefix: string;
  handleSelfTaskApproval: (interaction: any) => Promise<void>;
  generatedImageInteractionRuntime: {
    handleImageActionButton: (interaction: any) => Promise<void>;
    handleAddToPoolButton: (interaction: any) => Promise<void>;
    handleAddToPoolSelect: (interaction: any) => Promise<void>;
  };
  handleGifFrameDownloadButton: (interaction: any) => Promise<void>;
  handleGeneratedModelButton: (interaction: any) => Promise<void>;
  handleGeneratedModelModal: (interaction: any) => Promise<boolean>;
  handleModerationVeto: (interaction: any) => Promise<void>;
  handleHoneypotVerify: (interaction: any) => Promise<void>;
  handleSlashCommand: (interaction: any) => Promise<void>;
  enforceModerationRoleRestrictions: (message: Message) => Promise<boolean>;
  duplicateSpamGuard: {
    inspectMessage: (message: Message) => Promise<void>;
  };
  maybeOfferMediaReactionActions: (message: Message) => Promise<boolean>;
  maybeHandleChatModeMessage: (message: Message) => Promise<boolean>;
};

export function createDiscordEventRuntime(input: DiscordEventRuntimeInput) {
  async function handleClientReady(readyClient: { user: { tag: string; }; }) {
    input.runtimeState.recordAction("system", `Logged in as ${readyClient.user.tag}.`);
    console.log(`Node migration bot logged in as ${readyClient.user.tag}`);
    await input.refreshConfiguredMemberCounters();
    await input.runAutonomousHeartbeatPass();
  }

  async function handleGuildMemberAdd(member: any) {
    input.runtimeState.recordGuildSignal(member.guild.id, "member-join", `${member.user.tag} joined ${member.guild.name}`);
    try {
      await input.cacheGuildMember(member);
    } catch (error) {
      console.error("Failed to cache joined member", error);
    }
    try {
      await input.updateMemberCounterChannelForGuild(member.guild.id);
    } catch (error) {
      console.error("Failed to refresh member counter after join", error);
    }
    try {
      const settings = await input.getGuildSettings(member.guild.id);
      if (!settings.welcomeEnabled || !settings.welcomeChannelId) {
        return;
      }
      const targetChannel = await input.client.channels.fetch(settings.welcomeChannelId);
      if (!targetChannel?.isTextBased() || !input.canSendMessages(targetChannel)) {
        return;
      }
      const message = input.renderWelcomeMessage(settings.welcomeMessage, {
        userMention: `<@${member.id}>`,
        username: member.user.username,
        serverName: member.guild.name
      });
      await input.sendChunkedToChannel(targetChannel, message);
      input.runtimeState.recordAction("welcome", `Posted welcome message for ${member.user.tag} in ${member.guild.name}.`);
    } catch (error) {
      console.error("Failed to post welcome message", error);
    }
    try {
      await input.automationEngine.handleMemberJoin(member);
    } catch (error) {
      console.error("Failed to run join automations", error);
    }
  }

  async function handleGuildMemberRemove(member: any) {
    input.runtimeState.recordGuildSignal(member.guild.id, "member-leave", `${member.user.tag} left ${member.guild.name}`);
    try {
      await input.removeCachedGuildUser(member.guild.id, member.id);
    } catch (error) {
      console.error("Failed to remove departed member from cache", error);
    }
    try {
      await input.updateMemberCounterChannelForGuild(member.guild.id);
    } catch (error) {
      console.error("Failed to refresh member counter after leave", error);
    }
  }

  async function handleInteractionCreate(interaction: Interaction) {
    if (interaction.guildId && interaction.user && !interaction.user.bot) {
      input.runtimeState.recordGuildSignal(
        interaction.guildId,
        "interaction",
        `${interaction.user.tag} used ${interaction.isChatInputCommand() ? `/${interaction.commandName}` : "an interaction"}`
      );
    }
    if (interaction.isButton() && interaction.customId.startsWith("media-rule:")) {
      const [, action, sourceMessageId, resultChannelId] = interaction.customId.split(":");
      await interaction.reply({
        content: "Queued `" + action + "` for message `" + sourceMessageId + "`. The result target is <#" + resultChannelId + ">. Full generation execution for this media-rule action is the next runtime step.",
        flags: MessageFlags.Ephemeral
      });
      input.runtimeState.recordAction("media-rule:select", `${interaction.user.tag} selected ${action} for ${sourceMessageId} -> ${resultChannelId}`);
      return;
    }
    if (interaction.isButton() && (interaction.customId.startsWith(input.selfTaskApprovePrefix) || interaction.customId.startsWith(input.selfTaskCancelPrefix))) {
      try {
        await input.handleSelfTaskApproval(interaction);
      } catch (error) {
        console.error("Failed to handle self task approval", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Something went wrong while applying that self-task plan.",
            flags: MessageFlags.Ephemeral
          });
        }
      }
      return;
    }
    if (
      interaction.isButton()
      && (
        interaction.customId.startsWith(input.imageGenerate3dPrefix)
        || interaction.customId.startsWith(input.imageNewPrefix)
        || interaction.customId.startsWith(input.imageNewPromptPrefix)
      )
    ) {
      await input.generatedImageInteractionRuntime.handleImageActionButton(interaction);
      return;
    }
    if (interaction.isButton() && input.modelActionPrefixes.some(prefix => interaction.customId.startsWith(prefix))) {
      try {
        await input.handleGeneratedModelButton(interaction);
      } catch (error) {
        console.error("Failed to handle generated model button", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Something went wrong while handling that model action.",
            flags: MessageFlags.Ephemeral
          });
        }
      }
      return;
    }
    if (interaction.isModalSubmit()) {
      try {
        const handledModelModal = await input.handleGeneratedModelModal(interaction);
        if (handledModelModal) {
          return;
        }
      } catch (error) {
        console.error("Failed to handle generated model modal", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Something went wrong while handling that model action.",
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }
    }
    if (interaction.isButton() && interaction.customId.startsWith(input.moderationVetoPrefix)) {
      try {
        await input.handleModerationVeto(interaction);
      } catch (error) {
        console.error("Failed to handle moderation veto", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Something went wrong while applying that veto.",
            flags: MessageFlags.Ephemeral
          });
        }
      }
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith(input.honeypotVerifyPrefix)) {
      try {
        await input.handleHoneypotVerify(interaction);
      } catch (error) {
        console.error("Failed to handle honeypot verification", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Something went wrong while handling that verification.",
            flags: MessageFlags.Ephemeral
          });
        }
      }
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith(input.imageAddToPoolButtonPrefix)) {
      await input.generatedImageInteractionRuntime.handleAddToPoolButton(interaction);
      return;
    }
    if (interaction.isButton() && interaction.customId.startsWith(input.gifFrameDownloadPrefix)) {
      await input.handleGifFrameDownloadButton(interaction);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith(input.imageAddToPoolSelectPrefix)) {
      await input.generatedImageInteractionRuntime.handleAddToPoolSelect(interaction);
      return;
    }
    if (!interaction.isChatInputCommand()) {
      return;
    }
    if (interaction.member instanceof GuildMember) {
      try {
        await input.cacheGuildMember(interaction.member);
      } catch (error) {
        console.error("Failed to cache interacting member", error);
      }
    }
    try {
      await input.handleSlashCommand(interaction);
    } catch (error) {
      console.error("Failed to handle slash command", error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "Something went wrong while handling that command.",
            flags: MessageFlags.Ephemeral
          });
          return;
        }
        await interaction.reply({
          content: "Something went wrong while handling that command.",
          flags: MessageFlags.Ephemeral
        });
      } catch (responseError) {
        console.error("Failed to send slash command error response", responseError);
      }
    }
  }

  async function handleMessageCreate(message: Message) {
    if (message.guild && !message.author.bot) {
      input.runtimeState.recordGuildSignal(
        message.guild.id,
        "message",
        `${message.author.tag} posted in #${"name" in message.channel ? message.channel.name : "channel"}: ${input.summarizeText(message.content.trim() || "[attachment-only message]")}`
      );
    }
    if (message.member) {
      try {
        await input.cacheGuildMember(message.member);
      } catch (error) {
        console.error("Failed to cache message author", error);
      }
    }
    try {
      const blockedByModerationRole = await input.enforceModerationRoleRestrictions(message);
      if (blockedByModerationRole) {
        return;
      }
    } catch (error) {
      console.error("Failed to enforce investigation-role restrictions", error);
    }
    try {
      await input.duplicateSpamGuard.inspectMessage(message);
    } catch (error) {
      console.error("Failed to inspect message for moderation", error);
    }
    try {
      const offeredMediaActions = await input.maybeOfferMediaReactionActions(message);
      if (offeredMediaActions) {
        return;
      }
    } catch (error) {
      console.error("Failed to offer media reaction actions", error);
    }
    try {
      const respondedInChatMode = await input.maybeHandleChatModeMessage(message);
      if (respondedInChatMode) {
        return;
      }
    } catch (error) {
      console.error("Failed to handle chat mode reply", error);
    }
  }

  return {
    handleClientReady,
    handleGuildMemberAdd,
    handleGuildMemberRemove,
    handleInteractionCreate,
    handleMessageCreate
  };
}
