function createDashboardImageLayeredWorkflowPreflight(dependencies) {
  const { getWorkflowPath, request } = dependencies;
  let refreshToken = 0;

  function setStatus(state, text) {
    const statusNode = document.getElementById("image-quick-action-preflight");
    if (!statusNode) {
      return;
    }
    const isVisible = state !== "hidden";
    statusNode.classList.toggle("hidden", !isVisible);
    statusNode.dataset.state = isVisible ? state : "";
    statusNode.textContent = text;
    const runButton = document.getElementById("image-quick-action-run-button");
    if (runButton) {
      runButton.disabled = state === "checking" || state === "blocked";
    }
  }

  async function getFailure() {
    const workflowPath = getWorkflowPath();
    const query = workflowPath ? "?workflowPath=" + encodeURIComponent(workflowPath) : "";
    const metadata = await request("/api/image-workflow-metadata" + query);
    if (metadata?.usesSubgraphs === true) {
      return "Image Layers needs an API-format or flattened ComfyUI workflow. Export the configured layered workflow in API format before running it.";
    }
    const preflight = await request("/api/image-workflow-preflight" + query);
    if (preflight?.status === "not-configured") {
      return "Image Layers needs a reachable ComfyUI image server. Set the ComfyUI image URL before running it.";
    }
    if (preflight?.status === "unavailable") {
      return "Image Layers could not reach the configured ComfyUI image server. Check its URL and that ComfyUI is running.";
    }
    if (Array.isArray(preflight?.missingNodeTypes) && preflight.missingNodeTypes.length > 0) {
      return "Image Layers is missing ComfyUI nodes: " + preflight.missingNodeTypes.join(", ") + ". Install the matching custom nodes, then restart ComfyUI.";
    }
    if (Array.isArray(preflight?.missingModelFiles) && preflight.missingModelFiles.length > 0) {
      return "Image Layers is missing ComfyUI model files: " + preflight.missingModelFiles.join(", ") + ". Install them in the matching ComfyUI model folders, then restart ComfyUI.";
    }
    return "";
  }

  async function refresh(isCurrent = () => true) {
    const token = ++refreshToken;
    setStatus("checking", "Checking workflow and ComfyUI readiness...");
    try {
      const failure = await getFailure();
      if (token !== refreshToken || !isCurrent()) {
        return;
      }
      setStatus(failure ? "blocked" : "ready", failure || "Workflow and ComfyUI are ready for layer separation.");
    } catch (error) {
      if (token !== refreshToken || !isCurrent()) {
        return;
      }
      const detail = error?.message || "Unknown error";
      setStatus("blocked", "Image Layers preflight failed: " + detail);
    }
  }

  function cancel() {
    refreshToken += 1;
  }

  function hide() {
    cancel();
    setStatus("hidden", "");
  }

  return { cancel, getFailure, hide, refresh, setStatus };
}
