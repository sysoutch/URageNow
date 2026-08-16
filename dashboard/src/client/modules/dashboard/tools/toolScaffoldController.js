function createDashboardToolScaffoldController(input) {
  const request = typeof input?.request === "function" ? input.request : () => Promise.reject(new Error("Request helper unavailable."));
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : () => {};
  let plannedImplementation = null;
  let plannedSpecSignature = "";
  const guaranteedAudit = [
    ["entry", "Runnable index.html", "Catalog entry point"],
    ["theme", "Dashboard theme", "Theme host and shared bridge"],
    ["output", "Current output contract", "Send Resource descriptor"],
    ["bridge", "Dashboard tool bridge", "Asset receive/send integration"],
    ["readme", "Integration documentation", "README for developers and LazyDev"],
    ["manifest", "Machine-readable manifest", "Explicit capabilities and options"]
  ];

  function getNodes() {
    return {
      overlay: document.getElementById("tool-scaffold-overlay"),
      openButton: document.getElementById("tools-add-tool-button"),
      closeButton: document.getElementById("tool-scaffold-close-button"),
      cancelButton: document.getElementById("tool-scaffold-cancel-button"),
      backdrop: document.getElementById("tool-scaffold-overlay-backdrop"),
      planButton: document.getElementById("tool-scaffold-plan-button"),
      createButton: document.getElementById("tool-scaffold-create-button"),
      requestInput: document.getElementById("tool-scaffold-request"),
      status: document.getElementById("tool-scaffold-status"),
      auditList: document.getElementById("tool-scaffold-audit-list"),
      title: document.getElementById("tool-scaffold-title-input"),
      category: document.getElementById("tool-scaffold-category"),
      slug: document.getElementById("tool-scaffold-slug"),
      description: document.getElementById("tool-scaffold-description"),
      purpose: document.getElementById("tool-scaffold-purpose"),
      outputKind: document.getElementById("tool-scaffold-output-kind"),
      acceptsFiles: document.getElementById("tool-scaffold-accepts-files"),
      sidebar: document.getElementById("tool-scaffold-sidebar"),
      persistState: document.getElementById("tool-scaffold-persist-state"),
      implementationPreview: document.getElementById("tool-scaffold-implementation-preview"),
      implementationFile: document.getElementById("tool-scaffold-implementation-file"),
      implementationDiff: document.getElementById("tool-scaffold-implementation-diff"),
      implementationCode: document.getElementById("tool-scaffold-implementation-code"),
      implementationSummary: document.getElementById("tool-scaffold-implementation-summary")
    };
  }

  function normalizeSlug(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  }

  function captureSpec() {
    const nodes = getNodes();
    return {
      title: String(nodes.title?.value || "").trim(),
      category: normalizeSlug(nodes.category?.value || "dev"),
      slug: normalizeSlug(nodes.slug?.value || nodes.title?.value),
      description: String(nodes.description?.value || "").trim(),
      purpose: String(nodes.purpose?.value || "").trim(),
      outputKind: String(nodes.outputKind?.value || "text"),
      acceptsFiles: nodes.acceptsFiles?.checked === true,
      includeSidebar: nodes.sidebar?.checked !== false,
      persistState: nodes.persistState?.checked === true
    };
  }

  function applySpec(spec) {
    const nodes = getNodes();
    if (nodes.title) nodes.title.value = spec.title || "";
    if (nodes.category) nodes.category.value = spec.category || "dev";
    if (nodes.slug) nodes.slug.value = spec.slug || "";
    if (nodes.description) nodes.description.value = spec.description || "";
    if (nodes.purpose) nodes.purpose.value = spec.purpose || "";
    if (nodes.outputKind) nodes.outputKind.value = spec.outputKind || "text";
    if (nodes.acceptsFiles) nodes.acceptsFiles.checked = spec.acceptsFiles === true;
    if (nodes.sidebar) nodes.sidebar.checked = spec.includeSidebar !== false;
    if (nodes.persistState) nodes.persistState.checked = spec.persistState === true;
  }

  function setStatus(message, isError) {
    const status = getNodes().status;
    if (!status) return;
    status.textContent = String(message || "");
    status.classList.toggle("is-error", isError === true);
  }

  function renderAudit(audit) {
    const list = getNodes().auditList;
    if (!list) return;
    list.replaceChildren();
    const items = Array.isArray(audit) && audit.length > 0
      ? audit
      : guaranteedAudit.map(([id, label, detail]) => ({id, label, detail, passed: true}));
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "tool-scaffold-audit-item " + (item.passed ? "is-passed" : "is-missing");
      const icon = document.createElement("i");
      icon.className = "bi " + (item.passed ? "bi-check-circle" : "bi-exclamation-triangle");
      icon.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span");
      const label = document.createElement("strong");
      label.textContent = item.label || item.id;
      const detail = document.createElement("small");
      detail.textContent = item.detail || "";
      copy.append(label, detail);
      row.append(icon, copy);
      list.appendChild(row);
    });
  }

  function renderImplementationFile() {
    const nodes = getNodes();
    const fileName = String(nodes.implementationFile?.value || "");
    const fileDiff = plannedImplementation?.diffs?.find(diff => diff.fileName === fileName);
    const content = String(plannedImplementation?.files?.[fileName] || "");
    if (nodes.implementationDiff) {
      nodes.implementationDiff.textContent = fileDiff
        ? fileDiff.lines.map(line => (line.type === "add" ? "+" : "-") + " " + line.lineNumber + " | " + line.text).join("\n") || "No changes from the audited baseline."
        : "No diff available.";
    }
    if (nodes.implementationCode) nodes.implementationCode.textContent = content;
  }

  function renderImplementationPreview(implementation) {
    const nodes = getNodes();
    plannedImplementation = implementation || null;
    const fileNames = Object.keys(implementation?.files || {}).filter(fileName => ["index.html", "app.js", "style.css"].includes(fileName));
    nodes.implementationPreview?.classList.toggle("hidden", fileNames.length === 0);
    if (nodes.implementationSummary) nodes.implementationSummary.textContent = implementation?.summary || "";
    if (nodes.implementationFile) {
      nodes.implementationFile.replaceChildren(...fileNames.map(fileName => {
        const option = document.createElement("option");
        option.value = fileName;
        option.textContent = fileName;
        return option;
      }));
    }
    renderImplementationFile();
  }

  function setMode(mode) {
    const normalized = mode === "llm" ? "llm" : "manual";
    document.querySelectorAll("[data-tool-scaffold-mode]").forEach(button => {
      const active = button.getAttribute("data-tool-scaffold-mode") === normalized;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    const llmPanel = document.querySelector('[data-tool-scaffold-mode-panel="llm"]');
    llmPanel?.classList.toggle("hidden", normalized !== "llm");
    if (normalized !== "llm") {
      plannedImplementation = null;
      plannedSpecSignature = "";
      renderImplementationPreview(null);
    }
  }

  function setOpen(open) {
    const nodes = getNodes();
    if (!nodes.overlay) return;
    nodes.overlay.classList.toggle("hidden", open !== true);
    nodes.overlay.setAttribute("aria-hidden", open === true ? "false" : "true");
    if (open) {
      renderAudit();
      window.setTimeout(() => nodes.title?.focus(), 0);
    }
  }

  async function planWithLlm() {
    const nodes = getNodes();
    const userRequest = String(nodes.requestInput?.value || "").trim();
    if (!userRequest) {
      setStatus("Describe the tool before asking LazyDev to plan it.", true);
      nodes.requestInput?.focus();
      return;
    }
    nodes.planButton.disabled = true;
    setStatus("LazyDev is planning and implementing the tool...");
    try {
      const payload = await request("/api/tools/scaffold/plan", {request: userRequest});
      applySpec(payload.spec || {});
      renderImplementationPreview(payload.implementation || null);
      plannedSpecSignature = JSON.stringify(captureSpec());
      renderAudit(payload.audit);
      setStatus(payload.implementation?.summary
        ? "Implementation ready: " + payload.implementation.summary
        : "Implementation ready. Review the options, then create the audited tool.");
    } catch (error) {
      setStatus(error?.message || "Failed to plan the tool.", true);
    } finally {
      nodes.planButton.disabled = false;
    }
  }

  async function createTool() {
    const nodes = getNodes();
    const spec = captureSpec();
    if (!spec.title || !spec.category || !spec.slug || !spec.description || !spec.purpose) {
      setStatus("Name, category, folder slug, description, and purpose are required.", true);
      return;
    }
    const llmMode = document.querySelector('[data-tool-scaffold-mode="llm"]')?.classList.contains("active") === true;
    if (llmMode && !plannedImplementation) {
      setStatus("Generate an implementation with LazyDev before creating this tool.", true);
      return;
    }
    if (llmMode && JSON.stringify(spec) !== plannedSpecSignature) {
      setStatus("The specification changed after implementation. Generate it again so the code matches these options.", true);
      return;
    }
    nodes.createButton.disabled = true;
    setStatus("Creating the dashboard-integrated tool...");
    try {
      const files = llmMode ? plannedImplementation.files : null;
      const payload = await request("/api/tools/scaffold/create", {spec, files});
      renderAudit(payload.audit);
      setOutput("Created " + payload.spec.title + " in tools/" + payload.spec.category + "/" + payload.spec.slug + ".");
      setStatus("Tool created. Reloading the catalog...");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setStatus(error?.message || "Failed to create the tool.", true);
      nodes.createButton.disabled = false;
    }
  }

  function bind() {
    const nodes = getNodes();
    if (!nodes.openButton || nodes.openButton.dataset.bound === "true") return;
    nodes.openButton.dataset.bound = "true";
    nodes.openButton.addEventListener("click", () => setOpen(true));
    nodes.closeButton?.addEventListener("click", () => setOpen(false));
    nodes.cancelButton?.addEventListener("click", () => setOpen(false));
    nodes.backdrop?.addEventListener("click", () => setOpen(false));
    nodes.planButton?.addEventListener("click", planWithLlm);
    nodes.implementationFile?.addEventListener("change", renderImplementationFile);
    nodes.createButton?.addEventListener("click", createTool);
    document.querySelectorAll("[data-tool-scaffold-mode]").forEach(button => {
      button.addEventListener("click", () => setMode(button.getAttribute("data-tool-scaffold-mode")));
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !nodes.overlay?.classList.contains("hidden")) setOpen(false);
    });
    setMode("manual");
    renderAudit();
  }

  return {bind, captureSpec, applySpec, renderAudit, setMode, setOpen};
}
