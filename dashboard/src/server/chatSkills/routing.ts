import type { DashboardDependencies } from "../runtime/botBridge.js";
import { buildChatSkillRoutingHints, buildChatSkillsCatalog, buildLocalToolsCatalog, hasChatSkill, stripChatSkillCommandPrefix } from "./catalog.js";
import type { ChatConversationTurn, ChatSkillAutoDecision, ChatSkillClarification, ChatSkillDefinition, ChatSkillFileUpload, ChatSkillModelUpload, ChatSkillTaskDecision, LocalToolDefinition } from "./types.js";
import { isChatSkillInputCompatible, normalizeChatSkillId } from "./types.js";

function extractJsonObjectText(value: string): string {
  const trimmed = String(value || "").trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (fencedMatch?.[1] || trimmed).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  return start >= 0 && end >= start ? source.slice(start, end + 1) : source;
}

export function parseChatSkillAutoDecision(value: string): ChatSkillAutoDecision {
  try {
    const parsed = JSON.parse(extractJsonObjectText(value)) as Record<string, unknown>;
    const skillId = normalizeChatSkillId(typeof parsed.skillId === "string" ? parsed.skillId : "");
    const confidenceRaw = typeof parsed.confidence === "number" || typeof parsed.confidence === "string" ? Number(parsed.confidence) : Number.NaN;
    const imageCountRaw = typeof parsed.imageCount === "number" || typeof parsed.imageCount === "string" ? Number(parsed.imageCount) : Number.NaN;
    const followUpSkillIds = Array.isArray(parsed.followUpSkillIds)
      ? parsed.followUpSkillIds.map(entry => normalizeChatSkillId(typeof entry === "string" ? entry : "")).filter(Boolean)
      : [];
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.map(normalizeChatSkillTaskDecision).filter((entry): entry is ChatSkillTaskDecision => Boolean(entry))
      : [];
    const clarification = normalizeChatSkillClarification(parsed.clarification);
    return {
      skillId,
      confidence: Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0,
      imageCount: Number.isFinite(imageCountRaw) ? Math.max(1, Math.min(8, Math.round(imageCountRaw))) : null,
      followUpSkillIds,
      clarification,
      tasks
    };
  } catch {
    return createEmptyChatSkillDecision();
  }
}

function createEmptyChatSkillDecision(): ChatSkillAutoDecision {
  return { skillId: "", confidence: 0, imageCount: null, followUpSkillIds: [], clarification: null, tasks: [] };
}

function normalizeChatSkillTaskDecision(value: unknown): ChatSkillTaskDecision | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const skillId = normalizeChatSkillId(typeof record.skillId === "string" ? record.skillId : "");
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const imageCountRaw = typeof record.imageCount === "number" || typeof record.imageCount === "string" ? Number(record.imageCount) : Number.NaN;
  const followUpSkillIds = Array.isArray(record.followUpSkillIds)
    ? record.followUpSkillIds.map(entry => normalizeChatSkillId(typeof entry === "string" ? entry : "")).filter(Boolean)
    : [];
  if (!skillId) {
    return null;
  }
  return {
    skillId,
    prompt,
    imageCount: Number.isFinite(imageCountRaw) ? Math.max(1, Math.min(8, Math.round(imageCountRaw))) : null,
    followUpSkillIds
  };
}

function normalizeChatSkillClarification(value: unknown): ChatSkillClarification | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const question = String(record.question || "").trim();
  const mode = record.mode === "suggestion" ? "suggestion" : "clarification";
  const groups = Array.isArray(record.groups)
    ? record.groups.map(group => {
      if (!group || typeof group !== "object") {
        return null;
      }
      const groupRecord = group as Record<string, unknown>;
      const label = String(groupRecord.label || "").trim();
      const options = Array.isArray(groupRecord.options)
        ? groupRecord.options.map(option => {
          if (!option || typeof option !== "object") {
            return null;
          }
          const optionRecord = option as Record<string, unknown>;
          const optionLabel = String(optionRecord.label || "").trim();
          const prompt = String(optionRecord.prompt || "").trim();
          const skillId = normalizeChatSkillId(typeof optionRecord.skillId === "string" ? optionRecord.skillId : "");
          return optionLabel && prompt ? { label: optionLabel, prompt, skillId } : null;
        }).filter((option): option is { label: string; prompt: string; skillId: string; } => Boolean(option))
        : [];
      return label && options.length > 0 ? { label, options } : null;
    }).filter((group): group is { label: string; options: { label: string; prompt: string; skillId: string; }[]; } => Boolean(group))
    : [];
  return question && groups.length > 0 ? { question, groups, mode } : null;
}

