import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction
} from "discord.js";

type PendingSelfTaskBatch = {
  id: string;
  createdAt: string;
  actions: unknown[];
  [key: string]: unknown;
};

type SlashCommandHandlerServiceDependencies = {
  isCommandEnabled: (guildId: string | null, commandName: string) => boolean;
  handleHelpCommand: (interaction: ChatInputCommandInteraction) => Promise<void>;
  handleAdminCoreSlashCommands: (interaction: ChatInputCommandInteraction, context: any) => Promise<boolean>;
  adminCoreContext: any;
  tryAnswerCachedGuildFactQuestion: (input: {
    guild: NonNullable<ChatInputCommandInteraction["guild"]>;
    content: string;
    authorId: string;
  }) => Promise<string | null>;
  summarizeText: (value: string, maxLength?: number) => string;
  buildMemberPromptContext: (member: GuildMember | null | undefined) => string | null;
  askText: (prompt: string) => Promise<string>;
  replyWithChunks: (interaction: ChatInputCommandInteraction, content: string) => Promise<void>;
  handleMediaAndUtilitySlashCommands: (interaction: ChatInputCommandInteraction, context: any) => Promise<boolean>;
  mediaAndUtilityContext: any;
  buildPendingSelfTaskBatch: (interaction: ChatInputCommandInteraction, requestText: string) => Promise<any>;
  pendingSelfTaskBatches: Map<string, any>;
  buildSelfTaskEmbed: (batch: any) => any;
  selfTaskApprovePrefix: string;
  selfTaskCancelPrefix: string;
  recordAction: (type: string, summary: string) => void;
};

type SlashCommandHandlerService = {
  handleSlashCommand: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export function createSlashCommandHandlerService(dependencies: SlashCommandHandlerServiceDependencies): SlashCommandHandlerService {
  function hasPrivilegedGuildPermissions(interaction: ChatInputCommandInteraction): boolean {
    if (!interaction.inGuild()) {
      return false;
    }
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
      || interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
      || false;
  }
  async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!dependencies.isCommandEnabled(interaction.guildId, interaction.commandName)) {
      await interaction.reply({ content: "That command is disabled here.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.commandName === "help") {
      await dependencies.handleHelpCommand(interaction);
      return;
    }
    if (!hasPrivilegedGuildPermissions(interaction)) {
      await interaction.reply({ content: "You are not allowed to use that here.", flags: MessageFlags.Ephemeral });
      return;
    }
    const handledAdminCore = await dependencies.handleAdminCoreSlashCommands(interaction, dependencies.adminCoreContext);
    if (handledAdminCore) {
      return;
    }
    if (interaction.commandName === "ask") {
      const prompt = interaction.options.getString("prompt", true).trim();
      if (interaction.guild) {
        const cachedFactAnswer = await dependencies.tryAnswerCachedGuildFactQuestion({ guild: interaction.guild, content: prompt, authorId: interaction.user.id });
        if (cachedFactAnswer) {
          dependencies.recordAction("slash:/ask-cache", `${interaction.user.tag}: ${dependencies.summarizeText(prompt)}`);
          await interaction.reply({ content: cachedFactAnswer, flags: MessageFlags.Ephemeral });
          return;
        }
      }
      await interaction.deferReply();
      const memberContext = interaction.member instanceof GuildMember ? dependencies.buildMemberPromptContext(interaction.member) : null;
      const contextualPrompt = ["You are LazyDev replying inside a Discord server.", `Member: ${interaction.user.tag}`, memberContext ? `Member context: ${memberContext}` : null, `Prompt: ${prompt}`].filter(Boolean).join("\n");
      const response = await dependencies.askText(contextualPrompt);
      dependencies.recordAction("slash:/ask", `${interaction.user.tag}: ${dependencies.summarizeText(prompt)}`);
      await dependencies.replyWithChunks(interaction, response);
      return;
    }
    const handledMediaOrUtility = await dependencies.handleMediaAndUtilitySlashCommands(interaction, dependencies.mediaAndUtilityContext);
    if (handledMediaOrUtility) {
      return;
    }
    if (interaction.commandName === "task") {
      if (!interaction.guildId) {
        await interaction.reply({ content: "Use `/task` inside a server.", flags: MessageFlags.Ephemeral });
        return;
      }
      const requestText = interaction.options.getString("prompt", true).trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const batch = await dependencies.buildPendingSelfTaskBatch(interaction, requestText);
      dependencies.pendingSelfTaskBatches.set(batch.id, batch);
      if (dependencies.pendingSelfTaskBatches.size > 25) {
        const oldest = [...dependencies.pendingSelfTaskBatches.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
        if (oldest) {
          dependencies.pendingSelfTaskBatches.delete(oldest.id);
        }
      }
      dependencies.recordAction("slash:/task", `${interaction.user.tag}: ${dependencies.summarizeText(requestText)}`);
      await interaction.editReply({
        embeds: [dependencies.buildSelfTaskEmbed(batch)],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`${dependencies.selfTaskApprovePrefix}${batch.id}`).setLabel("Approve").setStyle(ButtonStyle.Success).setDisabled(batch.actions.length === 0),
          new ButtonBuilder().setCustomId(`${dependencies.selfTaskCancelPrefix}${batch.id}`).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
        )]
      });
      return;
    }
    await interaction.reply({ content: `Command \`/${interaction.commandName}\` is not ported yet.`, flags: MessageFlags.Ephemeral });
  }

  return {
    handleSlashCommand
  };
}
