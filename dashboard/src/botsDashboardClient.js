(() => {
  const names = { discord: "Discord", telegram: "Telegram", matrix: "Matrix", whatsapp: "WhatsApp" };
  const byId = id => document.getElementById(id);
  const state = { messenger: "discord", view: "dashboard", snapshot: { runtimes: [], events: [] } };
  const notice = message => { byId("bots-notice").textContent = message; };

  async function api(path, body) {
    const response = await fetch(path, body === undefined ? undefined : {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }
  async function run(callback) {
    notice("");
    try { await callback(); } catch (error) { notice(error instanceof Error ? error.message : "Request failed."); }
  }
  function showView(view) {
    state.view = view;
    document.querySelectorAll("[data-view-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.viewPanel === view));
    document.querySelectorAll(".messenger-dashboard-view [data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    document.querySelectorAll("[data-bots-view]").forEach(button => button.classList.toggle("active", button.dataset.botsView === view));
  }
  function setMessenger(messenger) {
    state.messenger = messenger;
    document.body.className = `messenger-${messenger} view-dashboard-active`;
    document.querySelectorAll("[data-bot]").forEach(button => button.classList.toggle("active", button.dataset.bot === messenger));
    document.querySelectorAll("[data-messenger-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.messengerPanel === messenger));
    document.querySelectorAll("[data-discord-only]").forEach(element => { element.hidden = messenger !== "discord"; });
    document.querySelectorAll("[data-non-discord-only]").forEach(element => { element.hidden = messenger === "discord"; });
    byId("messenger-dashboard-title").textContent = names[messenger];
    byId("messenger-dashboard-icon-badge").textContent = names[messenger][0];
    byId("messenger-dashboard-subtitle").textContent = `Manage your ${names[messenger]} bot and messages.`;
    byId("messenger-active-chip").textContent = names[messenger];
    const nouns = messenger === "discord" ? ["Servers", "Members", "Channels"]
      : messenger === "telegram" ? ["Chats", "Contacts", "Updates"]
      : messenger === "matrix" ? ["Rooms", "Members", "Events"]
      : ["Recipients", "Contacts", "Messages"];
    byId("messenger-dashboard-space-label").textContent = nouns[0];
    byId("messenger-dashboard-member-label").textContent = nouns[1];
    byId("messenger-dashboard-channel-label").textContent = nouns[2];
    byId("messenger-dashboard-space-title").textContent = `${nouns[0].replace(/s$/, "")} Info`;
    byId("messenger-dashboard-server-name-label").textContent = `${nouns[0].replace(/s$/, "")} Name`;
    byId("messenger-dashboard-server-id-label").textContent = `${nouns[0].replace(/s$/, "")} ID`;
    byId("messenger-dashboard-server-members-label").textContent = nouns[1];
    showView("dashboard");
    renderSnapshot();
  }
  function renderSnapshot() {
    const runtime = state.snapshot.runtimes.find(item => item.messenger === state.messenger);
    const status = runtime?.status || "stopped";
    byId("messenger-dashboard-runtime-state").textContent = status;
    byId("messenger-dashboard-runtime-meta").textContent = runtime?.message || "Runtime is not connected.";
    byId("messenger-dashboard-bot-name").textContent = runtime?.label || names[state.messenger];
    byId("messenger-dashboard-bot-id").textContent = runtime?.pid ? `PID ${runtime.pid}` : "No process";
    byId("messenger-dashboard-connected-since").textContent = runtime?.startedAt || "Not connected";
    byId("messenger-dashboard-permissions").textContent = runtime?.configured ? "Configured" : "Credentials needed";
    byId("messenger-dashboard-enabled-pill").textContent = status;
    byId("messenger-dashboard-quick-runtime-button").textContent = status === "running" ? "Stop Messenger" : "Start Messenger";
    byId("bots-start").disabled = status === "running" || status === "starting";
    byId("bots-stop").disabled = status === "stopped" || status === "stopping";
    byId("bots-restart").disabled = status === "stopped";
    const events = state.snapshot.events.filter(event => event.messenger === state.messenger).slice(-8).reverse();
    const list = byId("messenger-dashboard-recent-list");
    list.replaceChildren(...events.map(event => {
      const item = document.createElement("div");
      item.className = "messenger-dashboard-message-item";
      item.textContent = `${new Date(event.createdAt).toLocaleString()} · ${event.message}`;
      return item;
    }));
    if (!events.length) list.textContent = "No recent runtime events.";
    byId("messenger-dashboard-message-count").textContent = String(events.length);
    byId("messenger-dashboard-message-subtitle").textContent = "Recent runtime events";
  }
  async function refresh() {
    state.snapshot = await api("/api/messenger-runtimes");
    renderSnapshot();
    if (state.messenger === "discord") {
      // Only the scoped bot servers expose this route; the Studio-embedded
      // frame keeps the runtime snapshot instead of reporting "Not found".
      const result = await api("/api/discord/status").catch(() => null);
      if (!result) return;
      byId("messenger-dashboard-bot-name").textContent = result.bot?.tag || "Discord bot";
      byId("messenger-dashboard-bot-id").textContent = result.bot?.id || "Not connected";
      byId("messenger-dashboard-space-count").textContent = String(result.bot?.guildCount || 0);
      byId("messenger-dashboard-space-label").textContent = "Servers";
    }
  }
  async function control(action) {
    const messenger = state.messenger;
    await api("/api/messenger-runtimes/control", { messenger, action });
    await refresh();
    notice(`${names[messenger]} ${action} requested.`);
  }
  async function loadTargets(messenger) {
    const routes = { telegram: "/api/telegram/chats", matrix: "/api/matrix/rooms", whatsapp: "/api/whatsapp/contacts" };
    const result = await api(routes[messenger]);
    const records = result.chats || result.rooms || result.contacts || [];
    const targetId = messenger === "telegram" ? "telegram-chat-list" : messenger === "matrix" ? "matrix-activity-list" : null;
    if (targetId) {
      const target = byId(targetId);
      target.replaceChildren(...records.map(record => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        const id = String(record.chatId || record.roomId || record.id || "");
        button.textContent = String(record.title || record.name || id);
        button.addEventListener("click", () => { byId(messenger === "telegram" ? "telegram-chat-id-input" : "matrix-room-id-input").value = id; });
        return button;
      }));
      if (!records.length) target.textContent = "No entries found.";
    }
    notice(`${names[messenger]}: ${records.length} ${messenger === "telegram" ? "chats" : messenger === "matrix" ? "rooms" : "contacts"} loaded.`);
  }
  async function sendMessage(messenger) {
    const fields = {
      telegram: ["telegram-chat-id-input", "telegram-message-text", "/api/telegram/send-message", "chatId"],
      matrix: ["matrix-room-id-input", "matrix-message-text", "/api/matrix/send-message", "roomId"],
      whatsapp: ["whatsapp-to-input", "whatsapp-message-text", "/api/whatsapp/send-message", "to"]
    };
    const [recipientId, textId, route, key] = fields[messenger];
    const recipient = byId(recipientId).value.trim();
    const text = byId(textId).value.trim();
    if (!recipient || !text) throw new Error("Choose a recipient and enter a message.");
    await api(route, { [key]: recipient, text });
    byId(textId).value = "";
    notice(`${names[messenger]} message sent.`);
  }
  document.querySelectorAll("[data-bot]").forEach(button => button.addEventListener("click", () => setMessenger(button.dataset.bot)));
  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin) return;
    const messenger = event.data?.type === "urage:select-bot" ? event.data.messenger : "";
    if (names[messenger]) setMessenger(messenger);
  });
  document.querySelectorAll(".messenger-dashboard-view [data-view]").forEach(button => button.addEventListener("click", () => {
    const view = button.dataset.view;
    showView(view === "messaging" ? "messenger" : view);
  }));
  document.querySelectorAll("[data-bots-view]").forEach(button => button.addEventListener("click", () => {
    const view = button.dataset.botsView;
    showView(view === "messaging" ? "messenger" : view);
  }));
  for (const action of ["start", "stop", "restart"]) byId(`bots-${action}`).addEventListener("click", () => run(() => control(action)));
  byId("messenger-dashboard-quick-runtime-button").addEventListener("click", () => run(() => control(byId("bots-start").disabled ? "stop" : "start")));
  byId("bots-refresh").addEventListener("click", () => run(refresh));
  for (const messenger of ["telegram", "matrix", "whatsapp"]) {
    const sendId = messenger === "telegram" ? "telegram-send-message-button" : messenger === "matrix" ? "matrix-send-message-button" : "whatsapp-send-message-button";
    byId(sendId).addEventListener("click", () => run(() => sendMessage(messenger)));
  }
  byId("telegram-refresh-chats-button").addEventListener("click", () => run(() => loadTargets("telegram")));
  byId("matrix-refresh-rooms-button").addEventListener("click", () => run(() => loadTargets("matrix")));
  byId("matrix-refresh-activity-button").addEventListener("click", () => run(async () => {
    const result = await api("/api/matrix/events");
    byId("matrix-activity-list").textContent = (result.events || []).slice(-20).map(event => event.message || JSON.stringify(event)).join("\n") || "No recent activity.";
  }));
  byId("matrix-load-workflow-permissions-button").addEventListener("click", () => run(async () => {
    const result = await api("/api/matrix/workflow-permissions");
    notice(`Loaded ${Object.keys(result || {}).length} Matrix permission entries.`);
  }));
  byId("matrix-save-workflow-permissions-button").addEventListener("click", () => run(async () => {
    const roomId = byId("matrix-workflow-room-id").value.trim();
    const workflows = [...byId("matrix-workflow-permission-actions").querySelectorAll("input:checked")].map(input => input.value);
    if (!roomId) throw new Error("Enter a Matrix room ID.");
    await api("/api/matrix/workflow-permissions", { roomId, workflows, allowAllMembers: byId("matrix-workflow-allow-all-members").checked });
    notice("Matrix room permissions saved.");
  }));
  function syncHostTheme() {
    let host;
    try { host = window.parent !== window ? window.parent.document : null; } catch { host = null; }
    if (!host) return;
    const apply = () => {
      const theme = host.body.getAttribute("data-dashboard-theme");
      if (theme) document.body.setAttribute("data-dashboard-theme", theme);
      document.documentElement.style.cssText = host.documentElement.style.cssText;
      document.body.style.cssText = host.body.style.cssText;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(host.body, { attributes: true, attributeFilter: ["data-dashboard-theme", "style"] });
    observer.observe(host.documentElement, { attributes: true, attributeFilter: ["style"] });
  }
  syncHostTheme();
  const initialMessenger = new URLSearchParams(window.location.search).get("messenger") || "discord";
  setMessenger(names[initialMessenger] ? initialMessenger : "discord");
  run(refresh);
})();
