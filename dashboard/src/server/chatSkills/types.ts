export type ChatSkillOutputKind = "image" | "model" | "audio" | "video" | "planning" | "utility";
export type ChatSkillInputMode = "optional" | "text-only" | "image-only" | "model-only" | "image-or-text";

export interface ChatSkillMetadata {
  outputKind: ChatSkillOutputKind;
  inputMode: ChatSkillInputMode;
  supportsMultiple: boolean;
  allowedFollowUps: string[];
  routerHint: string;
}

export interface ChatSkillDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
  metadata: ChatSkillMetadata;
}

export interface ChatSkillModelUpload {
  fileName: string;
  dataUrl: string;
  modelId?: string;
}

export interface ChatSkillFileUpload {
  fileName: string;
  contentType: string;
  text: string;
}

export interface ChatConversationTurn {
  role: "user" | "assistant";
  text: string;
  usedSkillId?: string;
  artifactKinds?: ChatSkillArtifact["kind"][];
}

export interface LocalToolDefinition {
  id: string;
  category: string;
  categoryLabel: string;
  toolSlug: string;
  title: string;
  description: string;
  sourcePath: string;
  coverPath: string;
}

export type ChatSkillArtifact =
  | {
    kind: "image";
    imageId: string;
    fileName: string;
    url: string;
    prompt: string;
  }
  | {
    kind: "model";
    modelId: string;
    fileName: string;
    url: string;
    prompt: string;
    lowPoly: boolean;
    previewUrl?: string;
    targetFaceCount: number | null;
  }
  | {
    kind: "audio";
    audioId: string;
    fileName: string;
    url: string;
    prompt: string;
    isMusic: boolean;
  }
  | {
    kind: "video";
    videoId: string;
    fileName: string;
    url: string;
    prompt: string;
  };

export interface ChatSkillPlanEvent {
  kind: "image-prompt" | "model-prompt" | "audio-prompt" | "video-prompt";
  skillId: string;
  title: string;
  prompt: string;
  index?: number;
  total?: number;
}

export interface ChatSkillAutoDecision {
  skillId: string;
  confidence: number;
  imageCount: number | null;
  followUpSkillIds: string[];
  clarification: ChatSkillClarification | null;
  tasks: ChatSkillTaskDecision[];
}

export interface ChatSkillTaskDecision {
  skillId: string;
  prompt: string;
  imageCount: number | null;
  followUpSkillIds: string[];
}

export interface ChatSkillClarificationOption {
  label: string;
  prompt: string;
  skillId: string;
}

export interface ChatSkillClarificationGroup {
  label: string;
  options: ChatSkillClarificationOption[];
}

export interface ChatSkillClarification {
  question: string;
  groups: ChatSkillClarificationGroup[];
  mode?: "clarification" | "suggestion";
}

export const defaultChatSkillMetadata: ChatSkillMetadata = {
  outputKind: "utility",
  inputMode: "optional",
  supportsMultiple: false,
  allowedFollowUps: [],
  routerHint: ""
};

export function normalizeChatSkillId(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeChatSkillOutputKind(value: string): ChatSkillOutputKind {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "image" || normalized === "model" || normalized === "audio" || normalized === "video" || normalized === "planning") {
    return normalized;
  }
  return "utility";
}

export function normalizeChatSkillInputMode(value: string): ChatSkillInputMode {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "text-only" || normalized === "image-only" || normalized === "model-only" || normalized === "image-or-text") {
    return normalized;
  }
  return "optional";
}

export function isChatSkillInputCompatible(skill: ChatSkillDefinition, input: { prompt: string; images: string[]; models: ChatSkillModelUpload[]; }): boolean {
  const hasPrompt = Boolean(String(input.prompt || "").trim());
  const hasImages = input.images.length > 0;
  const hasModels = input.models.length > 0;
  if (skill.metadata.inputMode === "text-only") {
    return hasPrompt;
  }
  if (skill.metadata.inputMode === "image-only") {
    return hasImages;
  }
  if (skill.metadata.inputMode === "model-only") {
    return hasModels;
  }
  if (skill.metadata.inputMode === "image-or-text") {
    return hasPrompt || hasImages;
  }
  return hasPrompt || hasImages || hasModels;
}

export function describeChatSkillCapabilities(skill: ChatSkillDefinition): string {
  const parts = [
    `input=${skill.metadata.inputMode}`,
    `output=${skill.metadata.outputKind}`
  ];
  if (skill.metadata.supportsMultiple) {
    parts.push("multi");
  }
  if (skill.metadata.allowedFollowUps.length > 0) {
    parts.push(`follow-up=${skill.metadata.allowedFollowUps.join("/")}`);
  }
  return parts.join(", ");
}
