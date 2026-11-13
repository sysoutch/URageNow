// 3D Studio "Bake" quick action: bakes a model's look into one clean PBR texture set.
// Source is either the model's own materials (flatten) or another, usually high-poly,
// model baked onto this one. Engine is Blender's built-in Cycles baker or BakeLab2.
// The result is saved as a new model entry; the selected model is never changed.

const BAKE_OVERLAY_ID = "model3d-bake-configuration-overlay";
const BAKE_BUTTON_ID = "model3d-bake-button";
const BAKE_SELF_SOURCE = "";

const BAKE_ENGINES = [
  { value: "builtin", label: "Built-in (Cycles)", hint: "Blender's own baker, runs in the background. Bakes every map type." },
  { value: "bakelab", label: "BakeLab2 add-on", hint: "Uses the BakeLab2 add-on. Opens a Blender window while it bakes. No metallic map." }
];

const BAKE_MAPS = [
  { value: "albedo", label: "Albedo (base color)", checked: true },
  { value: "normal", label: "Normal", checked: true },
  { value: "roughness", label: "Roughness", checked: false },
  { value: "metallic", label: "Metallic (built-in only)", checked: false },
  { value: "ao", label: "Ambient occlusion (multiplied into albedo)", checked: false },
  { value: "emission", label: "Emission", checked: false }
];

const BAKE_TEXTURE_SIZES = [1024, 2048, 4096];
const BAKE_DEFAULT_TEXTURE_SIZE = 2048;
const BAKE_SOURCE_LIST_LIMIT = 60;

