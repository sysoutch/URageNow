function createDashboardClientSharedBootstrapHelpers(input) {
  const dashboardPresentationHelpers = createDashboardPresentationHelpers();
  const dashboardMediaArtifactHelpers = createDashboardMediaArtifactHelpers({
    setModel3dStatus: text => input.setModel3dStatus(text),
    setOutput: dashboardPresentationHelpers.setOutput
  });
  let dashboardImageTransferHelpers = null;
  function getDashboardImageTransferHelpers() {
    if (dashboardImageTransferHelpers) {
      return dashboardImageTransferHelpers;
    }
    dashboardImageTransferHelpers = createDashboardImageTransferHelpers({
      filesToAiImages: typeof input.getFilesToAiImages === "function" ? input.getFilesToAiImages() : input.filesToAiImages,
      parseImageTextInputs: typeof input.getParseImageTextInputs === "function" ? input.getParseImageTextInputs() : input.parseImageTextInputs,
      setOutput: dashboardPresentationHelpers.setOutput
    });
    return dashboardImageTransferHelpers;
  }
  return {
    dashboardPresentationHelpers,
    escapeHtml: dashboardPresentationHelpers.escapeHtml,
    renderMarkdownHtml: dashboardPresentationHelpers.renderMarkdownHtml,
    renderMarkdownInto: dashboardPresentationHelpers.renderMarkdownInto,
    setOutput: dashboardPresentationHelpers.setOutput,
    formatDateTime: dashboardPresentationHelpers.formatDateTime,
    clearChildren: dashboardPresentationHelpers.clearChildren,
    setElementValue: dashboardPresentationHelpers.setElementValue,
    setElementChecked: dashboardPresentationHelpers.setElementChecked,
    dashboardMediaArtifactHelpers,
    getModel3dFileUrl: dashboardMediaArtifactHelpers.getModel3dFileUrl,
    getGeneratedImageFileUrl: dashboardMediaArtifactHelpers.getGeneratedImageFileUrl,
    getGeneratedAudioFileUrl: dashboardMediaArtifactHelpers.getGeneratedAudioFileUrl,
    getGeneratedVideoFileUrl: dashboardMediaArtifactHelpers.getGeneratedVideoFileUrl,
    buildAbsoluteDashboardUrl: dashboardMediaArtifactHelpers.buildAbsoluteDashboardUrl,
    downloadModel3dArtifact: dashboardMediaArtifactHelpers.downloadModel3dArtifact,
    getDashboardImageTransferHelpers,
    collectPastedImages(...args) {
      return getDashboardImageTransferHelpers().collectPastedImages(...args);
    },
    collectDroppedImages(...args) {
      return getDashboardImageTransferHelpers().collectDroppedImages(...args);
    }
  };
}