function buildSkillSuggestionClarification(tasks: ChatSkillTaskDecision[], question = "I can run this from here if you want."): ChatSkillClarification | null {
  const options = tasks
    .slice(0, 4)
    .map(task => {
      const label = task.skillId === "generate-model"
        ? "Generate 3D Model"
        : task.skillId === "generate-image"
          ? "Generate Image"
          : task.skillId === "generate-video"
            ? "Generate Video"
            : task.skillId === "generate-audio"
              ? "Generate Audio"
              : task.skillId === "generate-music"
                ? "Generate Music"
                : `Run ${task.skillId}`;
      return {
        label,
        prompt: task.prompt,
        skillId: task.skillId
      };
    })
    .filter(option => option.prompt && option.skillId);
  return options.length > 0 ? { question, mode: "suggestion", groups: [{ label: "Suggested actions", options }] } : null;
}

export function buildChatSkillRouterPrompt(input: {
  prompt: string;
  images: string[];
  models: ChatSkillModelUpload[];
  files?: ChatSkillFileUpload[];
  conversation?: ChatConversationTurn[];
  availableSkills: ChatSkillDefinition[];
  availableTools: LocalToolDefinition[];
}): string {
  const availableSkillIds = input.availableSkills.map(skill => skill.id).filter(Boolean);
  const catalogText = buildChatSkillsCatalog(input.availableSkills);
  const routingHintsText = buildChatSkillRoutingHints(input.availableSkills);
  const toolsCatalogText = buildLocalToolsCatalog(input.availableTools);
  return [
    "You are the multilingual task router for URage NOW.",
    "Choose zero, one, or multiple root skills from the catalog. Understand the user's intent in any language.",
    "Return only compact JSON with this exact shape: {\"skillId\":\"\",\"confidence\":0,\"imageCount\":null,\"followUpSkillIds\":[],\"tasks\":[],\"clarification\":null}",
    "Use tasks for multiple independent root tasks. Each task must be {\"skillId\":\"...\",\"prompt\":\"...\",\"imageCount\":null,\"followUpSkillIds\":[]}. Keep skillId/imageCount/followUpSkillIds populated with the first task for backward compatibility.",
    "Use an empty skillId when the user is asking a normal chat question, the intent is unclear, or the request needs user clarification before a skill should run.",
    "Use an empty skillId for direct coding tasks when no built-in skill clearly improves the answer, so the chat model can generate or explain code normally.",
    "Use an empty skillId for brainstorming, prompt-writing, planning, critique, explanation, or follow-up questions unless the user explicitly asks to generate/run/create the artifact now.",
    "If the user asks to think of, write, improve, revise, or describe a prompt, do not choose a generation skill. Let the chat model answer with the requested prompt text.",
    "When clarification is needed, set clarification to {\"mode\":\"clarification\",\"question\":\"...\",\"groups\":[{\"label\":\"...\",\"options\":[{\"label\":\"...\",\"prompt\":\"...\",\"skillId\":\"...\"}]}]} and leave skillId empty.",
    "Only suggest or run skills when the user's intent clearly asks for an executable Studio action. When you have a highly likely optional action but should mainly answer as chat, set clarification.mode to \"suggestion\" with action options and leave skillId empty.",
    "Clarification option prompts must be complete revised user prompts in the user's language when possible. Use only valid skill ids or an empty skillId for normal chat.",
    "When there is one likely action but it should not run yet, include a first group named Approval with one Approve option. That option should use the best skill and a complete prompt.",
    "Ask for confirmation when a short generation request could reasonably mean text, image, 3D model, audio, music, or video output.",
    "Ask for creative direction before image generation when the user asks for an image but gives only a broad subject. Useful groups include style, framing/camera angle, expression/mood, background, and output use.",
    "For broad image requests, include an Approval group with a direct generate-image option, then additional groups such as Define Style, Camera Angle, Expression, and Background.",
    "imageCount must be an integer from 1 to 8 when the user asks for multiple separate outputs.",
    "followUpSkillIds is optional and should list later skills that must run after the first skill finishes.",
    "If the user asks for later steps such as cleanup, background removal, low-poly conversion, rigging, or file naming, include those as followUpSkillIds instead of folding them into the first prompt.",
    "For text-only requests that should become multiple 3D models, prefer {skillId:\"generate-image\", imageCount:N, followUpSkillIds:[\"generate-model\"]} so each generated image can feed its own model step.",
    "Do not answer the user. Do not invent skill ids.",
    "Available skill ids:",
    availableSkillIds.length > 0 ? availableSkillIds.join(", ") : "(none)",
    "Skill catalog:",
    catalogText,
    "Local tools catalog (informational):",
    toolsCatalogText,
    "Attachment context:",
    `- Uploaded images: ${input.images.length}`,
    `- Uploaded 3D model files: ${input.models.length}`,
    `- Uploaded reference files: ${input.files?.length || 0}`,
    input.images.length > 0
      ? "- The user request includes uploaded image data. Treat references to an attached/source/reference image as satisfied by the uploaded image. Never ask the user to upload an image because one is already present."
      : "- No uploaded image data is present in this request.",
    "Routing guidance:",
    "- Prefer the skill whose output kind and input mode best match the user's request.",
    "- Use imageCount only when the chosen skill supports multiple separate outputs.",
    "- Only return followUpSkillIds that are valid follow-ups for the first skill.",
    "- For dependent workflows, use one task with followUpSkillIds. For independent workflows, use multiple tasks.",
    "- If conversation history makes a short follow-up clear, route using that context; otherwise ask clarification.",
    "- Requests about local utility tools can still map to a built-in skill when a matching skill already exists (for example uploaded image transforms such as remove background, delight image, normal map, or pixel-art style conversions).",
    "Skill-specific routing hints:",
    routingHintsText,
    "Recent conversation:",
    buildConversationContext(input.conversation),
    "User request:",
    String(input.prompt || "").trim() || "(no text)"
  ].join("\n").trim();
}

