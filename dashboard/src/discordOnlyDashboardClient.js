(() => {
  const byId = id => document.getElementById(id);
  const notice = message => { byId("bot-notice").textContent = message; };
  let definitions = [];
  let guildId = "";

  async function api(path, body) {
    const response = await fetch(path, body === undefined ? undefined : {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }
  async function action(callback) {
    notice("");
    try { await callback(); } catch (error) { notice(error instanceof Error ? error.message : "Request failed."); }
  }
  function option(value, text) {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = text;
    return item;
  }
  function commandRows(targetId, enabled, disabled = []) {
    const target = byId(targetId);
    target.replaceChildren();
    for (const definition of definitions) {
      const row = document.createElement("label");
      row.className = "command-row";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.value = definition.name;
      check.checked = enabled.includes(definition.name);
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = `/${definition.name}`;
      const detail = document.createElement("small");
      detail.textContent = definition.description + (disabled.includes(definition.name) ? " · inherited command disabled here" : "");
      copy.append(title, detail);
      row.append(check, copy);
      target.append(row);
    }
  }
  function guildCommandRows(settings) {
    const target = byId("bot-guild-commands");
    target.replaceChildren();
    for (const definition of definitions) {
      const row = document.createElement("label");
      row.className = "command-row";
      const title = document.createElement("span");
      title.textContent = `/${definition.name} · ${definition.description}`;
      const select = document.createElement("select");
      select.dataset.command = definition.name;
      select.append(option("inherit", "Inherit global"), option("enable", "Enable here"), option("disable", "Disable here"));
      select.value = settings.guildEnabledCommands?.includes(definition.name) ? "enable"
        : settings.guildDisabledInheritedCommands?.includes(definition.name) ? "disable" : "inherit";
      row.append(title, select);
      target.append(row);
    }
  }
  function checkedCommands(targetId) {
    return [...byId(targetId).querySelectorAll("input:checked")].map(input => input.value);
  }
  async function refreshStatus() {
    const data = await api("/api/discord/status");
    const running = Boolean(data.bot?.id);
    byId("bot-status").textContent = running ? "● Connected" : (data.runtime?.status || "Stopped");
    byId("bot-identity").textContent = running
      ? `${data.bot.tag || "Discord bot"} · ${data.bot.guildCount} server(s)`
      : `${data.runtime?.message || "Bot is not connected."} Start it after configuring the Discord token.`;
    byId("bot-start").disabled = running;
    byId("bot-stop").disabled = !running;
    byId("bot-restart").disabled = !running;
    const activity = byId("bot-activity-list");
    activity.replaceChildren(...(data.events || []).slice(-40).reverse().map(event => {
      const row = document.createElement("p");
      row.textContent = `${event.createdAt} · ${event.message}`;
      return row;
    }));
    if (!data.events?.length) activity.textContent = "No Discord runtime events yet.";
  }
  async function refreshGuilds() {
    const guilds = await api("/api/guilds");
    const picker = byId("bot-guild-select");
    const previous = picker.value || guildId;
    picker.replaceChildren(option("", "Choose a server"), ...guilds.map(guild => option(guild.id, guild.name)));
    if (guilds.some(guild => guild.id === previous)) picker.value = previous;
    guildId = picker.value;
    await refreshGuild();
  }
  async function refreshGuild() {
    guildId = byId("bot-guild-select").value;
    if (!guildId) {
      byId("bot-guild-summary").textContent = "Choose a server to manage welcome settings and commands.";
      byId("bot-channel-list").textContent = "Choose a server.";
      byId("bot-guild-commands").replaceChildren();
      return;
    }
    const [settings, channels, commands, moderation] = await Promise.all([
      api(`/api/guild-settings?guildId=${encodeURIComponent(guildId)}`),
      api(`/api/channels?guildId=${encodeURIComponent(guildId)}`),
      api(`/api/command-settings?guildId=${encodeURIComponent(guildId)}`),
      api(`/api/guild-dashboard-settings?guildId=${encodeURIComponent(guildId)}`)
    ]);
    byId("bot-guild-summary").textContent = `${channels.length} channel(s) available.`;
    byId("bot-welcome-enabled").checked = settings.welcomeEnabled === true;
    byId("bot-welcome-message").value = settings.welcomeMessage || "";
    const channelPicker = byId("bot-welcome-channel");
    channelPicker.replaceChildren(option("", "No channel"), ...channels.map(channel => option(channel.id, channel.name || channel.id)));
    channelPicker.value = settings.welcomeChannelId || "";
    const messagePicker = byId("bot-message-channel");
    const previousChannel = messagePicker.value;
    messagePicker.replaceChildren(option("", "Choose a channel"), ...channels.map(channel => option(channel.id, channel.name || channel.id)));
    if (channels.some(channel => channel.id === previousChannel)) messagePicker.value = previousChannel;
    const automationPicker = byId("bot-automation-channel");
    const previousAutomationChannel = automationPicker.value;
    automationPicker.replaceChildren(option("", "Choose a channel"), ...channels.map(channel => option(channel.id, channel.name || channel.id)));
    if (channels.some(channel => channel.id === previousAutomationChannel)) automationPicker.value = previousAutomationChannel;
    byId("bot-antispam-enabled").checked = moderation.antiSpamEnabled === true;
    byId("bot-antispam-timeouts").checked = moderation.antiSpamApplyTimeouts === true;
    byId("bot-antispam-rules").value = (moderation.antiSpamTextRulePatterns || []).join("\n");
    const channelList = byId("bot-channel-list");
    channelList.replaceChildren(...channels.map(channel => {
      const item = document.createElement("p");
      item.textContent = `# ${channel.name || channel.id}`;
      return item;
    }));
    guildCommandRows(commands);
    await refreshAutomations();
  }
  async function refreshAutomations() {
    const target = byId("bot-automation-list");
    if (!guildId) { target.textContent = "Choose a server."; return; }
    const data = await api(`/api/discord/automations?guildId=${encodeURIComponent(guildId)}`);
    target.replaceChildren();
    for (const entry of [...data.scheduled, ...data.joins]) {
      const row = document.createElement("div");
      row.className = "command-row";
      const summary = document.createElement("span");
      const isScheduled = "triggerMode" in entry;
      summary.textContent = `${entry.enabled ? "●" : "○"} ${entry.name} · ${isScheduled ? "schedule" : "member join"} · ${entry.action.source}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary danger";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => action(async () => {
        if (!window.confirm(`Delete ${entry.name}?`)) return;
        await api("/api/discord/automations", { action: "delete", guildId, id: entry.id });
        await refreshAutomations();
        notice("Automation deleted.");
      }));
      row.append(summary, remove);
      target.append(row);
    }
    if (!data.scheduled.length && !data.joins.length) target.textContent = "No Discord automations for this server.";
  }
  async function refreshCommands() {
    definitions = await api("/api/command-definitions");
    const settings = await api("/api/command-settings");
    commandRows("bot-global-commands", settings.globalEnabledCommands || []);
    if (guildId) await refreshGuild();
  }
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(entry => entry.classList.toggle("active", entry === button));
    document.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== tab; });
  }));
  byId("bot-guild-select").addEventListener("change", () => action(refreshGuild));
  for (const verb of ["start", "stop", "restart"]) byId(`bot-${verb}`).addEventListener("click", () => action(async () => {
    const result = await api("/api/discord/runtime", { action: verb });
    notice(result.runtime?.message || `Bot ${verb} requested.`);
    await refreshStatus();
    await refreshGuilds();
  }));
  byId("bot-refresh").addEventListener("click", () => action(async () => { await Promise.all([refreshStatus(), refreshGuilds(), refreshCommands()]); notice("Bot dashboard refreshed."); }));
  byId("bot-save-guild").addEventListener("click", () => action(async () => {
    if (!guildId) throw new Error("Choose a server first.");
    await api("/api/guild-settings", { guildId, welcomeEnabled: byId("bot-welcome-enabled").checked,
      welcomeChannelId: byId("bot-welcome-channel").value, welcomeMessage: byId("bot-welcome-message").value });
    notice("Guild settings saved.");
  }));
  byId("bot-save-moderation").addEventListener("click", () => action(async () => {
    if (!guildId) throw new Error("Choose a server first.");
    await api("/api/discord/moderation", { guildId,
      antiSpamEnabled: byId("bot-antispam-enabled").checked,
      antiSpamApplyTimeouts: byId("bot-antispam-timeouts").checked,
      antiSpamTextRulePatterns: byId("bot-antispam-rules").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean) });
    notice("Moderation settings saved.");
  }));
  byId("bot-send-message").addEventListener("click", () => action(async () => {
    const channelId = byId("bot-message-channel").value;
    const content = byId("bot-message-content").value.trim();
    if (!channelId || !content) throw new Error("Choose a channel and enter a message.");
    await api("/api/send-message", { channelId, content });
    byId("bot-message-content").value = "";
    notice("Message sent.");
    await refreshMessages();
  }));
  async function refreshMessages() {
    const channelId = byId("bot-message-channel").value;
    if (!channelId) throw new Error("Choose a channel first.");
    const messages = await api(`/api/channel-bot-messages?channelId=${encodeURIComponent(channelId)}`);
    const target = byId("bot-recent-messages");
    target.replaceChildren(...messages.map(message => {
      const row = document.createElement("p");
      row.textContent = message.content || "(empty message)";
      return row;
    }));
    if (!messages.length) target.textContent = "No recent bot messages.";
  }
  byId("bot-refresh-messages").addEventListener("click", () => action(refreshMessages));
  byId("bot-send-dm").addEventListener("click", () => action(async () => {
    const userId = byId("bot-dm-user").value.trim();
    const content = byId("bot-dm-content").value.trim();
    if (!/^\d{15,22}$/.test(userId) || !content) throw new Error("Enter a Discord user ID and message.");
    await api("/api/send-dm", { userId, content });
    byId("bot-dm-content").value = "";
    notice("Direct message sent.");
  }));
  byId("bot-automation-scope").addEventListener("change", () => {
    const scheduled = byId("bot-automation-scope").value === "schedule";
    byId("bot-automation-interval").disabled = !scheduled;
    byId("bot-automation-unit").disabled = !scheduled;
  });
  byId("bot-save-automation").addEventListener("click", () => action(async () => {
    if (!guildId) throw new Error("Choose a server first.");
    await api("/api/discord/automations", { guildId,
      scope: byId("bot-automation-scope").value,
      name: byId("bot-automation-name").value.trim(), channelId: byId("bot-automation-channel").value,
      template: byId("bot-automation-template").value.trim(),
      intervalValue: Number(byId("bot-automation-interval").value), intervalUnit: byId("bot-automation-unit").value });
    byId("bot-automation-name").value = "";
    byId("bot-automation-template").value = "";
    await refreshAutomations();
    notice("Discord text automation created.");
  }));
  byId("bot-refresh-automations").addEventListener("click", () => action(refreshAutomations));
  byId("bot-refresh-activity").addEventListener("click", () => action(refreshStatus));
  byId("bot-save-global").addEventListener("click", () => action(async () => {
    await api("/api/command-settings/global", { commandNames: checkedCommands("bot-global-commands") });
    notice("Global command settings saved. Sync them to publish the change.");
  }));
  byId("bot-sync-global").addEventListener("click", () => action(async () => {
    const result = await api("/api/command-sync/global", {});
    notice(`Published ${result.syncedCount} global command(s) to Discord.`);
  }));
  byId("bot-save-commands-guild").addEventListener("click", () => action(async () => {
    if (!guildId) throw new Error("Choose a server first.");
    const choices = [...byId("bot-guild-commands").querySelectorAll("select")];
    await api("/api/command-settings/guild", { guildId,
      guildEnabledCommands: choices.filter(choice => choice.value === "enable").map(choice => choice.dataset.command),
      guildDisabledInheritedCommands: choices.filter(choice => choice.value === "disable").map(choice => choice.dataset.command) });
    notice("Server command settings saved. Sync them to publish the change.");
  }));
  byId("bot-sync-commands-guild").addEventListener("click", () => action(async () => {
    if (!guildId) throw new Error("Choose a server first.");
    const result = await api("/api/command-sync/guild", { guildId });
    notice(`Published ${result.syncedCount} command(s) for this server.`);
  }));
  action(async () => {
    await refreshStatus();
    await refreshCommands();
    await refreshGuilds();
    try { byId("bot-invite").href = (await api("/api/invite-link")).url; } catch { byId("bot-invite").textContent = "Invite link unavailable until the bot is configured."; }
  });
})();
