function createDashboardCollectionState() {
  return {
    guilds: [],
    channels: [],
    users: [],
    roles: [],
    dmThreads: [],
    dmMessages: [],
    botMessages: [],
    scheduledAutomations: [],
    joinAutomations: [],
    automationPresets: [],
    automationTextSources: [],
    imagePools: [],
    commandDefinitions: [],
    globalEnabledCommands: [],
    guildEnabledCommands: [],
    guildDisabledInheritedCommands: [],
    ollamaModels: [],
    ollamaModelProviders: [],
    generatedModels: [],
    generatedImages: [],
    generatedAudios: [],
    generatedVideos: [],
    mediaConverterGifs: [],
    chatSkills: [],
    aiImages: [],
    askSkillModelUploads: [],
    askFileUploads: [],
    askAudioUploads: [],
    moderationTestImages: [],
    guildInvites: [],
    messengerRuntimes: [],
    messengerRuntimeEvents: [],
    telegramChats: []
  };
}

function createDashboardSelectionState() {
  return {
    channelsGuildId: "",
    selectedUser: null,
    selectedGeneratedModelId: "",
    selectedGeneratedModelIds: [],
    selectedGeneratedImageId: "",
    selectedGeneratedImageIds: [],
    selectedGeneratedAudioId: "",
    selectedGeneratedAudioIds: [],
    selectedGeneratedMusicId: "",
    selectedGeneratedMusicIds: [],
    selectedGeneratedVideoId: "",
    selectedGeneratedVideoIds: [],
    selectedAskSkillId: "",
    selectedSkillEditorId: "",
    selectedGuildId: "",
    selectedChannelId: "",
    selectedUserId: "",
    selectedBotMessageId: "",
    selectedDmChannelId: "",
    selectedRoleId: "",
    selectedImagePoolId: "",
    selectedScheduledAutomationId: "",
    selectedJoinAutomationId: "",
    selectedInviteCode: "",
    selectedMessenger: "discord",
    selectedTelegramChatId: "",
    selectedMatrixRoomId: "",
    selectedWhatsAppRecipient: "",
    matrixRooms: [],
    whatsappRecipients: []
  };
}

function createDashboardWorkflowUiState() {
  return {
    aiHomeMode: "workflow",
    aiFocusedSectionId: "",
    aiWorkflowSidebarVisible: false,
    aiWorkflowSidebarMode: "floaty",
    aiWorkflowSidebarWidth: 280,
    aiWorkflowDataLoaded: { ask: false, model3d: false, image: false, audio: false, music: false, video: false },
    imagePoolDataLoaded: false,
    workflowRightSidebarCollapsed: { ask: false, model3d: false, image: false, audio: false, music: false, video: false },
    workflowRightSidebarWidth: { ask: 360, model3d: 380, image: 340, audio: 332, music: 332, video: 340 },
    model3dStudioTab: "generate",
    model3dGenerateWorkflow: "single-image",
    model3dSourceTab: "upload",
    model3dEditTargetMode: "selected",
    model3dSelectedPoolSources: [],
    imageStudioTab: "generate",
    audioStudioTab: "sfx",
    studioRailExpanded: false,
    studioRailHoverMode: "temp-expand",
    detailTab: "current",
    guildSubview: "guild-overview",
    moderationSubview: "moderation-rules",
    automationPanel: "scheduled",
    scheduleMode: "basic",
    scheduledTriggerMode: "cron",
    detailPaneVisible: true,
    workspacePaneVisible: true,
    collapsedChannelGroups: {},
    draggingSidebarItem: null,
    dashboardTheme: "fire",
    messengerThemeConfigs: {},
    appliedThemeVariableNames: []
  };
}

