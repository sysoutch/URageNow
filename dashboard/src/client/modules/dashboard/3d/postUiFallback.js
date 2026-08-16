function createDashboardThreeDPostUiFallback() {
  return {
    updateModel3dPostOptionsUi() {},
    syncLowPolyPresetFromFaceCount() {},
    applyLowPolyPresetToFaceCount() {},
    readModel3dPostOptions() {
      return {
        postMessenger: "none",
        postDestinationId: "",
        postToChannel: false,
        postTargetMode: "channel",
        threadNameMode: "fixed",
        threadName: "",
        threadNameBase: "",
        modelNameSource: "llm",
        forumChannelId: "",
        forumChannelName: "",
        lowPolyForumChannelId: "",
        lowPolyForumChannelName: "",
        sendInitialToSelectedChannel: false,
        initialExtraText: "",
        destinationExtraText: "",
        modelUploadTarget: "selected",
        includeModelFile: true,
        includePreviewMedia: true,
        includeEmbed: true,
        includeEmbedInInitial: true,
        includeButtons: true,
        uploadTextureMessages: false,
        textureUploadTarget: "target",
        uploadMultiViewTextures: true,
        uploadUvMapTextures: true,
        uploadNormalMapTextures: true,
        generateLowPolyVersion: false,
        lowPolyExecutionTarget: "local",
        lowPolyUseLlmTargetFaces: false,
        lowPolyLlmDecisionSource: "input-image",
        lowPolyTargetFaceCount: 1500
      };
    },
    async refreshModel3dPostDestinationOptions() {},
    validateModel3dPostOptions() {
      return "";
    }
  };
}
