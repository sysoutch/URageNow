import type { IncomingMessage, ServerResponse } from "node:http";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { parseJsonBody, sendJson } from "../http.js";
import { postRoute } from "../router.js";

async function handlePostApiAskToChannel(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!channelId || !prompt) {
    sendJson(response, 400, { error: "channelId and prompt are required." });
    return;
  }
  const answer = await dependencies.askModel(prompt);
  const settings = dependencies.runtimeState.getGlobalDashboardSettings();
  if (settings.requireConfirmationForLlmSend) {
    const draft = dependencies.runtimeState.createPendingDraft(channelId, prompt, answer);
    dependencies.runtimeState.recordAction("dashboard:llm-draft", `Draft ${draft.id} prepared for ${channelId}.`);
    sendJson(response, 200, { mode: "draft", draft });
    return;
  }
  await dependencies.sendMessageToChannel(channelId, answer);
  dependencies.runtimeState.recordAction("dashboard:llm-send", `Model output sent directly to ${channelId}.`);
  sendJson(response, 200, { mode: "sent", response: answer });
}

async function handlePostApiConfirmDraft(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const draftId = typeof body.draftId === "string" ? body.draftId.trim() : "";
  if (!draftId) {
    sendJson(response, 400, { error: "draftId is required." });
    return;
  }
  const draft = dependencies.runtimeState.consumePendingDraft(draftId);
  if (!draft) {
    sendJson(response, 404, { error: "Draft not found." });
    return;
  }
  await dependencies.sendMessageToChannel(draft.channelId, draft.response);
  dependencies.runtimeState.recordAction("dashboard:llm-confirm", `Draft ${draft.id} sent to ${draft.channelId}.`);
  sendJson(response, 200, { ok: true, response: draft.response });
}

async function handlePostApiSendMessage(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!channelId || !content) {
    sendJson(response, 400, { error: "channelId and content are required." });
    return;
  }
  await dependencies.sendMessageToChannel(channelId, content);
  sendJson(response, 200, { ok: true });
}

async function handlePostApiEditBotMessage(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!channelId || !messageId || !content.trim()) {
    sendJson(response, 400, { error: "channelId, messageId, and content are required." });
    return;
  }
  const edited = await dependencies.editBotMessage(channelId, messageId, content);
  sendJson(response, 200, edited);
}

async function handlePostApiSendDm(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!userId || !content) {
    sendJson(response, 400, { error: "userId and content are required." });
    return;
  }
  await dependencies.sendDirectMessage(userId, content);
  sendJson(response, 200, { ok: true });
}

async function handlePostApiPostGift(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!channelId) {
    sendJson(response, 400, { error: "channelId is required." });
    return;
  }
  await dependencies.postGiftToChannel(channelId);
  sendJson(response, 200, { ok: true });
}

async function handlePostApiPostHumble(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!channelId) {
    sendJson(response, 400, { error: "channelId is required." });
    return;
  }
  await dependencies.postHumbleToChannel(channelId);
  sendJson(response, 200, { ok: true });
}

export const channelMessagingRouteDefinitions = [
  postRoute("/api/ask-to-channel", handlePostApiAskToChannel),
  postRoute("/api/confirm-draft", handlePostApiConfirmDraft),
  postRoute("/api/send-message", handlePostApiSendMessage),
  postRoute("/api/edit-bot-message", handlePostApiEditBotMessage),
  postRoute("/api/send-dm", handlePostApiSendDm),
  postRoute("/api/post-gift", handlePostApiPostGift),
  postRoute("/api/post-humble", handlePostApiPostHumble)
];
