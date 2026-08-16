class DashboardMessagingHandlers {
  constructor(input) {
    this.input = input;
    this.pendingDraftId = "";
  }

  bind() {
    this.bindSendChannel();
    this.bindAskToChannel();
    this.bindConfirmDraft();
    this.bindSendDm();
    this.bindRefreshDmConversation();
    this.bindQuickPosts();
    this.bindQuickPostPreset();
  }

  getSelectedChannelId() {
    return this.input.state.selectedChannelId || "";
  }

  bindSendChannel() {
    const button = document.getElementById("send-channel-button");
    if (!button) {
      return;
    }
    button.addEventListener("click", async () => {
      const channelId = this.getSelectedChannelId();
      const editor = document.getElementById("channel-message");
      const content = editor ? editor.value.trim() : "";
      if (!channelId) return void this.input.setOutput("Select a channel first.");
      if (!content) return void this.input.setOutput("Channel message cannot be empty.");
      await this.input.request("/api/send-message", { channelId, content });
      editor.value = "";
      this.input.setOutput("Message sent to selected channel.");
      await this.input.loadBotMessages();
    });
  }

  bindAskToChannel() {
    const button = document.getElementById("ask-to-channel-button");
    if (!button) {
      return;
    }
    button.addEventListener("click", async () => {
      try {
        const channelId = this.getSelectedChannelId();
        const promptNode = document.getElementById("llm-prompt");
        const prompt = promptNode ? promptNode.value.trim() : "";
        if (!channelId) return void this.input.setOutput("Select a channel first.");
        if (!prompt) return void this.input.setOutput("Prompt cannot be empty.");
        const response = await this.input.request("/api/ask-to-channel", { channelId, prompt });
        if (response && response.mode === "draft" && response.draft) {
          this.pendingDraftId = response.draft.id || "";
          this.input.setOutput("Draft ready. Click Confirm Draft to send to the channel.");
          return;
        }
        this.pendingDraftId = "";
        this.input.setOutput("Rod response sent to selected channel.");
        await this.input.loadBotMessages();
      } catch (error) {
        const detail = error && error.message ? error.message : String(error);
        this.input.setOutput("Rod send failed: " + detail);
      }
    });
  }

  bindConfirmDraft() {
    const button = document.getElementById("confirm-latest-button");
    if (!button) {
      return;
    }
    button.addEventListener("click", async () => {
      if (!this.pendingDraftId) return void this.input.setOutput("No draft ready to confirm.");
      await this.input.request("/api/confirm-draft", { draftId: this.pendingDraftId });
      this.pendingDraftId = "";
      this.input.setOutput("Draft sent to channel.");
      await this.input.loadBotMessages();
    });
  }

  bindSendDm() {
    const button = document.getElementById("send-dm-button");
    if (!button) {
      return;
    }
    button.addEventListener("click", async () => {
      const userId = this.input.state.selectedUserId || "";
      const editor = document.getElementById("dm-message");
      const content = editor ? editor.value.trim() : "";
      if (!userId) return void this.input.setOutput("Select a user first.");
      if (!content) return void this.input.setOutput("DM message cannot be empty.");
      await this.input.request("/api/send-dm", { userId, content });
      editor.value = "";
      this.input.setOutput("DM sent.");
      if (typeof this.input.refreshDirectMessageRail === "function") {
        await this.input.refreshDirectMessageRail();
      }
      if (typeof this.input.refreshDirectMessageConversation === "function") {
        await this.input.refreshDirectMessageConversation();
      }
    });
  }

  bindRefreshDmConversation() {
    const button = document.getElementById("refresh-dm-conversation-button");
    if (!button) return;
    button.addEventListener("click", () => {
      void this.input.refreshDirectMessageConversation?.();
    });
  }

  bindQuickPosts() {
    const giftButton = document.getElementById("post-gift-button");
    if (giftButton) {
      giftButton.addEventListener("click", async () => {
        await this.runQuickPostPreset("unity-publisher-gift");
      });
    }
    const humbleButton = document.getElementById("post-humble-button");
    if (humbleButton) {
      humbleButton.addEventListener("click", async () => {
        await this.runQuickPostPreset("humble-software");
      });
    }
  }

  bindQuickPostPreset() {
    const button = document.getElementById("run-messaging-quick-preset-button");
    if (!button) {
      return;
    }
    button.addEventListener("click", async () => {
      const select = document.getElementById("messaging-quick-preset-select");
      const presetId = select && typeof select.value === "string" ? select.value.trim() : "";
      await this.runQuickPostPreset(presetId);
    });
  }

  async runQuickPostPreset(presetId) {
    const channelId = this.getSelectedChannelId();
    if (!channelId) {
      return void this.input.setOutput("Select a channel first.");
    }
    if (presetId === "unity-publisher-gift") {
      await this.input.request("/api/post-gift", { channelId });
      this.input.setOutput("Unity Publisher Gift preset posted.");
      await this.input.loadBotMessages();
      return;
    }
    if (presetId === "humble-software") {
      await this.input.request("/api/post-humble", { channelId });
      this.input.setOutput("Humble Software preset posted.");
      await this.input.loadBotMessages();
      return;
    }
    this.input.setOutput("Choose a quick post preset first.");
  }
}

function createDashboardMessagingHandlers(input) {
  return new DashboardMessagingHandlers(input);
}

if (typeof window !== "undefined") {
  window.createDashboardMessagingHandlers = createDashboardMessagingHandlers;
}
