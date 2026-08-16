async function runDashboardAskStreamRequest(input) {
  const payload = input && input.payload ? input.payload : {};
  const handlers = input && input.handlers ? input.handlers : {};
  const normalizers = input && input.normalizers ? input.normalizers : {};
  const signal = input && input.signal ? input.signal : undefined;
  const response = await fetch("/api/ask-stream", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload),
    signal
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || "Ask stream failed with status " + response.status + ".");
  }
  if (!response.body) {
    throw new Error("Ask stream response body is unavailable.");
  }
  const normalizeTaskSkillList = typeof normalizers.normalizeTaskSkillList === "function" ? normalizers.normalizeTaskSkillList : value => value;
  const normalizeArtifact = typeof normalizers.normalizeArtifact === "function" ? normalizers.normalizeArtifact : value => value;
  const normalizeSkillPlan = typeof normalizers.normalizeSkillPlan === "function" ? normalizers.normalizeSkillPlan : value => value;
  const normalizeClarification = typeof normalizers.normalizeClarification === "function" ? normalizers.normalizeClarification : value => value;
  const normalizeUsedSkill = typeof normalizers.normalizeUsedSkill === "function" ? normalizers.normalizeUsedSkill : value => value;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatchLine = line => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    let event = null;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (!event || typeof event !== "object") {
      return;
    }
    const type = typeof event.type === "string" ? event.type : "";
    if (type === "reasoning-delta") {
      const delta = typeof event.delta === "string" ? event.delta : "";
      if (delta && typeof handlers.onReasoningDelta === "function") {
        handlers.onReasoningDelta(delta);
      }
      return;
    }
    if (type === "response-delta") {
      const delta = typeof event.delta === "string" ? event.delta : "";
      if (delta && typeof handlers.onResponseDelta === "function") {
        handlers.onResponseDelta(delta);
      }
      return;
    }
    if (type === "skill-start") {
      if (typeof handlers.onSkillStart === "function") {
        handlers.onSkillStart({
          skillId: typeof event.skillId === "string" ? event.skillId : "",
          skillName: typeof event.skillName === "string" ? event.skillName : "",
          source: event.source === "explicit" ? "explicit" : "auto",
          message: typeof event.message === "string" ? event.message : "",
          queuedSkills: normalizeTaskSkillList(event.queuedSkills)
        });
      }
      return;
    }
    if (type === "skill-artifact") {
      if (typeof handlers.onSkillArtifact === "function") {
        const artifact = normalizeArtifact(event.artifact);
        if (artifact) {
          handlers.onSkillArtifact(artifact);
        }
      }
      return;
    }
    if (type === "skill-plan") {
      if (typeof handlers.onSkillPlan === "function") {
        const plan = normalizeSkillPlan(event.plan);
        if (plan) {
          handlers.onSkillPlan(plan);
        }
      }
      return;
    }
    if (type === "clarification") {
      if (typeof handlers.onClarification === "function") {
        handlers.onClarification(normalizeClarification(event.clarification));
      }
      return;
    }
    if (type === "done") {
      if (typeof handlers.onDone === "function") {
        handlers.onDone({
          response: typeof event.response === "string" ? event.response : "",
          reasoning: typeof event.reasoning === "string" ? event.reasoning : "",
          usedSkill: normalizeUsedSkill(event.usedSkill),
          clarification: normalizeClarification(event.clarification),
          artifacts: Array.isArray(event.artifacts)
            ? event.artifacts.map(entry => normalizeArtifact(entry)).filter(entry => Boolean(entry))
            : []
        });
      }
      return;
    }
    if (type === "error") {
      const message = typeof event.message === "string" ? event.message : "Ask stream failed.";
      if (typeof handlers.onError === "function") {
        handlers.onError(message);
      }
      return;
    }
    if (type === "stopped" && typeof handlers.onStopped === "function") {
      const message = typeof event.message === "string" ? event.message : "Ask request stopped.";
      handlers.onStopped(message);
    }
  };
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    buffer += decoder.decode(chunk.value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      dispatchLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  const tail = buffer.replace(/\r$/, "");
  if (tail) {
    dispatchLine(tail);
  }
}
