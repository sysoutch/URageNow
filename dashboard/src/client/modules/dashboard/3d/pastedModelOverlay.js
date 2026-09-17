function createDashboardPastedModelOverlay(input) {
  const isModel = file => file && /\.(glb|gltf|fbx|obj|stl|3mf|ply)$/i.test(String(file.name || ""));
  let root;
  let pendingFiles = [];
  let importInProgress = false;
  let syncSelectedAction = () => {};

  function close() {
    root?.classList.add("hidden");
    pendingFiles = [];
  }

  function show(files) {
    pendingFiles = Array.from(files || []).filter(isModel);
    if (!pendingFiles.length) return false;
    if (!root) {
      root = document.createElement("div");
      root.className = "pasted-image-overlay pasted-model-overlay hidden";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-labelledby", "pasted-model-overlay-title");
      root.innerHTML = `<div class="pasted-image-panel pasted-model-panel"><div class="pasted-image-head"><div><span class="pasted-model-kicker">Clipboard import</span><h4 id="pasted-model-overlay-title">Pasted 3D models</h4></div><button class="pasted-image-close" type="button" data-action="close" aria-label="Cancel pasted model action">&times;</button></div><div class="pasted-image-body"><div class="pasted-model-preview"><i class="bi bi-box-seam" aria-hidden="true"></i><span>3D models</span></div><p class="hint pasted-image-hint"></p><div class="pasted-model-options" role="radiogroup" aria-label="Choose how to use the pasted models"><label class="pasted-model-option is-selected"><input type="radio" name="pasted-model-action" value="source" checked><span class="pasted-model-option-icon" aria-hidden="true"><i class="bi bi-pencil-square"></i></span><span class="pasted-model-option-copy"><strong>Use as edit sources</strong><small>Add the files to 3D Studio's upload queue.</small></span><span class="pasted-model-option-check" aria-hidden="true"><i class="bi bi-check"></i></span></label><label class="pasted-model-option"><input type="radio" name="pasted-model-action" value="import"><span class="pasted-model-option-icon" aria-hidden="true"><i class="bi bi-collection"></i></span><span class="pasted-model-option-copy"><strong>Import to Recent models</strong><small>Store the files in the dashboard's model history.</small></span><span class="pasted-model-option-check" aria-hidden="true"><i class="bi bi-check"></i></span></label></div><div class="hint pasted-image-status hidden"></div></div><div class="pasted-image-foot"><button class="secondary" type="button" data-action="cancel">Cancel</button><button class="pasted-model-confirm" type="button" data-action="confirm">Use as edit sources</button></div></div>`;
      root.querySelector('[data-action="cancel"]')?.addEventListener("click", close);
      root.querySelector('[data-action="close"]')?.addEventListener("click", close);
      syncSelectedAction = () => {
        const selectedAction = root.querySelector('input[name="pasted-model-action"]:checked')?.value || "source";
        root.querySelectorAll(".pasted-model-option").forEach(option => {
          option.classList.toggle("is-selected", option.querySelector("input")?.value === selectedAction);
        });
        const confirm = root.querySelector('[data-action="confirm"]');
        if (confirm) {
          confirm.disabled = importInProgress;
          confirm.textContent = importInProgress ? "Importing..." : (selectedAction === "import" ? "Import models" : "Use as edit sources");
        }
      };
      root.querySelectorAll('input[name="pasted-model-action"]').forEach(radio => radio.addEventListener("change", syncSelectedAction));
      syncSelectedAction();
      root.addEventListener("click", event => {
        if (event.target === root) close();
      });
      root.querySelector('[data-action="confirm"]')?.addEventListener("click", async () => {
        const action = root.querySelector('input[name="pasted-model-action"]:checked')?.value || "source";
        if (importInProgress) return;
        const status = root.querySelector(".pasted-image-status");
        const filesToProcess = pendingFiles.slice();
        if (action === "import") {
          importInProgress = true;
          syncSelectedAction();
        }
        try {
          if (action === "source") {
            input.onUseAsSource(filesToProcess);
            input.setOutput(`Used ${filesToProcess.length} pasted 3D model${filesToProcess.length === 1 ? "" : "s"} as uploaded edit sources.`);
          } else {
            for (const file of filesToProcess) {
              await input.request("/api/model3d-import", { dataUrl: await input.readFileAsDataUrl(file), fileName: file.name });
            }
            await input.onImported();
            input.setOutput(`Imported ${filesToProcess.length} pasted 3D model${filesToProcess.length === 1 ? "" : "s"} into Recent 3D Models.`);
          }
          close();
        } catch (error) {
          status.textContent = "Model paste failed: " + (error?.message || "Unknown error");
          status.classList.remove("hidden");
        } finally {
          importInProgress = false;
          if (!root.classList.contains("hidden")) syncSelectedAction();
        }
      });
      document.body.appendChild(root);
    }
    importInProgress = false;
    syncSelectedAction();
    root.querySelector(".pasted-image-hint").textContent = pendingFiles.length === 1 ? `1 model pasted from the clipboard: ${pendingFiles[0].name}` : `${pendingFiles.length} models pasted from the clipboard.`;
    root.classList.remove("hidden");
    return true;
  }

  return { show, close };
}
