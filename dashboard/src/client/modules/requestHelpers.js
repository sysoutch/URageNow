function createDashboardRequestId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

async function stopDashboardRequest(requestId) {
  const normalizedRequestId = String(requestId || "").trim();
  if (!normalizedRequestId) {
    return;
  }
  await fetch("/api/dashboard-request-stop", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ requestId: normalizedRequestId })
  }).catch(() => {});
}

function createDashboardKeyedRequestController(input) {
  const toggleBusy = input && typeof input.toggleBusy === "function" ? input.toggleBusy : function toggleBusyFallback() {};
  const activeRequestIds = new Map();
  return {
    get(kind) {
      return activeRequestIds.get(kind) || "";
    },
    start(kind, prefix) {
      const requestId = createDashboardRequestId(prefix || kind);
      activeRequestIds.set(kind, requestId);
      toggleBusy(kind, true);
      return requestId;
    },
    finish(kind, requestId) {
      if (activeRequestIds.get(kind) !== requestId) {
        return false;
      }
      activeRequestIds.delete(kind);
      toggleBusy(kind, false);
      return true;
    },
    async stop(kind) {
      const requestId = activeRequestIds.get(kind) || "";
      if (!requestId) {
        return false;
      }
      await stopDashboardRequest(requestId);
      return true;
    }
  };
}

function createDashboardSingleRequestController(input) {
  const prefix = String(input && input.prefix ? input.prefix : "request").trim() || "request";
  const toggleBusy = input && typeof input.toggleBusy === "function" ? input.toggleBusy : function toggleBusyFallback() {};
  let activeRequestId = "";
  return {
    get() {
      return activeRequestId;
    },
    start() {
      activeRequestId = createDashboardRequestId(prefix);
      toggleBusy(true);
      return activeRequestId;
    },
    finish(requestId) {
      if (activeRequestId !== requestId) {
        return false;
      }
      activeRequestId = "";
      toggleBusy(false);
      return true;
    },
    async stop() {
      if (!activeRequestId) {
        return false;
      }
      await stopDashboardRequest(activeRequestId);
      return true;
    }
  };
}