function createDashboardThreeDBakeQuickActionHelpers(input) {
  const state = input?.state || {};
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
    return items.map(item => "<option value='" + escapeHtml(item.value) + "'" + (String(item.value) === String(selectedValue) ? " selected" : "") + ">" + escapeHtml(item.label) + "</option>").join("");
  }

  function sourceModelOptions(selected) {
    const others = (Array.isArray(state.generatedModels) ? state.generatedModels : [])
      .filter(model => model && model.id !== selected.id)
      .slice(0, BAKE_SOURCE_LIST_LIMIT)
      .map(model => ({ value: model.id, label: "Bake from: " + (model.modelFileName || model.id) }));
    return [{ value: BAKE_SELF_SOURCE, label: "This model's own materials (flatten)" }, ...others];
  }

  function openBakeConfigurationOverlay(selected) {
    document.getElementById(BAKE_OVERLAY_ID)?.remove();
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.id = BAKE_OVERLAY_ID;
      overlay.className = "runtime-overlay model3d-share-overlay model3d-bake-configuration-overlay";
      overlay.innerHTML = ""
        + "<button class='runtime-overlay-backdrop' data-bake-cancel type='button' aria-label='Cancel'></button>"
        + "<section class='runtime-overlay-panel model3d-share-overlay-panel' role='dialog' aria-modal='true' aria-labelledby='model3d-bake-title'>"
        + "<header class='runtime-overlay-header'><div class='runtime-overlay-title-wrap'><span class='panel-kicker'>3D Quick Action</span>"
        + "<h3 id='model3d-bake-title'>Bake Textures</h3>"
        + "<p class='model3d-share-overlay-message'>Bake into one clean PBR texture set for <strong>" + escapeHtml(selected.modelFileName) + "</strong>. The result is saved as a new model.</p>"
        + "</div><button class='secondary mini-button' data-bake-cancel type='button' aria-label='Close'>✕</button></header>"
        + "<div class='model3d-share-overlay-body'>"
        + "<div class='field'><label for='model3d-bake-source'>Source</label><select id='model3d-bake-source'>" + renderOptions(sourceModelOptions(selected), BAKE_SELF_SOURCE) + "</select>"
        + "<div class='hint'>Pick another model to bake its detail onto this one (e.g. high-poly onto a remeshed or low-poly copy).</div></div>"
        + "<div class='field'><label for='model3d-bake-engine'>Bake With</label><select id='model3d-bake-engine'>" + renderOptions(BAKE_ENGINES, "builtin") + "</select><div class='hint' id='model3d-bake-engine-hint'></div></div>"
        + "<fieldset class='field model3d-bake-maps'><legend>Maps</legend>"
        + BAKE_MAPS.map(map => "<label class='toggle'><span>" + escapeHtml(map.label) + "</span><input type='checkbox' data-bake-map='" + map.value + "'" + (map.checked ? " checked" : "") + "></label>").join("")
        + "</fieldset>"
        + "<div class='field'><label for='model3d-bake-texture-size'>Texture Size</label><select id='model3d-bake-texture-size'>" + renderOptions(BAKE_TEXTURE_SIZES.map(size => ({ value: size, label: size + " × " + size })), BAKE_DEFAULT_TEXTURE_SIZE) + "</select></div>"
        + "<label class='toggle'><span>New UV unwrap (recommended for generated models)</span><input id='model3d-bake-new-uvs' type='checkbox' checked></label>"
        + "</div><div class='model3d-share-overlay-actions'><button class='secondary' data-bake-cancel type='button'>Cancel</button><button class='primary' data-bake-submit type='button'>Bake</button></div></section>";
      document.body.appendChild(overlay);

      const engine = overlay.querySelector("#model3d-bake-engine");
      const engineHint = overlay.querySelector("#model3d-bake-engine-hint");
      const metallic = overlay.querySelector("[data-bake-map='metallic']");
      const submit = overlay.querySelector("[data-bake-submit]");
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
      const checkedMaps = () => [...overlay.querySelectorAll("[data-bake-map]")].filter(box => box.checked && !box.disabled).map(box => box.dataset.bakeMap);
      const syncFields = () => {
        engineHint.textContent = BAKE_ENGINES.find(item => item.value === engine.value)?.hint || "";
        // BakeLab has no metallic pass.
        metallic.disabled = engine.value === "bakelab";
        submit.disabled = checkedMaps().length === 0;
      };

      engine.addEventListener("change", syncFields);
      overlay.querySelectorAll("[data-bake-map]").forEach(box => box.addEventListener("change", syncFields));
      document.addEventListener("keydown", onKeyDown);
      overlay.querySelectorAll("[data-bake-cancel]").forEach(node => node.addEventListener("click", () => close(null)));
      submit.addEventListener("click", () => {
        const sourceModelId = overlay.querySelector("#model3d-bake-source").value || undefined;
        close({
          sourceModelId,
          engine: engine.value,
          maps: checkedMaps(),
          textureSize: Number.parseInt(overlay.querySelector("#model3d-bake-texture-size").value, 10) || BAKE_DEFAULT_TEXTURE_SIZE,
          newUvs: overlay.querySelector("#model3d-bake-new-uvs").checked
        });
      });
      syncFields();
      overlay.querySelector("#model3d-bake-source").focus();
    });
  }

  function setButtonBusy(busy) {
    const button = document.getElementById(BAKE_BUTTON_ID);
    if (!button) {
      return;
    }
    button.disabled = busy;
    button.classList.toggle("is-busy", busy);
    button.setAttribute("aria-busy", busy ? "true" : "false");
  }

  async function runBakeForSelectedModel() {
    if (running) {
      return void setOutput("A bake is already running. Wait for it to finish.");
    }
    const selected = getSelectedGeneratedModel();
    if (!selected) {
      return void setOutput("Select a model first.");
    }
    const options = await openBakeConfigurationOverlay(selected);
    if (!options) {
      return;
    }
    running = true;
    setButtonBusy(true);
    const engineLabel = BAKE_ENGINES.find(item => item.value === options.engine)?.label || options.engine;
    setModel3dStatus("Baking " + options.maps.join(", ") + " for " + selected.modelFileName + " with " + engineLabel + "...");
    try {
      const result = await request("/api/model3d-bake", { modelId: selected.id, ...options });
      await loadModel3dHistory(result?.generated?.id || selected.id);
      const maps = Array.isArray(result?.maps) ? result.maps.join(", ") : options.maps.join(", ");
      setModel3dStatus("Baked " + maps + " for " + selected.modelFileName + ".");
      setOutput("Baked " + maps + " for " + selected.modelFileName + " with " + engineLabel + " into a new model.");
    } catch (error) {
      const detail = describeClientError(error, "Bake failed without an error detail.");
      setModel3dStatus("Bake failed for " + selected.modelFileName + ".");
      setOutput("Failed to bake " + selected.modelFileName + ": " + detail);
    } finally {
      running = false;
      setButtonBusy(false);
    }
  }

  function bindBakeQuickAction() {
    const button = document.getElementById(BAKE_BUTTON_ID);
    if (!button || button.dataset.bakeBound === "true") {
      return;
    }
    button.dataset.bakeBound = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      void runBakeForSelectedModel();
    });
  }

  return {
    runBakeForSelectedModel,
    bindBakeQuickAction
  };
}
