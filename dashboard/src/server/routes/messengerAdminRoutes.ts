import type { IncomingMessage, ServerResponse } from "node:http";
import {
  appConfig,
  fetchMatrixAdminEvents,
  fetchMatrixAdminHealth,
  fetchMatrixAdminRooms,
  fetchTelegramAdminChats,
  refreshMatrixAdminRooms,
  fetchWhatsAppAdminContacts,
  sendMatrixAdminMessage,
  listMatrixWorkflowPermissions,
  setMatrixRoomWorkflowPermissions,
  sendTelegramAdminMessage,
  sendWhatsAppAdminMessage,
  type DashboardDependencies
} from "../runtime/botBridge.js";
import { parseJsonBody, sendJson } from "../http.js";
import { getRoute, postRoute } from "../router.js";
import {
  listPersistedWhatsAppRecipients,
  mergeWhatsAppRecipients,
  rememberWhatsAppRecipient
} from "../messagingAndModel/whatsappRecipientStore.js";

async function handleGetApiTelegramChats(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  try {
    const chats = await fetchTelegramAdminChats(appConfig.telegramAdminBaseUrl, appConfig.messengerAdminSharedSecret);
    sendJson(response, 200, { chats });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendJson(response, 502, { error: detail || "Failed to load Telegram chats." });
  }
}

async function handlePostApiTelegramSendMessage(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const chatId = typeof body.chatId === "string" || typeof body.chatId === "number" ? String(body.chatId).trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!chatId || !text) {
    sendJson(response, 400, { error: "chatId and text are required." });
    return;
  }
  try {
    const payload = await sendTelegramAdminMessage(appConfig.telegramAdminBaseUrl, { chatId, text }, appConfig.messengerAdminSharedSecret);
    dependencies.runtimeState.recordAction("dashboard:telegram-send", `Sent Telegram message to ${chatId}.`);
    sendJson(response, 200, payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendJson(response, 502, { error: detail || "Failed to send Telegram message." });
  }
}

async function handleGetApiMatrixRooms(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  try {
    const rooms = await fetchMatrixAdminRooms(appConfig.matrixAdminBaseUrl, appConfig.messengerAdminSharedSecret);
    sendJson(response, 200, { rooms });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendJson(response, 502, { error: detail || "Failed to load Matrix rooms." });
  }
}

async function handleGetApiMatrixHealth(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  try {
    sendJson(response, 200, await fetchMatrixAdminHealth(appConfig.matrixAdminBaseUrl, appConfig.messengerAdminSharedSecret));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendJson(response, 502, { error: detail || "Failed to load Matrix health." });
  }
}

async function handleGetApiMatrixEvents(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  try {
    sendJson(response, 200, { events: await fetchMatrixAdminEvents(appConfig.matrixAdminBaseUrl, appConfig.messengerAdminSharedSecret) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendJson(response, 502, { error: detail || "Failed to load Matrix activity." });
  }
}

async function handlePostApiMatrixSendMessage(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!roomId || !text) {
    sendJson(response, 400, { error: "roomId and text are required." });
    return;
  }
  try {
    const payload = await sendMatrixAdminMessage(appConfig.matrixAdminBaseUrl, { roomId, text }, appConfig.messengerAdminSharedSecret);
    dependencies.runtimeState.recordAction("dashboard:matrix-send", `Sent Matrix message to ${roomId}.`);
    sendJson(response, 200, payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const unavailable = /Matrix runtime is not ready|encryption has not initialized|Matrix SDK sync stopped/i.test(detail);
    sendJson(response, unavailable ? 503 : 502, {
      error: unavailable
        ? "Matrix Runtime is online but not ready for encrypted messages. Repair or rotate its Matrix device session, then restart the Matrix Runtime."
        : (detail || "Failed to send Matrix message.")
    });
  }
}

async function handlePostApiMatrixRefreshRooms(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  try {
    const rooms = await refreshMatrixAdminRooms(appConfig.matrixAdminBaseUrl, appConfig.messengerAdminSharedSecret);
    dependencies.runtimeState.recordAction("dashboard:matrix-refresh-rooms", `Refreshed ${rooms.length} Matrix room(s).`);
    sendJson(response, 200, { rooms });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendJson(response, 502, { error: detail || "Failed to refresh Matrix rooms." });
  }
}

async function handleGetApiMatrixWorkflowPermissions(request: IncomingMessage, response: ServerResponse): Promise<void> {
  sendJson(response, 200, await listMatrixWorkflowPermissions());
}

async function handlePostApiMatrixWorkflowPermissions(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const roomId = typeof body.roomId === "string" ? body.roomId : "";
  try {
    const config = await setMatrixRoomWorkflowPermissions(roomId, body.workflows, body.allowAllMembers === true);
    dependencies.runtimeState.recordAction("dashboard:matrix-workflow-permissions", `Updated Matrix workflow permissions for ${roomId.trim()}.`);
    sendJson(response, 200, config);
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Invalid Matrix workflow permission settings." });
  }
}

async function handleGetApiWhatsAppContacts(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const persisted = await listPersistedWhatsAppRecipients();
  try {
    const contacts = await fetchWhatsAppAdminContacts(appConfig.whatsappAdminBaseUrl, appConfig.messengerAdminSharedSecret);
    sendJson(response, 200, { contacts: mergeWhatsAppRecipients(contacts, persisted), persisted: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (persisted.length > 0) {
      sendJson(response, 200, { contacts: persisted, persisted: true, runtimeWarning: detail || "WhatsApp runtime contacts unavailable." });
    } else {
      sendJson(response, 502, { error: detail || "Failed to load WhatsApp contacts." });
    }
  }
}

async function handlePostApiWhatsAppSendMessage(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const to = typeof body.to === "string" || typeof body.to === "number" ? String(body.to).trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!to || !text) {
    sendJson(response, 400, { error: "to and text are required." });
    return;
  }
  try {
    const payload = await sendWhatsAppAdminMessage(appConfig.whatsappAdminBaseUrl, { to, text }, appConfig.messengerAdminSharedSecret);
    await rememberWhatsAppRecipient({ to, message: text });
    dependencies.runtimeState.recordAction("dashboard:whatsapp-send", `Sent WhatsApp message to ${to}.`);
    sendJson(response, 200, payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    sendJson(response, 502, { error: detail || "Failed to send WhatsApp message." });
  }
}

export const messengerAdminRouteDefinitions = [
  getRoute("/api/telegram/chats", handleGetApiTelegramChats),
  postRoute("/api/telegram/send-message", handlePostApiTelegramSendMessage),
  getRoute("/api/matrix/rooms", handleGetApiMatrixRooms),
  getRoute("/api/matrix/health", handleGetApiMatrixHealth),
  getRoute("/api/matrix/events", handleGetApiMatrixEvents),
  getRoute("/api/matrix/workflow-permissions", handleGetApiMatrixWorkflowPermissions),
  postRoute("/api/matrix/workflow-permissions", handlePostApiMatrixWorkflowPermissions),
  postRoute("/api/matrix/rooms/refresh", handlePostApiMatrixRefreshRooms),
  postRoute("/api/matrix/send-message", handlePostApiMatrixSendMessage),
  getRoute("/api/whatsapp/contacts", handleGetApiWhatsAppContacts),
  postRoute("/api/whatsapp/send-message", handlePostApiWhatsAppSendMessage)
];
