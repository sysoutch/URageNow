function createDashboardThreeDViewerResizeHelpers(input) {
  const viewer = input.viewer;
  const browserWindow = input.window || window;
  const Observer = input.ResizeObserver || browserWindow.ResizeObserver;

  function resize(canvas, THREE) {
    if (!canvas || !viewer.renderer || !viewer.camera || !viewer.scene) return false;
    const hostNode = canvas.parentElement || canvas;
    const width = Math.max(1, hostNode.clientWidth || canvas.clientWidth || canvas.width || 640);
    const height = Math.max(1, hostNode.clientHeight || canvas.clientHeight || canvas.height || 360);
    viewer.renderer.setSize(width, height, false);
    const aspect = width / height;
    if (viewer.camera.isPerspectiveCamera) viewer.camera.aspect = aspect;
    if (viewer.camera.isOrthographicCamera) {
      input.updateOrthographicBounds(viewer.camera, {aspect, maxSize: input.getViewerMaxSize(THREE)});
    }
    viewer.camera.updateProjectionMatrix();
    viewer.controls?.update();
    input.updateLightRig();
    viewer.renderer.render(viewer.scene, viewer.camera);
    return true;
  }

  function unbind() {
    if (viewer.resizeObserver) {
      viewer.resizeObserver.disconnect();
      viewer.resizeObserver = null;
    }
    if (viewer.resizeHandler) {
      browserWindow.removeEventListener("resize", viewer.resizeHandler);
      viewer.resizeHandler = null;
    }
  }

  function bind(canvas, THREE) {
    unbind();
    const resizeHandler = () => resize(canvas, THREE);
    viewer.resizeHandler = resizeHandler;
    browserWindow.addEventListener("resize", resizeHandler);
    if (typeof Observer === "function") {
      viewer.resizeObserver = new Observer(resizeHandler);
      viewer.resizeObserver.observe(canvas);
      if (canvas.parentElement) viewer.resizeObserver.observe(canvas.parentElement);
    }
    resizeHandler();
    return resizeHandler;
  }

  return {bind, resize, unbind};
}
