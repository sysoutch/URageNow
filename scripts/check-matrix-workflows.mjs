import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const {decodeRelayPayload, encodeRelayPayload, parseRelayCommand, renderRelayProgress, renderRelayPrompt, renderRelayResult} = require("../bots/matrix-bot/relayProtocol.js");
const {createDashboardWorkflowClient} = require("../bots/matrix-bot/dashboardWorkflowClient.js");
const {MatrixSourceAudioRegistry, MatrixSourceImageRegistry, detectAudioContentType, detectImageContentType} = require("../bots/matrix-bot/matrixSourceImageRegistry.js");
const requestId = "request_12345678";
const encoded = encodeRelayPayload({prompt: "small robot"});
assert.deepEqual(parseRelayCommand(`!urage ${requestId} image ${encoded}`), {
  requestId,
  action: "image",
  payload: {prompt: "small robot"}
});
for (const action of ["audio", "music", "video", "image-interpret", "image-improve", "stt"]) {
  assert.equal(parseRelayCommand(`!urage ${requestId} ${action} ${encoded}`)?.action, action);
}
assert.match(renderRelayResult(requestId, "ok", {id: "image-1"}), /^URAGE_RESULT request_12345678 ok /);
assert.equal(renderRelayPrompt(requestId, "small robot"), "URAGE_PROMPT request_12345678 small robot");
const progress = renderRelayProgress(requestId, 2, {delta: "working"});
assert.match(progress, /^URAGE_PROGRESS request_12345678 2 /);
assert.deepEqual(decodeRelayPayload(progress.split(" ")[3]), {delta: "working"});
assert.equal(parseRelayCommand("!image human command"), null);

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);
assert.equal(detectImageContentType(jpeg), "image/jpeg");
const sourceRegistry = new MatrixSourceImageRegistry(async content => {
  assert.match(String(content.file?.url || content.url || ""), /^mxc:\/\/example\//);
  return jpeg;
});
assert.equal(sourceRegistry.remember({
  roomId: "!private:example", sender: "@phone:example", eventId: "$source",
  body: "URAGE_SOURCE source_12345678",
  content: {
    msgtype: "m.image", filename: "camera.jpg",
    file: {url: "mxc://example/source"}, info: {size: jpeg.length}
  }
}), true);
assert.deepEqual(await sourceRegistry.consume("source_12345678", "!private:example", "@phone:example"), {
  imageInput: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
  imageFileName: "camera.jpg"
});
sourceRegistry.remember({
  roomId: "!private:example", sender: "@phone:example", eventId: "$owned-source",
  body: "URAGE_SOURCE source_owned_1234",
  content: {
    msgtype: "m.image", filename: "owned.jpg",
    file: {url: "mxc://example/source"}, info: {size: jpeg.length}
  }
});
await assert.rejects(
  sourceRegistry.consume("source_owned_1234", "!private:example", "@intruder:example"),
  /does not belong to this workflow sender and room/
);
await sourceRegistry.consume("source_owned_1234", "!private:example", "@phone:example");
assert.equal(sourceRegistry.remember({
  roomId: "!private:example", sender: "@phone:example",
  body: "URAGE_SOURCE source_87654321",
  content: {msgtype: "m.image", url: "mxc://example/plaintext", info: {size: 10}}
}), true);
await assert.rejects(
  sourceRegistry.consume("source_87654321", "!private:example", "@phone:example"),
  /Confirm the unencrypted-media risk/
);
sourceRegistry.remember({
  roomId: "!private:example", sender: "@phone:example",
  body: "URAGE_SOURCE source_plaintext_1234",
  content: {msgtype: "m.image", url: "mxc://example/plaintext", info: {size: jpeg.length}}
});
assert.deepEqual(await sourceRegistry.consume("source_plaintext_1234", "!private:example", "@phone:example", true), {
  imageInput: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
  imageFileName: "matrix-source.jpg"
});

const m4a = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
assert.equal(detectAudioContentType(m4a), "audio/mp4");
const audioRegistry = new MatrixSourceAudioRegistry(async () => m4a);
assert.equal(audioRegistry.remember({
  roomId: "!private:example", sender: "@phone:example",
  body: "URAGE_AUDIO_SOURCE audio_12345678",
  content: {msgtype: "m.file", filename: "chat-recording.m4a", file: {url: "mxc://example/audio"}, info: {size: m4a.length}}
}), true);
assert.deepEqual(await audioRegistry.consume("audio_12345678", "!private:example", "@phone:example"), {
  audioDataUrl: `data:audio/mp4;base64,${m4a.toString("base64")}`,
  audioFileName: "chat-recording.m4a"
});

const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  requests.push({url: String(url), init});
  const pathname = new URL(String(url)).pathname;
  if (pathname === "/api/image-generate") {
    return new Response(JSON.stringify({id: "image-1", imageFileName: "robot.png", prompt: "small robot"}), {
      status: 200, headers: {"content-type": "application/json"}
    });
  }
  if (pathname === "/api/image-interpret-prompt" || pathname === "/api/image-rewrite-prompt") {
    return new Response(JSON.stringify({prompt: "improved robot prompt"}), {
      status: 200, headers: {"content-type": "application/json"}
    });
  }
  if (pathname === "/api/speech-stt") {
    return new Response(JSON.stringify({transcript: "matrix audio transcript"}), {
      status: 200, headers: {"content-type": "application/json"}
    });
  }
  if (pathname === "/api/ask-stream") {
    return new Response([
      'data: {"type":"response-delta","delta":"Hello "}\n\n',
      'data: {"type":"response-delta","delta":"Matrix"}\n\n',
      'data: {"type":"done","response":"Hello Matrix"}\n\n'
    ].join(""), {status: 200, headers: {"content-type": "text/event-stream"}});
  }
  if (pathname === "/api/generated-image-file") {
    return new Response(Buffer.from("png"), {status: 200, headers: {"content-type": "image/png"}});
  }
  if (pathname === "/api/audio-generate") {
    return new Response(JSON.stringify({id: "audio-1", audioFileName: "rain.wav", prompt: "rain"}), {
      status: 200, headers: {"content-type": "application/json"}
    });
  }
  if (pathname === "/api/music-generate") {
    return new Response(JSON.stringify({id: "music-1", audioFileName: "song.wav", prompt: "ambient"}), {
      status: 200, headers: {"content-type": "application/json"}
    });
  }
  if (pathname === "/api/generated-audio-file") {
    return new Response(Buffer.from("wav"), {status: 200, headers: {"content-type": "audio/wav"}});
  }
  if (pathname === "/api/video-generate") {
    return new Response(JSON.stringify({id: "video-1", videoFileName: "clip.mp4", prompt: "orbit"}), {
      status: 200, headers: {"content-type": "application/json"}
    });
  }
  if (pathname === "/api/generated-video-file") {
    return new Response(Buffer.from("mp4"), {status: 200, headers: {"content-type": "video/mp4"}});
  }
  if (pathname === "/api/model3d-generate") {
    return new Response(JSON.stringify({id: "model-1", modelFileName: "robot.glb", prompt: "small robot"}), {
      status: 200, headers: {"content-type": "application/json"}
    });
  }
  if (pathname === "/api/model3d-file") {
    return new Response(Buffer.from("glb"), {status: 200, headers: {"content-type": "model/gltf-binary"}});
  }
  throw new Error(`Unexpected request: ${url}`);
};

