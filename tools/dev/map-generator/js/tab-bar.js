(function () {
  var latestSnapshot = null;
  var frames = { "2d": document.querySelector("#panel2d iframe"), "3d": document.querySelector("#panel3d iframe") };
  var status = document.getElementById("mapSyncStatus");
  function updateStatus(message) { if (status) status.textContent = message; }
  function targetWindow(name) { return frames[name] && frames[name].contentWindow; }
  function applySnapshot(name) {
    var target = targetWindow(name);
    if (latestSnapshot && target && typeof target.__urageApplySharedMap === "function") target.__urageApplySharedMap(latestSnapshot);
  }
  window.switchTab = function (tabName) {
    var active = tabName === "3D" ? "3d" : "2d";
    ["2d", "3d"].forEach(function (name) {
      var selected = name === active;
      document.getElementById("tab" + name).classList.toggle("active", selected);
      document.getElementById("tab" + name).setAttribute("aria-selected", String(selected));
      document.getElementById("panel" + name).classList.toggle("active", selected);
    });
    window.location.hash = active;
    // No snapshot re-apply here: switching tabs must never reset the view being shown. The frame keeps its own map/state and only redraws at its new size.
    var target = targetWindow(active);
    if (target && typeof target.__urageMapGeneratorBecameVisible === "function") target.__urageMapGeneratorBecameVisible();
  };
  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "urage-map-generator-snapshot") return;
    latestSnapshot = event.data.snapshot;
    var source = event.data.source;
    applySnapshot(source === "2d" ? "3d" : "2d");
    updateStatus("Map synced from " + source.toUpperCase() + " · " + new Date().toLocaleTimeString());
  });
  Object.keys(frames).forEach(function (name) { frames[name].addEventListener("load", function () { applySnapshot(name); }); });
  document.getElementById("syncMapButton").addEventListener("click", function () {
    var active = document.querySelector(".tab-panel.active").id === "panel3d" ? "3d" : "2d";
    var source = targetWindow(active);
    if (source && typeof source.__urageGetSharedMap === "function") { latestSnapshot = source.__urageGetSharedMap(); applySnapshot(active === "2d" ? "3d" : "2d"); updateStatus("Map synced from " + active.toUpperCase() + " · " + new Date().toLocaleTimeString()); }
  });
  // WAI-ARIA tab keyboard support: arrows / Home / End move between the two views.
  var tabNames = ["2d", "3d"];
  document.querySelector(".tab-bar").addEventListener("keydown", function (event) {
    var current = event.target.id === "tab2d" ? 0 : event.target.id === "tab3d" ? 1 : -1;
    if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    var next = current;
    if (event.key === "ArrowLeft") next = tabNames.length - 1;
    else if (event.key === "ArrowRight") next = 0;
    else if (event.key === "Home") next = 0;
    else next = tabNames.length - 1;
    event.preventDefault();
    var button = document.getElementById("tab" + tabNames[next]);
    button.focus();
    window.switchTab(tabNames[next] === "3d" ? "3D" : "2D");
  });

  if (window.location.hash.toLowerCase() === "#3d") window.switchTab("3D");
}());
function getActiveGeneratorFrame() { var panel = document.querySelector(".tab-panel.active"); return panel && panel.querySelector("iframe"); }
function callActiveGenerator(methodName) { var frame = getActiveGeneratorFrame(); var target = frame && frame.contentWindow; var method = target && target[methodName]; return typeof method === "function" ? Promise.resolve(method.call(target)) : Promise.resolve(null); }
function describeActiveGeneratorAssets() { return callActiveGenerator("__urageToolDescribeCurrentAssets").then(function (payload) { return Array.isArray(payload) ? payload : payload ? [payload] : []; }); }
function exportActiveGeneratorImage() { return callActiveGenerator("__urageToolRequestExportImage").then(function (payload) { return payload || describeActiveGeneratorAssets().then(function (assets) { return assets.find(function (asset) { return asset && asset.kind === "image"; }) || null; }); }); }
if (typeof window.registerDashboardToolBridge === "function") window.registerDashboardToolBridge({ onDescribeCurrentAssets: describeActiveGeneratorAssets, onExportImage: exportActiveGeneratorImage });
else { window.__urageToolDescribeCurrentAssets = describeActiveGeneratorAssets; window.__urageToolDescribeCurrentAsset = function () { return describeActiveGeneratorAssets().then(function (assets) { return assets[0] || null; }); }; window.__urageToolRequestExportImage = exportActiveGeneratorImage; }