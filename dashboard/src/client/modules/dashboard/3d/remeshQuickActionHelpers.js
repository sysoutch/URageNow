// 3D Studio "Remesh" quick action: asks for a method and face budget, runs Blender on
// the server, and selects the new remeshed model entry when it is ready.
// The source model is never changed; the result is saved as its own model.

const REMESH_OVERLAY_ID = "model3d-remesh-configuration-overlay";
const REMESH_BUTTON_ID = "model3d-remesh-button";
const REMESH_DEFAULT_TARGET_FACES = 5000;
const REMESH_MIN_TARGET_FACES = 100;
const REMESH_MAX_TARGET_FACES = 200000;

const REMESH_METHODS = [
  {
    value: "quadriflow",
    label: "QuadriFlow (clean quads)",
    hint: "Built into Blender, runs in the background. Clean, even quads; best for characters and organic shapes."
  },
  {
    value: "voxel",
    label: "Voxel (robust)",
    hint: "Built into Blender, runs in the background. Handles broken or non-manifold meshes; face count is approximate."
  },
  {
    value: "quadremesher",
    label: "Quad Remesher (add-on)",
    hint: "Needs the Exoside Quad Remesher add-on. Opens a Blender window while it works, then closes it."
  }
];

const REMESH_FACE_PRESETS = [
  { value: 1500, label: "Mobile — 1,500 faces" },
  { value: 5000, label: "Game asset — 5,000 faces" },
  { value: 15000, label: "Hero asset — 15,000 faces" },
  { value: 40000, label: "Detailed — 40,000 faces" }
];

const REMESH_TEXTURE_SIZES = [1024, 2048, 4096];
const REMESH_DEFAULT_TEXTURE_SIZE = 2048;

