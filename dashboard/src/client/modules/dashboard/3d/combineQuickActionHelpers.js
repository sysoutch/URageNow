// 3D Studio "Combine" quick action: merges a model's mesh objects (all, or the chosen
// ones) into one clean mesh with a boolean union, like Blender's Bool Tool. It can split
// the objects by loose parts first, which is what one-object generated models need.
// Runs blender-scripts/combine/combine_meshes.py on the server; the result is saved as a
// new model entry and selected, the source model stays as it is.

const COMBINE_OVERLAY_ID = "model3d-combine-configuration-overlay";
const COMBINE_BUTTON_ID = "model3d-combine-button";
const COMBINE_DEFAULT_MERGE_DISTANCE = 0.0001;
const COMBINE_MAX_MERGE_DISTANCE = 0.1;
const COMBINE_MAX_MIN_PART_FACES = 100000;

const COMBINE_METHODS = [
  {
    value: "union",
    label: "Union (one clean mesh)",
    hint: "Boolean union: overlapping parts are fused and faces hidden inside other parts are removed. Best for game-ready models."
  },
  {
    value: "join",
    label: "Join (keep every face)",
    hint: "Puts all parts into one object and only welds touching vertices. Fast, but hidden inner faces stay."
  }
];

const COMBINE_SOLVERS = [
  { value: "exact", label: "Exact (robust, slower)" },
  { value: "fast", label: "Fast (can fail on flat overlaps)" },
  { value: "manifold", label: "Manifold (very fast, needs closed parts)" }
];

