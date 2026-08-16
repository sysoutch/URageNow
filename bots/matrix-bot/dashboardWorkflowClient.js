"use strict";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function createDashboardWorkflowClient(input) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const accessToken = String(input.accessToken || "").trim();
  const accessTokenProvider = typeof input.accessTokenProvider === "function" ? input.accessTokenProvider : null;

  async function request(pathname, init = {}) {
    if (!baseUrl) throw new Error("DASHBOARD_BASE_URL is not configured.");
    const resolvedAccessToken = accessToken || (accessTokenProvider ? String(await accessTokenProvider() || "").trim() : "");
    const headers = {
      ...(init.headers || {}),
      ...(resolvedAccessToken ? {"x-dashboard-access-token": resolvedAccessToken} : {})
    };
    const response = await fetch(`${baseUrl}${pathname}`, {...init, headers});
    if (!response.ok) {
      const text = await response.text();
      try {
        const payload = JSON.parse(text);
        throw new Error(payload.error || `Dashboard request failed (${response.status}).`);
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error(text || `Dashboard request failed (${response.status}).`);
        throw error;
      }
    }
    return response;
  }

  async function requestJson(pathname, body) {
    const response = await request(pathname, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify(body)
    });
    return response.json();
  }

  async function download(pathname) {
    const response = await request(pathname);
    return {
      data: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "application/octet-stream"
    };
  }

  async function chat(prompt) {
    const payload = await requestJson("/api/ask", {prompt});
    return {text: String(payload.response || "").trim()};
  }

  async function chatStream(prompt, onDelta) {
    const response = await request("/api/ask-stream", {
      method: "POST",
      headers: {"content-type": "application/json", accept: "text/event-stream"},
      body: JSON.stringify({prompt})
    });
    if (!response.body) return chat(prompt);
    const decoder = new TextDecoder();
    let pending = "";
    let streamedText = "";
    let completedText = "";
    const consumeEvent = async rawEvent => {
      const dataLine = rawEvent.split(/\r?\n/).find(line => line.startsWith("data:"));
      if (!dataLine) return;
      const event = JSON.parse(dataLine.slice(5).trim());
      if (event.type === "response-delta" && event.delta) {
        const delta = String(event.delta);
        streamedText += delta;
        await onDelta(delta);
      } else if (event.type === "done") {
        completedText = String(event.response || "");
      } else if (event.type === "error") {
        throw new Error(String(event.message || "Dashboard Chat stream failed."));
      }
    };
    for await (const chunk of response.body) {
      pending += decoder.decode(chunk, {stream: true});
      const events = pending.split(/\r?\n\r?\n/);
      pending = events.pop() || "";
      for (const event of events) await consumeEvent(event);
    }
    pending += decoder.decode();
    if (pending.trim()) await consumeEvent(pending);
    return {text: (completedText || streamedText).trim()};
  }

  async function image(options) {
    let imageInput = String(options.imageInput || "");
    if (!imageInput && options.imageId && options.imageFileName) {
      const source = await download(`/api/generated-image-file?imageId=${encodeURIComponent(options.imageId)}&file=${encodeURIComponent(options.imageFileName)}`);
      imageInput = `data:${source.contentType};base64,${source.data.toString("base64")}`;
    }
    const generated = await requestJson("/api/image-generate", {
      prompt: options.prompt,
      negativePrompt: options.negativePrompt || "",
      width: options.width || 1024,
      height: options.height || 1024,
      seed: Number.isFinite(options.seed) ? options.seed : undefined,
      steps: Number.isFinite(options.steps) ? options.steps : undefined,
      cfg: Number.isFinite(options.cfg) ? options.cfg : undefined,
      imageInput,
      imageFileNameHint: imageInput ? options.imageFileName : undefined,
      autoPrompt: options.autoPrompt !== false,
      autoFileName: true
    });
    const fileName = String(generated.imageFileName || "generated-image.png");
    const file = await download(`/api/generated-image-file?imageId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`);
    return {kind: "image", id: generated.id, fileName, prompt: generated.prompt || options.prompt, ...file};
  }

  async function interpretImage(options) {
    const payload = await requestJson("/api/image-interpret-prompt", {
      imageInput: options.imageInput,
      imageFileNameHint: options.imageFileName || "matrix-source.jpg",
      prompt: options.prompt || "",
      detailMode: options.mode === "parts" ? "precise" : "normal"
    });
    return {kind: "text", text: String(payload.prompt || "").trim()};
  }

  async function improveImagePrompt(options) {
    const payload = await requestJson("/api/image-rewrite-prompt", {
      currentPrompt: options.prompt,
      negativePrompt: options.negativePrompt || "",
      instructions: options.instructions || "",
      mode: "improve"
    });
    return {kind: "text", text: String(payload.prompt || "").trim()};
  }

  async function transcribeAudio(options) {
    const payload = await requestJson("/api/speech-stt", {
      audioDataUrl: String(options.audioDataUrl || ""),
      fileName: String(options.audioFileName || "matrix-audio.m4a"),
      saveSource: false
    });
    return {kind: "text", text: String(payload.transcript || "").trim()};
  }

  async function audio(options) {
    const generated = await requestJson("/api/audio-generate", {
      prompt: options.prompt,
      seconds: options.seconds || 10
    });
    const fileName = String(generated.audioFileName || "generated-audio.wav");
    const file = await download(`/api/generated-audio-file?audioId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`);
    return {kind: "audio", id: generated.id, fileName, prompt: generated.prompt || options.prompt, ...file};
  }

  async function music(options) {
    const generated = await requestJson("/api/music-generate", {
      tags: options.tags || "",
      lyrics: options.lyrics || "",
      seconds: options.seconds || 30
    });
    const fileName = String(generated.audioFileName || "generated-music.wav");
    const file = await download(`/api/generated-audio-file?audioId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`);
    return {kind: "audio", id: generated.id, fileName, prompt: generated.prompt || options.tags || options.lyrics, ...file};
  }

  async function video(options) {
    let imageDataUrl = String(options.imageInput || "");
    if (!imageDataUrl && options.imageId && options.imageFileName) {
      const source = await download(`/api/generated-image-file?imageId=${encodeURIComponent(options.imageId)}&file=${encodeURIComponent(options.imageFileName)}`);
      imageDataUrl = `data:${source.contentType};base64,${source.data.toString("base64")}`;
    }
    const generated = await requestJson("/api/video-generate", {
      prompt: options.prompt,
      negativePrompt: options.negativePrompt || "",
      seconds: options.seconds || 5,
      fps: options.fps || 24,
      width: options.width || 1024,
      height: options.height || 576,
      steps: Number.isFinite(options.steps) ? options.steps : undefined,
      seed: Number.isFinite(options.seed) ? options.seed : undefined,
      imageDataUrl,
      imageFileName: imageDataUrl ? options.imageFileName : undefined
    });
    const fileName = String(generated.videoFileName || "generated-video.mp4");
    const file = await download(`/api/generated-video-file?videoId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`);
    return {kind: "video", id: generated.id, fileName, prompt: generated.prompt || options.prompt, ...file};
  }

  async function model3d(options) {
    const hasExistingSource = Boolean(
      options.imageInput
      || (options.imageId && options.imageFileName)
    );
    if (!hasExistingSource && !String(options.prompt || "").trim()) {
      throw new Error("3D generation requires a source image or a prompt for generating one.");
    }
    const source = options.imageInput
      ? {id: "matrix-source", fileName: options.imageFileName || "matrix-source.jpg", imageInput: options.imageInput}
      : options.imageId && options.imageFileName
      ? {
          id: options.imageId,
          fileName: options.imageFileName,
          ...(await download(`/api/generated-image-file?imageId=${encodeURIComponent(options.imageId)}&file=${encodeURIComponent(options.imageFileName)}`))
        }
      : await image({
          prompt: options.prompt,
          negativePrompt: options.negativePrompt || "",
          width: 1024,
          height: 1024,
          autoPrompt: true
        });
    const imageInput = source.imageInput || `data:${source.contentType};base64,${source.data.toString("base64")}`;
    const generated = await requestJson("/api/model3d-generate", {
      imageInput,
      imageFileNameHint: source.fileName,
      prompt: options.prompt,
      autoPrompt: false,
      useLlmMetadata: true,
      generateLowPolyVersion: options.generateLowPoly === true
    });
    const fileName = String(generated.modelFileName || "generated-model.glb");
    const file = await download(`/api/model3d-file?modelId=${encodeURIComponent(generated.id)}&file=${encodeURIComponent(fileName)}`);
    return {kind: "model3d", id: generated.id, fileName, prompt: generated.prompt || options.prompt, sourceImageId: source.id, ...file};
  }

  return {chat, chatStream, image, interpretImage, improveImagePrompt, transcribeAudio, audio, music, video, model3d};
}

module.exports = {createDashboardWorkflowClient};