try {
  const client = createDashboardWorkflowClient({baseUrl: "https://dashboard.example", accessToken: "secret"});
  const deltas = [];
  const chat = await client.chatStream("Hello", delta => deltas.push(delta));
  assert.equal(chat.text, "Hello Matrix");
  assert.deepEqual(deltas, ["Hello ", "Matrix"]);
  const image = await client.image({prompt: "small robot", width: 1024, height: 1024});
  assert.equal(image.fileName, "robot.png");
  assert.equal(image.contentType, "image/png");
  assert.equal((await client.interpretImage({imageInput: `data:image/jpeg;base64,${jpeg.toString("base64")}`})).text, "improved robot prompt");
  assert.equal((await client.improveImagePrompt({prompt: "robot"})).text, "improved robot prompt");
  assert.equal((await client.transcribeAudio({audioDataUrl: `data:audio/mp4;base64,${m4a.toString("base64")}`, audioFileName: "chat-recording.m4a"})).text, "matrix audio transcript");
  assert.equal((await client.audio({prompt: "rain", seconds: 8})).contentType, "audio/wav");
  assert.equal((await client.music({tags: "ambient", lyrics: "", seconds: 30})).fileName, "song.wav");
  assert.equal((await client.video({
    prompt: "orbit", seconds: 5, imageId: "image-1", imageFileName: "robot.png"
  })).contentType, "video/mp4");
  const model = await client.model3d({prompt: "small robot", generateLowPoly: true});
  assert.equal(model.fileName, "robot.glb");
  assert.equal(model.contentType, "model/gltf-binary");
  const sourceModel = await client.model3d({
    prompt: "",
    imageInput: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    imageFileName: "camera.jpg"
  });
  assert.equal(sourceModel.fileName, "robot.glb");
  assert.ok(requests.every(entry => new Headers(entry.init.headers).get("x-dashboard-access-token") === "secret"));
  const videoRequest = requests.find(entry => new URL(entry.url).pathname === "/api/video-generate");
  const videoBody = JSON.parse(String(videoRequest?.init.body || "{}"));
  assert.match(videoBody.imageDataUrl, /^data:image\/png;base64,/);
  assert.equal(videoBody.imageFileName, "robot.png");
  await client.image({
    prompt: "camera robot", imageInput: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    imageFileName: "camera.jpg"
  });
  const matrixSourceRequest = requests
    .filter(entry => new URL(entry.url).pathname === "/api/image-generate")
    .map(entry => JSON.parse(String(entry.init.body || "{}")))
    .find(body => body.prompt === "camera robot");
  assert.match(matrixSourceRequest.imageInput, /^data:image\/jpeg;base64,/);
  assert.equal(matrixSourceRequest.imageFileNameHint, "camera.jpg");
} finally {
  globalThis.fetch = originalFetch;
}