function createDashboardThreeDCombineQuickActionHelpers(input) {
  const request = typeof input?.request === "function" ? input.request : async () => {
    throw new Error("Dashboard request helper is not available.");
  };
  const getSelectedGeneratedModel = typeof input?.getSelectedGeneratedModel === "function" ? input.getSelectedGeneratedModel : () => null;
  const setOutput = typeof input?.setOutput === "function" ? input.setOutput : () => {};
  const setModel3dStatus = typeof input?.setModel3dStatus === "function" ? input.setModel3dStatus : () => {};
  const loadModel3dHistory = typeof input?.loadModel3dHistory === "function" ? input.loadModel3dHistory : async () => {};
  const escapeHtml = typeof input?.escapeHtml === "function"
    ? input.escapeHtml
    : value => String(value ?? "").replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
  const describeClientError = typeof input?.describeClientError === "function"
    ? input.describeClientError
    : (error, fallback) => (error instanceof Error && error.message) || fallback;
  let running = false;

  function renderOptions(items, selectedValue) {
    return items.map(item => `<option value="${escapeHtml(item.value)}"${item.value === selectedValue ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
  }

  async function loadMeshObjects(modelId) {
    try {
      const result = await request("/api/model3d-mesh-objects?modelId=" + encodeURIComponent(modelId));
      return {
        supported: result?.supported === true,
        objects: Array.isArray(result?.objects) ? result.objects : []
      };
    } catch {
      // Listing is optional: without it the user can still combine every object.
      return { supported: false, objects: [] };
    }
  }

  function renderObjectList(objects) {
    if (objects.length === 0) {
      return "<p class='hint'>This file type cannot list its objects here; every object will be combined.</p>";
    }
    return "<div class='model3d-combine-object-list' role='group' aria-label='Objects to combine'>"
      + objects.map((item, index) => {
        const triangles = typeof item.triangles === "number" ? item.triangles.toLocaleString() + " tris" : "";
        return "<label class='toggle'><span>" + escapeHtml(item.name)
          + (triangles ? " <small class='hint'>" + escapeHtml(triangles) + "</small>" : "")
          + "</span><input type='checkbox' data-combine-object='" + index + "' checked></label>";
      }).join("")
      + "</div>";
  }

  function openCombineConfigurationOverlay(selected, meshObjects) {
    document.getElementById(COMBINE_OVERLAY_ID)?.remove();
    const objects = meshObjects.objects;
    // A single object has nothing to union unless it is split into its loose parts first.
    const singleObject = meshObjects.supported && objects.length <= 1;
    const objectSummary = meshObjects.supported
      ? objects.length + " mesh object" + (objects.length === 1 ? "" : "s")
      : "unknown object count";
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.id = COMBINE_OVERLAY_ID;
      overlay.className = "runtime-overlay model3d-share-overlay model3d-combine-configuration-overlay";
      overlay.innerHTML = ""
        + "<button class='runtime-overlay-backdrop' data-combine-cancel type='button' aria-label='Cancel'></button>"
        + "<section class='runtime-overlay-panel model3d-share-overlay-panel' role='dialog' aria-modal='true' aria-labelledby='model3d-combine-title'>"
        + "<header class='runtime-overlay-header'><div class='runtime-overlay-title-wrap'><span class='panel-kicker'>3D Quick Action</span>"
        + "<h3 id='model3d-combine-title'>Combine Meshes</h3>"
        + "<p class='model3d-share-overlay-message'>Fuse the parts of <strong>" + escapeHtml(selected.modelFileName) + "</strong> (" + escapeHtml(objectSummary) + ") into one clean mesh. The result is saved as a new model; the original stays as it is.</p>"
        + "</div><button class='secondary mini-button' data-combine-cancel type='button' aria-label='Close'>✕</button></header>"
        + "<div class='model3d-share-overlay-body'>"
        + (objects.length > 1
          ? "<div class='field'><label for='model3d-combine-scope'>Objects</label><select id='model3d-combine-scope'><option value='all' selected>All objects</option><option value='chosen'>Only the chosen objects</option></select></div>"
            + "<div class='field hidden' id='model3d-combine-object-field'>" + renderObjectList(objects) + "<div class='hint'>Objects you leave out are kept unchanged in the new model.</div></div>"
          : "")
        + "<label class='toggle'><span>Separate loose parts first</span><input id='model3d-combine-separate' type='checkbox'" + (singleObject ? " checked" : "") + "></label>"
        + "<div class='hint'>" + (singleObject
          ? "This model is one object, so it is split into its connected pieces and those are fused."
          : "Split each object into its connected pieces before fusing, so overlapping pieces inside one object are cleaned up too.") + "</div>"
        + "<div class='field'><label for='model3d-combine-method'>Method</label><select id='model3d-combine-method'>" + renderOptions(COMBINE_METHODS, "union") + "</select><div class='hint' id='model3d-combine-method-hint'></div></div>"
        + "<div class='field' id='model3d-combine-solver-field'><label for='model3d-combine-solver'>Boolean Solver</label><select id='model3d-combine-solver'>" + renderOptions(COMBINE_SOLVERS, "exact") + "</select></div>"
        + "<div class='field'><label for='model3d-combine-min-faces'>Delete Parts Under (faces)</label><input id='model3d-combine-min-faces' type='number' min='0' max='" + COMBINE_MAX_MIN_PART_FACES + "' step='1' value='0'><div class='hint'>Removes tiny floating debris. 0 keeps every part.</div></div>"
        + "<div class='field'><label for='model3d-combine-merge-distance'>Weld Distance</label><input id='model3d-combine-merge-distance' type='number' min='0' max='" + COMBINE_MAX_MERGE_DISTANCE + "' step='0.0001' value='" + COMBINE_DEFAULT_MERGE_DISTANCE + "'></div>"
        + "<p class='hint' id='model3d-combine-error' role='alert'></p>"
        + "</div><div class='model3d-share-overlay-actions'><button class='secondary' data-combine-cancel type='button'>Cancel</button><button class='primary' data-combine-submit type='button'>Combine</button></div></section>";
      document.body.appendChild(overlay);

      const scope = overlay.querySelector("#model3d-combine-scope");
      const objectField = overlay.querySelector("#model3d-combine-object-field");
      const method = overlay.querySelector("#model3d-combine-method");
      const methodHint = overlay.querySelector("#model3d-combine-method-hint");
      const solverField = overlay.querySelector("#model3d-combine-solver-field");
      const errorLine = overlay.querySelector("#model3d-combine-error");

      const close = value => {
        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
        resolve(value);
      };
      const onKeyDown = event => {
        if (event.key === "Escape") {
          close(null);
        }
      };
      const syncFields = () => {
        objectField?.classList.toggle("hidden", scope?.value !== "chosen");
        methodHint.textContent = COMBINE_METHODS.find(item => item.value === method.value)?.hint || "";
        solverField.classList.toggle("hidden", method.value !== "union");
      };
      const readChosenObjectNames = () => {
        if (scope?.value !== "chosen") {
          return [];
        }
        return Array.from(overlay.querySelectorAll("[data-combine-object]"))
          .filter(box => box.checked)
          .map(box => objects[Number(box.dataset.combineObject)]?.name)
          .filter(Boolean);
      };

      scope?.addEventListener("change", syncFields);
      method.addEventListener("change", syncFields);
      document.addEventListener("keydown", onKeyDown);
      overlay.querySelectorAll("[data-combine-cancel]").forEach(node => node.addEventListener("click", () => close(null)));
      overlay.querySelector("[data-combine-submit]").addEventListener("click", () => {
        const objectNames = readChosenObjectNames();
        const separateLooseParts = overlay.querySelector("#model3d-combine-separate").checked;
        if (scope?.value === "chosen" && objectNames.length === 0) {
          errorLine.textContent = "Choose at least one object.";
          return;
        }
        if (scope?.value === "chosen" && objectNames.length === 1 && !separateLooseParts) {
          errorLine.textContent = "One object alone has nothing to combine. Choose more, or turn on Separate loose parts first.";
          return;
        }
        const minFaces = Number.parseInt(overlay.querySelector("#model3d-combine-min-faces").value, 10);
        const mergeDistance = Number.parseFloat(overlay.querySelector("#model3d-combine-merge-distance").value);
        close({
          objectNames,
          separateLooseParts,
          method: method.value,
          solver: overlay.querySelector("#model3d-combine-solver").value,
          minPartFaces: Number.isFinite(minFaces) ? Math.max(0, Math.min(COMBINE_MAX_MIN_PART_FACES, minFaces)) : 0,
          mergeDistance: Number.isFinite(mergeDistance) ? Math.max(0, Math.min(COMBINE_MAX_MERGE_DISTANCE, mergeDistance)) : COMBINE_DEFAULT_MERGE_DISTANCE
        });
      });
      syncFields();
      (scope || method).focus();
    });
  }

  function setButtonBusy(busy) {
    const button = document.getElementById(COMBINE_BUTTON_ID);
    if (!button) {
      return;
    }
    button.disabled = busy;
    button.classList.toggle("is-busy", busy);
    button.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function describeReport(report) {
    if (!report) {
      return "";
    }
    const parts = [report.parts + " part" + (report.parts === 1 ? "" : "s"), report.inputFaces.toLocaleString() + " → " + report.faces.toLocaleString() + " faces"];
    if (report.droppedParts) {
      parts.push(report.droppedParts + " tiny part(s) removed");
    }
    if (report.joinedFallbackParts) {
      parts.push(report.joinedFallbackParts + " part(s) could not be fused and were joined");
    }
    parts.push(report.nonManifoldEdges === 0 ? "watertight" : report.nonManifoldEdges.toLocaleString() + " open edges");
    return parts.join(", ");
  }

  async function runCombineForSelectedModel() {
    if (running) {
      return void setOutput("A combine is already running. Wait for it to finish.");
    }
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a model first.");
    }
    setModel3dStatus("Reading the objects of " + selected.modelFileName + "...");
    const meshObjects = await loadMeshObjects(selected.id);
    setModel3dStatus("");
    const options = await openCombineConfigurationOverlay(selected, meshObjects);
    if (!options) {
      return;
    }
    running = true;
    setButtonBusy(true);
    setModel3dStatus("Combining " + selected.modelFileName + "...");
    try {
      const result = await request("/api/model3d-combine", { modelId: selected.id, ...options });
      await loadModel3dHistory(result?.generated?.id || selected.id);
      const summary = describeReport(result?.report);
      setModel3dStatus("Combined " + selected.modelFileName + (summary ? " — " + summary : "") + ".");
      setOutput("Combined " + selected.modelFileName + " into a new model" + (summary ? " (" + summary + ")" : "") + ".");
    } catch (error) {
      const detail = describeClientError(error, "Combine failed without an error detail.");
      setModel3dStatus("Combine failed for " + selected.modelFileName + ".");
      setOutput("Failed to combine " + selected.modelFileName + ": " + detail);
    } finally {
      running = false;
      setButtonBusy(false);
    }
  }

  function bindCombineQuickAction() {
    const button = document.getElementById(COMBINE_BUTTON_ID);
    if (!button || button.dataset.combineBound === "true") {
      return;
    }
    button.dataset.combineBound = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      void runCombineForSelectedModel();
    });
  }

  return {
    runCombineForSelectedModel,
    bindCombineQuickAction
  };
}
