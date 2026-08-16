function createDashboardToolEditorController(input) {
  const request = typeof input?.request === "function" ? input.request : () => Promise.reject(new Error("Request helper unavailable."));
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : () => {};
  const state = { tools: [], proposedFiles: {}, mode: "manual", stageId: "", transactionId: "" };

  function nodes() {
    return {
      overlay: document.getElementById("tool-editor-overlay"),
      open: document.getElementById("tools-edit-tool-button"),
      close: document.getElementById("tool-editor-close-button"),
      cancel: document.getElementById("tool-editor-cancel-button"),
      backdrop: document.getElementById("tool-editor-overlay-backdrop"),
      tool: document.getElementById("tool-editor-tool"),
      file: document.getElementById("tool-editor-file"),
      content: document.getElementById("tool-editor-content"),
      request: document.getElementById("tool-editor-request"),
      plan: document.getElementById("tool-editor-plan-button"),
      apply: document.getElementById("tool-editor-apply-button"),
      status: document.getElementById("tool-editor-status"),
      audit: document.getElementById("tool-editor-audit-list"),
      llmFields: document.getElementById("tool-editor-llm-fields"),
      diffSection: document.getElementById("tool-editor-diff-section"),
      diff: document.getElementById("tool-editor-diff"),
      diffSummary: document.getElementById("tool-editor-diff-summary"),
      rollback: document.getElementById("tool-editor-rollback-button")
    };
  }

  function invalidateStage() {
    state.stageId = "";
    const ui = nodes();
    ui.diffSection?.classList.add("hidden");
    const label = ui.apply?.querySelector("span");
    if (label) label.textContent = "Review Staged Diff";
  }

  function renderDiff(diffs) {
    const ui = nodes();
    const list = Array.isArray(diffs) ? diffs : [];
    const added = list.reduce((total, diff) => total + Number(diff.added || 0), 0);
    const removed = list.reduce((total, diff) => total + Number(diff.removed || 0), 0);
    if (ui.diffSummary) ui.diffSummary.textContent = "+" + added + " / -" + removed + " across " + list.length + " file(s)";
    const lines = [];
    list.forEach(diff => {
      lines.push("=== " + diff.fileName + " ===");
      (Array.isArray(diff.lines) ? diff.lines : []).forEach(line => {
        lines.push((line.type === "add" ? "+" : "-") + String(line.lineNumber).padStart(5, " ") + " " + String(line.text || ""));
      });
    });
    if (ui.diff) ui.diff.textContent = lines.join("\n") || "No textual changes.";
    ui.diffSection?.classList.remove("hidden");
  }

  function setStatus(message, error) {
    const node = nodes().status;
    if (!node) return;
    node.textContent = String(message || "");
    node.classList.toggle("is-error", error === true);
  }

  function renderAudit(items) {
    const list = nodes().audit;
    if (!list) return;
    list.replaceChildren();
    (Array.isArray(items) ? items : []).forEach(item => {
      const row = document.createElement("div");
      row.className = "tool-scaffold-audit-item " + (item.passed ? "is-passed" : "is-missing");
      const icon = document.createElement("i");
      icon.className = "bi " + (item.passed ? "bi-check-circle" : "bi-exclamation-triangle");
      icon.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span");
      const label = document.createElement("strong");
      label.textContent = item.label || item.id || "Integration check";
      const detail = document.createElement("small");
      detail.textContent = item.detail || "";
      copy.append(label, detail);
      row.append(icon, copy);
      list.appendChild(row);
    });
  }

  function selectedTool() {
    return state.tools.find(tool => tool.id === nodes().tool?.value) || null;
  }

  function renderFileOptions(fileNames, selected) {
    const select = nodes().file;
    if (!select) return;
    select.replaceChildren();
    (Array.isArray(fileNames) ? fileNames : []).forEach(fileName => {
      const option = document.createElement("option");
      option.value = fileName;
      option.textContent = fileName;
      option.selected = fileName === selected;
      select.appendChild(option);
    });
  }

  async function loadSelectedFile() {
    const ui = nodes();
    const toolId = String(ui.tool?.value || "");
    const fileName = String(ui.file?.value || "");
    if (!toolId || !fileName) return;
    if (Object.hasOwn(state.proposedFiles, fileName)) {
      if (ui.content) ui.content.value = state.proposedFiles[fileName];
      return;
    }
    setStatus("Loading " + fileName + "...");
    try {
      const payload = await request("/api/tools/edit/file?toolId=" + encodeURIComponent(toolId) + "&fileName=" + encodeURIComponent(fileName));
      if (ui.content) ui.content.value = payload.content || "";
      setStatus("Review the complete file before applying. A backup is created automatically.");
    } catch (error) {
      setStatus(error?.message || "Could not load the tool file.", true);
    }
  }

  async function selectTool() {
    state.proposedFiles = {};
    invalidateStage();
    renderAudit([]);
    const tool = selectedTool();
    renderFileOptions(tool?.files || [], tool?.files?.[0]);
    await loadSelectedFile();
  }

  async function loadCatalog() {
    setStatus("Loading editable tools...");
    const payload = await request("/api/tools/edit/catalog");
    state.tools = Array.isArray(payload.tools) ? payload.tools : [];
    const select = nodes().tool;
    if (select) {
      select.replaceChildren();
      state.tools.forEach(tool => {
        const option = document.createElement("option");
        option.value = tool.id;
        option.textContent = tool.title + " · " + tool.id;
        select.appendChild(option);
      });
    }
    if (state.tools.length) await selectTool();
    else setStatus("No dashboard tools with an index.html were found.", true);
  }

  function setMode(mode) {
    state.mode = mode === "llm" ? "llm" : "manual";
    document.querySelectorAll("[data-tool-editor-mode]").forEach(button => {
      const active = button.getAttribute("data-tool-editor-mode") === state.mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    nodes().llmFields?.classList.toggle("hidden", state.mode !== "llm");
  }

  function setOpen(open) {
    const overlay = nodes().overlay;
    if (!overlay) return;
    overlay.classList.toggle("hidden", open !== true);
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) loadCatalog().catch(error => setStatus(error?.message || "Could not load editable tools.", true));
  }

  async function planWithLlm() {
    const ui = nodes();
    const editRequest = String(ui.request?.value || "").trim();
    if (!editRequest) return setStatus("Describe the change you want LazyDev to make.", true);
    ui.plan.disabled = true;
    setStatus("LazyDev is preparing complete-file replacements...");
    try {
      const payload = await request("/api/tools/edit/plan", { toolId: String(ui.tool?.value || ""), request: editRequest });
      state.proposedFiles = payload.files || {};
      invalidateStage();
      const names = Object.keys(state.proposedFiles);
      renderFileOptions(names, names[0]);
      if (ui.content) ui.content.value = state.proposedFiles[names[0]] || "";
      renderAudit(payload.audit);
      setStatus((payload.summary || "Plan ready.") + " Review every proposed file before applying.");
    } catch (error) {
      setStatus(error?.message || "Could not plan the tool edit.", true);
    } finally {
      ui.plan.disabled = false;
    }
  }

  async function applyChanges() {
    const ui = nodes();
    const fileName = String(ui.file?.value || "");
    if (!fileName) return setStatus("Choose a file to edit.", true);
    state.proposedFiles[fileName] = String(ui.content?.value || "");
    const files = state.mode === "llm" ? state.proposedFiles : { [fileName]: state.proposedFiles[fileName] };
    ui.apply.disabled = true;
    try {
      if (!state.stageId) {
        setStatus("Staging changes and building a reviewable diff...");
        const stage = await request("/api/tools/edit/stage", { toolId: String(ui.tool?.value || ""), files });
        state.stageId = String(stage.id || "");
        renderDiff(stage.diffs);
        renderAudit(stage.audit);
        const label = ui.apply?.querySelector("span");
        if (label) label.textContent = "Confirm Transactional Apply";
        setStatus("Review the staged diff. Apply is blocked if any source file changes before confirmation.");
        return;
      }
      setStatus("Applying the staged transaction...");
      const payload = await request("/api/tools/edit/apply", { stageId: state.stageId });
      state.stageId = "";
      state.transactionId = String(payload.transactionId || "");
      renderAudit(payload.audit);
      setOutput("Updated " + payload.files.join(", ") + ". Backup: " + payload.backupDirectory);
      ui.rollback?.classList.toggle("hidden", !state.transactionId);
      const label = ui.apply?.querySelector("span");
      if (label) label.textContent = "Review Staged Diff";
      setStatus("Transaction applied. Use rollback to restore the pre-apply backup.");
    } catch (error) {
      setStatus(error?.message || "Could not apply the tool edit.", true);
    } finally {
      ui.apply.disabled = false;
    }
  }

  async function rollbackLastApply() {
    if (!state.transactionId) return;
    const ui = nodes();
    ui.rollback.disabled = true;
    setStatus("Restoring the pre-apply tool files transactionally...");
    try {
      const payload = await request("/api/tools/edit/rollback", { transactionId: state.transactionId });
      state.transactionId = "";
      ui.rollback.classList.add("hidden");
      setOutput("Rolled back tool files. Recovery transaction: " + payload.transactionId);
      setStatus("Rollback complete. Reload the selected file before making more changes.");
      await selectTool();
    } catch (error) {
      setStatus(error?.message || "Could not roll back the tool edit.", true);
    } finally {
      ui.rollback.disabled = false;
    }
  }

  function bind() {
    const ui = nodes();
    if (!ui.open || ui.open.dataset.bound === "true") return;
    ui.open.dataset.bound = "true";
    ui.open.addEventListener("click", () => setOpen(true));
    ui.close?.addEventListener("click", () => setOpen(false));
    ui.cancel?.addEventListener("click", () => setOpen(false));
    ui.backdrop?.addEventListener("click", () => setOpen(false));
    ui.tool?.addEventListener("change", selectTool);
    ui.file?.addEventListener("change", loadSelectedFile);
    ui.content?.addEventListener("input", () => {
      const fileName = String(ui.file?.value || "");
      if (fileName) state.proposedFiles[fileName] = ui.content.value;
      invalidateStage();
    });
    ui.plan?.addEventListener("click", planWithLlm);
    ui.apply?.addEventListener("click", applyChanges);
    ui.rollback?.addEventListener("click", rollbackLastApply);
    document.querySelectorAll("[data-tool-editor-mode]").forEach(button => {
      button.addEventListener("click", () => setMode(button.getAttribute("data-tool-editor-mode")));
    });
    setMode("manual");
  }

  return { bind, loadCatalog, setMode, setOpen };
}
