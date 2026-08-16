import { applyDashboardTheme, exportImagePayload, setStatus } from "./processing.js";
import { loadDashboardPayload } from "./imageLoader.js";

function postDashboardMessage(type, requestId, payload) {
  window.parent.postMessage({
    source: "urage-tool",
    type,
    requestId,
    payload: payload || {}
  }, "*");
}

export function bindDashboardBridge(elements, state) {
  if (typeof window.registerDashboardToolBridge === "function") {
    window.registerDashboardToolBridge({
      onTheme: theme => applyDashboardTheme(theme),
      onLoadAsset: payload => loadDashboardPayload(payload, elements, state).catch(error => {
        setStatus(elements, error?.message || "Failed to load dashboard image.", "error");
        throw error;
      }),
      onExportImage: () => exportImagePayload(state),
      onDescribeCurrentAsset: async () => {
        const payload = await exportImagePayload(state);
        return {
          kind: "image",
          title: "Transparency Processed Image",
          fileName: payload.fileName,
          mimeType: "image/png",
          dataUrl: payload.dataUrl,
          width: payload.width,
          height: payload.height,
          previewKind: "image",
          previewUrl: payload.dataUrl,
          sourceDetail: "Processed image from Image Transparency Tool.",
          metadata: { sourceTool: "image-transparency-tool" }
        };
      }
    });
    return;
  }
  window.addEventListener("message", event => {
    const message = event?.data || null;
    if (!message || message.source !== "urage-dashboard") {
      return;
    }
    if (message.type === "tool:theme") {
      applyDashboardTheme(message.payload?.theme);
      return;
    }
    if (message.type === "tool:load-asset") {
      void loadDashboardPayload(message.payload || {}, elements, state).catch(error => {
        setStatus(elements, error?.message || "Failed to load dashboard image.", "error");
      });
      return;
    }
    if (message.type === "tool:request-export-image") {
      void exportImagePayload(state)
        .then(payload => {
          postDashboardMessage("tool:export-image", message.requestId, payload);
        })
        .catch(error => {
          postDashboardMessage("tool:error", message.requestId, {
            error: error?.message || "Transparency export failed."
          });
        });
    }
  });
}
