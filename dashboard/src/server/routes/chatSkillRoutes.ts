import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { parseJsonBody, sendJson } from "../http.js";
import { getRoute, postRoute } from "../router.js";
import { loadChatSkillsFromDisk, resolveChatSkillsDirectory, stripChatSkillCommandPrefix } from "../chatSkills/catalog.js";
import { buildPromptWithSkillContext, describeChatSkillTask } from "../chatSkills/routing.js";
import { resolveChatRequestContext } from "../chatSkills/requestContext.js";
import { executeChatSkillChain } from "../chatSkills/runner.js";
import { normalizeChatSkillId } from "../chatSkills/types.js";
import {
  buildChatSoulPromptPrefix,
  extractChatSoulJson,
  isDefaultChatReplyStyleId,
  normalizeChatSoulSettings,
  renderChatSoulMarkdown,
  type ChatSoulSettings
} from "../chatSkills/soulSettings.js";
import { isDashboardAbortError, registerDashboardRequest } from "../dashboardInterrupts.js";
import { resolveWorkspaceRelativePath } from "../messagingAndModel/helpers.js";

const sharedDirectory = fileURLToPath(new URL("../../../../shared/", import.meta.url));

function resolveSoulFilePath(fileName: "SOUL.md" | "USER.md"): string {
  return path.resolve(sharedDirectory, fileName);
}

async function readChatSoulSettings(): Promise<ChatSoulSettings> {
  try {
    const content = await readFile(resolveSoulFilePath("SOUL.md"), "utf8");
    return normalizeChatSoulSettings(extractChatSoulJson(content));
  } catch {
    return normalizeChatSoulSettings({});
  }
}

async function readChatUserMarkdown(): Promise<string> {
  try {
    return await readFile(resolveSoulFilePath("USER.md"), "utf8");
  } catch {
    return "# USER\n\nWrite durable notes about the user here.\n";
  }
}

async function writeChatSoulSettings(settings: ChatSoulSettings): Promise<void> {
  await writeFile(resolveSoulFilePath("SOUL.md"), renderChatSoulMarkdown(settings), "utf8");
}

async function writeChatUserMarkdown(content: string): Promise<void> {
  const normalized = String(content || "").trimEnd() || "# USER\n\n";
  await writeFile(resolveSoulFilePath("USER.md"), `${normalized}\n`, "utf8");
}

async function buildSoulPromptPrefix(replyStyleOverrideId = ""): Promise<string> {
  const soul = await readChatSoulSettings();
  return buildChatSoulPromptPrefix(soul, await readChatUserMarkdown(), replyStyleOverrideId);
}

export async function applySoulPromptContext(prompt: string, replyStyleOverrideId = ""): Promise<string> {
  const prefix = await buildSoulPromptPrefix(replyStyleOverrideId);
  return prefix ? `${prefix}${prompt}` : prompt;
}

function isBlockingChatClarification(context: Awaited<ReturnType<typeof resolveChatRequestContext>>): boolean {
  const clarification = context.autoSkillDecision.clarification;
  return Boolean(clarification && clarification.mode !== "suggestion");
}

function resolveOptionalChatSuggestion(context: Awaited<ReturnType<typeof resolveChatRequestContext>>) {
  const clarification = context.autoSkillDecision.clarification;
  return clarification && clarification.mode === "suggestion" ? clarification : null;
}

async function executeResolvedChatTasks(input: {
  context: Awaited<ReturnType<typeof resolveChatRequestContext>>;
  dependencies: DashboardDependencies;
  onArtifact?: Parameters<typeof executeChatSkillChain>[0]["onArtifact"];
  onPlan?: Parameters<typeof executeChatSkillChain>[0]["onPlan"];
  onProgressMessage?: Parameters<typeof executeChatSkillChain>[0]["onProgressMessage"];
  onSkillStart?: Parameters<typeof executeChatSkillChain>[0]["onSkillStart"];
}): Promise<{ handled: boolean; response: string; artifacts: Awaited<ReturnType<typeof executeChatSkillChain>>["artifacts"]; executedSkillIds: string[] }> {
  const plans = input.context.taskPlans.length > 0
    ? input.context.taskPlans
    : (input.context.selectedSkill ? [{ skillId: input.context.selectedSkill.id, prompt: input.context.prompt, imageCount: input.context.autoSkillDecision.imageCount, followUpSkillIds: input.context.autoSkillDecision.followUpSkillIds }] : []);
  if (plans.length === 0) {
    return { handled: false, response: "", artifacts: [], executedSkillIds: [] };
  }
  const executions = await Promise.all(plans.map(plan => executeChatSkillChain({
    skillIds: [plan.skillId].concat(plan.followUpSkillIds),
    prompt: plan.prompt || input.context.prompt,
    images: input.context.images,
    imageFileNames: input.context.imageFileNames,
    models: input.context.modelUploads,
    dependencies: input.dependencies,
    imageCountOverride: plan.imageCount,
    stripChatSkillCommandPrefix,
    resolveWorkspaceRelativePath,
    onArtifact: input.onArtifact,
    onPlan: input.onPlan,
    onProgressMessage: input.onProgressMessage,
    onSkillStart: input.onSkillStart
  })));
  if (executions.some(execution => !execution.handled)) {
    return {
      handled: false,
      response: "",
      artifacts: executions.flatMap(execution => execution.artifacts),
      executedSkillIds: executions.flatMap(execution => execution.executedSkillIds)
    };
  }
  return {
    handled: true,
    response: executions.map(execution => execution.response).filter(Boolean).join("\n\n"),
    artifacts: executions.flatMap(execution => execution.artifacts),
    executedSkillIds: executions.flatMap(execution => execution.executedSkillIds)
  };
}