function createDashboardModel3dViewerState() {
  return {
    model3dInspectionByKey: {},
    model3dThreeVariant: "original",
    model3dViewerWireframeEnabled: false,
    // Preserve each imported model's authored PBR material by default. The
    // Metal control is an explicit viewport override, not the baseline view.
    model3dViewerMetallicEnabled: false,
    model3dViewerRoughness: 0.5,
    model3dViewerTextureEnabled: true,
    model3dViewerMaterialMode: "textured",
    model3dViewerFlatShadingEnabled: false,
    model3dViewerGridEnabled: true,
    model3dViewerSkyboxEnabled: false,
    model3dViewerRigVisible: false,
    model3dViewerAxisMode: "gameengine",
    model3dPreviewRenderMode: "current",
    model3dPreviewProjection: "current",
    model3dAutoRigVerification: null
  };
}

function createDashboardDiscordSettingsState() {
  return {
    guildPermissions: null,
    channelPermissions: null,
    guildChannelPlan: null,
    channelSettings: null,
    channelSettingsTab: "discord",
    inviteLink: "",
    scheduledTargetMessenger: "discord",
    scheduledTargetChannelId: "",
    joinTargetChannelId: "",
    antiSpamImageScanChannelIds: [],
    antiSpamExcludedChannelIds: [],
    antiSpamExcludedRoleIds: [],
    antiSpamAlertChannelId: "",
    honeypotEnabled: false,
    honeypotChannelId: "",
    honeypotTriggerOnText: true,
    honeypotTriggerOnFiles: true,
    honeypotTriggerOnLinks: true,
    honeypotImmediateAction: "timeout",
    honeypotTimeoutMinutes: 10080,
    honeypotRemoveMessage: true,
    protectedUserIds: [],
    protectedRoleIds: [],
    honeypotExcludedChannelIds: [],
    honeypotExcludedRoleIds: [],
    honeypotBackupChannelId: "",
    honeypotDmEnabled: true,
    honeypotDmMessage: "",
    honeypotReviewChannelId: "",
    honeypotPostVerifyAction: "remove-timeout",
    honeypotVerificationWindowDays: 7,
    honeypotUnverifiedAction: "ban",
    investigationRoleId: "",
    temporaryImageBlockRoleId: "",
    memberCounterChannelId: "",
    memberCounterTemplate: "Members: {count}",
    botMode: "normal",
    botActingPreset: "user",
    botSafetyRequireMentionOrReply: true,
    botSafetySuggestOnly: true,
    botSafetyAllowChatSelfTasks: false,
    botSafetyChatSelfTasksAdminOnly: true,
    botSafetyChatSelfTaskMinConfidence: 85,
    botSafetyAllowRoleSuggestions: false,
    botSafetyAllowChannelSuggestions: false,
    botSafetyAllowPromotionSuggestions: false,
    autonomousStatusChannelId: "",
    autonomousHeartbeatEnabled: false,
    autonomousHeartbeatMinutes: 30,
    autonomousReplyToMentions: true,
    imagePoolVerifiedRoleIds: [],
    imagePoolVerifiedUserIds: [],
    selfTaskDryRunOnly: false,
    selfTaskAllowedActionTypes: ["create_channel", "send_message", "create_thread", "create_post", "edit_bot_message", "create_role", "set_channel_role_permissions", "rename_role", "assign_roles", "assign_role", "remove_roles", "remove_role", "move_channel", "rename_channel", "update_channel_settings", "list_roles", "list_channels", "list_members", "list_invites", "create_invite", "delete_invite", "replace_invite", "set_channel_slowmode", "archive_thread", "lock_thread", "set_welcome_channel", "set_welcome_message", "set_member_counter", "set_chat_mode", "explain_channel_permissions"],
    chatModeChannels: {},
    chatModeDebug: null
  };
}

function createDashboardRuntimeState() {
  return {
    globalSettings: null,
    botSnapshot: null,
    runtimeActions: [],
    moderationEvents: []
  };
}

function createDashboardClientState() {
  return {
    ...createDashboardCollectionState(),
    ...createDashboardSelectionState(),
    ...createDashboardWorkflowUiState(),
    ...createDashboardModel3dViewerState(),
    ...createDashboardDiscordSettingsState(),
    ...createDashboardRuntimeState()
  };
}
