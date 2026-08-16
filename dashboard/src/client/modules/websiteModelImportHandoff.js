function createWebsiteModelImportHandoff() {
  const sketchfabUidPattern = /^[a-f0-9]{32}$/i;

  function parseSketchfabImportRequest() {
    const query = new URLSearchParams(window.location.search);
    if (query.get("urageImport") !== "sketchfab") return null;
    const uid = String(query.get("uid") || "").trim();
    if (!sketchfabUidPattern.test(uid)) return null;
    const name = String(query.get("name") || "").trim().slice(0, 120) || "Sketchfab model";
    const candidateUrl = String(query.get("modelUrl") || "").trim();
    const candidateDownloadUrl = String(query.get("downloadUrl") || "").trim();
    let modelUrl = `https://sketchfab.com/3d-models/${uid}`;
    try {
      const parsed = new URL(candidateUrl || modelUrl);
      if (parsed.protocol === "https:" && /(^|\.)sketchfab\.com$/i.test(parsed.hostname)) {
        modelUrl = parsed.href;
      }
    } catch {}
    let downloadUrl = "";
    try {
      const parsed = new URL(candidateDownloadUrl);
      if (parsed.protocol === "https:" && /(^|\.)urage\.net$/i.test(parsed.hostname) && /^\/api\/sketchfab\/dashboard-imports\/[^/]+\/download$/.test(parsed.pathname)) downloadUrl = parsed.href;
    } catch {}
    return { uid, name, modelUrl, downloadUrl };
  }

  function removeImportQuery() {
    const url = new URL(window.location.href);
    ["urageImport", "uid", "name", "modelUrl", "downloadUrl"].forEach(key => url.searchParams.delete(key));
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function createImportOverlay(request) {
    const overlay = document.createElement("div");
    overlay.className = "runtime-overlay website-model-import-overlay";
    overlay.id = "website-model-import-overlay";
    overlay.dataset.websiteModelImportKey = getImportRequestKey(request);
    overlay.setAttribute("role", "presentation");
    const panel = document.createElement("section");
    panel.className = "runtime-overlay-panel website-model-import-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "website-model-import-title");
    const heading = document.createElement("div");
    heading.className = "website-model-import-heading";
    const title = document.createElement("h3");
    title.id = "website-model-import-title";
    title.textContent = "Import from URage.net";
    const summary = document.createElement("p");
    summary.textContent = "Review the selected Sketchfab model before it is added to your local 3D gallery.";
    heading.append(title, summary);
    const details = document.createElement("dl");
    details.className = "website-model-import-details";
    [["Model", request.name], ["Sketchfab ID", request.uid], ["Source", "URage.net / Sketchfab"]].forEach(([label, value]) => {
      const term = document.createElement("dt");
      term.textContent = label;
      const definition = document.createElement("dd");
      definition.textContent = value;
      details.append(term, definition);
    });
    const notice = document.createElement("p");
    notice.className = "hint website-model-import-notice";
    notice.textContent = request.downloadUrl ? "The URage.net server issued a one-time, five-minute download grant. Confirm to import this model into your local 3D gallery." : "This handoff has no authenticated download grant. Sign in to URage.net as an administrator and configure its Sketchfab download token.";
    const actions = document.createElement("div");
    actions.className = "row website-model-import-actions";
    const openSource = document.createElement("a");
    openSource.className = "secondary";
    openSource.href = request.modelUrl;
    openSource.target = "_blank";
    openSource.rel = "noopener noreferrer";
    openSource.textContent = "Open on Sketchfab";
    const importModel = document.createElement("button");
    importModel.className = "primary";
    importModel.type = "button";
    importModel.disabled = !request.downloadUrl;
    importModel.textContent = "Import to local gallery";
    importModel.addEventListener("click", async () => {
      importModel.disabled = true;
      importModel.textContent = "Importing model…";
      try {
        const response = await fetch("/api/model3d-website-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ downloadUrl: request.downloadUrl, modelName: request.name }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "The model could not be imported.");
        importModel.textContent = "Imported to 3D gallery";
        removeImportQuery();
        window.dispatchEvent(new Event("dashboard:model3d-history-changed"));
      } catch (error) {
        importModel.textContent = error?.message || "Import failed";
        importModel.disabled = false;
      }
    });
    const close = document.createElement("button");
    close.className = "secondary";
    close.type = "button";
    close.textContent = "Not now";
    const closeOverlay = () => {
      overlay.remove();
      removeImportQuery();
    };
    close.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeOverlay(); });
    actions.append(openSource, importModel, close);
    panel.append(heading, details, notice, actions);
    overlay.append(panel);
    return overlay;
  }

  function getImportRequestKey(request) {
    return [request.uid, request.downloadUrl].join("|");
  }

  function openPendingSketchfabImport() {
    const request = parseSketchfabImportRequest();
    if (!request) return;
    const existingOverlay = document.getElementById("website-model-import-overlay");
    if (existingOverlay?.dataset.websiteModelImportKey === getImportRequestKey(request)) return;
    existingOverlay?.remove();
    document.querySelector("[data-ai-scroll-target='model3d-studio-card']")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    if (!document.body) return;
    document.body.append(createImportOverlay(request));
  }

  return { openPendingSketchfabImport };
}

const websiteModelImportHandoff = createWebsiteModelImportHandoff();

function openWebsiteModelImportWhenReady() {
  if (!document.body) return;
  websiteModelImportHandoff.openPendingSketchfabImport();
}

// A protocol link opens a fresh document, while in-app routing completes during
// dashboard bootstrap. Cover both lifecycles so the handoff cannot be missed.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", openWebsiteModelImportWhenReady, { once: true });
} else {
  window.setTimeout(openWebsiteModelImportWhenReady, 0);
}
window.addEventListener("dashboard:ready", openWebsiteModelImportWhenReady);