export async function resolveAutoChatSkill(input: {
  prompt: string;
  images: string[];
  models: ChatSkillModelUpload[];
  files?: ChatSkillFileUpload[];
  conversation?: ChatConversationTurn[];
  availableSkills: ChatSkillDefinition[];
  availableTools: LocalToolDefinition[];
  dependencies: DashboardDependencies;
}): Promise<ChatSkillAutoDecision> {
  if (input.availableSkills.length === 0) {
    return createEmptyChatSkillDecision();
  }
  if (!String(input.prompt || "").trim() && input.images.length === 0 && input.models.length === 0 && (!input.files || input.files.length === 0)) {
    return createEmptyChatSkillDecision();
  }
  const answer = await input.dependencies.askModel(buildChatSkillRouterPrompt(input));
  const decision = parseChatSkillAutoDecision(answer);
  if (decision.clarification) {
    return { skillId: "", confidence: decision.confidence, imageCount: decision.imageCount, followUpSkillIds: [], clarification: decision.clarification, tasks: [] };
  }
  const candidateTasks = decision.tasks.length > 0
    ? decision.tasks
    : (decision.skillId ? [{ skillId: decision.skillId, prompt: input.prompt, imageCount: decision.imageCount, followUpSkillIds: decision.followUpSkillIds }] : []);
  const validTasks = candidateTasks
    .map(task => normalizeResolvedTaskDecision(task, input))
    .filter((task): task is ChatSkillTaskDecision => Boolean(task));
  if (validTasks.length === 0 || decision.confidence < 0.72) {
    return { skillId: "", confidence: decision.confidence, imageCount: decision.imageCount, followUpSkillIds: [], clarification: null, tasks: [] };
  }
  if (decision.confidence < 0.9) {
    return {
      skillId: "",
      confidence: decision.confidence,
      imageCount: null,
      followUpSkillIds: [],
      clarification: buildSkillSuggestionClarification(validTasks),
      tasks: []
    };
  }
  const firstTask = validTasks[0]!;
  return {
    ...decision,
    skillId: firstTask.skillId,
    imageCount: firstTask.imageCount,
    followUpSkillIds: firstTask.followUpSkillIds,
    clarification: null,
    tasks: validTasks
  };
}