function resolveSkillFile(rootDirectory: string, rawSkillId: string): { skillId: string; directory: string; filePath: string; } {
  const skillId = normalizeChatSkillId(rawSkillId);
  if (!skillId) {
    throw new Error("Skill ID is required.");
  }
  const root = path.resolve(rootDirectory);
  const directory = path.resolve(root, skillId);
  const relative = path.relative(root, directory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Skill path is outside the skills directory.");
  }
  return { skillId, directory, filePath: path.join(directory, "skill.md") };
}

async function handlePostApiAsk(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const requestBody = body as Record<string, unknown>;
  const context = await resolveChatRequestContext({ body: requestBody, dependencies });
  if (!context.prompt && !context.requestedSkillId && context.images.length === 0 && context.modelUploads.length === 0 && context.fileUploads.length === 0) {
    sendJson(response, 400, { error: "Prompt is required." });
    return;
  }
  if (isBlockingChatClarification(context)) {
    const clarification = context.autoSkillDecision.clarification!;
    sendJson(response, 200, {
      response: clarification.question,
      reasoning: "",
      usedSkill: null,
      clarification
    });
    return;
  }
  const optionalSuggestion = resolveOptionalChatSuggestion(context);
  if (context.selectedSkill) {
    const execution = await executeResolvedChatTasks({ context, dependencies });
    if (execution.handled) {
      sendJson(response, 200, { response: execution.response, reasoning: "", usedSkill: context.usedSkill, artifacts: execution.artifacts });
      return;
    }
  }
  const promptWithSkill = await applySoulPromptContext(buildPromptWithSkillContext({
    prompt: context.prompt,
    availableSkills: context.availableSkills,
    availableTools: context.availableTools,
    selectedSkill: context.selectedSkill,
    autoRunSkills: context.autoRunSkills,
    files: context.fileUploads,
    conversation: context.conversation
  }), String(requestBody.replyStyleOverrideId || ""));
  if (context.images.length > 0) {
    const answer = await dependencies.askVisionModel(promptWithSkill, context.images);
    sendJson(response, 200, { response: answer, reasoning: "", usedSkill: context.usedSkill, clarification: optionalSuggestion });
    return;
  }
  if (typeof dependencies.askModelDetailed === "function") {
    const detailed = await dependencies.askModelDetailed(promptWithSkill);
    sendJson(response, 200, {
      response: detailed.response,
      reasoning: context.reasoningEnabled && typeof detailed.reasoning === "string" ? detailed.reasoning : "",
      usedSkill: context.usedSkill,
      clarification: optionalSuggestion
    });
    return;
  }
  const answer = await dependencies.askModel(promptWithSkill);
  sendJson(response, 200, { response: answer, reasoning: "", usedSkill: context.usedSkill, clarification: optionalSuggestion });
}

