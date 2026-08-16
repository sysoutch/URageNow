function createDashboardThreeDViewerCanvasInputHelpers(input) {
  let boundCanvas = null;
  let pointerDownHandler = null;
  let keyDownHandler = null;

  function unbind() {
    if (!boundCanvas) return false;
    boundCanvas.removeEventListener("pointerdown", pointerDownHandler);
    boundCanvas.removeEventListener("keydown", keyDownHandler);
    boundCanvas = null;
    pointerDownHandler = null;
    keyDownHandler = null;
    return true;
  }

  function bind(canvas) {
    if (!canvas) return false;
    if (boundCanvas === canvas) return true;
    unbind();
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "3D model viewport. Press F to focus the model or period to reset the camera.");
    input.bindManualOrbitGuards(canvas);
    pointerDownHandler = () => canvas.focus({preventScroll: true});
    keyDownHandler = event => {
      if (event.defaultPrevented || event.repeat) return;
      if (String(event.key || "").toLowerCase() === "f") {
        event.preventDefault();
        input.focusViewer();
        return;
      }
      if (event.key === "." || event.code === "Period") {
        event.preventDefault();
        input.resetCamera();
      }
    };
    canvas.addEventListener("pointerdown", pointerDownHandler);
    canvas.addEventListener("keydown", keyDownHandler);
    boundCanvas = canvas;
    return true;
  }

  return {bind, unbind};
}
