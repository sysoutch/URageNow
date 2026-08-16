function createDashboardThreeDViewerAxisGizmoHelpers(input) {
  const viewer = input.viewer;
  const getGizmo = typeof input.getGizmo === "function"
    ? input.getGizmo
    : () => document.getElementById("model3d-axis-gizmo");
  const directions = {
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0]
  };

  function updateOrientation() {
    const gizmo = getGizmo();
    const THREE = viewer.lightRig?.THREE;
    const camera = viewer.camera;
    const target = viewer.controls?.target;
    if (!gizmo || !THREE || !camera || !target) return false;
    camera.updateMatrixWorld();
    const center = target.clone().project(camera);
    Object.entries(directions).forEach(([view, values]) => {
      const button = gizmo.querySelector('[data-model3d-gizmo-view="' + view + '"]');
      if (!button) return;
      const projected = target.clone().add(new THREE.Vector3(...values)).project(camera);
      const deltaX = projected.x - center.x;
      const deltaY = center.y - projected.y;
      const length = Math.hypot(deltaX, deltaY);
      const radius = length < 0.0001 ? 0 : 31;
      button.style.left = (50 + (length < 0.0001 ? 0 : (deltaX / length) * radius)) + "%";
      button.style.top = (50 + (length < 0.0001 ? 0 : (deltaY / length) * radius)) + "%";
      button.style.right = "auto";
      button.style.bottom = "auto";
      button.style.zIndex = length < 0.0001 ? "3" : "2";
    });
    return true;
  }

  function bind() {
    const gizmo = getGizmo();
    if (!gizmo || gizmo.dataset.bound === "true") return false;
    gizmo.dataset.bound = "true";
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let pressedView = "";
    gizmo.addEventListener("pointerdown", event => {
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      dragging = false;
      const pressedNode = event.target && typeof event.target.closest === "function"
        ? event.target.closest("[data-model3d-gizmo-view]")
        : null;
      pressedView = pressedNode?.getAttribute("data-model3d-gizmo-view") || "";
      gizmo.setPointerCapture?.(pointerId);
      event.preventDefault();
    });
    gizmo.addEventListener("pointermove", event => {
      if (event.pointerId !== pointerId) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (!dragging && Math.hypot(deltaX, deltaY) < 5) return;
      const THREE = viewer.lightRig?.THREE;
      const camera = viewer.camera;
      const target = viewer.controls?.target;
      if (!THREE || !camera || !target) return;
      dragging = true;
      const offset = camera.position.clone().sub(target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= deltaX * 0.012;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + (deltaY * 0.012), 0.05, Math.PI - 0.05);
      camera.position.copy(target).add(offset.setFromSpherical(spherical));
      camera.lookAt(target);
      viewer.controls?.update();
      updateOrientation();
      input.switchToManualOrbit();
      input.updateLightRig();
      input.requestInteractionFrames(8);
      startX = event.clientX;
      startY = event.clientY;
    });
    gizmo.addEventListener("pointerup", event => {
      if (event.pointerId !== pointerId) return;
      if (!dragging && pressedView) input.setView(pressedView);
      pointerId = null;
      pressedView = "";
      gizmo.releasePointerCapture?.(event.pointerId);
    });
    gizmo.addEventListener("pointercancel", () => {
      pointerId = null;
      pressedView = "";
    });
    return true;
  }

  return {bind, updateOrientation};
}