const bot = readFileSync(path.resolve("bots/matrix-bot/bot.js"), "utf8");
const matrixRuntime = readFileSync(path.resolve("bots/matrix-bot/matrixSdkRuntime.cjs"), "utf8");
assert.match(bot, /!image <prompt>/);
assert.match(bot, /!audio <prompt>/);
assert.match(bot, /!music <tags>/);
assert.match(bot, /!video <prompt>/);
assert.match(bot, /!3d <prompt>/);
assert.match(bot, /MATRIX_WORKFLOW_REQUIRE_ALLOWLIST/);
assert.match(bot, /sendRoomMedia/);
assert.match(bot, /sendRelayMedia/);
assert.match(bot, /allowUnencryptedMedia/);
assert.match(bot, /matrixAudioSourceId/);
assert.match(bot, /transcribeAudio/);
assert.match(bot, /renderRelayResult/);
assert.match(bot, /renderRelayProgress/);
assert.match(bot, /Matrix bot accepted the request/);
assert.match(bot, /markEventProcessed/);
assert.match(bot, /MatrixSdkRuntime/);
assert.match(matrixRuntime, /RustSdkCryptoStorageProvider/);
assert.match(matrixRuntime, /crypto\.encryptMedia/);
assert.match(matrixRuntime, /crypto\.decryptMedia/);
assert.match(matrixRuntime, /room\.message/);
assert.match(matrixRuntime, /crypto\.isReady/);
assert.match(matrixRuntime, /getJoinedRoomDetails/);
assert.match(bot, /describeMatrixRoom/);
assert.match(bot, /m\.space\.parent/);
assert.match(bot, /m\.space\.child/);
assert.match(matrixRuntime, /start\(\) resolves only when the long-running sync loop stops/);

console.log("Matrix SDK-backed E2EE Chat, Image, Audio, Music, Video, 3D, and Android relay validation passed.");
