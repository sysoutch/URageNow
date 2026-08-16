(function startTool() {
  "use strict";
  const inputNode = document.getElementById("tool-input");
  const output = document.getElementById("tool-output");
  const status = document.getElementById("tool-status");


  function run() {
    const inputValue = inputNode.value.trim();
    const context = output.getContext("2d");
    context.clearRect(0, 0, output.width, output.height);
    context.fillStyle = "#171b26";
    context.fillRect(0, 0, output.width, output.height);
    context.fillStyle = "#f6edf8";
    context.font = "32px system-ui";
    context.fillText(inputValue || "tetris", 40, 80);

    status.textContent = "Output updated.";
  }

  document.getElementById("tool-run-button").addEventListener("click", run);
  document.getElementById("tool-file-input").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) status.textContent = "Selected " + file.name + ".";
  });
  window.__urageToolDescribeCurrentAsset = function describeCurrentAsset() {
    return {kind: "image", label: "tetris" + " output", fileName: "tetris-output.png", dataUrl: output.toDataURL("image/png")};
  };
  window.__urageToolLoadAssetPayload = function loadAsset(payload) {
    const name = String(payload?.fileName || payload?.name || "dashboard asset");
    inputNode.value = "Received " + name;
    status.textContent = "Loaded " + name + " from the dashboard.";
    return {accepted: true};
  };
}());
