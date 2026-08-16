function createDashboardToolExportContext(input) {
  function readCurrentModelAsset(frameNode) {
    const targetWindow = frameNode?.contentWindow || null;
    if (!targetWindow) return null;
    try {
      if (typeof targetWindow.__urageToolDescribeCurrentAsset === "function") {
        const described = targetWindow.__urageToolDescribeCurrentAsset();
        return described && typeof described === "object" ? described : null;
      }
    } catch {}
    try {
      const fallback = targetWindow.__urageThreeModelViewerCurrentAsset;
      return fallback && typeof fallback === "object" ? fallback : null;
    } catch {
      return null;
    }
  }

  async function readCurrentAssetDescriptors(frameNode) {
    const targetWindow = frameNode?.contentWindow || null;
    if (!targetWindow) return [];
    try {
      if (typeof targetWindow.__urageToolDescribeCurrentAssets === "function") {
        const described = await Promise.resolve(targetWindow.__urageToolDescribeCurrentAssets());
        return Array.isArray(described) ? described.filter(asset => asset && typeof asset === "object") : described && typeof described === "object" ? [described] : [];
      }
    } catch {}
    try {
      if (typeof targetWindow.__urageToolDescribeCurrentAsset === "function") {
        const described = await Promise.resolve(targetWindow.__urageToolDescribeCurrentAsset());
        return Array.isArray(described) ? described.filter(asset => asset && typeof asset === "object") : described && typeof described === "object" ? [described] : [];
      }
    } catch {}
    return [];
  }

  function buildModelContext(entry, frameNode) {
    const asset = readCurrentModelAsset(frameNode);
    if (!asset || !asset.modelUrl) {
      return {
        entry,
        resourceKind: "model3d",
        sourceName: entry.title || "3D Model Viewer",
        sourceDetail: "Load a dashboard model into the 3D viewer first.",
        preview: {
          kind: "placeholder",
          label: "No loaded dashboard model",
          hint: "Models opened directly from local files cannot be queued to the dashboard engine exporter yet."
        },
        toolCandidates: [],
        sendToToolSupported: false,
        sendToToolReason: "This tool does not expose a sendable processed result.",
        sendToEngineSupported: false,
        sendToEngineReason: "Load a dashboard model into the 3D viewer first."
      };
    }
    return input.buildContextFromOptions(entry, [{
      entry,
      resourceKind: "model3d",
      sourceName: String(asset.modelFileName || entry.title || "Current 3D Model").trim() || "Current 3D Model",
      sourceDetail: "Using the 3D model currently loaded in the viewer.",
      preview: asset.previewImageUrl
        ? {
          kind: "image",
          url: input.buildAbsoluteUrl(asset.previewImageUrl),
          label: String(asset.previewFileName || asset.modelFileName || "Model Preview").trim() || "Model Preview"
        }
        : {
          kind: "placeholder",
          label: String(asset.modelFileName || "Loaded 3D Model").trim() || "Loaded 3D Model",
          hint: "This model will be queued directly for the selected engine importer."
        },
      toolCandidates: [],
      sendToToolSupported: false,
      sendToToolReason: "3D viewer sends are handled through the game engine export tab.",
      sendToEngineSupported: true,
      modelAsset: asset
    }], input.getSelectedResourceId());
  }

  async function buildImageToolContext(entry, frameNode, inferredContext, inferredContexts) {
    try {
      const exported = await input.requestProcessedImage(frameNode, entry, 6000);
      if (!exported || !exported.dataUrl) throw new Error("This tool did not return an image to send.");
      const toolCandidates = input.getSendCandidates(entry);
      return input.buildContextFromOptions(entry, [{
        entry,
        resourceKind: "image",
        sourceName: String(exported.fileName || entry.title || "Tool Output").trim() || "Tool Output",
        sourceDetail: "Using the current processed image from the active tool.",
        preview: {
          kind: "image",
          url: String(exported.dataUrl || "").trim(),
          label: String(exported.fileName || "Tool Output").trim() || "Tool Output"
        },
        exportedImage: exported,
        toolCandidates,
        sendToToolSupported: toolCandidates.length > 0,
        sendToToolReason: toolCandidates.length > 0 ? "" : "No other compatible image tools are available right now.",
        sendToEngineSupported: true
      }], input.getSelectedResourceId());
    } catch (error) {
      if (inferredContext && inferredContext.sendToEngineSupported) {
        return input.buildContextFromOptions(entry, inferredContexts.filter(context => context && context.sendToEngineSupported), input.getSelectedResourceId()) || inferredContext;
      }
      const detail = error && error.message ? error.message : "This tool did not expose a sendable image.";
      return {
        entry,
        resourceKind: "image",
        sourceName: entry.title || "Image Tool",
        sourceDetail: detail,
        preview: {kind: "placeholder", label: entry.title || "Image Tool", hint: detail},
        toolCandidates: [],
        sendToToolSupported: false,
        sendToToolReason: detail,
        sendToEngineSupported: false,
        sendToEngineReason: detail
      };
    }
  }

  async function build(entry) {
    const frameNode = document.getElementById("tools-workspace-frame");
    if (!entry || !frameNode) return null;
    const describedAssets = await readCurrentAssetDescriptors(frameNode);
    const describedContext = input.buildContextFromOptions(entry, describedAssets.map(asset => input.normalizeDescriptor(asset, entry)).filter(context => context && (context.sendToEngineSupported || context.sendToToolSupported)), input.getSelectedResourceId());
    if (describedContext && (describedContext.sendToEngineSupported || describedContext.sendToToolSupported)) return describedContext;
    if (input.isModelViewer(entry.sourcePath)) return buildModelContext(entry, frameNode);

    const inferredDescriptors = input.inferDescriptors(frameNode, entry);
    const inferredContexts = inferredDescriptors.map(descriptor => input.normalizeDescriptor(descriptor, entry)).filter(Boolean);
    const inferredContext = inferredContexts[0] || null;
    const shouldUseInferredContextFirst = inferredContext && inferredContext.sendToEngineSupported && String(inferredDescriptors[0]?.metadata?.inferenceSource || "").trim() !== "image-element";
    if (shouldUseInferredContextFirst) {
      return input.buildContextFromOptions(entry, inferredContexts.filter(context => context && context.sendToEngineSupported), input.getSelectedResourceId()) || inferredContext;
    }
    if (input.isImageTool(entry.sourcePath) && !input.isGifViewer(entry.sourcePath)) {
      return buildImageToolContext(entry, frameNode, inferredContext, inferredContexts);
    }
    if (inferredContext && inferredContext.sendToEngineSupported) {
      return input.buildContextFromOptions(entry, inferredContexts.filter(context => context && context.sendToEngineSupported), input.getSelectedResourceId()) || inferredContext;
    }
    if (inferredContext) {
      return input.buildContextFromOptions(entry, inferredContexts.map(context => ({
        ...context,
        sendToToolSupported: false,
        sendToToolReason: context.sendToToolReason || "This inferred tool resource cannot be sent into another tool directly yet."
      })), input.getSelectedResourceId()) || {
        ...inferredContext,
        sendToToolSupported: false,
        sendToToolReason: inferredContext.sendToToolReason || "This inferred tool resource cannot be sent into another tool directly yet."
      };
    }
    return {
      entry,
      resourceKind: "unsupported",
      sourceName: entry.title || "Unsupported Tool",
      sourceDetail: "This tool does not expose a sendable dashboard resource yet.",
      preview: {kind: "placeholder", label: entry.title || "Unsupported Tool", hint: "Try exporting or generating a processed result inside the tool first."},
      toolCandidates: [],
      sendToToolSupported: false,
      sendToToolReason: "This tool does not expose a sendable dashboard resource yet.",
      sendToEngineSupported: false,
      sendToEngineReason: "This tool does not expose a sendable dashboard resource yet."
    };
  }

  return {build, readCurrentAssetDescriptors, readCurrentModelAsset};
}
