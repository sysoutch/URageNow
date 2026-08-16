function createDashboardAiActionHelpers(input) {
  const replyStyleEditor = typeof createDashboardChatReplyStyleEditor === "function"
    ? createDashboardChatReplyStyleEditor({request: input.request})
    : null;
  const composerContextController = typeof createDashboardChatComposerContextController === "function"
    ? createDashboardChatComposerContextController({
      getActiveSession: () => getActiveAskSession(),
      persistSessions: () => persistAskChatStore(),
      getPersonalityLabel: () => askPersistedPersonalityLabel,
      replyStyleEditor
    })
    : null;
  const slashCommandController = typeof createDashboardChatSlashCommandController === "function"
    ? createDashboardChatSlashCommandController({request: input.request})
    : null;
  let askThinkAnimationToken = 0;
  let askSpeechActive = false;
  let askGeneratedSpeechAudio = null;
  let askSpeechVoicesListenerBound = false;
  let askRequestInFlight = false;
  let askStreamingSessionId = "";
  let askStreamingAssistantMessageId = "";
  let askActiveRequestId = "";
  let askActiveAbortController = null;
  const askSendQueue = [];
  const imageDelightWorkflowPath = String(globalThis.dashboardComfyWorkflowPaths?.image?.delight || "");
  const askAutoEnterStorageKey = "urage-ask-auto-enter-send";
  const askAutoTriggerSkillsStorageKey = "urage-ask-auto-trigger-skills";
  const askAutoRunSkillsStorageKey = "urage-ask-auto-run-skills";
  const askAutoTtsStorageKey = "urage-ask-auto-tts";
  const askTtsVoiceStorageKey = "urage-ask-tts-voice";
  const askTtsModeStorageKey = "urage-ask-tts-mode";
  const askChatStorageKey = "urage-ask-chat-sessions-v2";
  const askChatMaxSessions = 12;
  const askChatMaxMessages = 120;
  const askChatMaxImagePayload = 180_000;
  const askModelPreviewControllers = new Map();
  const codeExtensionByLanguage = {
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    tsx: "tsx",
    jsx: "jsx",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    python: "py",
    py: "py",
    shell: "sh",
    bash: "sh",
    sh: "sh",
    powershell: "ps1",
    ps1: "ps1",
    sql: "sql",
    markdown: "md",
    md: "md",
    yaml: "yml",
    yml: "yml",
    go: "go",
    rust: "rs",
    java: "java",
    c: "c",
    cpp: "cpp",
    csharp: "cs",
    cs: "cs",
    php: "php",
    ruby: "rb",
    swift: "swift",
    kotlin: "kt",
    lua: "lua"
  };
  const askQuickActionBootstrapIconNameByKey = {
    tts: "volume-up",
    ttsStop: "stop-circle",
    save: "floppy",
    model3d: "box",
    removeBg: "transparency",
    delight: "stars",
    normalMap: "image",
    lowpoly: "bounding-box-circles",
    edit: "pencil-square",
    delete: "trash3",
    busy: "hourglass-split"
  };

  function getAskNodes() {
    const messageList = document.getElementById("ask-chat-messages");
    const feed = document.getElementById("ask-chat-feed");
    const tabs = document.getElementById("ask-chat-tabs");
    const foldout = document.getElementById("ask-think-foldout");
    const thinkOutput = document.getElementById("ask-think-output");
    const askPrompt = document.getElementById("ask-prompt");
    return { messageList, feed, tabs, foldout, thinkOutput, askPrompt };
  }

  function clearAskComposerAttachmentTray() {
    const tray = document.getElementById("ask-composer-attachment-tray");
    if (!tray) return;
    tray.replaceChildren();
    tray.classList.add("hidden");
  }
  function getAskSendModeNodes() {
    const autoEnterToggle = document.getElementById("ask-auto-enter-send");
    const autoTriggerSkillsToggle = document.getElementById("ask-auto-trigger-skills");
    const autoRunSkillsToggle = document.getElementById("ask-auto-run-skills");
    const autoTtsToggle = document.getElementById("ask-auto-tts");
    const ttsVoiceSelect = document.getElementById("ask-tts-voice");
    const ttsModeSelect = document.getElementById("ask-tts-mode");
    const shortcutHint = document.getElementById("ask-send-shortcut-hint");
    return { autoEnterToggle, autoTriggerSkillsToggle, autoRunSkillsToggle, autoTtsToggle, ttsVoiceSelect, ttsModeSelect, shortcutHint };
  }
  function getAskPersonalityNodes() {
    const select = document.getElementById("ask-personality-select");
    const labelInput = document.getElementById("ask-personality-label");
    const promptInput = document.getElementById("ask-personality-prompt");
    const userInput = document.getElementById("ask-user-memory");
    const saveButton = document.getElementById("ask-personality-save-button");
    const addButton = document.getElementById("ask-personality-add-button");
    const deleteButton = document.getElementById("ask-personality-delete-button");
    const status = document.getElementById("ask-personality-status");
    return { select, labelInput, promptInput, userInput, saveButton, addButton, deleteButton, status };
  }

  let askPersonalityState = {
    soul: { activePersonalityId: "normal", personalities: [] },
    userMarkdown: ""
  };
  let askPersonalityEditingId = "normal";
  let askPersistedPersonalityLabel = "Normal";

  function createAskId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function normalizeAskPersonalityId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  function getActiveAskPersonality() {
    const soul = askPersonalityState.soul || {};
    const personalities = Array.isArray(soul.personalities) ? soul.personalities : [];
    const activeId = normalizeAskPersonalityId(soul.activePersonalityId || "normal");
    return personalities.find(entry => normalizeAskPersonalityId(entry && entry.id) === activeId) || personalities[0] || null;
  }
  function setAskPersonalityStatus(message) {
    const { status } = getAskPersonalityNodes();
    if (status) {
      status.textContent = String(message || "");
    }
  }
  function renderAskPersonalityEditor() {
    const nodes = getAskPersonalityNodes();
    if (!nodes.select) {
      return;
    }
    const soul = askPersonalityState.soul || { activePersonalityId: "normal", personalities: [] };
    const personalities = Array.isArray(soul.personalities) ? soul.personalities : [];
    clearNode(nodes.select);
    personalities.forEach(personality => {
      const option = document.createElement("option");
      option.value = personality.id;
      option.textContent = personality.label || personality.id;
      nodes.select.appendChild(option);
    });
    nodes.select.value = soul.activePersonalityId || (personalities[0] ? personalities[0].id : "");
    askPersonalityEditingId = normalizeAskPersonalityId(nodes.select.value || soul.activePersonalityId || "normal");
    const active = getActiveAskPersonality();
    if (nodes.labelInput) {
      nodes.labelInput.value = active ? active.label : "";
    }
    if (nodes.promptInput) {
      nodes.promptInput.value = active ? active.prompt : "";
    }
    if (nodes.userInput) {
      nodes.userInput.value = askPersonalityState.userMarkdown || "";
    }
    composerContextController?.render();
  }
  function captureAskPersonalityEditor() {
    const nodes = getAskPersonalityNodes();
    const soul = askPersonalityState.soul || { activePersonalityId: "normal", personalities: [] };
    const selectedId = normalizeAskPersonalityId(nodes.select ? nodes.select.value : soul.activePersonalityId);
    const editingId = normalizeAskPersonalityId(askPersonalityEditingId || selectedId || soul.activePersonalityId);
    const personalities = (Array.isArray(soul.personalities) ? soul.personalities : []).map(entry => {
      if (normalizeAskPersonalityId(entry && entry.id) !== editingId) {
        return entry;
      }
      const label = nodes.labelInput && nodes.labelInput.value.trim() ? nodes.labelInput.value.trim() : entry.label;
      return {
        id: entry.id,
        label,
        prompt: nodes.promptInput ? nodes.promptInput.value.trim() : entry.prompt
      };
    });
    return {
      soul: {...soul, activePersonalityId: selectedId || editingId, personalities},
      userMarkdown: nodes.userInput ? nodes.userInput.value : askPersonalityState.userMarkdown
    };
  }
  async function loadAskPersonalitySettings() {
    const response = await fetch("/api/chat-personality", { headers: { accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload && payload.error ? payload.error : "Failed to load personality settings.");
    }
    askPersonalityState = {
      soul: payload.soul || { activePersonalityId: "normal", personalities: [] },
      userMarkdown: payload.userMarkdown || ""
    };
    askPersistedPersonalityLabel = getActiveAskPersonality()?.label || "Normal";
    renderAskPersonalityEditor();
    setAskPersonalityStatus("Loaded SOUL.md and USER.md.");
  }
  async function saveAskPersonalitySettings() {
    const nextState = captureAskPersonalityEditor();
    const payload = await input.request("/api/chat-personality", nextState);
    askPersonalityState = {
      soul: payload.soul || nextState.soul,
      userMarkdown: payload.userMarkdown || nextState.userMarkdown
    };
    askPersistedPersonalityLabel = getActiveAskPersonality()?.label || "Normal";
    renderAskPersonalityEditor();
    setAskPersonalityStatus("Saved SOUL.md and USER.md.");
  }
  function addAskPersonalityOption() {
    const nodes = getAskPersonalityNodes();
    const baseLabel = nodes.labelInput && nodes.labelInput.value.trim() ? nodes.labelInput.value.trim() : "Custom";
    const baseId = normalizeAskPersonalityId(baseLabel) || "custom";
    const soul = captureAskPersonalityEditor().soul;
    const existing = new Set((soul.personalities || []).map(entry => normalizeAskPersonalityId(entry && entry.id)));
    let id = baseId;
    let index = 2;
    while (existing.has(id)) {
      id = baseId + "-" + index;
      index += 1;
    }
    soul.personalities = (soul.personalities || []).concat([{
      id,
      label: baseLabel,
      prompt: nodes.promptInput && nodes.promptInput.value.trim() ? nodes.promptInput.value.trim() : "Write this personality prompt."
    }]);
    soul.activePersonalityId = id;
    askPersonalityState = { soul, userMarkdown: nodes.userInput ? nodes.userInput.value : askPersonalityState.userMarkdown };
    renderAskPersonalityEditor();
    setAskPersonalityStatus("Added personality option. Save to write SOUL.md.");
  }
  function deleteAskPersonalityOption() {
    const nodes = getAskPersonalityNodes();
    const activeId = normalizeAskPersonalityId(nodes.select ? nodes.select.value : "");
    const soul = captureAskPersonalityEditor().soul;
    const personalities = (soul.personalities || []).filter(entry => normalizeAskPersonalityId(entry && entry.id) !== activeId);
    if (personalities.length === 0) {
      setAskPersonalityStatus("Keep at least one personality option.");
      return;
    }
    soul.personalities = personalities;
    soul.activePersonalityId = personalities[0].id;
    askPersonalityState = { soul, userMarkdown: nodes.userInput ? nodes.userInput.value : askPersonalityState.userMarkdown };
    renderAskPersonalityEditor();
    setAskPersonalityStatus("Deleted personality option. Save to write SOUL.md.");
  }
  function toAbsoluteDashboardUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    try {
      return new URL(raw, window.location.origin).toString();
    } catch {
      return raw;
    }
  }
  function escapeSelectorValue(value) {
    const raw = String(value || "");
    if (typeof window.CSS !== "undefined" && typeof window.CSS.escape === "function") {
      return window.CSS.escape(raw);
    }
    return raw.replace(/([#.;?+*~':"!^$[\]()=>|/@])/g, "\\$1");
  }
  function clearNode(node) {
    if (!node) {
      return;
    }
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }
  function getAskQuickActionIconName(iconKey) {
    const normalized = String(iconKey || "").trim();
    return askQuickActionBootstrapIconNameByKey[normalized] || askQuickActionBootstrapIconNameByKey.delight;
  }
  function setAskQuickActionButtonContent(button, label, iconKey) {
    if (!button) {
      return;
    }
    const text = String(label || "").trim() || "Action";
    button.classList.add("ask-quick-action-button");
    button.setAttribute("aria-label", text);
    button.title = text;
    button.innerHTML =
      "<span class=\"ask-quick-action-icon\" aria-hidden=\"true\">"
      + "<i class=\"bi bi-" + getAskQuickActionIconName(iconKey) + "\"></i>"
      + "</span>"
      + "<span class=\"ask-quick-action-label\">" + text + "</span>";
  }
  function updateAskButtonState() {
    const askButton = document.getElementById("ask-button");
    if (!askButton) {
      return;
    }
    if (askRequestInFlight) {
      askButton.classList.add("is-stopping-capable");
      askButton.innerHTML = "<span>Stop</span>";
      askButton.setAttribute("aria-label", "Stop LazyDev response");
      askButton.title = "Stop LazyDev response";
      document.dispatchEvent(new Event("ask-composer-primary-action-sync"));
      return;
    }
    askButton.classList.remove("is-stopping-capable");
    askButton.innerHTML = "<span>Send</span>";
    askButton.setAttribute("aria-label", "Send prompt");
    askButton.title = "Send prompt";
    document.dispatchEvent(new Event("ask-composer-primary-action-sync"));
  }
  async function stopAskRequest() {
    if (!askRequestInFlight) {
      return;
    }
    const requestId = askActiveRequestId;
    const controller = askActiveAbortController;
    ++askThinkAnimationToken;
    stopAskSpeech(true);
    input.setOutput("Stopping LazyDev response...");
    if (controller) {
      controller.abort();
    }
    await stopDashboardRequest(requestId);
  }

  function hasSpeechSupport() {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
  }
  function listSpeechSynthesisVoices() {
    if (!hasSpeechSupport()) {
      return [];
    }
    const voices = window.speechSynthesis.getVoices();
    return Array.isArray(voices) ? voices : [];
  }
  function classifySpeechVoiceGenderHint(voice) {
    const name = String(voice && voice.name ? voice.name : "").toLowerCase();
    const femaleHints = /\b(female|woman|girl|zira|aria|ava|sara|jenny|alloy|nova|fiona)\b/i;
    const maleHints = /\b(male|man|boy|david|mark|tom|alex|ryan|guy|echo|onyx)\b/i;
    if (femaleHints.test(name)) {
      return "female";
    }
    if (maleHints.test(name)) {
      return "male";
    }
    return "unknown";
  }
  function scoreSpeechVoiceForPreference(voice, preference) {
    let score = 0;
    const genderHint = classifySpeechVoiceGenderHint(voice);
    if (genderHint === preference) {
      score += 100;
    } else if (genderHint !== "unknown") {
      score -= 25;
    }
    const lang = String(voice && voice.lang ? voice.lang : "").toLowerCase();
    if (lang.startsWith("en")) {
      score += 8;
    }
    if (voice && voice.localService === true) {
      score += 6;
    }
    if (voice && voice.default === true) {
      score += 3;
    }
    return score;
  }
  function normalizeAskTtsVoicePreference(value) {
    return String(value || "").trim().toLowerCase() === "male" ? "male" : "female";
  }
  function getAskTtsVoicePreference() {
    const { ttsVoiceSelect } = getAskSendModeNodes();
    return ttsVoiceSelect ? normalizeAskTtsVoicePreference(ttsVoiceSelect.value) : "female";
  }
  function normalizeAskTtsMode(value) {
    return String(value || "").trim().toLowerCase() === "comfyui" ? "comfyui" : "builtin";
  }
  function getAskTtsMode() {
    const { ttsModeSelect } = getAskSendModeNodes();
    return ttsModeSelect ? normalizeAskTtsMode(ttsModeSelect.value) : "builtin";
  }
  function resolveAskTtsVoice() {
    const preference = getAskTtsVoicePreference();
    const voices = listSpeechSynthesisVoices();
    if (voices.length === 0) {
      return null;
    }
    const sorted = [...voices].sort((left, right) => {
      return scoreSpeechVoiceForPreference(right, preference) - scoreSpeechVoiceForPreference(left, preference);
    });
    return sorted[0] || null;
  }
  function stopAskSpeech(silent) {
    if (hasSpeechSupport()) {
      window.speechSynthesis.cancel();
    }
    if (askGeneratedSpeechAudio) {
      askGeneratedSpeechAudio.pause();
      askGeneratedSpeechAudio.currentTime = 0;
      askGeneratedSpeechAudio = null;
    }
    askSpeechActive = false;
    if (!silent) {
      input.setOutput("Stopped text to speech.");
    }
  }
  function speakAskText(text, options) {
    const silentStatus = options && options.silentStatus === true;
    const cleanText = String(text || "").trim();
    if (getAskTtsMode() === "comfyui") {
      void speakAskTextWithComfyUi(cleanText, silentStatus);
      return;
    }
    if (!hasSpeechSupport()) {
      if (!silentStatus) {
        input.setOutput("Text to speech is not supported in this browser.");
      }
      return;
    }
    if (!cleanText) {
      if (!silentStatus) {
        input.setOutput("No completed LazyDev response is ready for text to speech.");
      }
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(cleanText);
    const selectedVoice = resolveAskTtsVoice();
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      if (selectedVoice.lang) {
        utterance.lang = selectedVoice.lang;
      }
    } else {
      utterance.pitch = getAskTtsVoicePreference() === "male" ? 0.9 : 1.08;
    }
    askSpeechActive = true;
    utterance.onend = () => {
      askSpeechActive = false;
    };
    utterance.onerror = () => {
      askSpeechActive = false;
      input.setOutput("Text to speech failed while reading LazyDev's response.");
    };
    window.speechSynthesis.speak(utterance);
    if (!silentStatus) {
      input.setOutput("Reading LazyDev response aloud (" + getAskTtsVoicePreference() + " voice).");
    }
  }

  async function speakAskTextWithComfyUi(text, silentStatus) {
    if (!text) {
      if (!silentStatus) input.setOutput("No completed LazyDev response is ready for text to speech.");
      return;
    }
    stopAskSpeech(true);
    askSpeechActive = true;
    try {
      const response = await fetch("/api/speech-tts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, mode: "standard" })
      });
      const payload = await response.json();
      if (!response.ok || !payload.audioDataUrl) throw new Error(payload && payload.error ? payload.error : "ComfyUI TTS failed.");
      const audio = new Audio(payload.audioDataUrl);
      askGeneratedSpeechAudio = audio;
      audio.onended = () => { askSpeechActive = false; if (askGeneratedSpeechAudio === audio) askGeneratedSpeechAudio = null; };
      audio.onerror = () => { askSpeechActive = false; input.setOutput("ComfyUI TTS audio could not be played."); };
      await audio.play();
      if (!silentStatus) input.setOutput("Reading LazyDev response with ComfyUI TTS.");
    } catch (error) {
      askSpeechActive = false;
      if (!silentStatus) input.setOutput(error && error.message ? error.message : "ComfyUI TTS failed.");
    }
  }

  function normalizeAskUsedSkill(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const id = String(value.id || "").trim();
    if (!id) {
      return null;
    }
    const sourceRaw = String(value.source || "").trim();
    const source = sourceRaw === "explicit" || sourceRaw === "auto" ? sourceRaw : "auto";
    return {
      id,
      name: String(value.name || id).trim() || id,
      source
    };
  }
  function normalizeChatSkillIdClient(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  function resolveRequestedChatSkillIdClient(prompt) {
    const text = String(prompt || "").trim();
    const explicitMatch = text.match(/^\/skill\s+([a-z0-9-]+)/i);
    if (explicitMatch) {
      return normalizeChatSkillIdClient(explicitMatch[1] || "");
    }
    const shortcutMatch = text.match(/^\/(generate-image|generate-model|generate-lowpoly|generate-video|generate-audio|generate-music|remove-background|delight-image|create-normal-map|create-pixel-art|regenerate-image-filename|regenerate-model-filename|suggest-model-metadata|suggest-lowpoly-target|comfy-free-memory|add-cron-job|add-cron-job-discord|add-cron-job-telegram)(?:\s|$)/i);
    return shortcutMatch ? normalizeChatSkillIdClient(shortcutMatch[1] || "") : "";
  }
  function resolveLocalAskSkillRequest(prompt, images, models, autoRunSkills) {
    const requestedSkillId = resolveRequestedChatSkillIdClient(prompt);
    const hasImages = Array.isArray(images) && images.length > 0;
    const hasModels = Array.isArray(models) && models.length > 0;
    if (requestedSkillId === "create-pixel-art" && hasImages && !hasModels) {
      return { skillId: "create-pixel-art", source: "explicit" };
    }
    return null;
  }
  function describeAskSkillTask(skillId, source) {
    const id = normalizeChatSkillIdClient(skillId);
    const sourceText = source === "explicit" ? "requested" : "detected";
    if (id === "generate-image") {
      return "Starting " + sourceText + " image generation...";
    }
    if (id === "generate-model") {
      return "Starting " + sourceText + " image to 3D model generation...";
    }
    if (id === "generate-lowpoly") {
      return "Starting " + sourceText + " low poly model generation...";
    }
    if (id === "generate-video") {
      return "Starting " + sourceText + " video generation...";
    }
    if (id === "generate-audio") {
      return "Starting " + sourceText + " audio generation...";
    }
    if (id === "generate-music") {
      return "Starting " + sourceText + " music generation...";
    }
    if (id === "remove-background" || id === "delight-image" || id === "create-normal-map" || id === "create-pixel-art") {
      return "Starting " + sourceText + " image transform...";
    }
    if (id === "regenerate-image-filename" || id === "regenerate-model-filename") {
      return "Starting " + sourceText + " filename regeneration...";
    }
    if (id === "suggest-model-metadata" || id === "suggest-lowpoly-target") {
      return "Starting " + sourceText + " planning suggestion...";
    }
    if (id === "comfy-free-memory") {
      return "Starting " + sourceText + " ComfyUI memory cleanup...";
    }
    if (id === "add-cron-job" || id === "add-cron-job-discord" || id === "add-cron-job-telegram") {
      return "Starting " + sourceText + " scheduled automation setup...";
    }
    return id ? "Starting " + sourceText + " skill: " + id + "..." : "Preparing LazyDev task...";
  }
  function inferAskPendingTask(prompt, images, models, autoRunSkills) {
    const localSkill = resolveLocalAskSkillRequest(prompt, images, models, autoRunSkills);
    if (localSkill && localSkill.skillId) {
      return {
        text: describeAskSkillTask(localSkill.skillId, localSkill.source),
        usedSkill: { id: localSkill.skillId, name: localSkill.skillId, source: localSkill.source }
      };
    }
    const requestedSkillId = resolveRequestedChatSkillIdClient(prompt);
    if (requestedSkillId) {
      return {
        text: describeAskSkillTask(requestedSkillId, "explicit"),
        usedSkill: { id: requestedSkillId, name: requestedSkillId, source: "explicit" }
      };
    }
    if (autoRunSkills === false) {
      return { text: "", usedSkill: null };
    }
    const hasImages = Array.isArray(images) && images.length > 0;
    const hasModels = Array.isArray(models) && models.length > 0;
    if (hasImages || hasModels || String(prompt || "").trim()) {
      return { text: "", usedSkill: null };
    }
    return { text: "", usedSkill: null };
  }
  function buildAskConversationPayload(session) {
    if (!session || !Array.isArray(session.messages)) {
      return [];
    }
    return session.messages
      .slice(-12)
      .map(message => {
        const role = message && message.role === "assistant" ? "assistant" : message && message.role === "user" ? "user" : "";
        const text = String(message && message.text ? message.text : "").trim();
        if (!role || !text) {
          return null;
        }
        const usedSkillId = message.usedSkill && message.usedSkill.id ? normalizeChatSkillIdClient(message.usedSkill.id) : "";
        const artifactKinds = Array.isArray(message.artifacts)
          ? message.artifacts.map(artifact => String(artifact && artifact.kind ? artifact.kind : "").trim()).filter(kind =>
            kind === "image" || kind === "model" || kind === "audio" || kind === "video"
          )
          : [];
        return {
          role,
          text: text.slice(0, 4000),
          usedSkillId,
          artifactKinds
        };
      })
      .filter(Boolean);
  }
  function normalizeAskTaskStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "done") {
      return "done";
    }
    if (normalized === "error") {
      return "error";
    }
    return "pending";
  }
  function normalizeAskTaskSkillEntry(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const id = normalizeChatSkillIdClient(value.id || "");
    if (!id) {
      return null;
    }
    return {
      id,
      name: String(value.name || id).trim() || id,
      source: value.source === "explicit" || value.source === "auto" ? value.source : ""
    };
  }
  function normalizeAskTaskSkillList(value) {
    return Array.isArray(value)
      ? value
        .map(entry => normalizeAskTaskSkillEntry(entry))
        .filter(entry => Boolean(entry))
      : [];
  }
  function normalizeAskClarification(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const question = String(value.question || "").trim();
    const mode = value.mode === "suggestion" ? "suggestion" : "clarification";
    const groups = Array.isArray(value.groups)
      ? value.groups.map(group => {
        if (!group || typeof group !== "object") {
          return null;
        }
        const label = String(group.label || "").trim();
        const options = Array.isArray(group.options)
          ? group.options.map(option => {
            if (!option || typeof option !== "object") {
              return null;
            }
            const optionLabel = String(option.label || "").trim();
            const prompt = String(option.prompt || "").trim();
            const skillId = normalizeChatSkillIdClient(option.skillId || "");
            return optionLabel && prompt ? { label: optionLabel, prompt, skillId } : null;
          }).filter(option => Boolean(option))
          : [];
        return label && options.length > 0 ? { label, options } : null;
      }).filter(group => Boolean(group))
      : [];
    return question && groups.length > 0 ? { question, groups, mode } : null;
  }
  function normalizeAskTask(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const prompt = String(value.prompt || "").trim();
    const inputImageCount = typeof value.inputImageCount === "number" && Number.isFinite(value.inputImageCount)
      ? Math.max(0, Math.floor(value.inputImageCount))
      : 0;
    const inputModelCount = typeof value.inputModelCount === "number" && Number.isFinite(value.inputModelCount)
      ? Math.max(0, Math.floor(value.inputModelCount))
      : 0;
    const artifactCount = typeof value.artifactCount === "number" && Number.isFinite(value.artifactCount)
      ? Math.max(0, Math.floor(value.artifactCount))
      : 0;
    const requestedSkillId = normalizeChatSkillIdClient(value.requestedSkillId || "");
    const skillId = normalizeChatSkillIdClient(value.skillId || "");
    const skillSourceRaw = String(value.skillSource || "").trim();
    const skillSource = skillSourceRaw === "explicit" || skillSourceRaw === "auto" ? skillSourceRaw : "";
    const startedAt = typeof value.startedAt === "number" && Number.isFinite(value.startedAt)
      ? Math.max(0, Math.floor(value.startedAt))
      : 0;
    const finishedAt = typeof value.finishedAt === "number" && Number.isFinite(value.finishedAt)
      ? Math.max(0, Math.floor(value.finishedAt))
      : 0;
    const durationMs = typeof value.durationMs === "number" && Number.isFinite(value.durationMs)
      ? Math.max(0, Math.floor(value.durationMs))
      : 0;
    const queuedSkills = normalizeAskTaskSkillList(value.queuedSkills);
    return {
      prompt,
      inputImageCount,
      inputModelCount,
      artifactCount,
      autoRunSkills: value.autoRunSkills !== false,
      requestedSkillId,
      skillId,
      skillSource,
      status: normalizeAskTaskStatus(value.status),
      startedAt,
      finishedAt,
      durationMs,
      queuedSkills
    };
  }
  function mergeAskTask(currentTask, patchTask) {
    const current = normalizeAskTask(currentTask) || {
      prompt: "",
      inputImageCount: 0,
      inputModelCount: 0,
      artifactCount: 0,
      autoRunSkills: true,
      requestedSkillId: "",
      skillId: "",
      skillSource: "",
      status: "pending",
      startedAt: 0,
      finishedAt: 0,
      durationMs: 0,
      queuedSkills: []
    };
    if (!patchTask || typeof patchTask !== "object") {
      return current;
    }
    return normalizeAskTask({
      prompt: typeof patchTask.prompt === "string" ? patchTask.prompt : current.prompt,
      inputImageCount: typeof patchTask.inputImageCount === "number" ? patchTask.inputImageCount : current.inputImageCount,
      inputModelCount: typeof patchTask.inputModelCount === "number" ? patchTask.inputModelCount : current.inputModelCount,
      artifactCount: typeof patchTask.artifactCount === "number" ? patchTask.artifactCount : current.artifactCount,
      autoRunSkills: typeof patchTask.autoRunSkills === "boolean" ? patchTask.autoRunSkills : current.autoRunSkills,
      requestedSkillId: typeof patchTask.requestedSkillId === "string" ? patchTask.requestedSkillId : current.requestedSkillId,
      skillId: typeof patchTask.skillId === "string" ? patchTask.skillId : current.skillId,
      skillSource: typeof patchTask.skillSource === "string" ? patchTask.skillSource : current.skillSource,
      status: typeof patchTask.status === "string" ? patchTask.status : current.status,
      startedAt: typeof patchTask.startedAt === "number" ? patchTask.startedAt : current.startedAt,
      finishedAt: typeof patchTask.finishedAt === "number" ? patchTask.finishedAt : current.finishedAt,
      durationMs: typeof patchTask.durationMs === "number" ? patchTask.durationMs : current.durationMs,
      queuedSkills: Array.isArray(patchTask.queuedSkills) ? patchTask.queuedSkills : current.queuedSkills
    });
  }
  function createAskTaskFromInput(prompt, images, models, autoRunSkills) {
    const requestedSkillId = resolveRequestedChatSkillIdClient(prompt);
    return normalizeAskTask({
      prompt: String(prompt || "").trim(),
      inputImageCount: Array.isArray(images) ? images.length : 0,
      inputModelCount: Array.isArray(models) ? models.length : 0,
      artifactCount: 0,
      autoRunSkills: autoRunSkills !== false,
      requestedSkillId,
      skillId: "",
      skillSource: "",
      status: "pending",
      startedAt: Date.now(),
      finishedAt: 0,
      durationMs: 0,
      queuedSkills: []
    });
  }
  function formatAskTime(value) {
    const timestamp = typeof value === "number" && Number.isFinite(value) ? value : 0;
    if (timestamp <= 0) {
      return "";
    }
    try {
      return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "";
    }
  }
  function formatAskDuration(durationMs) {
    const ms = typeof durationMs === "number" && Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : 0;
    if (ms <= 0) {
      return "";
    }
    if (ms < 1000) {
      return ms + " ms";
    }
    const seconds = ms / 1000;
    return seconds >= 10 ? seconds.toFixed(1) + " s" : seconds.toFixed(2) + " s";
  }
  function formatAskTaskSkillLabel(skill) {
    if (!skill || !skill.id) {
      return "";
    }
    const sourceSuffix = skill.source ? " (" + skill.source + ")" : "";
    return (skill.name || skill.id) + sourceSuffix;
  }
  function normalizeAskArtifact(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const kind = String(entry.kind || "").trim().toLowerCase();
    if (kind === "image") {
      const imageId = String(entry.imageId || "").trim();
      const fileName = String(entry.fileName || "").trim();
      const url = String(entry.url || "").trim();
      if (!imageId || !fileName) {
        return null;
      }
      return {
        kind: "image",
        imageId,
        fileName,
        url,
        prompt: String(entry.prompt || "").trim()
      };
    }
    if (kind === "model") {
      const modelId = String(entry.modelId || "").trim();
      const fileName = String(entry.fileName || "").trim();
      const url = String(entry.url || "").trim();
      if (!modelId || !fileName) {
        return null;
      }
      const targetFaceCount = typeof entry.targetFaceCount === "number" && Number.isFinite(entry.targetFaceCount)
        ? Math.max(1, Math.round(entry.targetFaceCount))
        : null;
      return {
        kind: "model",
        modelId,
        fileName,
        url,
        prompt: String(entry.prompt || "").trim(),
        lowPoly: entry.lowPoly === true,
        previewUrl: String(entry.previewUrl || "").trim(),
        targetFaceCount
      };
    }
    if (kind === "audio") {
      const audioId = String(entry.audioId || "").trim();
      const fileName = String(entry.fileName || "").trim();
      const url = String(entry.url || "").trim();
      if (!audioId || !fileName) {
        return null;
      }
      return {
        kind: "audio",
        audioId,
        fileName,
        url,
        prompt: String(entry.prompt || "").trim(),
        isMusic: entry.isMusic === true
      };
    }
    if (kind === "video") {
      const videoId = String(entry.videoId || "").trim();
      const fileName = String(entry.fileName || "").trim();
      const url = String(entry.url || "").trim();
      if (!videoId || !fileName) {
        return null;
      }
      return {
        kind: "video",
        videoId,
        fileName,
        url,
        prompt: String(entry.prompt || "").trim()
      };
    }
    return null;
  }
  function normalizeAskSkillPlan(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const kind = String(entry.kind || "").trim();
    const prompt = normalizeAskPlanPromptText(entry.prompt);
    if (!prompt) {
      return null;
    }
    const index = typeof entry.index === "number" && Number.isFinite(entry.index) ? Math.max(1, Math.floor(entry.index)) : 0;
    const total = typeof entry.total === "number" && Number.isFinite(entry.total) ? Math.max(1, Math.floor(entry.total)) : 0;
    return {
      kind,
      skillId: normalizeChatSkillIdClient(entry.skillId || ""),
      title: String(entry.title || "").trim() || "Generation prompt ready",
      prompt,
      index,
      total
    };
  }
  function normalizeAskPlanPromptText(value) {
    if (typeof value === "string") {
      return value.trim();
    }
    if (!value || typeof value !== "object") {
      return "";
    }
    const candidates = [
      value.prompt,
      value.sourcePrompt,
      value.imagePrompt,
      value.modelPrompt,
      value.text,
      value.description,
      value.subject
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    return "";
  }
  function inferArtifactsFromResponseText(responseText) {
    const artifacts = [];
    const text = String(responseText || "");
    if (!text) {
      return artifacts;
    }
    const imageUrlMatches = text.match(/(?:https?:\/\/[^\s`)<]+)?\/api\/generated-image-file\?[^\s`)<]+/gi) || [];
    imageUrlMatches.forEach(rawMatch => {
      const absolute = toAbsoluteDashboardUrl(rawMatch);
      try {
        const parsedUrl = new URL(absolute);
        const imageId = String(parsedUrl.searchParams.get("imageId") || "").trim();
        const fileName = String(parsedUrl.searchParams.get("file") || "").trim();
        if (!imageId || !fileName) {
          return;
        }
        artifacts.push({ kind: "image", imageId, fileName, url: parsedUrl.pathname + parsedUrl.search, prompt: "" });
      } catch {}
    });
    const modelIdMatch = text.match(/Model\s+ID:\s*`([^`]+)`/i);
    const modelFileMatch = text.match(/Model\s+file:\s*`([^`]+)`/i);
    const modelId = modelIdMatch ? String(modelIdMatch[1] || "").trim() : "";
    const fileName = modelFileMatch ? String(modelFileMatch[1] || "").trim() : "";
    if (modelId && fileName) {
      const lowPoly = /low\s*poly/i.test(text);
      const faceMatch = text.match(/Target\s+faces:\s*(\d+)/i);
      const targetFaceCount = faceMatch ? Number.parseInt(faceMatch[1] || "", 10) : Number.NaN;
      artifacts.push({
        kind: "model",
        modelId,
        fileName,
        url: "/api/model3d-file?modelId=" + encodeURIComponent(modelId) + "&file=" + encodeURIComponent(fileName),
        prompt: "",
        lowPoly,
        targetFaceCount: Number.isFinite(targetFaceCount) ? Math.max(1, Math.round(targetFaceCount)) : null
      });
    }
    const audioUrlMatches = text.match(/(?:https?:\/\/[^\s`)<]+)?\/api\/generated-audio-file\?[^\s`)<]+/gi) || [];
    audioUrlMatches.forEach(rawMatch => {
      const absolute = toAbsoluteDashboardUrl(rawMatch);
      try {
        const parsedUrl = new URL(absolute);
        const audioId = String(parsedUrl.searchParams.get("audioId") || "").trim();
        const audioFileName = String(parsedUrl.searchParams.get("file") || "").trim();
        if (!audioId || !audioFileName) {
          return;
        }
        artifacts.push({
          kind: "audio",
          audioId,
          fileName: audioFileName,
          url: parsedUrl.pathname + parsedUrl.search,
          prompt: "",
          isMusic: /\bmusic\b/i.test(text)
        });
      } catch {}
    });
    const videoUrlMatches = text.match(/(?:https?:\/\/[^\s`)<]+)?\/api\/generated-video-file\?[^\s`)<]+/gi) || [];
    videoUrlMatches.forEach(rawMatch => {
      const absolute = toAbsoluteDashboardUrl(rawMatch);
      try {
        const parsedUrl = new URL(absolute);
        const videoId = String(parsedUrl.searchParams.get("videoId") || "").trim();
        const videoFileName = String(parsedUrl.searchParams.get("file") || "").trim();
        if (!videoId || !videoFileName) {
          return;
        }
        artifacts.push({
          kind: "video",
          videoId,
          fileName: videoFileName,
          url: parsedUrl.pathname + parsedUrl.search,
          prompt: ""
        });
      } catch {}
    });
    return artifacts;
  }
  function mergeAskArtifacts(explicitArtifacts, responseText) {
    const merged = [];
    const seen = new Set();
    const append = artifact => {
      const normalized = normalizeAskArtifact(artifact);
      if (!normalized) {
        return;
      }
      const key = normalized.kind === "image"
        ? "image|" + normalized.imageId + "|" + normalized.fileName
        : normalized.kind === "model"
          ? "model|" + normalized.modelId + "|" + normalized.fileName + "|" + (normalized.lowPoly ? "1" : "0")
          : normalized.kind === "audio"
            ? "audio|" + normalized.audioId + "|" + normalized.fileName
            : "video|" + normalized.videoId + "|" + normalized.fileName;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(normalized);
    };
    (Array.isArray(explicitArtifacts) ? explicitArtifacts : []).forEach(append);
    inferArtifactsFromResponseText(responseText).forEach(append);
    return merged;
  }
  async function refreshStudioHistoryForAskArtifact(artifact) {
    const normalized = normalizeAskArtifact(artifact);
    if (!normalized) {
      return;
    }
    try {
      if (normalized.kind === "image" && typeof input.loadImageHistory === "function") {
        await input.loadImageHistory(normalized.imageId);
      } else if (normalized.kind === "model" && typeof input.loadModel3dHistory === "function") {
        await input.loadModel3dHistory(normalized.modelId);
      } else if (normalized.kind === "audio" && typeof input.loadAudioHistory === "function") {
        await input.loadAudioHistory(normalized.audioId, normalized.isMusic ? normalized.audioId : "");
      } else if (normalized.kind === "video" && typeof input.loadVideoHistory === "function") {
        await input.loadVideoHistory(normalized.videoId);
      }
    } catch {}
  }
  async function refreshStudioHistoryForAskArtifacts(artifacts) {
    for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
      await refreshStudioHistoryForAskArtifact(artifact);
    }
  }

  function sanitizeAskImagePreview(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    if (/^data:image\//i.test(raw)) {
      return raw.length <= askChatMaxImagePayload ? raw : "";
    }
    return raw;
  }
  function createImageThumbnailDataUrl(source, maxEdge, quality) {
    const raw = String(source || "").trim();
    if (!raw || !/^data:image\//i.test(raw)) {
      return Promise.resolve("");
    }
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        try {
          const width = Number(image.naturalWidth || image.width) || 0;
          const height = Number(image.naturalHeight || image.height) || 0;
          if (width <= 0 || height <= 0) {
            resolve("");
            return;
          }
          const edge = Math.max(160, Number(maxEdge) || 420);
          const scale = Math.min(1, edge / Math.max(width, height));
          const nextWidth = Math.max(1, Math.round(width * scale));
          const nextHeight = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = nextWidth;
          canvas.height = nextHeight;
          const context = canvas.getContext("2d");
          if (!context) {
            resolve("");
            return;
          }
          context.drawImage(image, 0, 0, nextWidth, nextHeight);
          resolve(canvas.toDataURL("image/jpeg", Math.max(0.4, Math.min(0.86, Number(quality) || 0.72))));
        } catch {
          resolve("");
        }
      };
      image.onerror = () => resolve("");
      image.src = raw;
    });
  }
  async function createAskImageBubblePreview(entry) {
    const previewSource = String((entry && entry.previewUrl) || (entry && entry.value) || "").trim();
    if (!previewSource) {
      return "";
    }
    const sanitized = sanitizeAskImagePreview(previewSource);
    if (sanitized) {
      return sanitized;
    }
    if (!/^data:image\//i.test(previewSource)) {
      return previewSource;
    }
    const attempts = [
      { maxEdge: 520, quality: 0.74 },
      { maxEdge: 360, quality: 0.68 },
      { maxEdge: 240, quality: 0.62 }
    ];
    for (const attempt of attempts) {
      const thumbnail = await createImageThumbnailDataUrl(previewSource, attempt.maxEdge, attempt.quality);
      const safeThumbnail = sanitizeAskImagePreview(thumbnail);
      if (safeThumbnail) {
        return safeThumbnail;
      }
    }
    return "";
  }
  function normalizeAskMessage(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const roleRaw = String(value.role || "").trim().toLowerCase();
    const role = roleRaw === "assistant" ? "assistant" : "user";
    const id = String(value.id || "").trim() || createAskId("ask-msg");
    const text = getAskMessageText(value);
    const createdAt = typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
      ? Math.max(0, Math.floor(value.createdAt))
      : Date.now();
    const images = Array.isArray(value.images)
      ? value.images
        .slice(0, 6)
        .map(entry => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const name = String(entry.name || "").trim() || "image";
          const previewUrl = sanitizeAskImagePreview(entry.previewUrl || entry.value || "");
          return { name, previewUrl };
        })
        .filter(entry => Boolean(entry))
      : [];
    const models = Array.isArray(value.models)
      ? value.models
        .slice(0, 6)
        .map(entry => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const fileName = String(entry.fileName || "").trim() || "uploaded-model";
          return { fileName };
        })
        .filter(entry => Boolean(entry))
      : [];
    const audios = Array.isArray(value.audios)
      ? value.audios
        .slice(0, 4)
        .map(entry => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const fileName = String(entry.fileName || "").trim() || "recorded-audio.webm";
          const url = String(entry.url || "").trim();
          return url ? { fileName, url } : null;
        })
        .filter(entry => Boolean(entry))
      : [];
    const artifacts = Array.isArray(value.artifacts)
      ? value.artifacts
        .map(entry => normalizeAskArtifact(entry))
        .filter(entry => Boolean(entry))
      : [];
    const usedSkill = normalizeAskUsedSkill(value.usedSkill);
    const task = normalizeAskTask(value.task);
    const clarification = normalizeAskClarification(value.clarification);
    return {
      id,
      role,
      text,
      createdAt,
      images,
      models,
      audios,
      artifacts,
      usedSkill,
      task,
      clarification,
      error: value.error === true,
      pending: false
    };
  }
  function getAskMessageText(value) {
    if (!value || typeof value !== "object") {
      return "";
    }
    const candidates = [value.text, value.content, value.response, value.message];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") {
        continue;
      }
      if (candidate.trim()) {
        return candidate;
      }
    }
    return typeof value.text === "string" ? value.text : "";
  }
  function getAskFinalResponseText(payload, fallbackText) {
    const fallback = String(fallbackText || "").trim();
    if (!payload || typeof payload !== "object") {
      return fallback;
    }
    const candidates = [payload.response, payload.outputText, payload.output_text, payload.text, payload.content, payload.message];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") {
        continue;
      }
      const normalized = candidate.trim();
      if (normalized) {
        return normalized;
      }
    }
    return fallback;
  }
  function normalizeAskSession(value, index) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const id = String(value.id || "").trim() || createAskId("ask-chat");
    const titleRaw = String(value.title || "").trim();
    const title = titleRaw || "Chat " + (index + 1);
    const createdAt = typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
      ? Math.max(0, Math.floor(value.createdAt))
      : Date.now();
    const messages = Array.isArray(value.messages)
      ? value.messages
        .map(entry => normalizeAskMessage(entry))
        .filter(entry => Boolean(entry))
        .slice(-askChatMaxMessages)
      : [];
    const updatedAt = typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? Math.max(0, Math.floor(value.updatedAt))
      : (messages[messages.length - 1] ? messages[messages.length - 1].createdAt : createdAt);
    const replyStyleOverrideId = normalizeAskPersonalityId(value.replyStyleOverrideId);
    return { id, title, createdAt, updatedAt, messages, replyStyleOverrideId };
  }
  function createDefaultAskSession(index) {
    const now = Date.now();
    return {
      id: createAskId("ask-chat"),
      title: "Chat " + (index + 1),
      createdAt: now,
      updatedAt: now,
      messages: [],
      replyStyleOverrideId: ""
    };
  }
  function readAskChatStoreFromStorage() {
    try {
      const raw = window.localStorage.getItem(askChatStorageKey);
      if (!raw) {
        const defaultSession = createDefaultAskSession(0);
        return { activeSessionId: defaultSession.id, sessions: [defaultSession] };
      }
      const parsed = JSON.parse(raw);
      const sessions = Array.isArray(parsed && parsed.sessions)
        ? parsed.sessions
          .map((entry, index) => normalizeAskSession(entry, index))
          .filter(entry => Boolean(entry))
          .slice(-askChatMaxSessions)
        : [];
      if (sessions.length === 0) {
        const defaultSession = createDefaultAskSession(0);
        return { activeSessionId: defaultSession.id, sessions: [defaultSession] };
      }
      const activeSessionIdRaw = String(parsed && parsed.activeSessionId ? parsed.activeSessionId : "").trim();
      const activeSession = sessions.find(entry => entry.id === activeSessionIdRaw) || sessions[sessions.length - 1] || sessions[0];
      return {
        activeSessionId: activeSession ? activeSession.id : sessions[0].id,
        sessions
      };
    } catch {
      const defaultSession = createDefaultAskSession(0);
      return { activeSessionId: defaultSession.id, sessions: [defaultSession] };
    }
  }
  function persistAskChatStore() {
    try {
      let sessions = Array.isArray(askChatState.sessions) ? askChatState.sessions.slice(-askChatMaxSessions) : [];
      if (sessions.length === 0) {
        sessions = [createDefaultAskSession(0)];
      }
      const active = sessions.find(session => session.id === askChatState.activeSessionId) || sessions[sessions.length - 1] || sessions[0];
      askChatState.sessions = sessions;
      askChatState.activeSessionId = active.id;
      const payload = {
        activeSessionId: active.id,
        sessions: sessions.map((session, index) => {
          const normalized = normalizeAskSession(session, index);
          return normalized || createDefaultAskSession(index);
        })
      };
      window.localStorage.setItem(askChatStorageKey, JSON.stringify(payload));
    } catch {}
  }
  function getAskSessionById(sessionId) {
    const normalized = String(sessionId || "").trim();
    if (!normalized) {
      return null;
    }
    return askChatState.sessions.find(entry => entry.id === normalized) || null;
  }
  function getActiveAskSession() {
    let session = getAskSessionById(askChatState.activeSessionId);
    if (!session) {
      session = askChatState.sessions[askChatState.sessions.length - 1] || askChatState.sessions[0] || null;
      if (session) {
        askChatState.activeSessionId = session.id;
      }
    }
    return session;
  }
  function summarizeAskTabTitle(value, fallbackIndex) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "Chat " + (fallbackIndex + 1);
    }
    const singleLine = raw.replace(/\s+/g, " ").trim();
    return singleLine.length > 30 ? singleLine.slice(0, 30).trim() + "..." : singleLine;
  }
  function createAskSession(options) {
    const settings = options || {};
    const now = Date.now();
    const nextIndex = askChatState.sessions.length;
    const title = summarizeAskTabTitle(settings.title, nextIndex);
    const session = {
      id: createAskId("ask-chat"),
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
      replyStyleOverrideId: ""
    };
    askChatState.sessions.push(session);
    if (askChatState.sessions.length > askChatMaxSessions) {
      askChatState.sessions = askChatState.sessions.slice(-askChatMaxSessions);
    }
    askChatState.activeSessionId = session.id;
    persistAskChatStore();
    return session;
  }
  function ensureAskSessionState() {
    if (!Array.isArray(askChatState.sessions) || askChatState.sessions.length === 0) {
      const defaultSession = createDefaultAskSession(0);
      askChatState = { activeSessionId: defaultSession.id, sessions: [defaultSession] };
    }
    const active = getActiveAskSession();
    if (!active) {
      const created = createAskSession({ title: "Chat 1" });
      askChatState.activeSessionId = created.id;
    }
    persistAskChatStore();
  }
  function updateAskSessionTitleFromFirstMessage(session, text) {
    if (!session) {
      return;
    }
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      return;
    }
    const defaultChatTitle = /^Chat\s+\d+$/i.test(String(session.title || "").trim());
    if (!defaultChatTitle || session.messages.length > 1) {
      return;
    }
    session.title = summarizeAskTabTitle(trimmed, 0);
  }
  function appendAskMessageToSession(session, message) {
    if (!session) {
      return;
    }
    session.messages.push(message);
    if (session.messages.length > askChatMaxMessages) {
      session.messages = session.messages.slice(-askChatMaxMessages);
    }
    session.updatedAt = Date.now();
    if (message.role === "user") {
      updateAskSessionTitleFromFirstMessage(session, message.text);
    }
    persistAskChatStore();
  }
  function updateAskMessage(sessionId, messageId, patch) {
    const session = getAskSessionById(sessionId);
    if (!session) {
      return null;
    }
    const message = session.messages.find(entry => entry.id === messageId) || null;
    if (!message) {
      return null;
    }
    const updates = patch || {};
    if (typeof updates.text === "string") {
      message.text = updates.text;
    }
    if (typeof updates.pending === "boolean") {
      message.pending = updates.pending;
    }
    if (typeof updates.error === "boolean") {
      message.error = updates.error;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "usedSkill")) {
      message.usedSkill = normalizeAskUsedSkill(updates.usedSkill);
    }
    if (Array.isArray(updates.artifacts)) {
      message.artifacts = mergeAskArtifacts(updates.artifacts, message.text);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "task")) {
      message.task = mergeAskTask(message.task, updates.task);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "clarification")) {
      message.clarification = normalizeAskClarification(updates.clarification);
    }
    session.updatedAt = Date.now();
    persistAskChatStore();
    return message;
  }
  function deleteAskMessage(sessionId, messageId) {
    const session = getAskSessionById(sessionId);
    if (!session) {
      return false;
    }
    const nextMessages = Array.isArray(session.messages)
      ? session.messages.filter(entry => entry.id !== messageId)
      : [];
    if (nextMessages.length === session.messages.length) {
      return false;
    }
    session.messages = nextMessages;
    session.updatedAt = Date.now();
    persistAskChatStore();
    return true;
  }

  function readAskAutoEnterPreference() {
    try {
      const value = window.localStorage.getItem(askAutoEnterStorageKey);
      if (value === null) {
        return true;
      }
      return value === "true";
    } catch {
      return true;
    }
  }
  function readAskAutoTriggerSkillsPreference() {
    try {
      const value = window.localStorage.getItem(askAutoTriggerSkillsStorageKey);
      if (value === null) {
        return true;
      }
      return value === "true";
    } catch {
      return true;
    }
  }
  function readAskAutoRunSkillsPreference() {
    try {
      const value = window.localStorage.getItem(askAutoRunSkillsStorageKey);
      if (value === null) {
        return true;
      }
      return value === "true";
    } catch {
      return true;
    }
  }
  function readAskAutoTtsPreference() {
    try {
      return window.localStorage.getItem(askAutoTtsStorageKey) === "true";
    } catch {
      return false;
    }
  }
  function readAskTtsVoicePreference() {
    try {
      return normalizeAskTtsVoicePreference(window.localStorage.getItem(askTtsVoiceStorageKey) || "female");
    } catch {
      return "female";
    }
  }
  function isAskAutoEnterEnabled() {
    const { autoEnterToggle } = getAskSendModeNodes();
    return autoEnterToggle && typeof autoEnterToggle.checked === "boolean" ? autoEnterToggle.checked : true;
  }
  function isAskAutoRunSkillsEnabled() {
    const { autoRunSkillsToggle } = getAskSendModeNodes();
    return autoRunSkillsToggle && typeof autoRunSkillsToggle.checked === "boolean" ? autoRunSkillsToggle.checked : true;
  }
  function isAskAutoTtsEnabled() {
    const { autoTtsToggle } = getAskSendModeNodes();
    return autoTtsToggle && typeof autoTtsToggle.checked === "boolean" ? autoTtsToggle.checked : false;
  }
  function updateAskShortcutHint() {
    const { shortcutHint } = getAskSendModeNodes();
    if (!shortcutHint) {
      return;
    }
    shortcutHint.textContent = isAskAutoEnterEnabled()
      ? "Send: Enter or Ctrl+Enter | New line: Shift+Enter"
      : "Send: Ctrl+Enter | New line: Enter";
  }
  function setAskAutoEnterEnabled(enabled, persist) {
    const { autoEnterToggle } = getAskSendModeNodes();
    if (autoEnterToggle) {
      autoEnterToggle.checked = enabled === true;
    }
    updateAskShortcutHint();
    if (persist === false) {
      return;
    }
    try {
      window.localStorage.setItem(askAutoEnterStorageKey, enabled === true ? "true" : "false");
    } catch {}
  }
  function setAskAutoTriggerSkillsEnabled(enabled, persist) {
    const { autoTriggerSkillsToggle } = getAskSendModeNodes();
    if (autoTriggerSkillsToggle) {
      autoTriggerSkillsToggle.checked = enabled !== false;
    }
    if (persist === false) {
      return;
    }
    try {
      window.localStorage.setItem(askAutoTriggerSkillsStorageKey, enabled !== false ? "true" : "false");
    } catch {}
  }
  function setAskAutoRunSkillsEnabled(enabled, persist) {
    const { autoRunSkillsToggle } = getAskSendModeNodes();
    if (autoRunSkillsToggle) {
      autoRunSkillsToggle.checked = enabled !== false;
    }
    if (persist === false) {
      return;
    }
    try {
      window.localStorage.setItem(askAutoRunSkillsStorageKey, enabled !== false ? "true" : "false");
    } catch {}
  }
  function setAskAutoTtsEnabled(enabled, persist) {
    const { autoTtsToggle } = getAskSendModeNodes();
    if (autoTtsToggle) {
      autoTtsToggle.checked = enabled === true;
    }
    if (persist === false) {
      return;
    }
    try {
      window.localStorage.setItem(askAutoTtsStorageKey, enabled === true ? "true" : "false");
    } catch {}
  }
  function setAskTtsVoicePreference(value, persist) {
    const normalized = normalizeAskTtsVoicePreference(value);
    const { ttsVoiceSelect } = getAskSendModeNodes();
    if (ttsVoiceSelect) {
      ttsVoiceSelect.value = normalized;
    }
    if (persist === false) {
      return;
    }
    try {
      window.localStorage.setItem(askTtsVoiceStorageKey, normalized);
    } catch {}
  }
  function readAskTtsModePreference() {
    try { return normalizeAskTtsMode(window.localStorage.getItem(askTtsModeStorageKey)); } catch { return "builtin"; }
  }
  function setAskTtsMode(value, persist) {
    const normalized = normalizeAskTtsMode(value);
    const { ttsModeSelect } = getAskSendModeNodes();
    if (ttsModeSelect) ttsModeSelect.value = normalized;
    if (persist !== false) {
      try { window.localStorage.setItem(askTtsModeStorageKey, normalized); } catch {}
    }
  }

  function isAskReasoningEnabled() {
    const toggle = document.getElementById("lmstudio-text-reasoning-enabled");
    if (toggle && typeof toggle.checked === "boolean") {
      return toggle.checked;
    }
    return input && input.state && input.state.globalSettings && input.state.globalSettings.lmStudioTextModelReasoningEnabled !== false;
  }
  function hideAskThinkFoldout() {
    const { foldout, thinkOutput } = getAskNodes();
    if (foldout) {
      foldout.classList.add("hidden");
      foldout.open = false;
    }
    if (thinkOutput) {
      thinkOutput.classList.remove("markdown-surface");
      thinkOutput.textContent = "No reasoning trace yet.";
    }
  }
  function showAskThinkFoldoutPending() {
    const { foldout, thinkOutput } = getAskNodes();
    if (!foldout || !thinkOutput) {
      return;
    }
    foldout.classList.remove("hidden");
    foldout.open = true;
    thinkOutput.classList.remove("markdown-surface");
    thinkOutput.textContent = "Rod is thinking...";
  }
  function appendReasoningDelta(delta) {
    const text = String(delta || "");
    if (!text) {
      return;
    }
    const { foldout, thinkOutput } = getAskNodes();
    if (!foldout || !thinkOutput) {
      return;
    }
    foldout.classList.remove("hidden");
    foldout.open = true;
    if (thinkOutput.textContent === "Rod is thinking..." || thinkOutput.textContent === "No reasoning trace yet.") {
      thinkOutput.textContent = "";
    }
    thinkOutput.textContent += text;
    thinkOutput.scrollTop = thinkOutput.scrollHeight;
  }

  function getCodeFileExtension(language) {
    const normalized = String(language || "").trim().toLowerCase();
    return codeExtensionByLanguage[normalized] || "txt";
  }
  function collectCodeBlocksFromMarkdown(text) {
    const source = String(text || "");
    const blocks = [];
    const pattern = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let match = pattern.exec(source);
    while (match) {
      const language = String(match[1] || "").trim().toLowerCase();
      const body = String(match[2] || "").replace(/\s+$/, "");
      if (body) {
        blocks.push({ language, text: body });
      }
      match = pattern.exec(source);
    }
    return blocks;
  }
  function saveAskCodeBlocksFromText(text) {
    const codeBlocks = collectCodeBlocksFromMarkdown(text);
    if (codeBlocks.length === 0) {
      input.setOutput("No code block detected in this LazyDev reply.");
      return;
    }
    const firstLanguage = codeBlocks[0].language;
    const extension = getCodeFileExtension(firstLanguage);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = "ask-rod-code-" + timestamp + "." + extension;
    const content = codeBlocks.length === 1
      ? codeBlocks[0].text
      : codeBlocks.map((block, index) =>
        "----- Code Block " + (index + 1) + (block.language ? " (" + block.language + ")" : "") + " -----\n" + block.text
      ).join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    input.setOutput("Saved " + codeBlocks.length + " code block" + (codeBlocks.length === 1 ? "" : "s") + " to " + fileName + ".");
  }

  function setAssistantThinkingHtml(node) {
    if (!node) {
      return;
    }
    node.classList.remove("markdown-surface");
    node.innerHTML = [
      "<div class=\"ask-thinking-dots\" role=\"status\" aria-label=\"Rod is thinking\">",
      "<span class=\"ask-thinking-dot dot-a\" aria-hidden=\"true\">&#9679;</span>",
      "<span class=\"ask-thinking-dot dot-b\" aria-hidden=\"true\">&#9679;</span>",
      "<span class=\"ask-thinking-dot dot-c\" aria-hidden=\"true\">&#9679;</span>",
      "</div>"
    ].join("");
  }
  function setAssistantStreamingText(node, text) {
    if (!node) {
      return;
    }
    node.classList.remove("markdown-surface");
    node.textContent = String(text || "");
  }

  function scrollAskFeedToBottom() {
    const { feed } = getAskNodes();
    if (!feed) {
      return;
    }
    feed.scrollTop = feed.scrollHeight;
  }
  function getAskMessageNode(messageId) {
    const { messageList } = getAskNodes();
    if (!messageList) {
      return null;
    }
    const safeId = escapeSelectorValue(messageId);
    return messageList.querySelector('[data-ask-message-id="' + safeId + '"]');
  }
  function updateAskStreamingMessageNode(messageId, text) {
    const messageNode = getAskMessageNode(messageId);
    if (!messageNode) {
      return;
    }
    const body = messageNode.querySelector(".chat-bubble-body");
    if (!body) {
      return;
    }
    if (!text) {
      setAssistantThinkingHtml(body);
      return;
    }
    setAssistantStreamingText(body, text);
  }

  function waitForThreeLibrary(timeoutMs) {
    if (
      window.DiscrodThree
      && window.DiscrodThree.THREE
      && window.DiscrodThree.GLTFLoader
      && window.DiscrodThree.FBXLoader
      && window.DiscrodThree.OBJLoader
      && window.DiscrodThree.OrbitControls
    ) {
      return Promise.resolve(window.DiscrodThree);
    }
    const timeout = typeof timeoutMs === "number" && Number.isFinite(timeoutMs)
      ? Math.max(1_000, Math.floor(timeoutMs))
      : 10_000;
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = value => {
        if (settled) {
          return;
        }
        settled = true;
        window.removeEventListener("discrod-three-ready", onReady);
        window.clearTimeout(timer);
        resolve(value);
      };
      const fail = error => {
        if (settled) {
          return;
        }
        settled = true;
        window.removeEventListener("discrod-three-ready", onReady);
        window.clearTimeout(timer);
        reject(error);
      };
      const onReady = () => {
        if (
          window.DiscrodThree
          && window.DiscrodThree.THREE
          && window.DiscrodThree.GLTFLoader
          && window.DiscrodThree.FBXLoader
          && window.DiscrodThree.OBJLoader
          && window.DiscrodThree.OrbitControls
        ) {
          done(window.DiscrodThree);
        }
      };
      const timer = window.setTimeout(() => {
        fail(new Error("Three.js did not finish loading."));
      }, timeout);
      window.addEventListener("discrod-three-ready", onReady, { once: true });
      onReady();
    });
  }
  function fitModelInCamera(THREE, camera, object, controls) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxDim) || maxDim <= 0) {
      camera.position.set(0, 0.6, 2.2);
      camera.lookAt(0, 0, 0);
      if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
      }
      return;
    }
    const fov = camera.fov * Math.PI / 180;
    const distance = maxDim / (2 * Math.tan(fov / 2));
    camera.position.set(
      center.x + distance * 0.9,
      center.y + distance * 0.55,
      center.z + distance * 1.1
    );
    camera.near = Math.max(0.001, maxDim / 1000);
    camera.far = Math.max(1000, distance * 10);
    camera.updateProjectionMatrix();
    camera.lookAt(center);
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }
  function disposeThreeObject(root) {
    if (!root || typeof root.traverse !== "function") {
      return;
    }
    root.traverse(node => {
      if (node.geometry && typeof node.geometry.dispose === "function") {
        node.geometry.dispose();
      }
      const material = node.material;
      if (!material) {
        return;
      }
      if (Array.isArray(material)) {
        material.forEach(item => {
          if (item && typeof item.dispose === "function") {
            item.dispose();
          }
        });
        return;
      }
      if (typeof material.dispose === "function") {
        material.dispose();
      }
    });
  }
  function loadThreeObject(loaders, sourceUrl, fileName, onLoad, onError) {
    const ext = (String(fileName || sourceUrl || "").split("?")[0].match(/\.([a-z0-9]+)$/i) || ["", ""])[1].toLowerCase();
    if (ext === "glb" || ext === "gltf") {
      loaders.gltf.load(sourceUrl, gltf => onLoad(gltf && gltf.scene ? gltf.scene : null), undefined, onError);
      return;
    }
    if (ext === "fbx") {
      loaders.fbx.load(sourceUrl, object => onLoad(object || null), undefined, onError);
      return;
    }
    if (ext === "obj") {
      loaders.obj.load(sourceUrl, object => onLoad(object || null), undefined, onError);
      return;
    }
    onError(new Error("Preview for " + fileName + " is not supported in browser viewer."));
  }
  function getAskModelPreviewFallbackUrl(artifact) {
    const previewUrl = String(artifact && artifact.previewUrl ? artifact.previewUrl : "").trim();
    return previewUrl ? toAbsoluteDashboardUrl(previewUrl) : "";
  }
  function showAskModelPreviewFallback(shellNode, statusNode, artifact, detail) {
    const fallbackUrl = getAskModelPreviewFallbackUrl(artifact);
    if (!fallbackUrl) {
      statusNode.textContent = detail;
      return;
    }
    clearNode(shellNode);
    const image = document.createElement("img");
    image.className = "ask-model-preview-fallback-image";
    image.loading = "lazy";
    image.alt = artifact.fileName || "Generated model preview";
    image.src = fallbackUrl;
    shellNode.appendChild(image);
    statusNode.textContent = detail + " Showing saved preview image.";
  }
  function mountAskModelGifPreview(shellNode, statusNode, artifact) {
    const previewUrl = getAskModelPreviewFallbackUrl(artifact);
    clearNode(shellNode);
    if (!previewUrl) {
      statusNode.textContent = "Rendered GIF preview is unavailable for this model.";
      return;
    }
    const image = document.createElement("img");
    image.className = "ask-model-preview-fallback-image";
    image.loading = "lazy";
    image.alt = artifact.fileName || "Rendered model preview";
    image.src = previewUrl;
    shellNode.appendChild(image);
    statusNode.textContent = "Rendered GIF preview: " + (artifact.fileName || "model");
  }
  function disposeAskModelPreview(previewKey) {
    const controller = askModelPreviewControllers.get(previewKey);
    if (!controller) {
      return;
    }
    askModelPreviewControllers.delete(previewKey);
    controller.disposed = true;
    if (typeof controller.cleanup === "function") {
      controller.cleanup();
    }
    if (controller.objectUrl) {
      URL.revokeObjectURL(controller.objectUrl);
    }
  }
  function disposeAskModelPreviews() {
    const controllers = Array.from(askModelPreviewControllers.values());
    askModelPreviewControllers.clear();
    controllers.forEach(controller => {
      if (!controller) {
        return;
      }
      controller.disposed = true;
      if (typeof controller.cleanup === "function") {
        controller.cleanup();
      }
      if (controller.objectUrl) {
        URL.revokeObjectURL(controller.objectUrl);
      }
    });
  }
  async function mountAskModelPreview(shellNode, statusNode, artifact, previewKey) {
    if (!shellNode || !statusNode || !artifact || artifact.kind !== "model") {
      return;
    }
    const sourceUrl = toAbsoluteDashboardUrl(artifact.url || ("/api/model3d-file?modelId=" + encodeURIComponent(artifact.modelId) + "&file=" + encodeURIComponent(artifact.fileName)));
    if (!sourceUrl) {
      statusNode.textContent = "Model preview URL is unavailable.";
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.className = "ask-model-preview-canvas";
    shellNode.appendChild(canvas);
    const controller = {
      disposed: false,
      objectUrl: "",
      cleanup: function cleanup() {}
    };
    askModelPreviewControllers.set(previewKey, controller);
    try {
      statusNode.textContent = "Loading " + artifact.fileName + "...";
      const three = await waitForThreeLibrary(12_000);
      if (controller.disposed) {
        return;
      }
      const modelResponse = await fetch(sourceUrl, { cache: "no-store" });
      if (!modelResponse.ok) {
        throw new Error("Model file request failed with status " + modelResponse.status + ".");
      }
      const modelBlob = await modelResponse.blob();
      if (!modelBlob || modelBlob.size < 1) {
        throw new Error("Model file response was empty.");
      }
      if (controller.disposed) {
        return;
      }
      const modelObjectUrl = URL.createObjectURL(modelBlob);
      controller.objectUrl = modelObjectUrl;
      const THREE = three.THREE;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      } else if ("outputEncoding" in renderer && THREE.sRGBEncoding) {
        renderer.outputEncoding = THREE.sRGBEncoding;
      }
      if ("toneMapping" in renderer && THREE.ACESFilmicToneMapping) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.14;
      }
      renderer.setSize(Math.max(1, shellNode.clientWidth), Math.max(1, shellNode.clientHeight), false);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x172235);
      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
      const controls = new three.OrbitControls(camera, canvas);
      controls.enableDamping = false;
      controls.enablePan = true;
      controls.rotateSpeed = 0.65;
      const ambient = new THREE.AmbientLight(0xffffff, 1.12);
      const hemi = new THREE.HemisphereLight(0xddeeff, 0x241811, 0.7);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.16);
      const fillLight = new THREE.DirectionalLight(0xfff2e1, 0.72);
      const rimLight = new THREE.DirectionalLight(0x7ea7ff, 0.52);
      const keyTarget = new THREE.Object3D();
      const fillTarget = new THREE.Object3D();
      const rimTarget = new THREE.Object3D();
      keyLight.target = keyTarget;
      fillLight.target = fillTarget;
      rimLight.target = rimTarget;
      scene.add(ambient, hemi, keyLight, fillLight, rimLight, keyTarget, fillTarget, rimTarget);
      const updateLightRig = () => {
        const focusTarget = controls && controls.target ? controls.target : new THREE.Vector3(0, 0, 0);
        const keyOffset = new THREE.Vector3(2.3, 3.1, 3.5).applyQuaternion(camera.quaternion);
        const fillOffset = new THREE.Vector3(-2.1, 1.2, 2.6).applyQuaternion(camera.quaternion);
        const rimOffset = new THREE.Vector3(-2.8, 2.0, -3.1).applyQuaternion(camera.quaternion);
        keyLight.position.copy(camera.position).add(keyOffset);
        fillLight.position.copy(camera.position).add(fillOffset);
        rimLight.position.copy(camera.position).add(rimOffset);
        keyTarget.position.copy(focusTarget);
        fillTarget.position.copy(focusTarget);
        rimTarget.position.copy(focusTarget);
      };
      let rootObject = null;
      const updateSizeAndRender = () => {
        const width = Math.max(1, shellNode.clientWidth);
        const height = Math.max(1, shellNode.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        updateLightRig();
        renderer.render(scene, camera);
      };
      controls.addEventListener("change", updateSizeAndRender);
      const resizeObserver = typeof window.ResizeObserver === "function"
        ? new window.ResizeObserver(() => updateSizeAndRender())
        : null;
      if (resizeObserver) {
        resizeObserver.observe(shellNode);
      }
      controller.cleanup = () => {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        controls.removeEventListener("change", updateSizeAndRender);
        controls.dispose();
        if (rootObject) {
          disposeThreeObject(rootObject);
          scene.remove(rootObject);
        }
        renderer.dispose();
        if (controller.objectUrl) {
          URL.revokeObjectURL(controller.objectUrl);
          controller.objectUrl = "";
        }
      };
      await new Promise((resolve, reject) => {
        loadThreeObject({
          gltf: new three.GLTFLoader(),
          fbx: new three.FBXLoader(),
          obj: new three.OBJLoader()
        }, modelObjectUrl, artifact.fileName, object => {
          if (!object) {
            reject(new Error("Loaded file did not contain a previewable mesh."));
            return;
          }
          rootObject = object;
          scene.add(rootObject);
          fitModelInCamera(THREE, camera, rootObject, controls);
          updateSizeAndRender();
          resolve();
        }, reject);
      });
      if (controller.disposed) {
        return;
      }
      statusNode.textContent = "Preview ready: " + artifact.fileName;
    } catch (error) {
      showAskModelPreviewFallback(shellNode, statusNode, artifact, "3D preview failed: " + ((error && error.message) || "Unknown loader error.") + ".");
    }
  }
  function createAskModelPreviewTabs(shellNode, statusNode, artifact, previewKey) {
    const tabs = document.createElement("div");
    tabs.className = "dashboard-tabs ask-model-preview-tablist";
    const threeButton = document.createElement("button");
    const gifButton = document.createElement("button");
    const setButtonState = activeTab => {
      threeButton.classList.toggle("active", activeTab === "three");
      gifButton.classList.toggle("active", activeTab === "gif");
      threeButton.setAttribute("aria-selected", activeTab === "three" ? "true" : "false");
      gifButton.setAttribute("aria-selected", activeTab === "gif" ? "true" : "false");
    };
    const activate = activeTab => {
      setButtonState(activeTab);
      disposeAskModelPreview(previewKey);
      clearNode(shellNode);
      if (activeTab === "gif") {
        mountAskModelGifPreview(shellNode, statusNode, artifact);
        return;
      }
      statusNode.textContent = "Preparing Three.js viewer...";
      void mountAskModelPreview(shellNode, statusNode, artifact, previewKey);
    };
    threeButton.type = "button";
    threeButton.textContent = "Three.js";
    threeButton.addEventListener("click", event => {
      event.preventDefault();
      activate("three");
    });
    gifButton.type = "button";
    gifButton.textContent = "GIF";
    gifButton.addEventListener("click", event => {
      event.preventDefault();
      activate("gif");
    });
    tabs.appendChild(threeButton);
    tabs.appendChild(gifButton);
    activate(artifact.lowPoly ? "gif" : "three");
    return tabs;
  }

  function createAskUserMessageBody(message) {
    const body = document.createElement("div");
    body.className = "chat-bubble-body";
    const text = String(message && message.text ? message.text : "").trim();
    if (text) {
      const textNode = document.createElement("div");
      textNode.className = "ask-user-preview-text";
      textNode.textContent = text;
      body.appendChild(textNode);
    }
    const images = Array.isArray(message && message.images) ? message.images : [];
    if (images.length > 0) {
      const gallery = document.createElement("div");
      gallery.className = "ask-user-preview-gallery";
      images.forEach(entry => {
        const figure = document.createElement("figure");
        figure.className = "ask-user-preview-figure";
        const imageUrl = String(entry && entry.previewUrl ? entry.previewUrl : "").trim();
        if (imageUrl) {
          const image = document.createElement("img");
          image.src = imageUrl;
          image.alt = String(entry && entry.name ? entry.name : "Uploaded image");
          image.loading = "lazy";
          figure.appendChild(image);
        }
        const captionText = String(entry && entry.name ? entry.name : "").trim();
        if (captionText) {
          const caption = document.createElement("figcaption");
          caption.textContent = captionText;
          figure.appendChild(caption);
        }
        gallery.appendChild(figure);
      });
      body.appendChild(gallery);
    }
    const models = Array.isArray(message && message.models) ? message.models : [];
    if (models.length > 0) {
      const modelList = document.createElement("ul");
      modelList.className = "ask-user-preview-model-list";
      models.forEach(entry => {
        const row = document.createElement("li");
        row.textContent = "3D: " + String(entry && entry.fileName ? entry.fileName : "uploaded-model");
        modelList.appendChild(row);
      });
      body.appendChild(modelList);
    }
    const files = Array.isArray(message && message.files) ? message.files : [];
    if (files.length > 0) {
      const fileList = document.createElement("ul");
      fileList.className = "ask-user-preview-model-list";
      files.forEach(entry => {
        const row = document.createElement("li");
        row.textContent = "File: " + String(entry && entry.fileName ? entry.fileName : "uploaded-file");
        fileList.appendChild(row);
      });
      body.appendChild(fileList);
    }
    const audios = Array.isArray(message && message.audios) ? message.audios : [];
    if (audios.length > 0) {
      const audioList = document.createElement("div");
      audioList.className = "ask-user-audio-list";
      audios.forEach(entry => {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = String(entry && (entry.url || entry.dataUrl) ? (entry.url || entry.dataUrl) : "");
        audio.setAttribute("aria-label", String(entry && entry.fileName ? entry.fileName : "Attached audio"));
        audioList.appendChild(audio);
      });
      body.appendChild(audioList);
    }
    return body;
  }
  function createAskTaskInfoBlock(message) {
    if (!message || message.role !== "assistant") {
      return null;
    }
    const task = normalizeAskTask(message.task);
    if (!task) {
      return null;
    }
    const details = document.createElement("details");
    details.className = "ask-task-info";
    // Task metadata can be useful while debugging, but it should not take over
    // the conversation every time an assistant message is rendered.
    details.open = false;
    const summary = document.createElement("summary");
    summary.textContent = "Task Info";
    details.appendChild(summary);
    const content = document.createElement("div");
    content.className = "ask-task-info-content";
    const appendInfo = (label, value) => {
      const cleanValue = String(value || "").trim();
      if (!cleanValue) {
        return;
      }
      const row = document.createElement("div");
      row.className = "ask-task-info-row";
      const key = document.createElement("span");
      key.className = "ask-task-info-key";
      key.textContent = label;
      const text = document.createElement("span");
      text.className = "ask-task-info-value";
      text.textContent = cleanValue;
      row.appendChild(key);
      row.appendChild(text);
      content.appendChild(row);
    };
    const resolvedSkillId = task.skillId || task.requestedSkillId;
    const resolvedSkillSource = task.skillSource || (task.requestedSkillId ? "explicit" : "");
    const statusText = task.status === "error" ? "Failed" : task.status === "done" ? "Completed" : "Running";
    appendInfo("Status", statusText);
    appendInfo(
      "Skill",
      resolvedSkillId
        ? resolvedSkillId + (resolvedSkillSource ? " (" + resolvedSkillSource + ")" : "")
        : (task.autoRunSkills ? "Router deciding" : "Manual chat mode")
    );
    if (Array.isArray(task.queuedSkills) && task.queuedSkills.length > 0) {
      appendInfo("Queued", task.queuedSkills.map(skill => formatAskTaskSkillLabel(skill)).filter(Boolean).join(" -> "));
    }
    appendInfo("Prompt", task.prompt || "(empty)");
    appendInfo("Inputs", task.inputImageCount + " image(s), " + task.inputModelCount + " model(s)");
    appendInfo("Outputs", task.artifactCount + " artifact(s)");
    const started = formatAskTime(task.startedAt);
    if (started) {
      appendInfo("Started", started);
    }
    const finished = formatAskTime(task.finishedAt);
    if (finished) {
      appendInfo("Finished", finished);
    }
    const duration = formatAskDuration(task.durationMs);
    if (duration) {
      appendInfo("Duration", duration);
    }
    if (content.childNodes.length === 0) {
      return null;
    }
    details.appendChild(content);
    return details;
  }
  function createAskBubbleUtilityActionRow(session, message) {
    if (!session || !message) {
      return null;
    }
    const row = document.createElement("div");
    row.className = "row chat-bubble-action-row ask-bubble-utility-action-row";
    if (!message.pending) {
      const editButton = document.createElement("button");
      editButton.className = "secondary mini-button";
      editButton.type = "button";
      setAskQuickActionButtonContent(editButton, "Edit", "edit");
      editButton.addEventListener("click", event => {
        event.preventDefault();
        if (askRequestInFlight && message.id === askStreamingAssistantMessageId) {
          input.setOutput("Wait for the current response to finish before editing this message.");
          return;
        }
        const currentText = String(message.text || "");
        const editedText = window.prompt("Edit message text", currentText);
        if (editedText === null) {
          return;
        }
        const nextText = String(editedText).trim();
        if (!nextText) {
          input.setOutput("Message text cannot be empty.");
          return;
        }
        updateAskMessage(session.id, message.id, {
          text: nextText,
          error: false
        });
        renderAskChatTabs();
        renderAskChatMessages();
        scrollAskFeedToBottom();
        input.setOutput("Message updated.");
      });
      row.appendChild(editButton);
      const deleteButton = document.createElement("button");
      deleteButton.className = "secondary mini-button";
      deleteButton.type = "button";
      setAskQuickActionButtonContent(deleteButton, "Delete", "delete");
      deleteButton.addEventListener("click", async event => {
        event.preventDefault();
        if (askRequestInFlight && message.id === askStreamingAssistantMessageId) {
          input.setOutput("Wait for the current response to finish before deleting this message.");
          return;
        }
        const messageLabel = message.role === "assistant" ? "assistant" : "user";
        const confirmed = typeof window.dashboardConfirm === "function"
          && await window.dashboardConfirm({
            title: "Delete Message",
            message: "Delete this " + messageLabel + " message?",
            confirmLabel: "Delete",
            variant: "warning"
          });
        if (!confirmed) {
          return;
        }
        if (!deleteAskMessage(session.id, message.id)) {
          input.setOutput("Message delete failed.");
          return;
        }
        renderAskChatTabs();
        renderAskChatMessages();
        scrollAskFeedToBottom();
        input.setOutput("Message deleted.");
      });
      row.appendChild(deleteButton);
    }
    return row.childNodes.length > 0 ? row : null;
  }
  async function runAskQuickActionWithBusyButton(button, pendingText, action) {
    if (!button || button.dataset.askBusy === "true") {
      return;
    }
    const previousHtml = button.innerHTML;
    const previousLabel = button.getAttribute("aria-label") || button.textContent || "";
    const previousTitle = button.title;
    button.dataset.askBusy = "true";
    button.classList.add("is-busy");
    button.disabled = true;
    setAskQuickActionButtonContent(button, pendingText, "busy");
    try {
      await action();
    } finally {
      button.dataset.askBusy = "false";
      button.classList.remove("is-busy");
      button.disabled = false;
      button.innerHTML = previousHtml;
      button.setAttribute("aria-label", previousLabel);
      button.title = previousTitle;
    }
  }
  async function runAskImageToModelQuickAction(message, artifact) {
    if (!artifact || artifact.kind !== "image") {
      return;
    }
    const imageUrl = toAbsoluteDashboardUrl(artifact.url || ("/api/generated-image-file?imageId=" + encodeURIComponent(artifact.imageId) + "&file=" + encodeURIComponent(artifact.fileName)));
    const generated = await input.request("/api/model3d-generate", {
      imageInput: imageUrl,
      imageFileNameHint: artifact.fileName,
      autoPrompt: true,
      useLlmMetadata: true,
      useLlmModelFileName: true,
      useLlmModelDescription: true,
      metadataTiming: "after",
      executionTarget: "local"
    });
    const modelArtifact = {
      kind: "model",
      modelId: generated.id,
      fileName: generated.modelFileName,
      url: "/api/model3d-file?modelId=" + encodeURIComponent(generated.id) + "&file=" + encodeURIComponent(generated.modelFileName),
      prompt: String(generated.prompt || artifact.prompt || "").trim(),
      lowPoly: false,
      previewUrl: generated.previewGifUrl || generated.previewImageUrl || "",
      targetFaceCount: typeof generated.targetFaceCount === "number" && Number.isFinite(generated.targetFaceCount)
        ? Math.max(1, Math.round(generated.targetFaceCount))
        : null
    };
    const session = getActiveAskSession();
    if (!session) {
      return;
    }
    appendAskMessageToSession(session, {
      id: createAskId("ask-msg"),
      role: "assistant",
      text:
        "Quick action complete. Generated 3D model from image.\n\n"
        + "Model file: `" + generated.modelFileName + "`\n"
        + "Model ID: `" + generated.id + "`",
      createdAt: Date.now(),
      images: [],
      models: [],
      artifacts: [modelArtifact],
      usedSkill: null,
      error: false,
      pending: false
    });
    renderAskChatMessages();
    scrollAskFeedToBottom();
    input.setOutput("Generated 3D model from image quick action.");
    await refreshStudioHistoryForAskArtifact(modelArtifact);
  }
  function getAskImageTransformPrompt(actionKey, artifact) {
    const sourcePrompt = String(artifact && artifact.prompt ? artifact.prompt : "").trim();
    if (actionKey === "remove-background") {
      return "Remove the background from this image. Keep the main subject clean, centered, and sharply cut out on a transparent or plain neutral background. Preserve subject detail." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
    }
    if (actionKey === "delight") {
      return "Delight this image for texture use: remove baked shadows, strong directional lighting, highlights, and color casts while preserving the original surface color and details. Make it evenly lit and neutral." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
    }
    if (actionKey === "normal-map") {
      return "Create a tangent-space normal map from this image. Output only a clean crystal-blue normal map texture with readable surface relief and no labels or extra objects." + (sourcePrompt ? "\nOriginal prompt: " + sourcePrompt : "");
    }
    return sourcePrompt || "Create an improved version of this image.";
  }
  function getAskImageTransformLabel(actionKey) {
    if (actionKey === "remove-background") {
      return "Remove Background";
    }
    if (actionKey === "delight") {
      return "Delight Image";
    }
    if (actionKey === "normal-map") {
      return "Create Normal Map";
    }
    return "Image Action";
  }
  async function runAskImageTransformQuickAction(message, artifact, actionKey) {
    if (!artifact || artifact.kind !== "image") {
      return;
    }
    const imageUrl = toAbsoluteDashboardUrl(artifact.url || ("/api/generated-image-file?imageId=" + encodeURIComponent(artifact.imageId) + "&file=" + encodeURIComponent(artifact.fileName)));
    const generated = actionKey === "remove-background"
      ? await input.request("/api/image-remove-background", {
        imageInput: imageUrl,
        imageFileNameHint: artifact.fileName,
        mode: "lora"
      })
      : await input.request("/api/image-generate", {
        prompt: getAskImageTransformPrompt(actionKey, artifact),
        autoPrompt: false,
        autoFileName: false,
        imageInput: imageUrl,
        imageFileNameHint: artifact.fileName,
        workflowPathOverride: actionKey === "delight" && imageDelightWorkflowPath ? imageDelightWorkflowPath : undefined,
        skipPromptResolution: actionKey === "delight"
      });
    const imageArtifact = {
      kind: "image",
      imageId: generated.id,
      fileName: generated.imageFileName,
      url: "/api/generated-image-file?imageId=" + encodeURIComponent(generated.id) + "&file=" + encodeURIComponent(generated.imageFileName),
      prompt: String(generated.prompt || "").trim()
    };
    const session = getActiveAskSession();
    if (!session) {
      return;
    }
    const label = getAskImageTransformLabel(actionKey);
    appendAskMessageToSession(session, {
      id: createAskId("ask-msg"),
      role: "assistant",
      text:
        "Quick action complete. " + label + " generated.\n\n"
        + "File: `" + generated.imageFileName + "`\n"
        + "Image ID: `" + generated.id + "`",
      createdAt: Date.now(),
      images: [],
      models: [],
      artifacts: [imageArtifact],
      usedSkill: null,
      error: false,
      pending: false
    });
    renderAskChatMessages();
    scrollAskFeedToBottom();
    input.setOutput(label + " quick action complete.");
    await refreshStudioHistoryForAskArtifact(imageArtifact);
  }
  async function runAskImageNormalMapToolQuickAction(artifact) {
    if (!artifact || artifact.kind !== "image") {
      return;
    }
    if (typeof input.convertImageUrlToNormalMap !== "function") {
      return void input.setOutput("Normal Map Maker bridge is unavailable.");
    }
    const imageUrl = toAbsoluteDashboardUrl(artifact.url || ("/api/generated-image-file?imageId=" + encodeURIComponent(artifact.imageId) + "&file=" + encodeURIComponent(artifact.fileName)));
    const imported = await input.convertImageUrlToNormalMap({
      imageUrl,
      fileName: artifact.fileName,
      prompt: artifact.prompt || ""
    });
    const imageArtifact = {
      kind: "image",
      imageId: imported.id,
      fileName: imported.imageFileName,
      url: "/api/generated-image-file?imageId=" + encodeURIComponent(imported.id) + "&file=" + encodeURIComponent(imported.imageFileName),
      prompt: String(imported.prompt || artifact.prompt || "").trim()
    };
    const session = getActiveAskSession();
    if (!session) {
      return;
    }
    appendAskMessageToSession(session, {
      id: createAskId("ask-msg"),
      role: "assistant",
      text: "Normal map created.\n\nFile: `" + imported.imageFileName + "`\nImage ID: `" + imported.id + "`",
      createdAt: Date.now(),
      images: [],
      models: [],
      artifacts: [imageArtifact],
      usedSkill: null,
      error: false,
      pending: false
    });
    renderAskChatMessages();
    scrollAskFeedToBottom();
    input.setOutput("Created normal map from " + artifact.fileName + ".");
    await refreshStudioHistoryForAskArtifact(imageArtifact);
  }
  async function runAskImagePixelArtQuickAction(message, artifact) {
    if (!artifact || artifact.kind !== "image") {
      return;
    }
    if (typeof input.convertImageUrlToPixelArt !== "function") {
      return void input.setOutput("Pixel Art Converter bridge is unavailable.");
    }
    const imageUrl = toAbsoluteDashboardUrl(artifact.url || ("/api/generated-image-file?imageId=" + encodeURIComponent(artifact.imageId) + "&file=" + encodeURIComponent(artifact.fileName)));
    const imported = await input.convertImageUrlToPixelArt({
      imageUrl,
      fileName: artifact.fileName,
      prompt: artifact.prompt || ""
    });
    const imageArtifact = {
      kind: "image",
      imageId: imported.id,
      fileName: imported.imageFileName,
      url: "/api/generated-image-file?imageId=" + encodeURIComponent(imported.id) + "&file=" + encodeURIComponent(imported.imageFileName),
      prompt: String(imported.prompt || artifact.prompt || "").trim()
    };
    const frameArtifacts = (Array.isArray(imported.pixelArtFrameRecords) ? imported.pixelArtFrameRecords : []).slice(0, 12).map(frame => ({
      kind: "image",
      imageId: frame.id,
      fileName: frame.imageFileName,
      url: "/api/generated-image-file?imageId=" + encodeURIComponent(frame.id) + "&file=" + encodeURIComponent(frame.imageFileName),
      prompt: String(frame.prompt || artifact.prompt || "").trim()
    }));
    const session = getActiveAskSession();
    if (!session) {
      return;
    }
    appendAskMessageToSession(session, {
      id: createAskId("ask-msg"),
      role: "assistant",
      text:
        "Quick action complete. Pixel art image generated.\n\n"
        + "File: `" + imported.imageFileName + "`\n"
        + "Image ID: `" + imported.id + "`"
        + (frameArtifacts.length > 0 ? "\nFrames saved to image history: " + imported.pixelArtFrameRecords.length : ""),
      createdAt: Date.now(),
      images: [],
      models: [],
      artifacts: [imageArtifact, ...frameArtifacts],
      usedSkill: null,
      error: false,
      pending: false
    });
    renderAskChatMessages();
    scrollAskFeedToBottom();
    input.setOutput("Pixel art quick action complete.");
    await refreshStudioHistoryForAskArtifact(imageArtifact);
  }
  function buildAskPixelArtArtifacts(imported, fallbackPrompt) {
    const prompt = String(imported && imported.prompt ? imported.prompt : fallbackPrompt || "").trim();
    const imageArtifact = {
      kind: "image",
      imageId: imported.id,
      fileName: imported.imageFileName,
      url: "/api/generated-image-file?imageId=" + encodeURIComponent(imported.id) + "&file=" + encodeURIComponent(imported.imageFileName),
      prompt
    };
    const frameArtifacts = (Array.isArray(imported.pixelArtFrameRecords) ? imported.pixelArtFrameRecords : []).slice(0, 24).map(frame => ({
      kind: "image",
      imageId: frame.id,
      fileName: frame.imageFileName,
      url: "/api/generated-image-file?imageId=" + encodeURIComponent(frame.id) + "&file=" + encodeURIComponent(frame.imageFileName),
      prompt: String(frame.prompt || prompt).trim()
    }));
    return { imageArtifact, frameArtifacts };
  }
  function buildAskPixelArtSummary(items) {
    const validItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const count = validItems.length;
    const lines = [
      count === 1
        ? "Pixel art conversion complete with skill **create-pixel-art**."
        : `${count} images converted to pixel art with skill **create-pixel-art**.`,
      ""
    ];
    validItems.forEach((entry, index) => {
      const frameCount = Array.isArray(entry.frameArtifacts) ? entry.frameArtifacts.length : 0;
      lines.push(
        `${index + 1}. File: \`${entry.imageArtifact.fileName}\``,
        `   Image ID: \`${entry.imageArtifact.imageId}\`${frameCount > 0 ? `\n   Frames saved: ${frameCount}` : ""}`
      );
    });
    return lines.join("\n");
  }
  async function runAskLocalPixelArtSkill(session, assistantMessage, prompt, askImages, skillSource) {
    if (typeof input.convertImageUrlToPixelArt !== "function") {
      throw new Error("Pixel Art conversion bridge is unavailable.");
    }
    const source = skillSource === "explicit" ? "explicit" : "auto";
    const requestImages = Array.isArray(askImages) ? askImages.filter(item => item && item.value) : [];
    if (requestImages.length === 0) {
      throw new Error("Create Pixel Art needs at least one uploaded image.");
    }
    const createdAt = assistantMessage && typeof assistantMessage.createdAt === "number" ? assistantMessage.createdAt : Date.now();
    const convertedItems = [];
    for (let index = 0; index < requestImages.length; index += 1) {
      const item = requestImages[index];
      const itemName = String(item && item.name ? item.name : "image").trim() || "image";
      const progressText = requestImages.length > 1
        ? `Converting uploaded images to pixel art (${index + 1}/${requestImages.length})...\n\nCurrent file: \`${itemName}\``
        : `Converting uploaded image to pixel art...\n\nFile: \`${itemName}\``;
      updateAskMessage(session.id, assistantMessage.id, {
        text: progressText,
        pending: true,
        error: false,
        usedSkill: { id: "create-pixel-art", name: "create-pixel-art", source },
        task: {
          skillId: "create-pixel-art",
          skillSource: source,
          artifactCount: convertedItems.reduce((sum, entry) => sum + 1 + entry.frameArtifacts.length, 0),
          status: "pending"
        }
      });
      renderAskChatMessages();
      scrollAskFeedToBottom();
      const imported = await input.convertImageUrlToPixelArt({
        imageUrl: item.value,
        fileName: itemName,
        prompt: String(prompt || "").trim()
      });
      const artifactBundle = buildAskPixelArtArtifacts(imported, prompt);
      convertedItems.push(artifactBundle);
      await refreshStudioHistoryForAskArtifact(artifactBundle.imageArtifact);
      for (const frameArtifact of artifactBundle.frameArtifacts) {
        await refreshStudioHistoryForAskArtifact(frameArtifact);
      }
    }
    const artifacts = convertedItems.flatMap(entry => [entry.imageArtifact, ...entry.frameArtifacts]);
    const responseText = buildAskPixelArtSummary(convertedItems);
    const finishedAt = Date.now();
    updateAskMessage(session.id, assistantMessage.id, {
      text: responseText,
      pending: false,
      error: false,
      usedSkill: { id: "create-pixel-art", name: "create-pixel-art", source },
      artifacts,
      task: {
        skillId: "create-pixel-art",
        skillSource: source,
        artifactCount: artifacts.length,
        status: "done",
        finishedAt,
        durationMs: Math.max(0, finishedAt - createdAt)
      }
    });
    renderAskChatTabs();
    renderAskChatMessages();
    scrollAskFeedToBottom();
    input.setOutput(responseText);
    await input.refreshState();
  }
  async function runAskModelSeparateByLoosePartsQuickAction(message, artifact) {
    if (!artifact || artifact.kind !== "model") {
      throw new Error("Separate by loose parts requires a generated model artifact.");
    }
    const generated = await input.request("/api/model3d-separate-loose-parts", {
      modelId: artifact.modelId
    });
    if (!generated || !generated.id) {
      throw new Error("Separate by loose parts output is missing generated models metadata.");
    }
    const session = getActiveAskSession();
    if (!session) {
      return;
    }
  }
  async function runAskModelLowpolyQuickAction(message, artifact) {
    if (!artifact || artifact.kind !== "model") {
      return;
    }
    const lowPoly = await input.request("/api/model3d-lowpoly-generate", {
      modelId: artifact.modelId,
      executionTarget: "local",
      llmTargetFaces: true,
      prompt: "Create a low poly version of this generated model: " + artifact.fileName,
      context: artifact.fileName
    });
    const generated = lowPoly && lowPoly.generated ? lowPoly.generated : null;
    if (!generated || !generated.id || !generated.modelFileName) {
      throw new Error("Low poly output is missing generated model metadata.");
    }
    const lowPolyFileName = String(generated.lowPolyModelFileName || generated.modelFileName || "").trim();
    if (!lowPolyFileName) {
      throw new Error("Low poly output is missing a low poly file name.");
    }
    const lowPolyArtifact = {
      kind: "model",
      modelId: generated.id,
      fileName: lowPolyFileName,
      url: "/api/model3d-file?modelId=" + encodeURIComponent(generated.id) + "&file=" + encodeURIComponent(lowPolyFileName),
      prompt: String(artifact.prompt || "").trim(),
      lowPoly: true,
      previewUrl: generated.lowPolyPreviewGifUrl || generated.lowPolyPreviewImageUrl || generated.previewGifUrl || generated.previewImageUrl || "",
      targetFaceCount: typeof lowPoly.targetFaceCount === "number" && Number.isFinite(lowPoly.targetFaceCount)
        ? Math.max(1, Math.round(lowPoly.targetFaceCount))
        : null
    };
    const session = getActiveAskSession();
    if (!session) {
      return;
    }
    const targetFaceCount = lowPolyArtifact.targetFaceCount;
    appendAskMessageToSession(session, {
      id: createAskId("ask-msg"),
      role: "assistant",
      text:
        "Quick action complete. Low poly model generated.\n\n"
        + "Model file: `" + lowPolyFileName + "`\n"
        + (targetFaceCount ? "Target faces: " + targetFaceCount + "\n" : "")
        + "Model ID: `" + generated.id + "`",
      createdAt: Date.now(),
      images: [],
      models: [],
      artifacts: [lowPolyArtifact],
      usedSkill: null,
      error: false,
      pending: false
    });
    renderAskChatMessages();
    scrollAskFeedToBottom();
    input.setOutput("Generated low poly model from quick action.");
    await refreshStudioHistoryForAskArtifact(lowPolyArtifact);
  }
  async function runAskModelAutoRigQuickAction(message, artifact) {
    if (!artifact || artifact.kind !== "model") {
      return;
    }
    const generated = await input.request("/api/model3d-autorig", {
      modelId: artifact.modelId,
      rigProfile: "auto",
      useVision: true,
      landmarks: null
    });
    if (!generated || !generated.id || !generated.modelFileName) {
      throw new Error("AutoRig output is missing generated model metadata.");
    }
    const rigArtifact = {
      kind: "model",
      modelId: generated.id,
      fileName: generated.modelFileName,
      url: "/api/model3d-file?modelId=" + encodeURIComponent(generated.id) + "&file=" + encodeURIComponent(generated.modelFileName),
      prompt: String(artifact.prompt || "").trim(),
      lowPoly: false,
      previewUrl: generated.previewGifUrl || generated.previewImageUrl || "",
      targetFaceCount: typeof generated.lowPolyTargetFaceCount === "number" && Number.isFinite(generated.lowPolyTargetFaceCount)
        ? Math.max(1, Math.round(generated.lowPolyTargetFaceCount))
        : (typeof generated.targetFaceCount === "number" && Number.isFinite(generated.targetFaceCount) ? Math.max(1, Math.round(generated.targetFaceCount)) : null)
    };
    const session = getActiveAskSession();
    if (!session) {
      return;
    }
    appendAskMessageToSession(session, {
      id: createAskId("ask-msg"),
      role: "assistant",
      text:
        "Quick action complete. AutoRig model generated.\n\n"
        + "Rigged model file: `" + rigArtifact.fileName + "`\n"
        + "Model ID: `" + generated.id + "`",
      createdAt: Date.now(),
      images: [],
      models: [],
      artifacts: [rigArtifact],
      usedSkill: null,
      error: false,
      pending: false
    });
    renderAskChatMessages();
    scrollAskFeedToBottom();
    input.setOutput("Generated AutoRig model from quick action.");
    await refreshStudioHistoryForAskArtifact(rigArtifact);
  }
  function createAskQuickActionButton(label, iconKey, title, busyLabel, runAction) {
    const button = document.createElement("button");
    button.className = "secondary mini-button";
    button.type = "button";
    setAskQuickActionButtonContent(button, label, iconKey);
    if (title) {
      button.title = title;
    }
    button.addEventListener("click", event => {
      event.preventDefault();
      void runAskQuickActionWithBusyButton(button, busyLabel, runAction).catch(error => {
        const detail = error && error.message ? error.message : String(error);
        input.setOutput(label + " quick action failed: " + detail);
      });
    });
    return button;
  }
  function createAskClarificationPanel(session, message) {
    const clarification = normalizeAskClarification(message && message.clarification);
    if (!session || !message || !clarification || message.pending) {
      return null;
    }
    const panel = document.createElement("div");
    panel.className = "ask-clarification-panel";
    const runClarificationOption = option => {
      if (!option) {
        return;
      }
      if (askRequestInFlight) {
        input.setOutput("Wait for the current request to finish before choosing a clarification option.");
        return;
      }
      void runAskPromptSend({
        sessionId: session.id,
        rawPrompt: option.prompt,
        askImages: [],
        askModelUploads: [],
        skillId: option.skillId
      });
    };
    const defaultOption = clarification.groups
      .flatMap(group => Array.isArray(group.options) ? group.options : [])
      .find(option => option && option.prompt);
    if (defaultOption) {
      const approveRow = document.createElement("div");
      approveRow.className = "row chat-bubble-action-row ask-clarification-approve-row";
      const approveButton = document.createElement("button");
      approveButton.className = "secondary mini-button ask-clarification-option ask-clarification-approve-button";
      approveButton.type = "button";
      setAskQuickActionButtonContent(
        approveButton,
        clarification.mode === "suggestion" ? defaultOption.label : "Approve",
        defaultOption.skillId === "generate-model" ? "model3d" : defaultOption.skillId === "generate-image" ? "image" : "sparkle"
      );
      approveButton.addEventListener("click", event => {
        event.preventDefault();
        runClarificationOption(defaultOption);
      });
      approveRow.appendChild(approveButton);
      panel.appendChild(approveRow);
    }
    clarification.groups.forEach(group => {
      if (clarification.mode === "suggestion" && clarification.groups.length === 1 && group.options.length === 1) {
        return;
      }
      const details = document.createElement("details");
      details.className = "ask-clarification-group";
      details.open = clarification.mode === "suggestion";
      const summary = document.createElement("summary");
      summary.textContent = group.label;
      details.appendChild(summary);
      const optionRow = document.createElement("div");
      optionRow.className = "row chat-bubble-action-row ask-clarification-options";
      group.options.forEach(option => {
        const button = document.createElement("button");
        button.className = "secondary mini-button ask-clarification-option";
        button.type = "button";
        setAskQuickActionButtonContent(button, option.label, option.skillId === "generate-model" ? "model3d" : option.skillId === "generate-image" ? "image" : "sparkle");
        button.addEventListener("click", event => {
          event.preventDefault();
          runClarificationOption(option);
        });
        optionRow.appendChild(button);
      });
      details.appendChild(optionRow);
      panel.appendChild(details);
    });
    return panel;
  }
  function createAskImageArtifactActionRow(message, artifact, options) {
    const row = document.createElement("div");
    const suffix = options && options.batch ? " ask-bubble-batch-action-row" : " ask-artifact-action-row";
    row.className = "row chat-bubble-action-row" + suffix;
    const prefix = options && options.batch ? "All " : "";
    const titleSuffix = options && options.batch ? " for all generated images" : " for " + artifact.fileName;
    row.appendChild(createAskQuickActionButton(
      prefix + "Create 3D Model" + (options && options.batch ? "s" : ""),
      "model3d",
      "Generate 3D model" + titleSuffix,
      "Generating 3D...",
      async () => {
        await runAskImageToModelQuickAction(message, artifact);
      }
    ));
    [
      ["delight", prefix + "Delight", "Delighting...", "delight"],
      ["remove-background", prefix + "Remove BG", "Removing BG...", "removeBg"]
    ].forEach(action => {
      row.appendChild(createAskQuickActionButton(
        action[1],
        action[3],
        getAskImageTransformLabel(action[0]) + titleSuffix,
        action[2],
        async () => {
          await runAskImageTransformQuickAction(message, artifact, action[0]);
        }
      ));
    });
    row.appendChild(createAskQuickActionButton(
      prefix + "Pixel Art",
      "image",
      "Convert" + titleSuffix + " to pixel art.",
      "Pixelizing...",
      async () => {
        await runAskImagePixelArtQuickAction(message, artifact);
      }
    ));
    if (!options || !options.batch) {
      row.appendChild(createAskQuickActionButton(
        "Normal Map",
        "normalMap",
        "Create a normal map from " + artifact.fileName + ".",
        "Creating...",
        async () => {
          await runAskImageNormalMapToolQuickAction(artifact);
        }
      ));
    }
    return row;
  }
  function createAskModelArtifactActionRow(message, artifact) {
    const row = document.createElement("div");
    row.className = "row chat-bubble-action-row ask-artifact-action-row";
    row.appendChild(createAskQuickActionButton(
      artifact.lowPoly ? "Generate Lower Poly" : "Generate Lowpoly",
      "lowpoly",
      "Generate a low poly version of " + artifact.fileName,
      "Generating Lowpoly...",
      async () => {
        await runAskModelLowpolyQuickAction(message, artifact);
      }
    ));
    if (!artifact.lowPoly) {
      row.appendChild(createAskQuickActionButton(
        "AutoRig",
        "settings",
        "Generate a Rigify AutoRig version of " + artifact.fileName,
        "Rigging...",
        async () => {
          await runAskModelAutoRigQuickAction(message, artifact);
        }
      ));
    }
    return row;
  }
  function getAskImageArtifacts(message) {
    return (Array.isArray(message && message.artifacts) ? message.artifacts : []).filter(artifact => artifact && artifact.kind === "image");
  }
  async function runAskBatchImageQuickAction(button, label, artifacts, runAction) {
    const imageArtifacts = Array.isArray(artifacts) ? artifacts.filter(artifact => artifact && artifact.kind === "image") : [];
    if (imageArtifacts.length === 0) {
      return;
    }
    for (let index = 0; index < imageArtifacts.length; index += 1) {
      input.setOutput(label + " " + (index + 1) + "/" + imageArtifacts.length + "...");
      await runAction(imageArtifacts[index]);
    }
    input.setOutput(label + " complete for " + imageArtifacts.length + " image(s).");
  }
  function createAskBatchImageActionButton(message, artifacts, label, iconKey, busyLabel, runAction) {
    return createAskQuickActionButton(
      label,
      iconKey,
      label + " for all generated images.",
      busyLabel,
      async () => {
        await runAskBatchImageQuickAction(null, label, artifacts, artifact => runAction(message, artifact));
      }
    );
  }
  function createAskAssistantActionRow(message) {
    const row = document.createElement("div");
    row.className = "row chat-bubble-action-row ask-bubble-assistant-action-row";
    const text = String(message && message.text ? message.text : "").trim();
    if (text && !(message && message.pending)) {
      const ttsButton = document.createElement("button");
      ttsButton.className = "secondary mini-button";
      ttsButton.type = "button";
      setAskQuickActionButtonContent(ttsButton, askSpeechActive ? "Stop Speech" : "Text To Speech", askSpeechActive ? "ttsStop" : "tts");
      ttsButton.addEventListener("click", event => {
        event.preventDefault();
        if (askSpeechActive) {
          stopAskSpeech(false);
          setAskQuickActionButtonContent(ttsButton, "Text To Speech", "tts");
          return;
        }
        speakAskText(text);
        setAskQuickActionButtonContent(ttsButton, "Stop Speech", "ttsStop");
      });
      row.appendChild(ttsButton);
      const codeBlocks = collectCodeBlocksFromMarkdown(text);
      if (codeBlocks.length > 0) {
        row.appendChild(createAskQuickActionButton("Save Code", "save", "Save Code", "Saving...", async () => {
          saveAskCodeBlocksFromText(text);
        }));
      }
    }
    const imageArtifacts = getAskImageArtifacts(message);
    if (imageArtifacts.length > 1 && !(message && message.pending)) {
      row.classList.add("ask-bubble-batch-action-row");
      row.appendChild(createAskBatchImageActionButton(message, imageArtifacts, "All 3D Models", "model3d", "Generating 3D...", runAskImageToModelQuickAction));
      row.appendChild(createAskBatchImageActionButton(message, imageArtifacts, "All Pixel Art", "image", "Pixelizing...", runAskImagePixelArtQuickAction));
      row.appendChild(createAskBatchImageActionButton(message, imageArtifacts, "All Delight", "delight", "Delighting...", (sourceMessage, artifact) => runAskImageTransformQuickAction(sourceMessage, artifact, "delight")));
      row.appendChild(createAskBatchImageActionButton(message, imageArtifacts, "All Remove BG", "removeBg", "Removing BG...", (sourceMessage, artifact) => runAskImageTransformQuickAction(sourceMessage, artifact, "remove-background")));
    }
    if (row.childNodes.length >= 5) {
      row.classList.add("is-dense");
    }
    return row;
  }
  function createAskAssistantArtifactGrid(message) {
    const artifacts = Array.isArray(message && message.artifacts) ? message.artifacts : [];
    if (artifacts.length === 0) {
      return null;
    }
    const grid = document.createElement("div");
    grid.className = "ask-assistant-artifact-grid";
    artifacts.forEach((artifact, index) => {
      if (artifact.kind === "image") {
        const card = document.createElement("div");
        card.className = "ask-assistant-artifact-card";
        const title = document.createElement("div");
        title.className = "ask-assistant-artifact-title";
        title.textContent = "Generated Image";
        card.appendChild(title);
        const image = document.createElement("img");
        image.className = "ask-assistant-artifact-image";
        image.loading = "lazy";
        image.alt = artifact.fileName;
        image.src = artifact.url
          ? toAbsoluteDashboardUrl(artifact.url)
          : toAbsoluteDashboardUrl("/api/generated-image-file?imageId=" + encodeURIComponent(artifact.imageId) + "&file=" + encodeURIComponent(artifact.fileName));
        card.appendChild(image);
        card.appendChild(createAskImageArtifactActionRow(message, artifact));
        grid.appendChild(card);
        return;
      }
      if (artifact.kind === "model") {
        const card = document.createElement("div");
        card.className = "ask-assistant-artifact-card";
        const title = document.createElement("div");
        title.className = "ask-assistant-artifact-title";
        title.textContent = artifact.lowPoly ? "Generated Lowpoly Model" : "Generated 3D Model";
        card.appendChild(title);
        const shell = document.createElement("div");
        shell.className = "ask-model-preview-shell";
        const status = document.createElement("div");
        status.className = "ask-model-preview-status";
        status.textContent = "Preparing viewer...";
        const previewKey = message.id + "::" + index + "::" + artifact.modelId + "::" + artifact.fileName;
        const tabs = createAskModelPreviewTabs(shell, status, artifact, previewKey);
        card.appendChild(tabs);
        card.appendChild(shell);
        card.appendChild(status);
        card.appendChild(createAskModelArtifactActionRow(message, artifact));
        grid.appendChild(card);
        return;
      }
      if (artifact.kind === "audio") {
        const card = document.createElement("div");
        card.className = "ask-assistant-artifact-card";
        const title = document.createElement("div");
        title.className = "ask-assistant-artifact-title";
        title.textContent = artifact.isMusic ? "Generated Music" : "Generated Audio";
        card.appendChild(title);
        const audio = document.createElement("audio");
        audio.className = "ask-assistant-artifact-audio";
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = artifact.url ? toAbsoluteDashboardUrl(artifact.url) : "";
        card.appendChild(audio);
        grid.appendChild(card);
        return;
      }
      if (artifact.kind === "video") {
        const card = document.createElement("div");
        card.className = "ask-assistant-artifact-card";
        const title = document.createElement("div");
        title.className = "ask-assistant-artifact-title";
        title.textContent = "Generated Video";
        card.appendChild(title);
        const video = document.createElement("video");
        video.className = "ask-assistant-artifact-video";
        video.controls = true;
        video.preload = "metadata";
        video.src = artifact.url ? toAbsoluteDashboardUrl(artifact.url) : "";
        card.appendChild(video);
        grid.appendChild(card);
      }
    });
    return grid;
  }

  function renderAskChatTabs() {
    const { tabs } = getAskNodes();
    if (!tabs) {
      composerContextController?.render();
      return;
    }
    clearNode(tabs);
    askChatState.sessions.forEach((session, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ask-chat-tab" + (session.id === askChatState.activeSessionId ? " is-active" : "");
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", session.id === askChatState.activeSessionId ? "true" : "false");
      button.title = session.title;
      const label = document.createElement("span");
      label.className = "ask-chat-tab-label";
      label.textContent = session.title || ("Chat " + (index + 1));
      button.appendChild(label);
      if (askChatState.sessions.length > 1) {
        const closeButton = document.createElement("span");
        closeButton.className = "ask-chat-tab-close";
        closeButton.textContent = "x";
        closeButton.setAttribute("role", "button");
        closeButton.tabIndex = 0;
        closeButton.title = "Close chat";
        const closeTab = event => {
          event.preventDefault();
          event.stopPropagation();
          if (askRequestInFlight) {
            input.setOutput("Wait for the current request to finish before closing chats.");
            return;
          }
          askChatState.sessions = askChatState.sessions.filter(entry => entry.id !== session.id);
          if (askChatState.sessions.length === 0) {
            const replacement = createDefaultAskSession(0);
            askChatState.sessions = [replacement];
          }
          const activeStillExists = askChatState.sessions.some(entry => entry.id === askChatState.activeSessionId);
          if (!activeStillExists) {
            askChatState.activeSessionId = askChatState.sessions[askChatState.sessions.length - 1].id;
          }
          persistAskChatStore();
          renderAskChatTabs();
          renderAskChatMessages();
        };
        closeButton.addEventListener("click", closeTab);
        closeButton.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            closeTab(event);
          }
        });
        button.appendChild(closeButton);
      }
      button.addEventListener("click", () => {
        if (askRequestInFlight) {
          input.setOutput("Wait for the current request to finish before switching chats.");
          return;
        }
        askChatState.activeSessionId = session.id;
        persistAskChatStore();
        renderAskChatTabs();
        renderAskChatMessages();
      });
      tabs.appendChild(button);
    });
    composerContextController?.render();
  }

  function renderAskChatMessages() {
    const { messageList } = getAskNodes();
    if (!messageList) {
      return;
    }
    disposeAskModelPreviews();
    clearNode(messageList);
    const session = getActiveAskSession();
    if (!session || !Array.isArray(session.messages) || session.messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ask-chat-empty";
      empty.textContent = "No messages yet. Send a prompt, image, or 3D model to start this chat.";
      messageList.appendChild(empty);
      return;
    }
    session.messages.forEach(message => {
      const article = document.createElement("article");
      article.className = "chat-bubble " + (message.role === "assistant" ? "assistant-bubble" : "user-bubble") + (message.error ? " is-error" : "");
      article.setAttribute("data-ask-message-id", message.id);
      const role = document.createElement("div");
      role.className = "chat-role";
      role.textContent = message.role === "assistant" ? "Assistant" : "You";
      article.appendChild(role);
      if (message.role === "assistant") {
        if (message.usedSkill && message.usedSkill.id) {
          const skillTag = document.createElement("div");
          skillTag.className = "ask-bubble-skill-tag";
          const sourceLabel = message.usedSkill.source === "explicit" ? "manual" : "auto";
          skillTag.textContent = "Skill: " + message.usedSkill.id + " (" + sourceLabel + ")";
          article.appendChild(skillTag);
        }
        const taskInfo = createAskTaskInfoBlock(message);
        if (taskInfo) {
          article.appendChild(taskInfo);
        }
        const body = document.createElement("div");
        body.className = "chat-bubble-body";
        if (message.pending && !String(message.text || "").trim()) {
          setAssistantThinkingHtml(body);
        } else if (message.pending) {
          setAssistantStreamingText(body, message.text || "");
        } else {
          input.renderMarkdownInto(body, message.text || "", "No LazyDev reply yet.");
        }
        article.appendChild(body);
        const artifactGrid = createAskAssistantArtifactGrid(message);
        if (artifactGrid) {
          article.appendChild(artifactGrid);
        }
        const clarificationPanel = createAskClarificationPanel(session, message);
        if (clarificationPanel) {
          article.appendChild(clarificationPanel);
        }
        const actionRow = createAskAssistantActionRow(message);
        if (actionRow.childNodes.length > 0) {
          article.appendChild(actionRow);
        }
      } else {
        article.appendChild(createAskUserMessageBody(message));
      }
      const utilityRow = createAskBubbleUtilityActionRow(session, message);
      if (utilityRow) {
        article.appendChild(utilityRow);
      }
      messageList.appendChild(article);
    });
  }

  let askChatState = readAskChatStoreFromStorage();
  ensureAskSessionState();

  function captureAskSendInputFromUi() {
    const { askPrompt } = getAskNodes();
    const rawPrompt = askPrompt && typeof askPrompt.value === "string" ? askPrompt.value.trim() : "";
    const askImages = Array.isArray(input.state.aiImages)
      ? input.state.aiImages
        .map(item => {
          const value = item && item.value ? item.value : (item && item.previewUrl ? item.previewUrl : "");
          return {
            name: item && item.name ? item.name : "image",
            value,
            previewUrl: item && item.previewUrl ? item.previewUrl : value
          };
        })
        .filter(item => Boolean(item.value))
      : [];
    const askModelUploads = Array.isArray(input.state.askSkillModelUploads)
      ? input.state.askSkillModelUploads.map(item => ({
        fileName: item && item.fileName ? item.fileName : "uploaded-model",
        dataUrl: item && item.dataUrl ? item.dataUrl : ""
      }))
      : [];
    const askFileUploads = Array.isArray(input.state.askFileUploads)
      ? input.state.askFileUploads.map(item => ({
        fileName: item && item.fileName ? item.fileName : "uploaded-file",
        contentType: item && item.contentType ? item.contentType : "text/plain",
        text: item && item.text ? item.text : ""
      })).filter(item => Boolean(item.text))
      : [];
    const askAudioUploads = Array.isArray(input.state.askAudioUploads)
      ? input.state.askAudioUploads.map(item => ({
        fileName: item && item.fileName ? item.fileName : "recorded-audio.webm",
        contentType: item && item.contentType ? item.contentType : "audio/webm",
        dataUrl: item && item.dataUrl ? item.dataUrl : ""
      })).filter(item => Boolean(item.dataUrl))
      : [];
    const prompt = rawPrompt || (askImages.length > 0 ? "Describe this image in detail." : "");
    if (!prompt && askImages.length === 0 && askModelUploads.length === 0 && askFileUploads.length === 0 && askAudioUploads.length === 0) {
      return null;
    }
    if (askPrompt && typeof askPrompt.value === "string") {
      askPrompt.value = "";
      askPrompt.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (typeof input.clearAiImages === "function") {
      input.clearAiImages();
    }
    if (typeof input.clearAskSkillModelUploads === "function") {
      input.clearAskSkillModelUploads();
    }
    if (typeof input.clearAskFileUploads === "function") {
      input.clearAskFileUploads();
    }
    input.state.askAudioUploads = [];
    clearAskComposerAttachmentTray();
    input.renderAskComposerAttachments?.();
    const session = getActiveAskSession();
    return session
      ? {
        sessionId: session.id,
        rawPrompt,
        askImages,
        askModelUploads,
        askFileUploads,
        askAudioUploads,
        skillId: "",
        replyStyleOverrideId: session.replyStyleOverrideId || ""
      }
      : null;
  }
  async function runAskPromptSend(queuedInput) {
    if (askRequestInFlight && !queuedInput) {
      const queued = captureAskSendInputFromUi();
      if (!queued) {
        input.setOutput("Prompt or uploaded files are required.");
        return;
      }
      askSendQueue.push(queued);
      input.setOutput("Rod request queued. It will run after the current task finishes.");
      return;
    }
    if (!askRequestInFlight) {
      askRequestInFlight = true;
      updateAskButtonState();
    }

    const sendInput = queuedInput || captureAskSendInputFromUi();
    if (!sendInput) {
      askRequestInFlight = false;
      input.setOutput("Prompt or uploaded files are required.");
      return;
    }
    const session = getAskSessionById(sendInput.sessionId) || getActiveAskSession();
    if (!session) {
      input.setOutput("No active chat session is available.");
      askRequestInFlight = false;
      return;
    }
    let assistantMessage = null;
    try {
      await replyStyleEditor?.flush();
      const rawPrompt = sendInput.rawPrompt;
      const askImages = sendInput.askImages;
      const askModelUploads = sendInput.askModelUploads;
      const askFileUploads = sendInput.askFileUploads || [];
      const askAudioUploads = sendInput.askAudioUploads || [];
      const explicitSkillId = normalizeChatSkillIdClient(sendInput.skillId || "");
      let prompt = rawPrompt || (askImages.length > 0 ? "Describe this image in detail." : "");
      let audioTranscriptions = [];
      if (askAudioUploads.length > 0) {
        input.setOutput("Transcribing attached audio...");
        audioTranscriptions = await Promise.all(askAudioUploads.map(async audio => {
          const response = await input.request("/api/stt-transcribe", {
            audioDataUrl: audio.dataUrl,
            fileName: audio.fileName,
            saveSource: true
          });
          return {
            text: String(response?.transcript || response?.text || "").trim(),
            audioUrl: String(response?.sourceAudio?.audioUrl || "").trim()
          };
        }));
        const transcript = audioTranscriptions.map(item => item.text).filter(Boolean).join("\n\n");
        if (!transcript && !prompt) {
          input.setOutput("Transcription returned empty text.");
          return;
        }
        prompt = [prompt, transcript].filter(Boolean).join("\n\n");
      }
      if (!prompt && askImages.length === 0 && askModelUploads.length === 0 && askFileUploads.length === 0) {
        input.setOutput("Prompt or uploaded files are required.");
        return;
      }
      const previewText = prompt
        || (askModelUploads.length > 0
          ? "Process uploaded 3D model file(s)."
          : askFileUploads.length > 0
            ? "Read uploaded reference file(s)."
            : askAudioUploads.length > 0
              ? "Transcribe attached audio."
            : "Process uploaded image(s).");
      const conversation = buildAskConversationPayload(session);
      const userImagePreviews = await Promise.all(askImages.map(async item => ({
        name: item && item.name ? item.name : "image",
        previewUrl: await createAskImageBubblePreview(item)
      })));
      const taskInfo = createAskTaskFromInput(prompt, askImages, askModelUploads, isAskAutoRunSkillsEnabled());
      const pendingTask = inferAskPendingTask(prompt, askImages, askModelUploads, isAskAutoRunSkillsEnabled());
      const userMessage = {
        id: createAskId("ask-msg"),
        role: "user",
        text: previewText,
        createdAt: Date.now(),
        images: userImagePreviews,
        models: askModelUploads.map(item => ({
          fileName: item && item.fileName ? item.fileName : "uploaded-model"
        })),
        files: askFileUploads.map(item => ({
          fileName: item && item.fileName ? item.fileName : "uploaded-file"
        })),
        audios: askAudioUploads.map((item, index) => ({
          fileName: item && item.fileName ? item.fileName : "recorded-audio.webm",
          url: audioTranscriptions[index]?.audioUrl || "",
          dataUrl: audioTranscriptions[index]?.audioUrl ? "" : (item && item.dataUrl ? item.dataUrl : "")
        })),
        artifacts: [],
        usedSkill: null,
        task: null,
        error: false,
        pending: false
      };
      appendAskMessageToSession(session, userMessage);
      assistantMessage = {
        id: createAskId("ask-msg"),
        role: "assistant",
        text: pendingTask.text,
        createdAt: Date.now(),
        images: [],
        models: [],
        artifacts: [],
        usedSkill: pendingTask.usedSkill,
        task: taskInfo,
        error: false,
        pending: true
      };
      appendAskMessageToSession(session, assistantMessage);
      renderAskChatTabs();
      renderAskChatMessages();
      scrollAskFeedToBottom();
      const localSkillRequest = resolveLocalAskSkillRequest(prompt, askImages, askModelUploads, isAskAutoRunSkillsEnabled());
      if (localSkillRequest && localSkillRequest.skillId === "create-pixel-art") {
        await runAskLocalPixelArtSkill(session, assistantMessage, prompt, askImages, localSkillRequest.source);
        return;
      }
      const requestToken = ++askThinkAnimationToken;
      const reasoningEnabled = isAskReasoningEnabled();
      if (reasoningEnabled) {
        showAskThinkFoldoutPending();
      } else {
        hideAskThinkFoldout();
      }
      stopAskSpeech(true);
      askStreamingSessionId = session.id;
      askStreamingAssistantMessageId = assistantMessage.id;
      const dashboardRequestId = createDashboardRequestId("ask");
      askActiveRequestId = dashboardRequestId;
      askActiveAbortController = new AbortController();
      let responseBuffer = "";
      let reasoningBuffer = "";
      let finalPayload = null;
      await runDashboardAskStreamRequest({
        payload: {
        prompt,
        skillId: explicitSkillId,
        autoRunSkills: isAskAutoRunSkillsEnabled(),
        images: askImages.map(item => item.value),
        imageFileNames: askImages.map(item => item.name || "image"),
        modelUploads: askModelUploads.map(item => ({
          fileName: item.fileName || "uploaded-model",
          dataUrl: item.dataUrl || "",
          modelId: item.modelId || ""
        })),
        files: askFileUploads.map(item => ({
          fileName: item.fileName || "uploaded-file",
          contentType: item.contentType || "text/plain",
          text: item.text || ""
        })),
        conversation,
        replyStyleOverrideId: sendInput.replyStyleOverrideId || "",
        dashboardRequestId
        },
        handlers: {
        onReasoningDelta: delta => {
          if (requestToken !== askThinkAnimationToken) {
            return;
          }
          if (!reasoningEnabled) {
            return;
          }
          reasoningBuffer += delta;
          appendReasoningDelta(delta);
        },
        onResponseDelta: delta => {
          if (requestToken !== askThinkAnimationToken) {
            return;
          }
          responseBuffer += delta;
          updateAskMessage(askStreamingSessionId, askStreamingAssistantMessageId, {
            text: responseBuffer,
            pending: true,
            error: false
          });
          updateAskStreamingMessageNode(askStreamingAssistantMessageId, responseBuffer);
          scrollAskFeedToBottom();
        },
        onSkillStart: event => {
          if (requestToken !== askThinkAnimationToken || responseBuffer) {
            return;
          }
          const skillId = normalizeChatSkillIdClient(event.skillId);
          const source = event.source === "explicit" ? "explicit" : "auto";
          const message = String(event.message || "").trim() || describeAskSkillTask(skillId, source);
          updateAskMessage(askStreamingSessionId, askStreamingAssistantMessageId, {
            text: message,
            pending: true,
            error: false,
            usedSkill: skillId ? { id: skillId, name: event.skillName || skillId, source } : null,
            task: {
              skillId,
              skillSource: source,
              status: "pending",
              queuedSkills: event.queuedSkills
            }
          });
          updateAskStreamingMessageNode(askStreamingAssistantMessageId, message);
          renderAskChatMessages();
          scrollAskFeedToBottom();
        },
        onSkillArtifact: artifact => {
          if (requestToken !== askThinkAnimationToken) {
            return;
          }
          const session = getAskSessionById(askStreamingSessionId);
          const previousMessage = session ? session.messages.find(entry => entry.id === askStreamingAssistantMessageId) : null;
          const previousArtifacts = Array.isArray(previousMessage && previousMessage.artifacts) ? previousMessage.artifacts : [];
          const current = updateAskMessage(askStreamingSessionId, askStreamingAssistantMessageId, {
            artifacts: previousArtifacts.concat([artifact]),
            pending: true,
            error: false,
            task: {
              artifactCount: previousArtifacts.length + 1,
              status: "pending"
            }
          });
          void refreshStudioHistoryForAskArtifact(artifact);
          if (current && String(current.text || "").trim()) {
            updateAskStreamingMessageNode(askStreamingAssistantMessageId, current.text);
          }
          renderAskChatMessages();
          scrollAskFeedToBottom();
        },
        onSkillPlan: plan => {
          if (requestToken !== askThinkAnimationToken || !plan) {
            return;
          }
          const suffix = plan.index && plan.total
            ? " " + plan.index + " of " + plan.total
            : "";
          appendAskMessageToSession(session, {
            id: createAskId("ask-msg"),
            role: "assistant",
            text: "**" + plan.title + suffix + "**\n\n" + plan.prompt,
            createdAt: Date.now(),
            images: [],
            models: [],
            artifacts: [],
            usedSkill: plan.skillId ? { id: plan.skillId, name: plan.skillId, source: "auto" } : null,
            task: null,
            error: false,
            pending: false
          });
          renderAskChatMessages();
          scrollAskFeedToBottom();
        },
        onClarification: clarification => {
          if (requestToken !== askThinkAnimationToken || !clarification) {
            return;
          }
          responseBuffer = clarification.question;
          updateAskMessage(askStreamingSessionId, askStreamingAssistantMessageId, {
            text: clarification.question,
            pending: true,
            error: false,
            clarification
          });
          updateAskStreamingMessageNode(askStreamingAssistantMessageId, clarification.question);
          scrollAskFeedToBottom();
        },
        onDone: payload => {
          finalPayload = payload;
        },
        onError: message => {
          throw new Error(message);
        },
        onStopped: message => {
          throw new DOMException(message || "Ask request stopped.", "AbortError");
        }
        },
        signal: askActiveAbortController.signal,
        normalizers: {
          normalizeTaskSkillList: normalizeAskTaskSkillList,
          normalizeArtifact: normalizeAskArtifact,
          normalizeSkillPlan: normalizeAskSkillPlan,
          normalizeClarification: normalizeAskClarification,
          normalizeUsedSkill: normalizeAskUsedSkill
        }
      });
      if (requestToken !== askThinkAnimationToken) {
        return;
      }
      const previousMessage = getAskSessionById(askStreamingSessionId)?.messages.find(entry => entry.id === askStreamingAssistantMessageId) || null;
      const streamedText = String(previousMessage?.text || responseBuffer || "").trim();
      const responseText = getAskFinalResponseText(finalPayload, streamedText);
      const rawReasoningText = (finalPayload && typeof finalPayload.reasoning === "string" ? finalPayload.reasoning : reasoningBuffer).trim();
      const reasoningText = reasoningEnabled ? rawReasoningText : "";
      const usedSkill = finalPayload && finalPayload.usedSkill ? normalizeAskUsedSkill(finalPayload.usedSkill) : null;
      const clarification = finalPayload && finalPayload.clarification ? normalizeAskClarification(finalPayload.clarification) : null;
      const previousArtifacts = Array.isArray(previousMessage && previousMessage.artifacts) ? previousMessage.artifacts : [];
      const finalArtifacts = previousArtifacts.concat(finalPayload && Array.isArray(finalPayload.artifacts) ? finalPayload.artifacts : []);
      const artifacts = mergeAskArtifacts(finalArtifacts, responseText);
      if (usedSkill && usedSkill.id === "create-pixel-art" && askImages.length > 0 && askModelUploads.length === 0) {
        if (!reasoningText) {
          hideAskThinkFoldout();
        }
        await runAskLocalPixelArtSkill(session, assistantMessage, prompt, askImages, usedSkill.source);
        await input.refreshState();
        return;
      }
      const finishedAt = Date.now();
      const durationMs = Math.max(0, finishedAt - assistantMessage.createdAt);
      updateAskMessage(askStreamingSessionId, askStreamingAssistantMessageId, {
        text: responseText,
        pending: false,
        error: false,
        usedSkill,
        clarification,
        artifacts,
        task: {
          skillId: usedSkill && usedSkill.id ? usedSkill.id : "",
          skillSource: usedSkill && usedSkill.source ? usedSkill.source : "",
          artifactCount: artifacts.length,
          status: "done",
          finishedAt,
          durationMs,
          queuedSkills: []
        }
      });
      void refreshStudioHistoryForAskArtifacts(artifacts);
      renderAskChatTabs();
      renderAskChatMessages();
      scrollAskFeedToBottom();
      if (!reasoningText) {
        hideAskThinkFoldout();
      }
      if (isAskAutoTtsEnabled()) {
        speakAskText(responseText, { silentStatus: true });
      }
      input.setOutput(responseText || "No LazyDev reply yet.");
      await input.refreshState();
    } catch (error) {
      ++askThinkAnimationToken;
      hideAskThinkFoldout();
      stopAskSpeech(true);
      const detail = error && error.message ? error.message : String(error);
      const stopped = error && error.name === "AbortError";
      const failedAt = Date.now();
      if (assistantMessage && askStreamingSessionId && askStreamingAssistantMessageId) {
        const failedDurationMs = Math.max(0, failedAt - assistantMessage.createdAt);
        updateAskMessage(askStreamingSessionId, askStreamingAssistantMessageId, {
          text: stopped ? "Rod request stopped." : "Rod request failed: " + detail,
          pending: false,
          error: !stopped,
          usedSkill: null,
          artifacts: [],
          task: {
            status: stopped ? "done" : "error",
            finishedAt: failedAt,
            durationMs: failedDurationMs,
            queuedSkills: []
          }
        });
      }
      renderAskChatMessages();
      scrollAskFeedToBottom();
      input.setOutput(stopped ? "Stopped LazyDev response." : "Rod request failed: " + detail);
    } finally {
      askStreamingSessionId = "";
      askStreamingAssistantMessageId = "";
      askActiveRequestId = "";
      askActiveAbortController = null;
      if (askSendQueue.length > 0) {
        const nextQueued = askSendQueue.shift();
        if (nextQueued) {
          void runAskPromptSend(nextQueued);
          return;
        }
      }
      askRequestInFlight = false;
      updateAskButtonState();
    }
  }

  function startNewAskChat() {
    if (askRequestInFlight) {
      input.setOutput("Wait for the current request to finish before starting a new chat.");
      return;
    }
    const session = createAskSession({ title: "Chat " + (askChatState.sessions.length + 1) });
    const { askPrompt } = getAskNodes();
    if (askPrompt && typeof askPrompt.value === "string") {
      askPrompt.value = "";
      askPrompt.dispatchEvent(new Event("input", { bubbles: true }));
      askPrompt.focus();
    }
    if (typeof input.clearAiImages === "function") {
      input.clearAiImages();
    }
    if (typeof input.clearAskSkillModelUploads === "function") {
      input.clearAskSkillModelUploads();
    }
    stopAskSpeech(true);
    hideAskThinkFoldout();
    askChatState.activeSessionId = session.id;
    persistAskChatStore();
    renderAskChatTabs();
    renderAskChatMessages();
    input.setOutput("Started a new Ask LazyDev chat tab.");
  }

  function bindActions() {
    ensureAskSessionState();
    renderAskChatTabs();
    renderAskChatMessages();
    window.requestAnimationFrame(() => {
      scrollAskFeedToBottom();
    });
    setAskAutoEnterEnabled(readAskAutoEnterPreference(), true);
    setAskAutoRunSkillsEnabled(readAskAutoRunSkillsPreference(), false);
    setAskAutoTtsEnabled(readAskAutoTtsPreference(), false);
    setAskTtsVoicePreference(readAskTtsVoicePreference(), false);
    setAskTtsMode(readAskTtsModePreference(), false);
    replyStyleEditor?.bind();
    composerContextController?.bind();
    slashCommandController?.bind();
    const { autoEnterToggle, autoRunSkillsToggle, autoTtsToggle, ttsVoiceSelect, ttsModeSelect } = getAskSendModeNodes();
    if (autoEnterToggle) {
      autoEnterToggle.addEventListener("change", () => {
        setAskAutoEnterEnabled(autoEnterToggle.checked, true);
      });
    }
    if (autoRunSkillsToggle) {
      autoRunSkillsToggle.addEventListener("change", () => {
        setAskAutoRunSkillsEnabled(autoRunSkillsToggle.checked, true);
      });
    }
    if (autoTtsToggle) {
      autoTtsToggle.addEventListener("change", () => {
        setAskAutoTtsEnabled(autoTtsToggle.checked, true);
      });
    }
    if (ttsVoiceSelect) {
      ttsVoiceSelect.addEventListener("change", () => {
        setAskTtsVoicePreference(ttsVoiceSelect.value, true);
      });
    }
    if (ttsModeSelect) {
      ttsModeSelect.addEventListener("change", () => setAskTtsMode(ttsModeSelect.value, true));
    }
    const personalityNodes = getAskPersonalityNodes();
    if (personalityNodes.select) {
      personalityNodes.select.addEventListener("change", () => {
        askPersonalityState.soul = captureAskPersonalityEditor().soul;
        askPersonalityState.soul.activePersonalityId = normalizeAskPersonalityId(personalityNodes.select.value);
        askPersonalityEditingId = askPersonalityState.soul.activePersonalityId;
        renderAskPersonalityEditor();
        setAskPersonalityStatus("Selected personality. Save to write SOUL.md.");
      });
      void loadAskPersonalitySettings().catch(error => {
        setAskPersonalityStatus(error && error.message ? error.message : "Failed to load SOUL.md.");
      });
    }
    if (personalityNodes.saveButton) {
      personalityNodes.saveButton.addEventListener("click", () => {
        void saveAskPersonalitySettings().catch(error => {
          setAskPersonalityStatus(error && error.message ? error.message : "Failed to save SOUL.md.");
        });
      });
    }
    if (personalityNodes.addButton) {
      personalityNodes.addButton.addEventListener("click", () => {
        addAskPersonalityOption();
      });
    }
    if (personalityNodes.deleteButton) {
      personalityNodes.deleteButton.addEventListener("click", () => {
        deleteAskPersonalityOption();
      });
    }
    if (hasSpeechSupport()) {
      window.speechSynthesis.getVoices();
      if (!askSpeechVoicesListenerBound) {
        askSpeechVoicesListenerBound = true;
        window.speechSynthesis.addEventListener("voiceschanged", () => {
          setAskTtsVoicePreference(getAskTtsVoicePreference(), false);
        });
      }
    }
    updateAskShortcutHint();
    const askPromptNode = document.getElementById("ask-prompt");
    if (askPromptNode) {
      askPromptNode.addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.isComposing) {
          return;
        }
        if (event.ctrlKey) {
          event.preventDefault();
          void runAskPromptSend();
          return;
        }
        if (isAskAutoEnterEnabled() && !event.shiftKey) {
          event.preventDefault();
          void runAskPromptSend();
        }
      });
    }
    const askNewChatButton = document.getElementById("ask-new-chat-button");
    if (askNewChatButton) {
      askNewChatButton.addEventListener("click", () => {
        startNewAskChat();
      });
    }
    const askButton = document.getElementById("ask-button");
    if (askButton) {
      askButton.addEventListener("click", async () => {
        if (askRequestInFlight) {
          await stopAskRequest();
          return;
        }
        await runAskPromptSend();
      });
      updateAskButtonState();
    }

    const askChatSettingsButton = document.getElementById("ask-send-to-game-engine-button");
    const askChatSettingsDialog = document.getElementById("ask-chat-settings-dialog");
    const closeAskChatSettings = () => {
      if (askChatSettingsDialog?.open) {
        askChatSettingsDialog.close();
      }
    };
    askChatSettingsButton?.addEventListener("click", () => {
      if (!askChatSettingsDialog) return;
      if (askChatSettingsDialog.open) {
        closeAskChatSettings();
      } else {
        askChatSettingsDialog.showModal();
      }
    });
    document.getElementById("ask-chat-settings-close-button")?.addEventListener("click", closeAskChatSettings);

    const askAudioUploadInput = document.getElementById("ask-audio-upload-input");
    if (askAudioUploadInput) {
      askAudioUploadInput.addEventListener("change", async event => {
        const file = event.target && event.target.files && event.target.files[0];
        if (!file) return;
        await attachAskAudioFiles([file]);
        askAudioUploadInput.value = "";
      });
    }
    const askAudioUploadButton = document.getElementById("ask-audio-upload-button");
    if (askAudioUploadButton) {
      askAudioUploadButton.addEventListener("click", () => {
        askAudioUploadInput && askAudioUploadInput.click();
      });
    }
    let askVoiceRecorderState = "idle";
    let askMediaRecorder = null;
    let askAudioChunks = [];
    let askRecordingStartedAt = 0;
    let askRecordingTimer = null;
    const askVoiceRecordButton = document.getElementById("ask-voice-record-button");
    const askComposerMessageRow = document.querySelector(".ask-composer-message-row");
    const askRecordingStatus = document.getElementById("ask-recording-status");
    const updateAskRecordingStatus = () => {
      if (!askRecordingStatus || !askRecordingStartedAt) return;
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - askRecordingStartedAt) / 1000));
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = String(elapsedSeconds % 60).padStart(2, "0");
      askRecordingStatus.textContent = "Recording " + minutes + ":" + seconds + " — tap the stop button when finished";
    };
    const setAskRecordingStatus = recording => {
      if (askRecordingTimer) {
        window.clearInterval(askRecordingTimer);
        askRecordingTimer = null;
      }
      askComposerMessageRow?.classList.toggle("is-recording", recording);
      if (!askRecordingStatus) return;
      askRecordingStatus.classList.toggle("hidden", !recording);
      if (!recording) {
        askRecordingStatus.textContent = "";
        return;
      }
      askRecordingStartedAt = Date.now();
      updateAskRecordingStatus();
      askRecordingTimer = window.setInterval(updateAskRecordingStatus, 1000);
    };
    const syncAskComposerPrimaryAction = () => {
      if (!askVoiceRecordButton) return;
      const hasText = Boolean(String(askPromptNode?.value || "").trim());
      const hasAudio = Array.isArray(input.state.askAudioUploads) && input.state.askAudioUploads.length > 0;
      if (askVoiceRecorderState === "recording") {
        askVoiceRecordButton.innerHTML = '<i class="bi bi-stop-fill" aria-hidden="true"></i>';
        askVoiceRecordButton.title = "Stop recording";
        askVoiceRecordButton.setAttribute("aria-label", "Stop recording");
        return;
      }
      const sendMode = askVoiceRecorderState === "idle" && (hasText || hasAudio || askRequestInFlight);
      askVoiceRecordButton.innerHTML = sendMode
        ? '<i class="bi bi-send" aria-hidden="true"></i>'
        : '<i class="bi bi-mic" aria-hidden="true"></i>';
      askVoiceRecordButton.title = sendMode ? (askRequestInFlight ? "Stop LazyDev response" : "Send message") : "Record Audio";
      askVoiceRecordButton.setAttribute("aria-label", askVoiceRecordButton.title);
    };
    if (askPromptNode) {
      askPromptNode.addEventListener("input", syncAskComposerPrimaryAction);
    }
    document.addEventListener("ask-composer-primary-action-sync", syncAskComposerPrimaryAction);
    if (askVoiceRecordButton) {
      askVoiceRecordButton.addEventListener("click", async () => {
        if (askRequestInFlight) {
          await stopAskRequest();
          syncAskComposerPrimaryAction();
          return;
        }
        const hasText = Boolean(String(askPromptNode?.value || "").trim());
        const hasAudio = Array.isArray(input.state.askAudioUploads) && input.state.askAudioUploads.length > 0;
        if (askVoiceRecorderState === "idle" && (hasText || hasAudio)) {
          await runAskPromptSend();
          syncAskComposerPrimaryAction();
          return;
        }
        if (askVoiceRecorderState === "idle") {
          await startAskVoiceRecording();
        } else {
          stopAskVoiceRecording();
        }
        syncAskComposerPrimaryAction();
      });
      syncAskComposerPrimaryAction();
    }

    async function attachAskAudioFiles(files) {
      const uploads = Array.isArray(input.state.askAudioUploads) ? input.state.askAudioUploads : [];
      input.state.askAudioUploads = uploads;
      let added = 0;
      for (const file of Array.from(files || [])) {
        if (!file || !String(file.type || "").startsWith("audio/")) continue;
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Failed to read audio file."));
          reader.readAsDataURL(file);
        });
        if (!dataUrl || uploads.some(entry => entry.dataUrl === dataUrl)) continue;
        uploads.push({
          id: createAskId("ask-audio"),
          fileName: String(file.name || "recorded-audio.webm").trim() || "recorded-audio.webm",
          contentType: String(file.type || "audio/webm").trim() || "audio/webm",
          dataUrl,
          detail: "Voice recording"
        });
        added += 1;
      }
      syncAskComposerPrimaryAction();
      input.renderAskComposerAttachments?.();
      input.setOutput(added > 0 ? "Audio attached. Press Send to transcribe and send it." : "No new audio was attached.");
    }

    async function startAskVoiceRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        askMediaRecorder = new MediaRecorder(stream);
        askAudioChunks = [];
        askMediaRecorder.ondataavailable = event => {
          if (event.data.size > 0) {
            askAudioChunks.push(event.data);
          }
        };
        askMediaRecorder.onstop = async () => {
          const mimeType = askMediaRecorder?.mimeType || "audio/webm";
          const blob = new Blob(askAudioChunks, { type: mimeType });
          askAudioChunks = [];
          stream.getTracks().forEach(track => track.stop());
          const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
          await attachAskAudioFiles([new File([blob], "recording-" + Date.now() + "." + extension, { type: mimeType })]);
          setAskRecordingStatus(false);
        };
        askMediaRecorder.start();
        askVoiceRecorderState = "recording";
        askVoiceRecordButton.classList.add("is-recording");
        setAskRecordingStatus(true);
        syncAskComposerPrimaryAction();
      } catch (error) {
        const detail = error && error.message ? error.message : String(error);
        input.setOutput("Microphone access denied: " + detail);
      }
    }

    function stopAskVoiceRecording() {
      if (askMediaRecorder && askMediaRecorder.state === "recording") {
        askMediaRecorder.stop();
        askVoiceRecorderState = "idle";
        askVoiceRecordButton.classList.remove("is-recording");
        if (askRecordingStatus) {
          askRecordingStatus.textContent = "Saving recording…";
        }
        syncAskComposerPrimaryAction();
      }
    }

    document.getElementById("apply-guild-channel-plan-button").addEventListener("click", async () => {
      if (!input.state.selectedGuildId) return void input.setOutput("Select a guild first.");
        if (!input.state.guildChannelPlan || !Array.isArray(input.state.guildChannelPlan.entries) || input.state.guildChannelPlan.entries.length === 0) {
        return void input.setOutput("Plan channels first.");
      }
      const payload = await input.request("/api/guild-ai/apply-channel-plan", {
        guildId: input.state.selectedGuildId,
        plan: input.state.guildChannelPlan
      });
      await input.loadChannels();
      input.renderMarkdownInto(
        "guild-ai-output",
        "Created **" + payload.createdChannels + "** channels in **" + payload.createdCategories + "** new categories.",
        "No LazyDev guild action run yet."
      );
      input.setOutput("Rod channel plan applied.");
    });

    document.getElementById("clear-guild-channel-plan-button").addEventListener("click", () => {
      input.state.guildChannelPlan = null;
      input.renderGuildChannelPlan();
      input.renderMarkdownInto("guild-ai-output", "", "No LazyDev guild action run yet.");
      input.setOutput("Cleared LazyDev channel plan.");
    });

    document.getElementById("run-guild-audit-button").addEventListener("click", async () => {
      if (!input.state.selectedGuildId) return void input.setOutput("Select a guild first.");
      const prompt = document.getElementById("guild-ai-prompt").value.trim();
      const payload = await input.request("/api/guild-ai/audit", {
        guildId: input.state.selectedGuildId,
        prompt
      });
      input.renderMarkdownInto("guild-ai-output", payload.result, "No LazyDev guild action run yet.");
      input.setOutput("Rod guild audit finished.");
    });

    document.getElementById("simulate-moderation-button").addEventListener("click", async () => {
      const payload = await input.request("/api/moderation/simulate", {
        guildId: input.state.selectedGuildId,
        text: document.getElementById("moderation-test-text").value,
        images: input.state.moderationTestImages.map(item => item.value)
      });
      input.renderModerationSimulation(payload);
      input.setOutput("Moderation simulation finished.");
    });

    document.getElementById("clear-moderation-simulation-button").addEventListener("click", () => {
      document.getElementById("moderation-simulation-output").textContent = "No moderation simulation run yet.";
      document.getElementById("moderation-test-text").value = "";
      input.clearModerationImages();
      input.setOutput("Moderation simulation cleared.");
    });
  }

  return {
    bindActions
  };
}
