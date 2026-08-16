import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import type {IncomingMessage, ServerResponse} from "node:http";
import os from "node:os";
import path from "node:path";
import type {DashboardDependencies} from "@urage/shared/dashboard/types";

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "urage-companion-workflows-"));
process.env.DASHBOARD_DATA_DIR = temporaryRoot;

type CapturedResponse = {
  status: number;
  payload: Record<string, unknown>;
};

try {
  const access = await import("../dashboard/src/server/companion/companionAccessService.js");
  const routes = await import(`../dashboard/src/server/companion/companionRoutes.js?workflow-routes=${Date.now()}`);
  const pairing = access.getCompanionPairingPayload();
  const credentials = await access.pairCompanionDevice(pairing.token, "Workflow Test Device");
  let generatedImageCount = 0;
  let generatedModelCount = 0;
  let generatedAudioCount = 0;
  let generatedMusicCount = 0;
  let generatedVideoCount = 0;
  let videoReceivedSourceImage = false;
  let imageReceivedSourceImage = false;
  let modelReceivedSourceImage = false;
  const dependencies = {
    runtimeState: {recordAction: () => {}},
    askModel: async (prompt: string) => `Mobile reply to: ${prompt}`,
    askVisionModel: async (prompt: string, images: string[]) =>
      `Interpreted ${images.length} reference images as ${prompt.includes("individually") ? "parts" : "whole"}`,
    askModelDetailedStream: async (prompt: string, callbacks: {onResponseDelta?: (delta: string) => void}) => {
      callbacks.onResponseDelta?.("Streamed ");
      callbacks.onResponseDelta?.("reply");
      return {response: `Streamed reply to: ${prompt}`, reasoning: ""};
    },
    generateImageFromPrompt: async (input: {prompt?: string; imageInput?: string; imageFileNameHint?: string}) => {
      generatedImageCount += 1;
      if (input.imageInput) {
        imageReceivedSourceImage = input.imageInput.startsWith("data:image/png;base64,")
          && input.imageFileNameHint === "image-1.png";
      }
      return {
        id: `image-${generatedImageCount}`,
        imageFileName: `image-${generatedImageCount}.png`,
        prompt: input.prompt || "",
        createdAt: new Date().toISOString()
      };
    },
    readGeneratedImageFile: async () => ({data: Buffer.from("image"), contentType: "image/png"}),
    generate3dModelFromImage: async (input: {prompt?: string; imageInput?: string}) => {
      generatedModelCount += 1;
      modelReceivedSourceImage = String(input.imageInput || "").startsWith("data:image/png;base64,");
      return {
        id: `model-${generatedModelCount}`,
        modelFileName: `model-${generatedModelCount}.glb`,
        prompt: input.prompt || "",
        createdAt: new Date().toISOString()
      };
    },
    generateAudioFromPrompt: async (input: {prompt?: string}) => ({
      id: `audio-${++generatedAudioCount}`,
      audioFileName: `audio-${generatedAudioCount}.wav`,
      prompt: input.prompt || "",
      createdAt: new Date().toISOString()
    }),
    generateMusicFromPrompt: async (input: {tags?: string}) => ({
      id: `music-${++generatedMusicCount}`,
      audioFileName: `music-${generatedMusicCount}.wav`,
      prompt: input.tags || "",
      createdAt: new Date().toISOString()
    }),
    generateVideoFromPrompt: async (input: {prompt?: string; imageDataUrl?: string; imageFileName?: string}) => {
      videoReceivedSourceImage = String(input.imageDataUrl || "").startsWith("data:image/png;base64,")
        && input.imageFileName === "image-1.png";
      return {
        id: `video-${++generatedVideoCount}`,
        videoFileName: `video-${generatedVideoCount}.mp4`,
        prompt: input.prompt || "",
        createdAt: new Date().toISOString()
      };
    }
  } as unknown as DashboardDependencies;

  async function call(pathname: string, body: Record<string, unknown> = {}, method = "POST"): Promise<CapturedResponse> {
    const bytes = Buffer.from(JSON.stringify(body));
    const request = {
      method,
      headers: {authorization: `Bearer ${credentials.token}`},
      async *[Symbol.asyncIterator]() {
        yield bytes;
      }
    } as unknown as IncomingMessage;
    let status = 0;
    let responseBody = "";
    const response = {
      writeHead(nextStatus: number) {
        status = nextStatus;
        return this;
      },
      end(chunk?: string | Buffer) {
        responseBody += chunk ? chunk.toString() : "";
        return this;
      },
      setHeader() {}
    } as unknown as ServerResponse;
    assert.equal(await routes.handleAuthenticatedCompanionRequest(request, response, new URL(`http://localhost${pathname}`), dependencies), true);
    return {status, payload: responseBody ? JSON.parse(responseBody) : {}};
  }

  async function callStream(pathname: string, body: Record<string, unknown>): Promise<{status: number; body: string}> {
    const bytes = Buffer.from(JSON.stringify(body));
    const request = {
      method: "POST",
      headers: {authorization: `Bearer ${credentials.token}`},
      async *[Symbol.asyncIterator]() { yield bytes; }
    } as unknown as IncomingMessage;
    let status = 0;
    let responseBody = "";
    const response = {
      writeHead(nextStatus: number) { status = nextStatus; return this; },
      write(chunk: string | Buffer) { responseBody += chunk.toString(); return true; },
      end(chunk?: string | Buffer) { responseBody += chunk ? chunk.toString() : ""; return this; },
      setHeader() {}
    } as unknown as ServerResponse;
    assert.equal(await routes.handleAuthenticatedCompanionRequest(request, response, new URL(`http://localhost${pathname}`), dependencies), true);
    return {status, body: responseBody};
  }

  assert.equal((await call("/api/companion/workflows/chat", {prompt: "Hello"})).status, 403);
  assert.equal((await call("/api/companion/tools", {}, "GET")).status, 403);
  const initial = await access.getCompanionAccessPolicy();
  await access.updateCompanionDefaultPermissions({
    ...initial.defaults,
    "workflow.chat": true,
    "workflow.image.generate": true,
    "workflow.audio.generate": true,
    "workflow.music.generate": true,
    "workflow.video.generate": true,
    "workflow.model3d.generate": true,
    "tools.browse": true,
    "media.download": true
  });

  const toolCatalog = await call("/api/companion/tools", {}, "GET");
  assert.equal(toolCatalog.status, 200);
  const tools = toolCatalog.payload.tools as Array<Record<string, unknown>>;
  const pokerTool = tools.find(tool => tool.id === "game__ultimate-texas-holdem");
  assert.equal(pokerTool?.category, "game");
  assert.match(String(pokerTool?.entryPath || ""), /^\/tools\/game\/ultimate-texas-holdem\//);
  const toolFiles = await import("../dashboard/src/server/companion/companionToolCatalog.js");
  const pokerEntry = await toolFiles.readCompanionToolFile(String(pokerTool?.entryPath || ""));
  assert.match(pokerEntry?.contentType || "", /^text\/html/);
  assert.match(pokerEntry?.data.toString("utf8") || "", /Ultimate Texas Hold'em/);

  const chat = await call("/api/companion/workflows/chat", {
    prompt: "Continue",
    history: [{role: "user", content: "Hello"}, {role: "assistant", content: "Hi"}]
  });
  assert.equal(chat.status, 200);
  assert.match(String(chat.payload.response || ""), /Continue/);
  const streamedChat = await callStream("/api/companion/workflows/chat-stream", {prompt: "Stream this"});
  assert.equal(streamedChat.status, 200);
  assert.match(streamedChat.body, /"type":"response-delta"/);
  assert.match(streamedChat.body, /Streamed reply/);

  const image = await call("/api/companion/workflows/image", {prompt: "small robot", width: 1024, height: 1024});
  assert.equal(image.status, 200);
  assert.equal((image.payload.item as Record<string, unknown>).kind, "image");
  const interpreted = await call("/api/companion/workflows/image/interpret", {
    mode: "parts",
    prompt: "combine these references",
    images: [{id: "image-1", fileName: "image-1.png"}, {id: "image-2", fileName: "image-2.png"}]
  });
  assert.equal(interpreted.status, 200);
  assert.match(String(interpreted.payload.prompt || ""), /2 reference images as parts/);
  const improved = await call("/api/companion/workflows/image/improve-prompt", {
    prompt: "small robot", instructions: "make the lighting cinematic"
  });
  assert.equal(improved.status, 200);
  assert.match(String(improved.payload.prompt || ""), /small robot/);
  const editedImage = await call("/api/companion/workflows/image", {
    prompt: "add a red stripe", imageId: "image-1", imageFileName: "image-1.png"
  });
  assert.equal(editedImage.status, 200);

  const audio = await call("/api/companion/workflows/audio", {prompt: "rain on glass", seconds: 8});
  assert.equal(audio.status, 200);
  assert.equal((audio.payload.item as Record<string, unknown>).kind, "audio");

  const music = await call("/api/companion/workflows/music", {tags: "ambient, piano", lyrics: "[verse]\nQuiet rain", seconds: 30});
  assert.equal(music.status, 200);
  assert.equal((music.payload.item as Record<string, unknown>).kind, "audio");

  const video = await call("/api/companion/workflows/video", {
    prompt: "slow orbit around a crystal", seconds: 5, imageId: "image-1", imageFileName: "image-1.png"
  });
  assert.equal(video.status, 200);
  assert.equal((video.payload.item as Record<string, unknown>).kind, "video");

  const missingModelSource = await call("/api/companion/workflows/model3d", {
    sourceMode: "existing-image", prompt: ""
  });
  assert.equal(missingModelSource.status, 400);
  const modelFromImage = await call("/api/companion/workflows/model3d", {
    sourceMode: "existing-image", prompt: "", imageId: "image-1", imageFileName: "image-1.png"
  });
  assert.equal(modelFromImage.status, 200);
  const model = await call("/api/companion/workflows/model3d", {
    sourceMode: "generate-image", prompt: "small robot"
  });
  assert.equal(model.status, 200);
  assert.equal((model.payload.item as Record<string, unknown>).kind, "model3d");
  assert.equal(generatedImageCount, 3);
  assert.equal(generatedModelCount, 2);
  assert.equal(generatedAudioCount, 1);
  assert.equal(generatedMusicCount, 1);
  assert.equal(generatedVideoCount, 1);
  assert.equal(videoReceivedSourceImage, true);
  assert.equal(imageReceivedSourceImage, true);
  assert.equal(modelReceivedSourceImage, true);
} finally {
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  if (!resolvedTemporaryRoot.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
    throw new Error("Refusing to remove a companion workflow test directory outside the OS temp directory.");
  }
  await rm(resolvedTemporaryRoot, {recursive: true, force: true});
}

console.log("Companion Chat, Image, Audio, Music, Video, and 3D workflow validation passed.");