async function handlePostApiAskStream(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const body = await parseJsonBody(request);
  const requestBody = body as Record<string, unknown>;
  const dashboardRequest = registerDashboardRequest({ requestId: requestBody.dashboardRequestId });
  const context = await resolveChatRequestContext({ body: requestBody, dependencies });
  if (!context.prompt && !context.requestedSkillId && context.images.length === 0 && context.modelUploads.length === 0 && context.fileUploads.length === 0) {
    dashboardRequest.finish();
    sendJson(response, 400, { error: "Prompt is required." });
    return;
  }
  response.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no"
  });
  let closed = false;
  request.on("close", () => {
    closed = true;
    dashboardRequest.abort();
  });
  const writeEvent = (event: Record<string, unknown>): void => {
    if (closed || response.writableEnded) {
      return;
    }
    response.write(`${JSON.stringify(event)}\n`);
  };
  const buildChainSkillsPayload = (skillIds: string[], currentIndex = 0) => {
    return skillIds
      .slice(currentIndex)
      .map((skillId, index) => {
        const skill = context.availableSkills.find(entry => entry.id === skillId) || null;
        const source = currentIndex + index === 0 ? context.selectedSkillSource : "auto";
        return { id: skillId, name: skill?.name || skillId, source };
      });
  };
  try {
    writeEvent({
      type: "start",
      queuedSkills: context.selectedSkill ? buildChainSkillsPayload(context.chainSkillIds) : []
    });
    if (isBlockingChatClarification(context)) {
      const clarification = context.autoSkillDecision.clarification!;
      writeEvent({ type: "clarification", clarification });
      writeEvent({
        type: "done",
        response: clarification.question,
        reasoning: "",
        usedSkill: null,
        clarification
      });
      response.end();
      return;
    }
    const optionalSuggestion = resolveOptionalChatSuggestion(context);
    if (context.selectedSkill) {
      let chainStartIndex = 0;
      const execution = await executeResolvedChatTasks({
        context,
        dependencies,
        onSkillStart: skillId => {
          const chainSkill = context.availableSkills.find(entry => entry.id === skillId) || null;
          const source = chainStartIndex === 0 ? context.selectedSkillSource : "auto";
          writeEvent({
            type: "skill-start",
            skillId,
            skillName: chainSkill?.name || skillId,
            source,
            message: chainSkill ? describeChatSkillTask(chainSkill, source) : `Starting follow-up skill: ${skillId}.`,
            queuedSkills: buildChainSkillsPayload(context.chainSkillIds, chainStartIndex + 1)
          });
          chainStartIndex += 1;
        },
        onArtifact: artifact => {
          writeEvent({ type: "skill-artifact", artifact });
        },
        onPlan: plan => {
          writeEvent({ type: "skill-plan", plan });
        },
        onProgressMessage: message => {
          if (message.trim()) {
            writeEvent({ type: "response-delta", delta: message.trim() + "\n\n" });
          }
        }
      });
      if (execution.handled) {
        writeEvent({ type: "response-delta", delta: execution.response });
        writeEvent({ type: "done", response: execution.response, reasoning: "", usedSkill: context.usedSkill, artifacts: execution.artifacts });
        response.end();
        return;
      }
    }
    const promptWithSkill = await applySoulPromptContext(buildPromptWithSkillContext({
      prompt: context.prompt,
      availableSkills: context.availableSkills,
      availableTools: context.availableTools,
      selectedSkill: context.selectedSkill,
      autoRunSkills: context.autoRunSkills,
      files: context.fileUploads,
      conversation: context.conversation
    }), String(requestBody.replyStyleOverrideId || ""));
    if (context.images.length > 0) {
      const answer = await dependencies.askVisionModel(promptWithSkill, context.images, { signal: dashboardRequest.signal });
      writeEvent({ type: "response-delta", delta: answer });
      writeEvent({ type: "done", response: answer, reasoning: "", usedSkill: context.usedSkill, clarification: optionalSuggestion });
      response.end();
      return;
    }
    if (typeof dependencies.askModelDetailedStream === "function") {
      const detailed = await dependencies.askModelDetailedStream(promptWithSkill, {
        onReasoningDelta: delta => {
          if (!context.reasoningEnabled) {
            return;
          }
          writeEvent({ type: "reasoning-delta", delta });
        },
        onResponseDelta: delta => writeEvent({ type: "response-delta", delta }),
        signal: dashboardRequest.signal
      });
      writeEvent({
        type: "done",
        response: detailed.response,
        reasoning: context.reasoningEnabled && typeof detailed.reasoning === "string" ? detailed.reasoning : "",
        usedSkill: context.usedSkill,
        clarification: optionalSuggestion
      });
      response.end();
      return;
    }
    if (typeof dependencies.askModelDetailed === "function") {
      const detailed = await dependencies.askModelDetailed(promptWithSkill);
      if (context.reasoningEnabled && detailed.reasoning) {
        writeEvent({ type: "reasoning-delta", delta: detailed.reasoning });
      }
      if (detailed.response) {
        writeEvent({ type: "response-delta", delta: detailed.response });
      }
      writeEvent({
        type: "done",
        response: detailed.response,
        reasoning: context.reasoningEnabled && typeof detailed.reasoning === "string" ? detailed.reasoning : "",
        usedSkill: context.usedSkill,
        clarification: optionalSuggestion
      });
      response.end();
      return;
    }
    const answer = await dependencies.askModel(promptWithSkill);
    writeEvent({ type: "response-delta", delta: answer });
    writeEvent({ type: "done", response: answer, reasoning: "", usedSkill: context.usedSkill, clarification: optionalSuggestion });
    response.end();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    writeEvent({ type: isDashboardAbortError(error) ? "stopped" : "error", message: isDashboardAbortError(error) ? "Ask request stopped." : (detail || "Ask stream failed.") });
    response.end();
  } finally {
    dashboardRequest.finish();
  }
}

