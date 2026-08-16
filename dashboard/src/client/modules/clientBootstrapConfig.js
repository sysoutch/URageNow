function createDashboardClientBootstrapConfig() {
  return {
    stageMeta: {
      ai: { kicker: "Rod Workspace", title: "LazyDev" },
      tools: { kicker: "URage Tools", title: "Tools" },
      "blender-addons": { kicker: "Blender", title: "3D Suites" },
      assets: { kicker: "Game Engines", title: "Assets" },
      dashboard: { kicker: "Messenger Control", title: "Dashboard" },
      messaging: { kicker: "Message Composer", title: "Messaging" },
      automation: { kicker: "Automations", title: "Automation" },
      guild: { kicker: "Community Setup", title: "Guild" },
      moderation: { kicker: "Moderation Rules", title: "Moderation" },
      messenger: { kicker: "Messaging Workspace", title: "Messaging" },
      dms: { kicker: "Direct Messages", title: "DMs" },
      activity: { kicker: "Runtime Log", title: "Activity" },
      profile: { kicker: "Bot Identity", title: "Profile" }
    },
    studioWorkflowSidebarMeta: {
      "ask-rod-card": {
        title: "Ask LazyDev",
        summary: "Chat, planning, and coding assistance with prompt presets."
      },
      "image-studio-card": {
        title: "Image Studio",
        summary: "Generate or edit images and keep prompt intent separated per output."
      },
      "model3d-studio-card": {
        title: "3D Model Studio",
        summary: "Create low poly variants, inspect meshes, and export validated assets."
      },
      "audio-studio-card": {
        title: "Audio Studio",
        summary: "Generate short audio clips from text prompts with optional posting."
      },
      "music-studio-card": {
        title: "Music Studio",
        summary: "Generate music tracks from tags and optional lyrics context."
      },
      "video-studio-card": {
        title: "Video Studio",
        summary: "Generate video outputs and track long-running generation progress."
      }
    },
    toolsWorkspaceState: {
      setActiveToolButton: null,
      activeFilter: "all",
      searchQuery: "",
      sidebarCollapsed: false,
      sidebarWidth: 238,
      favoriteToolIds: [],
      recentToolIds: []
    },
    toolsWorkspaceStorageKeys: {
      sidebarCollapsed: "urage-tools-workspace-sidebar-collapsed",
      sidebarWidth: "urage-tools-workspace-sidebar-width",
      favorites: "urage-tools-workspace-favorites",
      recent: "urage-tools-workspace-recent"
    },
    toolQuickActionStorageKeys: {
      imagePinned: "urage-tool-quick-actions-image-pinned",
      modelPinned: "urage-tool-quick-actions-model-pinned",
      videoPinned: "urage-tool-quick-actions-video-pinned",
      imageSelected: "urage-tool-quick-actions-image-selected",
      modelSelected: "urage-tool-quick-actions-model-selected",
      videoSelected: "urage-tool-quick-actions-video-selected",
      imageSelectedExplicit: "urage-tool-quick-actions-image-selected-explicit",
      modelSelectedExplicit: "urage-tool-quick-actions-model-selected-explicit",
      videoSelectedExplicit: "urage-tool-quick-actions-video-selected-explicit",
      imagePickerTab: "urage-tool-quick-actions-image-picker-tab",
      modelPickerTab: "urage-tool-quick-actions-model-picker-tab"
    },
    toolQuickActionState: {
      imagePinnedIds: [],
      modelPinnedIds: [],
      videoPinnedIds: [],
      imageSelectedId: "",
      modelSelectedId: "",
      videoSelectedId: "",
      imageSelectedExplicit: false,
      modelSelectedExplicit: false,
      videoSelectedExplicit: false,
      imagePickerTab: "web",
      modelPickerTab: "web"
    },
    studioRailExpandedStorageKey: "urage-studio-rail-expanded",
    studioRailHoverModeStorageKey: "urage-studio-rail-hover-mode",
    studioWorkflowSidebarModeStorageKey: "urage-studio-workflow-sidebar-mode",
    workflowRightSidebarStateStorageKey: "urage-workflow-right-sidebar-collapsed",
    workflowRightSidebarWidthStorageKey: "urage-workflow-right-sidebar-width",
    workflowRightSidebarTargets: ["ask", "model3d", "image", "audio", "music", "video"]
  };
}
