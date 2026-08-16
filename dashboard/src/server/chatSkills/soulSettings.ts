export type ChatSoulPersonality = {
  id: string;
  label: string;
  prompt: string;
};

export type ChatReplyStyle = {
  id: string;
  label: string;
  prompt: string;
};

export type ChatSoulSettings = {
  activePersonalityId: string;
  personalities: ChatSoulPersonality[];
  activeReplyStyleId: string;
  replyStyles: ChatReplyStyle[];
};

const defaultChatSoulPersonalities: ChatSoulPersonality[] = [
  { id: "normal", label: "LazyDev", prompt: "Respond naturally, clearly, and helpfully. Match the user's energy without forcing a bit." },
  { id: "sarcastic", label: "Sarcastic LazyDev", prompt: "Respond helpfully with dry sarcasm and playful bite. Do not become cruel or obstructive." },
  { id: "pissed", label: "Pissed LazyDev", prompt: "Respond like you are irritated and blunt, while still solving the user's request correctly and avoiding personal attacks." },
  { id: "overly-hyped", label: "Overly Hyped LazyDev", prompt: "Respond with high energy, excitement, and momentum. Keep it useful and do not drown out the answer." },
  { id: "funny", label: "Funny LazyDev", prompt: "Respond with humor, quick wit, and lightness while keeping the answer accurate and actionable." },
  { id: "sad", label: "Sad LazyDev", prompt: "Respond with a subdued, melancholy tone while still being caring, useful, and clear." },
  { id: "custom", label: "Custom LazyDev", prompt: "Use the custom personality instructions the user writes here." }
];

const defaultChatReplyStyles: ChatReplyStyle[] = [
  { id: "empty", label: "<empty>", prompt: "" },
  { id: "markdown", label: "Always Markdown", prompt: "Format the entire reply as GitHub-Flavored Markdown. Use headings, lists, tables, links, and fenced code blocks when they improve clarity." },
  { id: "plain-text", label: "Plain Text Only", prompt: "Return plain text only. Do not use Markdown, HTML, XML, or code fences." },
  { id: "json", label: "JSON Only", prompt: "Return exactly one valid JSON value with no surrounding commentary and no Markdown code fence." },
  { id: "xml", label: "XML Only", prompt: "Return one well-formed XML document with no surrounding commentary and no Markdown code fence." },
  { id: "csv", label: "CSV Only", prompt: "Return RFC 4180-style CSV only, including a header row when the data has named fields. Do not add commentary or a Markdown code fence." },
  { id: "html", label: "HTML (Sanitized)", prompt: "Return a semantic HTML fragment only. Do not include scripts, styles, iframes, event-handler attributes, or unsafe URLs. The dashboard will sanitize the result before display." },
  { id: "concise", label: "Concise", prompt: "Prefer the shortest complete answer. Lead with the result and omit background that is not needed to act." },
  { id: "step-by-step", label: "Step by Step", prompt: "Structure the reply as an ordered sequence of concrete steps, including commands or examples where useful." },
  { id: "custom", label: "Custom", prompt: "Replace this text with custom reply-format instructions." }
];
const defaultChatReplyStyleIds = new Set(defaultChatReplyStyles.map(entry => entry.id));

export function isDefaultChatReplyStyleId(value: unknown): boolean {
  return defaultChatReplyStyleIds.has(normalizeSoulId(value));
}

export function normalizeSoulId(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePromptOption<T extends ChatSoulPersonality | ChatReplyStyle>(value: unknown): T | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const label = String(record.label || "").trim();
  const id = normalizeSoulId(record.id || label);
  const prompt = String(record.prompt || "").trim();
  return id && label ? { id, label, prompt } as T : null;
}

function mergePromptOptions<T extends ChatSoulPersonality | ChatReplyStyle>(defaults: T[], value: unknown): T[] {
  const fromInput = Array.isArray(value)
    ? value.map(entry => normalizePromptOption<T>(entry)).filter(entry => Boolean(entry)) as T[]
    : [];
  const merged = new Map<string, T>();
  defaults.concat(fromInput).forEach(entry => merged.set(entry.id, entry));
  return Array.from(merged.values());
}

export function normalizeChatSoulSettings(value: unknown): ChatSoulSettings {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const personalities = mergePromptOptions(defaultChatSoulPersonalities, record.personalities);
  const replyStyles = mergePromptOptions(defaultChatReplyStyles, record.replyStyles);
  const requestedPersonalityId = normalizeSoulId(record.activePersonalityId) || "normal";
  const requestedReplyStyleId = normalizeSoulId(record.activeReplyStyleId) || "empty";
  return {
    activePersonalityId: personalities.some(entry => entry.id === requestedPersonalityId) ? requestedPersonalityId : "normal",
    personalities,
    activeReplyStyleId: replyStyles.some(entry => entry.id === requestedReplyStyleId) ? requestedReplyStyleId : "empty",
    replyStyles
  };
}

export function extractChatSoulJson(content: string): unknown {
  const match = String(content || "").match(/```json\s*([\s\S]*?)```/i);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1] || "{}");
  } catch {
    return null;
  }
}

export function renderChatSoulMarkdown(settings: ChatSoulSettings): string {
  const activePersonality = settings.personalities.find(entry => entry.id === settings.activePersonalityId);
  const activeReplyStyle = settings.replyStyles.find(entry => entry.id === settings.activeReplyStyleId);
  return [
    "# SOUL",
    "",
    "LazyDev personality and reply-style settings. Edit through the dashboard or adjust the JSON block directly.",
    "",
    `Active Personality: ${activePersonality?.label || "Normal"}`,
    `Active Reply Style: ${activeReplyStyle?.label || "<empty>"}`,
    "",
    "```json",
    JSON.stringify(settings, null, 2),
    "```",
    ""
  ].join("\n");
}

export function buildChatSoulPromptPrefix(settings: ChatSoulSettings, userMarkdown: string, replyStyleOverrideId = ""): string {
  const activePersonality = settings.personalities.find(entry => entry.id === settings.activePersonalityId) || null;
  const normalizedOverrideId = normalizeSoulId(replyStyleOverrideId);
  const activeReplyStyle = settings.replyStyles.find(entry => entry.id === normalizedOverrideId)
    || settings.replyStyles.find(entry => entry.id === settings.activeReplyStyleId)
    || null;
  const sections: string[] = [];
  if (activePersonality?.prompt.trim()) {
    sections.push([
      "[SOUL.md active personality]",
      `Name: ${activePersonality.label}`,
      activePersonality.prompt.trim()
    ].join("\n"));
  }
  if (activeReplyStyle?.prompt.trim()) {
    sections.push([
      "[SOUL.md active reply style]",
      `Name: ${activeReplyStyle.label}`,
      activeReplyStyle.prompt.trim()
    ].join("\n"));
  }
  if (userMarkdown.trim()) {
    sections.push([
      "[USER.md durable user notes]",
      userMarkdown.trim()
    ].join("\n"));
  }
  return sections.length > 0 ? `${sections.join("\n\n")}\n\n` : "";
}
