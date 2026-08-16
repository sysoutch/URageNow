type DiscordRuntimeControlInput = {
  client: {
    isReady: () => boolean;
    user: unknown;
    login: (token: string) => Promise<unknown>;
    destroy: () => void;
  };
  canStartDiscordRuntime: boolean;
  discordTokenRuntime: string;
  getGlobalSettings: () => {
    ollamaUrl: string;
    comfyUiBaseUrl: string;
    lmStudioBaseUrl: string;
    lmStudioApiKey: string;
  };
  dashboardBaseUrl: string;
  messengerAdminSharedSecret: string;
  telegramAdminBaseUrl: string;
  telegramAdminHost: string;
  telegramAdminPort: number;
  whatsappAdminBaseUrl: string;
  whatsappAdminHost: string;
  whatsappAdminPort: number;
};

export function createDiscordRuntimeControl(input: DiscordRuntimeControlInput) {
  let discordLoginPromise: Promise<void> | null = null;

  async function startDiscordRuntime(tokenOverride?: string): Promise<void> {
    const discordToken = typeof tokenOverride === "string" && tokenOverride.trim()
      ? tokenOverride.trim()
      : input.discordTokenRuntime;
    if (!discordToken) {
      throw new Error("No Discord token is available to this user. Store it as the same OS user that runs the dashboard, then restart the dashboard.");
    }
    if (input.client.isReady()) {
      return;
    }
    if (discordLoginPromise) {
      await discordLoginPromise;
      return;
    }
    discordLoginPromise = input.client.login(discordToken)
      .then(() => undefined)
      .finally(() => {
        discordLoginPromise = null;
      });
    await discordLoginPromise;
  }

  async function stopDiscordRuntime(): Promise<void> {
    if (discordLoginPromise) {
      try {
        await discordLoginPromise;
      } catch {
        // Ignore startup errors while trying to stop.
      }
    }
    if (!input.client.isReady() && !input.client.user) {
      return;
    }
    input.client.destroy();
  }

  function resolveSharedMessengerEnvironment(): Record<string, string> {
    const settings = input.getGlobalSettings();
    const ollamaGenerateUrl = settings.ollamaUrl.trim();
    const ollamaBaseUrl = ollamaGenerateUrl.replace(/\/api\/generate\/?$/i, "");
    const comfyBaseUrl = settings.comfyUiBaseUrl.trim();
    const dashboardBaseUrl = input.dashboardBaseUrl.trim();
    return {
      OLLAMA_URL: ollamaGenerateUrl,
      OLLAMA_API_URL: ollamaGenerateUrl,
      OLLAMA_BASE_URL: ollamaBaseUrl || ollamaGenerateUrl,
      COMFYUI_BASE_URL: comfyBaseUrl,
      COMFYUI_API_URL: comfyBaseUrl,
      LMSTUDIO_BASE_URL: settings.lmStudioBaseUrl.trim(),
      LMSTUDIO_API_KEY: settings.lmStudioApiKey.trim(),
      DASHBOARD_BASE_URL: dashboardBaseUrl,
      NODE_BOT_DASHBOARD_URL: dashboardBaseUrl,
      MESSENGER_ADMIN_SHARED_SECRET: input.messengerAdminSharedSecret.trim(),
      TELEGRAM_ADMIN_BASE_URL: input.telegramAdminBaseUrl.trim(),
      TELEGRAM_ADMIN_HOST: input.telegramAdminHost.trim(),
      TELEGRAM_ADMIN_PORT: String(input.telegramAdminPort),
      WHATSAPP_ADMIN_BASE_URL: input.whatsappAdminBaseUrl.trim(),
      WHATSAPP_ADMIN_HOST: input.whatsappAdminHost.trim(),
      WHATSAPP_ADMIN_PORT: String(input.whatsappAdminPort)
    };
  }

  return {
    startDiscordRuntime,
    stopDiscordRuntime,
    resolveSharedMessengerEnvironment
  };
}
