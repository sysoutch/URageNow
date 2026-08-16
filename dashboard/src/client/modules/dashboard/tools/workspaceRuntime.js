const dashboardToolsWorkspaceRuntime = {
  state: {},
  toolsWorkspaceState: {},
  toolsWorkspaceStorageKeys: {},
  toolQuickActionState: {},
  toolQuickActionStorageKeys: {},
  pixelArtConversionRequests: new Map(),
  toolWorkspaceImageExportRequests: new Map(),
  pixelArtReadyWaiters: [],
  clearChildren(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  },
  setOutput() {},
  request() {
    return Promise.reject(new Error("Dashboard request helper is not ready."));
  },
  buildAbsoluteDashboardUrl(value) {
    return String(value || "");
  },
  getGeneratedImageFileUrl() {
    return "";
  },
  getGeneratedVideoFileUrl() {
    return "";
  },
  getModel3dFileUrl() {
    return "";
  },
  getSelectedGeneratedImage() {
    return null;
  },
  getSelectedGeneratedModel() {
    return null;
  },
  getSelectedGeneratedVideo() {
    return null;
  },
  getModel3dViewerTarget() {
    return null;
  },
  resolveModel3dPreviewMedia() {
    return null;
  },
  loadImageHistory() {
    return Promise.resolve();
  },
  refreshState() {
    return Promise.resolve();
  },
  switchView() {
    return undefined;
  }
};
function configureDashboardToolsWorkspaceRuntime(input) {
  const next = input && typeof input === "object" ? input : {};
  Object.assign(dashboardToolsWorkspaceRuntime, {
    state: next.state || dashboardToolsWorkspaceRuntime.state,
    toolsWorkspaceState: next.toolsWorkspaceState || dashboardToolsWorkspaceRuntime.toolsWorkspaceState,
    toolsWorkspaceStorageKeys: next.toolsWorkspaceStorageKeys || dashboardToolsWorkspaceRuntime.toolsWorkspaceStorageKeys,
    toolQuickActionState: next.toolQuickActionState || dashboardToolsWorkspaceRuntime.toolQuickActionState,
    toolQuickActionStorageKeys: next.toolQuickActionStorageKeys || dashboardToolsWorkspaceRuntime.toolQuickActionStorageKeys,
    pixelArtConversionRequests: next.pixelArtConversionRequests instanceof Map ? next.pixelArtConversionRequests : dashboardToolsWorkspaceRuntime.pixelArtConversionRequests,
    toolWorkspaceImageExportRequests: next.toolWorkspaceImageExportRequests instanceof Map ? next.toolWorkspaceImageExportRequests : dashboardToolsWorkspaceRuntime.toolWorkspaceImageExportRequests,
    pixelArtReadyWaiters: Array.isArray(next.pixelArtReadyWaiters) ? next.pixelArtReadyWaiters : dashboardToolsWorkspaceRuntime.pixelArtReadyWaiters,
    clearChildren: typeof next.clearChildren === "function" ? next.clearChildren : dashboardToolsWorkspaceRuntime.clearChildren,
    setOutput: typeof next.setOutput === "function" ? next.setOutput : dashboardToolsWorkspaceRuntime.setOutput,
    request: typeof next.request === "function" ? next.request : dashboardToolsWorkspaceRuntime.request,
    buildAbsoluteDashboardUrl: typeof next.buildAbsoluteDashboardUrl === "function" ? next.buildAbsoluteDashboardUrl : dashboardToolsWorkspaceRuntime.buildAbsoluteDashboardUrl,
    getGeneratedImageFileUrl: typeof next.getGeneratedImageFileUrl === "function" ? next.getGeneratedImageFileUrl : dashboardToolsWorkspaceRuntime.getGeneratedImageFileUrl,
    getGeneratedVideoFileUrl: typeof next.getGeneratedVideoFileUrl === "function" ? next.getGeneratedVideoFileUrl : dashboardToolsWorkspaceRuntime.getGeneratedVideoFileUrl,
    getModel3dFileUrl: typeof next.getModel3dFileUrl === "function" ? next.getModel3dFileUrl : dashboardToolsWorkspaceRuntime.getModel3dFileUrl,
    getSelectedGeneratedImage: typeof next.getSelectedGeneratedImage === "function" ? next.getSelectedGeneratedImage : dashboardToolsWorkspaceRuntime.getSelectedGeneratedImage,
    getSelectedGeneratedModel: typeof next.getSelectedGeneratedModel === "function" ? next.getSelectedGeneratedModel : dashboardToolsWorkspaceRuntime.getSelectedGeneratedModel,
    getSelectedGeneratedVideo: typeof next.getSelectedGeneratedVideo === "function" ? next.getSelectedGeneratedVideo : dashboardToolsWorkspaceRuntime.getSelectedGeneratedVideo,
    getModel3dViewerTarget: typeof next.getModel3dViewerTarget === "function" ? next.getModel3dViewerTarget : dashboardToolsWorkspaceRuntime.getModel3dViewerTarget,
    resolveModel3dPreviewMedia: typeof next.resolveModel3dPreviewMedia === "function" ? next.resolveModel3dPreviewMedia : dashboardToolsWorkspaceRuntime.resolveModel3dPreviewMedia,
    loadImageHistory: typeof next.loadImageHistory === "function" ? next.loadImageHistory : dashboardToolsWorkspaceRuntime.loadImageHistory,
    refreshState: typeof next.refreshState === "function" ? next.refreshState : dashboardToolsWorkspaceRuntime.refreshState,
    switchView: typeof next.switchView === "function" ? next.switchView : dashboardToolsWorkspaceRuntime.switchView
  });
}
const state = new Proxy({}, {
  get(_target, property) {
    return dashboardToolsWorkspaceRuntime.state?.[property];
  },
  set(_target, property, value) {
    if (dashboardToolsWorkspaceRuntime.state) dashboardToolsWorkspaceRuntime.state[property] = value;
    return true;
  }
});
const toolsWorkspaceState = new Proxy({}, {
  get(_target, property) {
    return dashboardToolsWorkspaceRuntime.toolsWorkspaceState?.[property];
  },
  set(_target, property, value) {
    if (dashboardToolsWorkspaceRuntime.toolsWorkspaceState) dashboardToolsWorkspaceRuntime.toolsWorkspaceState[property] = value;
    return true;
  }
});
const toolsWorkspaceStorageKeys = new Proxy({}, {
  get(_target, property) {
    return dashboardToolsWorkspaceRuntime.toolsWorkspaceStorageKeys?.[property];
  }
});
const toolQuickActionState = new Proxy({}, {
  get(_target, property) {
    return dashboardToolsWorkspaceRuntime.toolQuickActionState?.[property];
  },
  set(_target, property, value) {
    if (dashboardToolsWorkspaceRuntime.toolQuickActionState) dashboardToolsWorkspaceRuntime.toolQuickActionState[property] = value;
    return true;
  }
});
const toolQuickActionStorageKeys = new Proxy({}, {
  get(_target, property) {
    return dashboardToolsWorkspaceRuntime.toolQuickActionStorageKeys?.[property];
  }
});
const pixelArtConversionRequests = {
  get(key) {
    return dashboardToolsWorkspaceRuntime.pixelArtConversionRequests.get(key);
  },
  set(key, value) {
    return dashboardToolsWorkspaceRuntime.pixelArtConversionRequests.set(key, value);
  },
  delete(key) {
    return dashboardToolsWorkspaceRuntime.pixelArtConversionRequests.delete(key);
  }
};
const toolWorkspaceImageExportRequests = {
  get(key) {
    return dashboardToolsWorkspaceRuntime.toolWorkspaceImageExportRequests.get(key);
  },
  set(key, value) {
    return dashboardToolsWorkspaceRuntime.toolWorkspaceImageExportRequests.set(key, value);
  },
  delete(key) {
    return dashboardToolsWorkspaceRuntime.toolWorkspaceImageExportRequests.delete(key);
  }
};
const pixelArtReadyWaiters = new Proxy([], {
  get(_target, property) {
    const waiters = dashboardToolsWorkspaceRuntime.pixelArtReadyWaiters;
    const value = waiters[property];
    return typeof value === "function" ? value.bind(waiters) : value;
  },
  set(_target, property, value) {
    dashboardToolsWorkspaceRuntime.pixelArtReadyWaiters[property] = value;
    return true;
  }
});
function clearChildren(node) {
  return dashboardToolsWorkspaceRuntime.clearChildren(node);
}
function setOutput(...args) {
  return dashboardToolsWorkspaceRuntime.setOutput(...args);
}
function setStatus(text) {
  const statusNode = document.getElementById("tools-workspace-status");
  if (statusNode) {
    statusNode.textContent = String(text || "");
  }
}
function request(...args) {
  return dashboardToolsWorkspaceRuntime.request(...args);
}
function buildAbsoluteDashboardUrl(...args) {
  return dashboardToolsWorkspaceRuntime.buildAbsoluteDashboardUrl(...args);
}
function getGeneratedImageFileUrl(...args) {
  return dashboardToolsWorkspaceRuntime.getGeneratedImageFileUrl(...args);
}
function getGeneratedVideoFileUrl(...args) {
  return dashboardToolsWorkspaceRuntime.getGeneratedVideoFileUrl(...args);
}
function getModel3dFileUrl(...args) {
  return dashboardToolsWorkspaceRuntime.getModel3dFileUrl(...args);
}
function getSelectedGeneratedImage(...args) {
  return dashboardToolsWorkspaceRuntime.getSelectedGeneratedImage(...args);
}
function getSelectedGeneratedModel(...args) {
  return dashboardToolsWorkspaceRuntime.getSelectedGeneratedModel(...args);
}
function getSelectedGeneratedVideo(...args) {
  return dashboardToolsWorkspaceRuntime.getSelectedGeneratedVideo(...args);
}
function getModel3dViewerTarget(...args) {
  return dashboardToolsWorkspaceRuntime.getModel3dViewerTarget(...args);
}
function resolveModel3dPreviewMedia(...args) {
  return dashboardToolsWorkspaceRuntime.resolveModel3dPreviewMedia(...args);
}
function loadImageHistory(...args) {
  return dashboardToolsWorkspaceRuntime.loadImageHistory(...args);
}
function refreshState(...args) {
  return dashboardToolsWorkspaceRuntime.refreshState(...args);
}
function switchView(...args) {
  return dashboardToolsWorkspaceRuntime.switchView(...args);
}
