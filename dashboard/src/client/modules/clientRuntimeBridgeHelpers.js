function resolveRequiredRuntime(getter, message) {
  const value = typeof getter === "function" ? getter() : null;
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function resolveOptionalRuntime(getter) {
  return typeof getter === "function" ? getter() : null;
}

function resolveBrowserDocument() {
  if (typeof document !== "undefined") {
    return document;
  }
  return null;
}

function normalizeBridgeInput(input) {
  return input && typeof input === "object" ? input : {};
}

function createDashboardClientRuntimeBridgeHelpers(input) {
  const normalizedInput = normalizeBridgeInput(input);
  const getSettingsRuntimeHelpers = normalizedInput.getSettingsRuntimeHelpers;
  const getGuildChannelRuntimeHelpers = normalizedInput.getGuildChannelRuntimeHelpers;
  const getSwitchView = normalizedInput.getSwitchView;
  const getConsoleHelpers = normalizedInput.getConsoleHelpers;
  return {
    request(path, body) {
      const runtimeHelpers = resolveRequiredRuntime(
        getSettingsRuntimeHelpers,
        "Dashboard settings runtime helpers are not ready."
      );
      return runtimeHelpers.request(path, body);
    },
    getDashboardGuildChannelRuntimeHelpers() {
      return resolveRequiredRuntime(
        getGuildChannelRuntimeHelpers,
        "Dashboard guild/channel runtime helpers are not ready."
      );
    },
    setDashboardText(id, value) {
      const browserDocument = resolveBrowserDocument();
      if (!browserDocument) {
        return;
      }
      const node = browserDocument.getElementById(id);
      if (node) {
        node.textContent = value;
      }
    },
    switchDashboardView(view) {
      const switchView = resolveRequiredRuntime(getSwitchView, "Dashboard view switching is not ready.");
      return switchView(view);
    },
    setConsoleOverlayOpen(isOpen) {
      resolveOptionalRuntime(getConsoleHelpers)?.setConsoleOverlayOpen(isOpen);
    }
  };
}

