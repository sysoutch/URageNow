function createDashboardToolExportSubmission(input) {
  const state = input.state;

  function setOverlayStatus(text) {
    const statusNode = document.getElementById("tools-workspace-export-status");
    if (statusNode) statusNode.textContent = text;
    input.setStatus(text);
  }

  async function submitToLazyDev(context) {
    const target = document.getElementById("tools-workspace-export-lazydev-target")?.value === "model3d" ? "model3d" : "image";
    setOverlayStatus("Importing current tool image into LazyDev...");
    const importedImages = await input.sendImageToLazyDev(context, target);
    input.closeOverlay();
    input.setOutput("Sent " + importedImages.length + " image" + (importedImages.length === 1 ? "" : "s") + " to " + (target === "model3d" ? "3D Model Studio" : "Image Studio") + ".");
  }

  async function submitToTool(context) {
    const targetId = String(document.getElementById("tools-workspace-export-tool-target")?.value || "").trim();
    const targetEntry = Array.isArray(context.toolCandidates) ? context.toolCandidates.find(candidate => candidate.id === targetId) || null : null;
    if (!targetEntry || !context.exportedAsset) {
      throw new Error(context.sendToToolReason || "Select a target tool first.");
    }
    setOverlayStatus("Opening " + targetEntry.title + "...");
    const asset = context.exportedAsset;
    await input.sendAssetToTool(targetEntry, {
      kind: asset.kind || context.resourceKind,
      dataUrl: String(asset.dataUrl || "").trim() || undefined,
      sourceUrl: String(asset.sourceUrl || "").trim() || undefined,
      url: String(asset.sourceUrl || "").trim() || undefined,
      imageFileName: String(asset.fileName || "tool-output").trim() || "tool-output",
      fileName: String(asset.fileName || "tool-output").trim() || "tool-output",
      width: asset.width || undefined,
      height: asset.height || undefined,
      prompt: ""
    }, {switchView: true});
    input.closeOverlay();
    input.setOutput("Sent " + (context.sourceName || "tool result") + " to " + targetEntry.title + ".");
  }

  function buildSourceMetadata(context, metadata) {
    return {
      ...(metadata || {}),
      sourceToolId: String(context.entry?.id || "").trim(),
      sourceToolTitle: String(context.entry?.title || "").trim()
    };
  }

  async function queueImage(context, engine, customTitle) {
    const descriptor = context.assetDescriptor || null;
    if (!context.exportedImage?.dataUrl && !descriptor?.sourceUrl && !descriptor?.dataUrl) {
      throw new Error(context.sendToEngineReason || "This tool did not expose an image to queue.");
    }
    if (context.exportedImage?.dataUrl) {
      setOverlayStatus("Importing current tool image...");
      const imported = await input.request("/api/image-import", {
        dataUrl: String(context.exportedImage.dataUrl || "").trim(),
        fileName: String(context.exportedImage.fileName || "tool-output.png").trim() || "tool-output.png",
        prompt: "",
        width: context.exportedImage.width || undefined,
        height: context.exportedImage.height || undefined,
        model: String(context.entry?.title || "Tool Workspace").trim() || "Tool Workspace"
      });
      setOverlayStatus("Queueing " + input.getEngineLabel(engine) + " export...");
      await input.request("/api/game-engine-export", {
        engine,
        sourceStudio: "tools",
        resourceKind: "image",
        title: customTitle || imported.imageFileName || context.sourceName,
        fileName: imported.imageFileName,
        mimeType: input.inferMimeType(imported.imageFileName, "image/png"),
        sourceUrl: input.buildAbsoluteUrl(input.getGeneratedImageFileUrl(imported.id, imported.imageFileName)),
        metadata: buildSourceMetadata(context)
      });
      return;
    }
    let sourceUrl = String(descriptor?.sourceUrl || "").trim();
    let dataUrl = String(descriptor?.dataUrl || "").trim();
    if (!dataUrl && /^blob:/i.test(sourceUrl)) {
      dataUrl = await input.readBlobSourceAsDataUrl(sourceUrl);
      sourceUrl = "";
    }
    setOverlayStatus("Queueing " + input.getEngineLabel(engine) + " export...");
    await input.request("/api/game-engine-export", {
      engine,
      sourceStudio: "tools",
      resourceKind: "image",
      title: customTitle || descriptor?.title || context.sourceName,
      fileName: descriptor?.fileName || context.sourceName || "tool-image.png",
      mimeType: descriptor?.mimeType || input.inferMimeType(descriptor?.fileName, "image/png"),
      sourceUrl: sourceUrl || undefined,
      dataUrl: dataUrl || undefined,
      metadata: buildSourceMetadata(context, descriptor?.metadata)
    });
  }

  async function queueDescriptor(context, engine, customTitle) {
    const descriptor = context.assetDescriptor;
    if (descriptor.resourceKind === "text" && !descriptor.textContent) {
      throw new Error(context.sendToEngineReason || "This tool did not expose any text to queue.");
    }
    if (descriptor.resourceKind !== "text" && !descriptor.sourceUrl && !descriptor.dataUrl) {
      throw new Error(context.sendToEngineReason || "This tool did not expose a queueable source URL.");
    }
    let sourceUrl = String(descriptor.sourceUrl || "").trim();
    let dataUrl = String(descriptor.dataUrl || "").trim();
    if (!dataUrl && /^blob:/i.test(sourceUrl)) {
      dataUrl = await input.readBlobSourceAsDataUrl(sourceUrl);
      sourceUrl = "";
    }
    setOverlayStatus("Queueing " + input.getEngineLabel(engine) + " export...");
    await input.request("/api/game-engine-export", {
      engine,
      sourceStudio: "tools",
      resourceKind: descriptor.resourceKind,
      title: customTitle || descriptor.title || context.sourceName,
      fileName: descriptor.fileName || context.sourceName,
      mimeType: descriptor.mimeType || input.inferMimeType(descriptor.fileName, ""),
      sourceUrl: sourceUrl || undefined,
      dataUrl: dataUrl || undefined,
      textContent: descriptor.textContent || undefined,
      metadata: buildSourceMetadata(context, descriptor.metadata)
    });
  }

  async function queueModel(context, engine, customTitle) {
    const asset = context.modelAsset;
    if (!asset || !asset.modelUrl) {
      throw new Error(context.sendToEngineReason || "Load a dashboard model into the 3D viewer first.");
    }
    setOverlayStatus("Queueing " + input.getEngineLabel(engine) + " export...");
    await input.request("/api/game-engine-export", {
      engine,
      sourceStudio: "tools",
      resourceKind: "model3d",
      title: customTitle || asset.modelFileName || context.sourceName,
      fileName: asset.modelFileName,
      mimeType: input.inferMimeType(asset.modelFileName, "model/gltf-binary"),
      sourceUrl: input.buildAbsoluteUrl(asset.modelUrl),
      metadata: buildSourceMetadata(context)
    });
  }

  async function submitToGameEngine(context) {
    const engine = String(document.getElementById("tools-workspace-export-engine-target")?.value || "").trim() || "unity";
    const customTitle = String(document.getElementById("tools-workspace-export-engine-title")?.value || "").trim();
    input.writePreferredEngine(engine);
    if (context.resourceKind === "image") {
      await queueImage(context, engine, customTitle);
      input.closeOverlay();
      input.setOutput("Queued " + (context.sourceName || "tool image") + " for " + input.getEngineLabel(engine) + ".");
      return;
    }
    if (context.assetDescriptor && context.assetDescriptor.resourceKind !== "model3d") {
      await queueDescriptor(context, engine, customTitle);
      input.closeOverlay();
      const descriptor = context.assetDescriptor;
      input.setOutput("Queued " + (descriptor.fileName || descriptor.title || context.sourceName || "tool resource") + " for " + input.getEngineLabel(engine) + ".");
      return;
    }
    if (context.resourceKind === "model3d") {
      await queueModel(context, engine, customTitle);
      input.closeOverlay();
      input.setOutput("Queued " + (context.modelAsset.modelFileName || context.sourceName || "3D model") + " for " + input.getEngineLabel(engine) + ".");
      return;
    }
    throw new Error(context.sendToEngineReason || "No exportable tool output was found yet. Create or select an output first.");
  }

  async function submit() {
    const context = state.context;
    if (!context) return;
    state.loading = true;
    input.updateUi();
    const submitButton = document.getElementById("tools-workspace-export-submit-button");
    if (submitButton) submitButton.disabled = true;
    try {
      if (state.activeTab === "lazydev") await submitToLazyDev(context);
      else if (state.activeTab === "tool") await submitToTool(context);
      else await submitToGameEngine(context);
    } catch (error) {
      setOverlayStatus(error && error.message ? error.message : "Failed to send tool resource.");
    } finally {
      state.loading = false;
      input.updateUi();
    }
  }

  return {submit};
}
