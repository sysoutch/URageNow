function createDashboardThreeDViewerRenderLoopHelpers(input) {
  const viewer = input.viewer;
  const requestFrame = input.requestAnimationFrame || (callback => window.requestAnimationFrame(callback));
  const cancelFrame = input.cancelAnimationFrame || (handle => window.cancelAnimationFrame(handle));

  function renderFrame() {
    if (!viewer.renderer || !viewer.scene || !viewer.camera) return false;
    viewer.controls?.update();
    input.updateLightRig();
    viewer.renderer.render(viewer.scene, viewer.camera);
    return true;
  }

  function schedule() {
    if (viewer.animateHandle || !viewer.renderer) return false;
    viewer.animateHandle = requestFrame(() => {
      viewer.animateHandle = 0;
      if (viewer.root && viewer.autoRotate) {
        viewer.root.rotation.y += 0.004;
        renderFrame();
        schedule();
        return;
      }
      renderFrame();
      if (viewer.interactionFrames > 0) {
        viewer.interactionFrames -= 1;
        schedule();
      }
    });
    return true;
  }

  function requestInteractionFrames(frameCount) {
    viewer.interactionFrames = Math.max(viewer.interactionFrames || 0, Number(frameCount) || 1);
    schedule();
  }

  function cancel() {
    if (!viewer.animateHandle) return false;
    cancelFrame(viewer.animateHandle);
    viewer.animateHandle = 0;
    return true;
  }

  return {cancel, renderFrame, requestInteractionFrames, schedule};
}
