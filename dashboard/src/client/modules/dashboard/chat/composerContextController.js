function createDashboardChatComposerContextController(input) {
  const getActiveSession = typeof input?.getActiveSession === "function" ? input.getActiveSession : () => null;
  const persistSessions = typeof input?.persistSessions === "function" ? input.persistSessions : () => {};
  const getPersonalityLabel = typeof input?.getPersonalityLabel === "function" ? input.getPersonalityLabel : () => "Normal";
  const replyStyleEditor = input?.replyStyleEditor || null;
  let unbindReplyStyleSubscription = null;

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  }

  function getNodes() {
    return {
      personalityBadge: document.getElementById("ask-active-personality-badge"),
      replyStyleBadge: document.getElementById("ask-active-reply-style-badge"),
      overrideSelect: document.getElementById("ask-chat-reply-style-override")
    };
  }

  function getStyleLabel(styles, id, fallback) {
    return styles.find(style => normalizeId(style?.id) === normalizeId(id))?.label || fallback;
  }

  function render() {
    const nodes = getNodes();
    const snapshot = replyStyleEditor?.getSnapshot?.() || {activeReplyStyleId: "empty", replyStyles: []};
    const styles = Array.isArray(snapshot.replyStyles) ? snapshot.replyStyles : [];
    const globalId = normalizeId(snapshot.activeReplyStyleId || "empty");
    const globalLabel = getStyleLabel(styles, globalId, "<empty>");
    const session = getActiveSession();
    let overrideId = normalizeId(session?.replyStyleOverrideId);
    if (overrideId && styles.length > 0 && !styles.some(style => normalizeId(style?.id) === overrideId)) {
      overrideId = "";
      session.replyStyleOverrideId = "";
      persistSessions();
    }
    if (nodes.personalityBadge) {
      nodes.personalityBadge.textContent = `Personality: ${getPersonalityLabel() || "Normal"}`;
    }
    if (nodes.replyStyleBadge) {
      const effectiveLabel = overrideId ? getStyleLabel(styles, overrideId, overrideId) : globalLabel;
      nodes.replyStyleBadge.textContent = `Reply: ${effectiveLabel}`;
      nodes.replyStyleBadge.classList.toggle("is-overridden", Boolean(overrideId));
      nodes.replyStyleBadge.title = overrideId ? "This chat overrides the global reply style." : "This chat inherits the global reply style.";
    }
    if (!nodes.overrideSelect) return;
    const selectedValue = overrideId;
    nodes.overrideSelect.replaceChildren();
    const inheritOption = document.createElement("option");
    inheritOption.value = "";
    inheritOption.textContent = `Use global (${globalLabel})`;
    nodes.overrideSelect.appendChild(inheritOption);
    styles.forEach(style => {
      const option = document.createElement("option");
      option.value = normalizeId(style?.id);
      option.textContent = style?.label || style?.id;
      nodes.overrideSelect.appendChild(option);
    });
    nodes.overrideSelect.value = selectedValue;
  }

  function bind() {
    const {overrideSelect} = getNodes();
    if (overrideSelect && overrideSelect.dataset.bound !== "true") {
      overrideSelect.dataset.bound = "true";
      overrideSelect.addEventListener("change", () => {
        const session = getActiveSession();
        if (!session) return;
        session.replyStyleOverrideId = normalizeId(overrideSelect.value);
        persistSessions();
        render();
      });
    }
    if (!unbindReplyStyleSubscription && typeof replyStyleEditor?.subscribe === "function") {
      unbindReplyStyleSubscription = replyStyleEditor.subscribe(render);
    }
    render();
  }

  return {bind, render};
}