async function handleGetApiChatSkills(request: IncomingMessage, response: ServerResponse, url: URL, dependencies: DashboardDependencies): Promise<void> {
  const skills = await loadChatSkillsFromDisk();
  sendJson(response, 200, {
    skills: skills.map(entry => ({ id: entry.id, name: entry.name, description: entry.description, metadata: entry.metadata }))
  });
}

async function handleGetApiChatSkill(_request: IncomingMessage, response: ServerResponse, url: URL, _dependencies: DashboardDependencies): Promise<void> {
  try {
    const rootDirectory = await resolveChatSkillsDirectory();
    const resolved = resolveSkillFile(rootDirectory, url.searchParams.get("skillId") || url.searchParams.get("id") || "");
    const content = await readFile(resolved.filePath, "utf8");
    sendJson(response, 200, { id: resolved.skillId, fileName: "skill.md", content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read skill.";
    sendJson(response, message.includes("required") ? 400 : 404, { error: message });
  }
}

async function handlePostApiChatSkill(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await parseJsonBody(request) as Record<string, unknown>;
    const rootDirectory = await resolveChatSkillsDirectory();
    const resolved = resolveSkillFile(rootDirectory, String(body.skillId || body.id || ""));
    const content = String(body.content || "").trimEnd();
    if (!content.trim()) {
      sendJson(response, 400, { error: "Skill content is required." });
      return;
    }
    await mkdir(resolved.directory, { recursive: true });
    await writeFile(resolved.filePath, `${content}\n`, "utf8");
    const skills = await loadChatSkillsFromDisk();
    const saved = skills.find(entry => entry.id === resolved.skillId) || null;
    sendJson(response, 200, { id: resolved.skillId, fileName: "skill.md", content: `${content}\n`, skill: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save skill.";
    sendJson(response, 400, { error: message });
  }
}

async function handleGetApiChatPersonality(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  const soul = await readChatSoulSettings();
  const userMarkdown = await readChatUserMarkdown();
  sendJson(response, 200, { soul, userMarkdown });
}

async function handlePostApiChatPersonality(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await parseJsonBody(request) as Record<string, unknown>;
    const soul = normalizeChatSoulSettings(body.soul);
    const userMarkdown = String(body.userMarkdown || "").trimEnd();
    await writeChatSoulSettings(soul);
    await writeChatUserMarkdown(userMarkdown);
    sendJson(response, 200, { soul, userMarkdown: `${userMarkdown || "# USER\n\n"}\n` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save personality settings.";
    sendJson(response, 400, { error: message });
  }
}

async function handleGetApiChatReplyStyle(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  const soul = await readChatSoulSettings();
  sendJson(response, 200, {
    activeReplyStyleId: soul.activeReplyStyleId,
    replyStyles: soul.replyStyles.map(entry => ({...entry, isBuiltIn: isDefaultChatReplyStyleId(entry.id)}))
  });
}

async function handlePostApiChatReplyStyle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const body = await parseJsonBody(request) as Record<string, unknown>;
    const current = await readChatSoulSettings();
    const next = normalizeChatSoulSettings({
      ...current,
      activeReplyStyleId: body.activeReplyStyleId ?? current.activeReplyStyleId,
      replyStyles: Array.isArray(body.replyStyles) ? body.replyStyles : current.replyStyles
    });
    await writeChatSoulSettings(next);
    sendJson(response, 200, {
      activeReplyStyleId: next.activeReplyStyleId,
      replyStyles: next.replyStyles.map(entry => ({...entry, isBuiltIn: isDefaultChatReplyStyleId(entry.id)}))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save reply style settings.";
    sendJson(response, 400, { error: message });
  }
}

export const chatSkillRouteDefinitions = [
  getRoute("/api/chat-personality", handleGetApiChatPersonality),
  postRoute("/api/chat-personality", handlePostApiChatPersonality),
  getRoute("/api/chat-reply-style", handleGetApiChatReplyStyle),
  postRoute("/api/chat-reply-style", handlePostApiChatReplyStyle),
  getRoute("/api/chat-skills", handleGetApiChatSkills),
  getRoute("/api/chat-skill", handleGetApiChatSkill),
  postRoute("/api/chat-skill", handlePostApiChatSkill),
  postRoute("/api/ask", handlePostApiAsk),
  postRoute("/api/ask-stream", handlePostApiAskStream)
];