function createDashboardThreeDRemeshQuickActionHelpers(input) {
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
    return items.map(item => {
      const value = typeof item === "object" ? item.value : item;
      const label = typeof item === "object" ? item.label : String(item);
      return `<option value="${escapeHtml(value)}"${String(value) === String(selectedValue) ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function openRemeshConfigurationOverlay(selected) {
    document.getElementById(REMESH_OVERLAY_ID)?.remove();
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.id = REMESH_OVERLAY_ID;
      overlay.className = "runtime-overlay model3d-share-overlay model3d-remesh-configuration-overlay";
      overlay.innerHTML = ""
        + "<button class='runtime-overlay-backdrop' data-remesh-cancel type='button' aria-label='Cancel'></button>"
        + "<section class='runtime-overlay-panel model3d-share-overlay-panel model3d-remesh-configuration-panel' role='dialog' aria-modal='true' aria-labelledby='model3d-remesh-title'>"
        + "<header class='runtime-overlay-header'><div class='runtime-overlay-title-wrap'><span class='panel-kicker'>3D Quick Action</span>"
        + "<h3 id='model3d-remesh-title'>Remesh</h3>"
        + "<p class='model3d-share-overlay-message'>Rebuild <strong>" + escapeHtml(selected.modelFileName) + "</strong> as a clean, lighter mesh and bake its look onto it. The result is saved as a new model; the original stays as it is.</p>"
        + "</div><button class='secondary mini-button' data-remesh-cancel type='button' aria-label='Close'>✕</button></header>"
        + "<div class='model3d-share-overlay-body model3d-remesh-configuration-body'>"
        + "<div class='field'><label for='model3d-remesh-method'>Method</label><select id='model3d-remesh-method'>" + renderOptions(REMESH_METHODS, "quadriflow") + "</select><div class='hint' id='model3d-remesh-method-hint'></div></div>"
        + "<div class='field'><label for='model3d-remesh-preset'>Face Budget</label><select id='model3d-remesh-preset'>" + renderOptions([...REMESH_FACE_PRESETS, { value: "custom", label: "Custom value" }], REMESH_DEFAULT_TARGET_FACES) + "</select></div>"
        + "<div class='field hidden' id='model3d-remesh-custom-field'><label for='model3d-remesh-target'>Custom Faces</label><input id='model3d-remesh-target' type='number' min='" + REMESH_MIN_TARGET_FACES + "' max='" + REMESH_MAX_TARGET_FACES + "' step='100' value='" + REMESH_DEFAULT_TARGET_FACES + "'></div>"
        + "<div class='field'><label for='model3d-remesh-texture-size'>Baked Texture Size</label><select id='model3d-remesh-texture-size'>" + renderOptions(REMESH_TEXTURE_SIZES.map(size => ({ value: size, label: size + " × " + size })), REMESH_DEFAULT_TEXTURE_SIZE) + "</select></div>"
        + "<label class='toggle'><span>Bake original colors</span><input id='model3d-remesh-bake' type='checkbox' checked></label>"
        + "<label class='toggle'><span>Bake normal map (keeps surface detail)</span><input id='model3d-remesh-bake-normal' type='checkbox' checked></label>"
        + "<label class='toggle'><span>Keep sharp edges</span><input id='model3d-remesh-sharp' type='checkbox' checked></label>"
        + "<label class='toggle'><span>Mirror symmetry (X)</span><input id='model3d-remesh-symmetry' type='checkbox'></label>"
        + "</div><div class='model3d-share-overlay-actions'><button class='secondary' data-remesh-cancel type='button'>Cancel</button><button class='primary' data-remesh-submit type='button'>Remesh</button></div></section>";
      document.body.appendChild(overlay);

      const method = overlay.querySelector("#model3d-remesh-method");
      const methodHint = overlay.querySelector("#model3d-remesh-method-hint");
      const preset = overlay.querySelector("#model3d-remesh-preset");
      const customField = overlay.querySelector("#model3d-remesh-custom-field");
      const bake = overlay.querySelector("#model3d-remesh-bake");
      const bakeNormal = overlay.querySelector("#model3d-remesh-bake-normal");
      const textureSize = overlay.querySelector("#model3d-remesh-texture-size");

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
        methodHint.textContent = REMESH_METHODS.find(item => item.value === method.value)?.hint || "";
        customField.classList.toggle("hidden", preset.value !== "custom");
        bakeNormal.disabled = !bake.checked;
        textureSize.disabled = !bake.checked;
      };

      method.addEventListener("change", syncFields);
      preset.addEventListener("change", syncFields);
      bake.addEventListener("change", syncFields);
      document.addEventListener("keydown", onKeyDown);
      overlay.querySelectorAll("[data-remesh-cancel]").forEach(node => node.addEventListener("click", () => close(null)));
      overlay.querySelector("[data-remesh-submit]").addEventListener("click", () => {
        const rawFaces = preset.value === "custom" ? overlay.querySelector("#model3d-remesh-target").value : preset.value;
        const parsedFaces = Number.parseInt(rawFaces, 10);
        const targetFaces = Math.max(REMESH_MIN_TARGET_FACES, Math.min(REMESH_MAX_TARGET_FACES, Number.isFinite(parsedFaces) ? parsedFaces : REMESH_DEFAULT_TARGET_FACES));
        close({
          method: method.value,
          targetFaces,
          bakeTextures: bake.checked,
          bakeNormal: bake.checked && bakeNormal.checked,
          textureSize: Number.parseInt(textureSize.value, 10) || REMESH_DEFAULT_TEXTURE_SIZE,
          preserveSharp: overlay.querySelector("#model3d-remesh-sharp").checked,
          symmetryX: overlay.querySelector("#model3d-remesh-symmetry").checked
        });
      });
      syncFields();
      method.focus();
    });
  }

  function setButtonBusy(busy) {
    const button = document.getElementById(REMESH_BUTTON_ID);
    if (!button) {
      return;
    }
    button.disabled = busy;
    button.classList.toggle("is-busy", busy);
    button.setAttribute("aria-busy", busy ? "true" : "false");
  }

  async function runRemeshForSelectedModel() {
    if (running) {
      return void setOutput("A remesh is already running. Wait for it to finish.");
    }
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a model first.");
    }
    const options = await openRemeshConfigurationOverlay(selected);
    if (!options) {
      return;
    }
    running = true;
    setButtonBusy(true);
    const methodLabel = REMESH_METHODS.find(item => item.value === options.method)?.label || options.method;
    setModel3dStatus("Remeshing " + selected.modelFileName + " with " + methodLabel + "...");
    try {
      const result = await request("/api/model3d-remesh", { modelId: selected.id, ...options });
      const newId = result?.generated?.id;
      await loadModel3dHistory(newId || selected.id);
      const faces = typeof result?.faceCount === "number" ? result.faceCount.toLocaleString() : "?";
      setModel3dStatus("Remeshed " + selected.modelFileName + " — " + faces + " faces.");
      setOutput("Remeshed " + selected.modelFileName + " with " + methodLabel + " into a new model (" + faces + " faces, target " + options.targetFaces.toLocaleString() + ").");
    } catch (error) {
      const detail = describeClientError(error, "Remesh failed without an error detail.");
      setModel3dStatus("Remesh failed for " + selected.modelFileName + ".");
      setOutput("Failed to remesh " + selected.modelFileName + ": " + detail);
    } finally {
      running = false;
      setButtonBusy(false);
    }
  }

  function bindRemeshQuickAction() {
    const button = document.getElementById(REMESH_BUTTON_ID);
    if (!button || button.dataset.remeshBound === "true") {
      return;
    }
    button.dataset.remeshBound = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      void runRemeshForSelectedModel();
    });
  }

  return {
    runRemeshForSelectedModel,
    bindRemeshQuickAction
  };
}
