function createDashboardImageGenerationOrchestrator(dependencies) {
  const {
    app,
    editSources,
    form,
    generation,
    history,
    postTargets,
    preview,
    workflow
  } = dependencies;

  async function generate(options) {
    const requestedOptions = options || {};
    const isEditMode = app.state.imageStudioTab === "edit";
    const hasPromptOverride = Object.prototype.hasOwnProperty.call(requestedOptions, "promptOverride");
    const hasPromptTextFileOverride = Object.prototype.hasOwnProperty.call(requestedOptions, "promptTextFileOverride");
    const hasAutoPromptOverride = Object.prototype.hasOwnProperty.call(requestedOptions, "autoPromptOverride");
    const prompt = hasPromptOverride
      ? String(requestedOptions.promptOverride || "").trim()
      : document.getElementById("imagegen-prompt").value.trim();
    const promptTextFile = hasPromptTextFileOverride
      ? String(requestedOptions.promptTextFileOverride || "").trim()
      : (document.getElementById("imagegen-prompt-text-file")?.value || "");
    const promptTextSelectionMode = document.getElementById("imagegen-prompt-text-no-repeat")?.checked === true ? "no-repeat" : "random";
    const negativePrompt = document.getElementById("imagegen-negative-prompt")?.value.trim() || "";
    const autoPrompt = hasAutoPromptOverride
      ? requestedOptions.autoPromptOverride === true
      : document.getElementById("imagegen-auto-prompt").checked;
    const autoFileName = document.getElementById("imagegen-auto-filename")?.checked === true;
    const autoDescription = document.getElementById("imagegen-auto-description")?.checked === true;
    const autoFileNameTiming = document.getElementById("imagegen-auto-filename-timing")?.value === "before"
      ? "before"
      : (document.getElementById("imagegen-auto-filename-timing")?.value === "parallel" ? "parallel" : "after");
    const width = form.readOptionalNumberInput("imagegen-width", { min: 64, max: 4096 });
    const height = form.readOptionalNumberInput("imagegen-height", { min: 64, max: 4096 });
    const steps = form.readOptionalNumberInput("imagegen-steps", { min: 1, max: 250 });
    const cfg = form.readOptionalNumberInput("imagegen-cfg", { min: 0, max: 30, float: true });
    const overwriteImageId = String(requestedOptions.overwriteImageId || "").trim();
    const requestedCount = typeof requestedOptions.count === "number"
      ? Math.max(1, Math.min(8, Math.round(requestedOptions.count)))
      : form.readGenerateCount(["image-generate-count", "imagegen-batch-size"], { max: 8 });
    const generationCount = overwriteImageId ? 1 : requestedCount;
    const sources = isEditMode ? editSources.getExecutionSources() : [];
    const imageInput = isEditMode ? String(sources[0]?.value || "").trim() : "";
    const postTarget = postTargets.get("imagegen", "images");
    if (postTarget.error) {
      return void app.setOutput(postTarget.error);
    }
    const discordChannelId = postTarget.messenger === "discord" ? postTarget.destinationId : "";
    if (isEditMode && !imageInput) {
      return void app.setOutput("Select a source image in the Edit tab first.");
    }
    if (!prompt && !autoPrompt && !promptTextFile) {
      return void app.setOutput("Provide an image prompt, choose a prompt text source file, or enable auto prompt.");
    }

    const totalRuns = isEditMode ? Math.max(1, sources.length * generationCount) : generationCount;
    if (isEditMode) {
      editSources.resetRunStates();
    }
    generation.setStatus(isEditMode
      ? (totalRuns > 1 ? "Applying image edits to 1/" + totalRuns + "..." : "Applying image edit...")
      : (overwriteImageId ? "Regenerating and overwriting image..." : (totalRuns > 1 ? "Generating image 1/" + totalRuns + "..." : "Generating image...")));
    if (width && height) {
      preview.applyWorkflowDimensions(width, height);
    } else {
      await preview.applyWorkflowDimensionsFromWorkflow();
    }

    preview.setLoading(true);
    const generatedPayloads = [];
    let totalCreatedImages = 0;
    const dashboardRequestId = generation.startRequest("image");
    try {
      const requestSources = isEditMode ? sources : [null];
      for (let index = 0; index < requestSources.length; index += 1) {
        const source = requestSources[index];
        for (let repeatIndex = 0; repeatIndex < generationCount; repeatIndex += 1) {
          const runIndex = (index * generationCount) + repeatIndex + 1;
          const seed = workflow.readSeed(["image-editor-seed", "imagegen-seed"]);
          if (isEditMode && totalRuns > 1) {
            const label = String(source?.fileNameHint || source?.label || "source image").trim();
            generation.setStatus("Applying image edits to " + runIndex + "/" + totalRuns + ": " + label + "...");
          } else if (!isEditMode && totalRuns > 1) {
            generation.setStatus("Generating image " + runIndex + "/" + totalRuns + "...");
          }
          if (isEditMode && source?.id) {
            editSources.updateRunState(source.id, "running", "Applying edit " + (repeatIndex + 1) + "/" + generationCount + "...");
          }
          const payload = await app.request("/api/image-generate", {
            prompt: prompt || undefined,
            promptTextFile: promptTextFile || undefined,
            promptTextSelectionMode,
            negativePrompt: negativePrompt || undefined,
            autoPrompt,
            autoFileName,
            autoDescription,
            autoFileNameTiming,
            width,
            height,
            seed,
            steps,
            cfg,
            stripMetadata: document.getElementById("image-strip-metadata-storage")?.checked !== false,
            imageInput: isEditMode ? (source?.value || undefined) : undefined,
            imageFileNameHint: isEditMode ? (source?.fileNameHint || undefined) : undefined,
            overwriteImageId: overwriteImageId || undefined,
            channelId: discordChannelId || undefined,
            dashboardRequestId
          });
          generatedPayloads.push(payload);
          const generatedEntries = history.getBatchEntries(payload);
          totalCreatedImages += Math.max(1, generatedEntries.length || 0);
          if (isEditMode && source?.id) {
            editSources.updateRunState(
              source.id,
              "success",
              generatedEntries.length > 1 ? (generatedEntries.length + " images saved.") : (payload.imageFileName || "Edited successfully.")
            );
          }
          await history.load((generatedEntries[0] || payload).id);
          workflow.applySeedAfterGenerate(["image-editor-seed", "imagegen-seed"], "imagegen-seed-control", seed);
          if (postTarget.messenger === "telegram" || postTarget.messenger === "whatsapp") {
            const imageUrl = app.buildAbsoluteDashboardUrl(app.getGeneratedImageFileUrl(payload.id, payload.imageFileName));
            await postTargets.postExternal(
              postTarget,
              (isEditMode ? "Edited image ready:\n" : "Generated image ready:\n") + imageUrl + "\n\nPrompt: " + String(payload.prompt || prompt || "(auto prompt)")
            );
          }
        }
      }
    } catch (error) {
      if (isEditMode) {
        const failedSource = sources[generatedPayloads.length] || null;
        if (failedSource?.id) {
          editSources.updateRunState(failedSource.id, "error", (error && error.message) || "Edit failed.");
        }
      }
      throw error;
    } finally {
      preview.setLoading(false);
      generation.finishRequest("image", dashboardRequestId);
    }

    const payload = generatedPayloads[generatedPayloads.length - 1];
    if (!payload) {
      return null;
    }
    if ((autoFileName || autoDescription) && autoFileNameTiming !== "before") {
      generation.setStatus(generatedPayloads.length > 1 || totalCreatedImages > 1
        ? "Edited " + totalCreatedImages + " images. Waiting for LLM metadata..."
        : "Generated " + payload.imageFileName + ". Waiting for LLM metadata...");
      for (const generatedPayload of generatedPayloads) {
        for (const generatedEntry of history.getBatchEntries(generatedPayload)) {
          history.scheduleRefresh(generatedEntry.id, generatedEntry.imageFileName);
        }
      }
    } else {
      generation.setStatus(isEditMode && totalCreatedImages > 1
        ? "Edited " + totalCreatedImages + " images successfully."
        : (isEditMode ? "Edited " : "Generated ") + payload.imageFileName + " successfully.");
    }

    const resultVerb = isEditMode ? "Edited" : "Generated";
    const resultNoun = totalCreatedImages > 1 ? totalCreatedImages + " images" : "image";
    const messengerName = postTarget.messenger === "discord"
      ? "Discord"
      : postTarget.messenger === "telegram"
        ? "Telegram"
        : postTarget.messenger === "whatsapp"
          ? "WhatsApp"
          : "";
    app.setOutput(messengerName
      ? resultVerb + " " + resultNoun + " and posted " + (totalCreatedImages > 1 ? "them" : "it") + " to " + messengerName + "."
      : resultVerb + " " + resultNoun + " in Image Studio.");
    await app.refreshState();
    if (postTarget.messenger === "discord") {
      await app.loadBotMessages();
    }
    return payload;
  }

  return { generate };
}
