import type { DashboardDependencies } from "../runtime/botBridge.js";
import { loadChatSkillsFromDisk, loadLocalToolsFromDisk, resolveRequestedChatSkillId } from "./catalog.js";
import { buildUsedSkillMeta, resolveAutoChatSkill } from "./routing.js";
import type { ChatConversationTurn, ChatSkillAutoDecision, ChatSkillDefinition, ChatSkillFileUpload, ChatSkillModelUpload, ChatSkillTaskDecision, LocalToolDefinition } from "./types.js";

export interface ParsedChatRequest {
  prompt: string;
  skillId: string;
  autoRunSkills: boolean;
  images: string[];
  imageFileNames: string[];
  modelUploads: ChatSkillModelUpload[];
  fileUploads: ChatSkillFileUpload[];
  conversation: ChatConversationTurn[];
}

export interface ResolvedChatRequestContext extends ParsedChatRequest {
  requestedSkillId: string;
  reasoningEnabled: boolean;
  availableSkills: ChatSkillDefinition[];
  availableTools: LocalToolDefinition[];
  autoSkillDecision: ChatSkillAutoDecision;
  selectedSkillSource: "explicit" | "auto" | "";
  selectedSkill: ChatSkillDefinition | null;
  usedSkill: { id: string; name: string; source: "explicit" | "auto"; } | null;
  chainSkillIds: string[];
  taskPlans: ChatSkillTaskDecision[];
}

export function parseChatRequestBody(body: Record<string, unknown>): ParsedChatRequest {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const skillId = typeof body.skillId === "string" ? body.skillId.trim() : "";
  const autoRunSkills = body.autoRunSkills !== false;
  const images = Array.isArray(body.images)
    ? body.images.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const imageFileNames = Array.isArray(body.imageFileNames)
    ? body.imageFileNames.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const rawModelUploads = Array.isArray(body.modelUploads)
    ? body.modelUploads
    : (Array.isArray(body.skillModelUploads) ? body.skillModelUploads : []);
  const modelUploads = rawModelUploads
    ? rawModelUploads
      .map(entry => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const fileName = typeof entry.fileName === "string" ? entry.fileName.trim() : "";
        const dataUrl = typeof entry.dataUrl === "string" ? entry.dataUrl.trim() : "";
        const modelId = typeof entry.modelId === "string" ? entry.modelId.trim() : "";
        if (!fileName || !dataUrl) {
          return null;
        }
        return modelId ? { fileName, dataUrl, modelId } : { fileName, dataUrl };
      })
      .filter((entry): entry is ChatSkillModelUpload => Boolean(entry))
    : [];
  const rawFileUploads = Array.isArray(body.files) ? body.files : [];
  const fileUploads = rawFileUploads
    .map(entry => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const fileName = typeof record.fileName === "string" ? record.fileName.trim() : "";
      const contentType = typeof record.contentType === "string" ? record.contentType.trim() : "text/plain";
      const text = typeof record.text === "string" ? record.text.trim() : "";
      return fileName && text ? { fileName, contentType, text: text.slice(0, 80_000) } : null;
    })
    .filter((entry): entry is ChatSkillFileUpload => Boolean(entry));
  const conversation = parseChatConversation(body.conversation);
  return { prompt, skillId, autoRunSkills, images, imageFileNames, modelUploads, fileUploads, conversation };
}

function parseChatConversation(value: unknown): ChatConversationTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(-12)
    .map((entry): ChatConversationTurn | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : "";
      const text = typeof record.text === "string" ? record.text.trim().slice(0, 4000) : "";
      const usedSkillId = typeof record.usedSkillId === "string" ? record.usedSkillId.trim() : "";
      const artifactKinds = Array.isArray(record.artifactKinds)
        ? record.artifactKinds.filter((kind): kind is "image" | "model" | "audio" | "video" =>
          kind === "image" || kind === "model" || kind === "audio" || kind === "video"
        )
        : [];
      if (!role || !text) {
        return null;
      }
      return {
        role,
        text,
        ...(usedSkillId ? { usedSkillId } : {}),
        ...(artifactKinds.length > 0 ? { artifactKinds } : {})
      };
    })
    .filter((entry): entry is ChatConversationTurn => Boolean(entry));
}

export async function resolveChatRequestContext(input: { body: Record<string, unknown>; dependencies: DashboardDependencies; }): Promise<ResolvedChatRequestContext> {
  const parsed = parseChatRequestBody(input.body);
  const requestedSkillId = resolveRequestedChatSkillId(parsed.prompt, parsed.skillId);
  const reasoningEnabled = input.dependencies.runtimeState.getGlobalDashboardSettings().lmStudioTextModelReasoningEnabled !== false;
  const availableSkills = await loadChatSkillsFromDisk();
  const availableTools = await loadLocalToolsFromDisk();
  const autoSkillDecision = requestedSkillId || !parsed.autoRunSkills
    ? { skillId: "", confidence: 0, imageCount: null, followUpSkillIds: [], clarification: null, tasks: [] }
    : await resolveAutoChatSkill({
      prompt: parsed.prompt,
      images: parsed.images,
      models: parsed.modelUploads,
      files: parsed.fileUploads,
      conversation: parsed.conversation,
      availableSkills,
      availableTools,
      dependencies: input.dependencies
    });
  const autoSkillId = autoSkillDecision.skillId;
  const effectiveSkillId = requestedSkillId || autoSkillId;
  const selectedSkillSource: "explicit" | "auto" | "" = requestedSkillId ? "explicit" : autoSkillId ? "auto" : "";
  const selectedSkill = effectiveSkillId ? availableSkills.find(entry => entry.id === effectiveSkillId) || null : null;
  const usedSkill = buildUsedSkillMeta(selectedSkill, selectedSkillSource);
  const taskPlans = requestedSkillId && selectedSkill
    ? [{ skillId: selectedSkill.id, prompt: parsed.prompt, imageCount: null, followUpSkillIds: [] }]
    : autoSkillDecision.tasks;
  const chainSkillIds = selectedSkill
    ? [selectedSkill.id].concat(selectedSkillSource === "auto" ? autoSkillDecision.followUpSkillIds : [])
    : [];
  return {
    ...parsed,
    requestedSkillId,
    reasoningEnabled,
    availableSkills,
    availableTools,
    autoSkillDecision,
    selectedSkillSource,
    selectedSkill,
    usedSkill,
    chainSkillIds,
    taskPlans
  };
}