function normalizeResolvedTaskDecision(task: ChatSkillTaskDecision, input: {
  prompt: string;
  images: string[];
  models: ChatSkillModelUpload[];
  availableSkills: ChatSkillDefinition[];
}): ChatSkillTaskDecision | null {
  const skill = input.availableSkills.find(entry => entry.id === task.skillId) || null;
  if (!skill || !hasChatSkill(input.availableSkills, task.skillId)) {
    return null;
  }
  const taskPrompt = task.prompt || input.prompt;
  if (!isChatSkillInputCompatible(skill, { prompt: taskPrompt, images: input.images, models: input.models })) {
    return null;
  }
  const followUpSkillIds = task.followUpSkillIds.filter(skillId =>
    skillId !== task.skillId
    && hasChatSkill(input.availableSkills, skillId)
    && skill.metadata.allowedFollowUps.includes(skillId)
  );
  return {
    skillId: skill.id,
    prompt: taskPrompt,
    imageCount: skill.metadata.supportsMultiple ? task.imageCount : null,
    followUpSkillIds: Array.from(new Set(followUpSkillIds))
  };
}

export function buildPromptWithSkillContext(input: {
  prompt: string;
  files?: ChatSkillFileUpload[];
  conversation?: ChatConversationTurn[];
  availableSkills: ChatSkillDefinition[];
  availableTools: LocalToolDefinition[];
  selectedSkill: ChatSkillDefinition | null;
  autoRunSkills?: boolean;
}): string {
  const cleanedUserPrompt = stripChatSkillCommandPrefix(input.prompt);
  const userRequest = cleanedUserPrompt || String(input.prompt || "").trim();
  const catalogText = buildChatSkillsCatalog(input.availableSkills);
  const localToolsCatalogText = buildLocalToolsCatalog(input.availableTools);
  const fileContext = buildUploadedFileContext(input.files);
  const baseSections = [
    "You are LazyDev in URage NOW.",
    "You have access to these chat skills:",
    catalogText,
    "You also have access to these local studio tools:",
    localToolsCatalogText,
  ];
  const skillSections = input.selectedSkill
    ? [
        `Active selected skill: ${input.selectedSkill.id} (${input.selectedSkill.name}).`,
        "Follow the selected skill instructions exactly when they apply.",
        "If the selected skill does not fit and a direct code answer is clearly more useful, generate the code or explanation directly instead of forcing a skill workflow.",
        "When relevant, you may suggest opening a matching tool from the tools catalog and using Send Image To Tool or Send 3D Model To Tool quick actions.",
        "Skill instructions:",
        input.selectedSkill.content,
      ]
    : [
        "No skill is manually selected.",
        input.autoRunSkills === false
          ? "Auto-run skills are disabled for this request. Do not execute any skill automatically."
          : "The task router did not select a built-in skill for automatic execution. Answer normally unless the user is asking about the skill catalog.",
        "Fulfill the user's request directly. If they ask for an idea, plan, prompt, rewrite, critique, or follow-up answer, provide that content instead of merely suggesting a skill.",
        "Never answer a prompt-writing request by telling the user to use a skill. Write the requested prompt, variants, or refinement directly.",
        "If no listed skill fits, or if a direct code answer is more useful than a skill run, generate the code or explanation directly in the reply.",
        input.autoRunSkills === false
          ? "Only execute a skill if the user explicitly requests one with /skill <id>."
          : "Do not lead with the skill catalog. Answer the chat request first; optional skill actions are shown separately by the UI when available.",
        "If the user asks about available skills or tools, list them from the catalogs above.",
        "For tool-related requests, mention the best matching tool name from the tool catalog and how to open it in the Tools view.",
      ];
  return [
    ...baseSections,
    ...skillSections,
    buildConversationContext(input.conversation) !== "(none)" ? `Recent conversation:\n${buildConversationContext(input.conversation)}` : "",
    fileContext ? `Uploaded reference files:\n\n${fileContext}` : "",
    "User request:",
    userRequest,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function buildConversationContext(conversation?: ChatConversationTurn[]): string {
  const turns = Array.isArray(conversation) ? conversation.slice(-10) : [];
  if (turns.length === 0) {
    return "(none)";
  }
  return turns
    .map(turn => {
      const role = turn.role === "assistant" ? "Assistant" : "User";
      const text = String(turn.text || "").trim().replace(/\s+/g, " ").slice(0, 1200);
      const skill = turn.usedSkillId ? ` skill=${turn.usedSkillId}` : "";
      const artifacts = Array.isArray(turn.artifactKinds) && turn.artifactKinds.length > 0 ? ` artifacts=${turn.artifactKinds.join(",")}` : "";
      return `- ${role}${skill}${artifacts}: ${text || "(no text)"}`;
    })
    .join("\n");
}

function buildUploadedFileContext(files?: ChatSkillFileUpload[]): string {
  return (files || [])
    .slice(0, 8)
    .map((file, index) =>
      [
        `File ${index + 1}: ${file.fileName} (${file.contentType || "text/plain"})`,
        "```",
        String(file.text || "").slice(0, 80_000),
        "```",
      ].join("\n")
    )
    .join("\n\n");
}

export function buildUsedSkillMeta(
  selectedSkill: ChatSkillDefinition | null,
  source: "explicit" | "auto" | ""
): { id: string; name: string; source: "explicit" | "auto"; } | null {
  if (!selectedSkill || !selectedSkill.id) {
    return null;
  }
  if (source !== "explicit" && source !== "auto") {
    return null;
  }
  return {
    id: selectedSkill.id,
    name: selectedSkill.name,
    source
  };
}

export function describeChatSkillTask(skill: ChatSkillDefinition | null, source: "explicit" | "auto" | ""): string {
  if (!skill || !skill.id) {
    return "";
  }
  const sourceText = source === "explicit" ? "requested" : "detected";
  if (skill.id === "generate-image") return `Starting ${sourceText} image generation.`;
  if (skill.id === "generate-model") return `Starting ${sourceText} image to 3D model generation.`;
  if (skill.id === "generate-autorig") return `Starting ${sourceText} autorig generation.`;
  if (skill.id === "generate-lowpoly") return `Starting ${sourceText} low poly model generation.`;
  if (skill.id === "generate-video") return `Starting ${sourceText} video generation.`;
  if (skill.id === "generate-audio") return `Starting ${sourceText} audio generation.`;
  if (skill.id === "generate-music") return `Starting ${sourceText} music generation.`;
  if (skill.id === "remove-background" || skill.id === "delight-image" || skill.id === "create-normal-map" || skill.id === "create-pixel-art") return `Starting ${sourceText} image transform.`;
  if (skill.id === "regenerate-image-filename" || skill.id === "regenerate-model-filename") return `Starting ${sourceText} filename regeneration.`;
  if (skill.id === "suggest-model-metadata" || skill.id === "suggest-lowpoly-target") return `Starting ${sourceText} model planning suggestion.`;
  if (skill.id === "comfy-free-memory") return `Starting ${sourceText} ComfyUI memory cleanup.`;
  if (skill.id === "add-cron-job" || skill.id === "add-cron-job-discord" || skill.id === "add-cron-job-telegram") return `Starting ${sourceText} scheduled automation setup.`;
  return `Starting ${sourceText} skill: ${skill.name || skill.id}.`;
}
