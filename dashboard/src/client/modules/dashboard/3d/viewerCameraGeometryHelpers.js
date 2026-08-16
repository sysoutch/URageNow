function createDashboardThreeDViewerCameraGeometryHelpers(input) {
  const viewer = input.viewer;

  function getFiniteModelBounds(THREE, object) {
    if (!THREE || !object) return null;
    object.updateWorldMatrix?.(true, true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty() || !Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)
      || !Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)
      || !Number.isFinite(box.min.z) || !Number.isFinite(box.max.z)) {
      return null;
    }
    const size = box.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) {
      return null;
    }
    return { box, size };
  }

  function fitModelInCamera(THREE, camera, object, controls) {
    // Imported assets regularly use a different unit system than generated
    // assets. Recompute every world transform before reading bounds: parsers
    // can leave nested GLTF/FBX transforms dirty until their first render.
    const initialBounds = getFiniteModelBounds(THREE, object);
    if (!initialBounds || !camera) return false;
    const center = initialBounds.box.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.y -= initialBounds.box.min.y;
    object.position.z -= center.z;
    const normalizedBounds = getFiniteModelBounds(THREE, object);
    if (!normalizedBounds) return false;
    const size = normalizedBounds.size;
    const maxSize = Math.max(size.x, size.y, size.z, 0.01);
    const targetY = Math.max(0, size.y * 0.5);
    const target = new THREE.Vector3(0, targetY, 0);
    const aspect = getModel3dViewerAspect();
    input.updateSceneHelpers(maxSize);
    // Derive the distance from the active perspective FOV rather than an
    // arbitrary world-unit multiplier. This gives equally useful framing to
    // Sketchfab (often centimetres) and generated models (often metres).
    const horizontalFov = camera.isPerspectiveCamera
      ? 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * Math.max(aspect, 0.01))
      : 0;
    const verticalDistance = camera.isPerspectiveCamera
      ? (size.y * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)
      : maxSize * 2.4;
    const horizontalDistance = camera.isPerspectiveCamera
      ? (Math.max(size.x, size.z) * 0.5) / Math.tan(horizontalFov * 0.5)
      : maxSize * 2.4;
    const distance = Math.max(maxSize * 0.9, verticalDistance, horizontalDistance) * 1.3 + (size.z * 0.4);
    const direction = new THREE.Vector3(1.35, 0.82, 1.35).normalize();
    if (camera.isOrthographicCamera) {
      camera.userData = camera.userData || {};
      camera.userData.orthoFrustumHeight = Math.max(0.25, Math.max(size.y, size.x / Math.max(aspect, 0.001)) * 1.35);
      updateModel3dOrthographicCameraBounds(camera, { aspect, maxSize });
    }
    camera.position.copy(direction.multiplyScalar(Math.max(distance, maxSize * 2.5))).add(target);
    const cameraDistance = Math.max(camera.position.distanceTo(target), maxSize);
    camera.near = Math.max(0.0001, cameraDistance / 1000);
    camera.far = Math.max(10, cameraDistance + (maxSize * 40));
    // Keep the atmospheric fog useful for normal-size assets without letting
    // it consume imports whose source units are much larger than our default
    // scene. A Sketchfab glTF can easily be hundreds of world units tall even
    // though the fitted camera is correct.
    if (viewer.scene?.fog) {
      viewer.scene.fog.far = Math.max(38, cameraDistance + (maxSize * 4));
    }
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.copy(target);
      controls.minDistance = Math.max(0.0001, cameraDistance / 80);
      controls.maxDistance = Math.max(8, cameraDistance * 12, maxSize * 20);
      controls.update();
    }
    return true;
  }

  function getModel3dViewerAspect() {
    const canvas = document.getElementById("model3d-canvas");
    if (!canvas) return 1;
    const width = Math.max(1, canvas.clientWidth || canvas.width || 1);
    const height = Math.max(1, canvas.clientHeight || canvas.height || 1);
    return width / height;
  }

  function getModel3dViewerMaxSize(THREE) {
    const bounds = getFiniteModelBounds(THREE, viewer.root);
    if (!bounds) return 1;
    const size = bounds.size;
    return Math.max(size.x, size.y, size.z, 0.01);
  }

  function captureModel3dViewerCameraState() {
    const camera = viewer.camera;
    if (!camera) return null;
    return {
      position: camera.position ? camera.position.clone() : null,
      quaternion: camera.quaternion ? camera.quaternion.clone() : null,
      zoom: typeof camera.zoom === "number" ? camera.zoom : null,
      orthoFrustumHeight: typeof camera.userData?.orthoFrustumHeight === "number" ? camera.userData.orthoFrustumHeight : null,
      controlsTarget: viewer.controls?.target ? viewer.controls.target.clone() : null,
      rootRotation: viewer.root?.rotation ? viewer.root.rotation.clone() : null
    };
  }

  function updateModel3dOrthographicCameraBounds(camera, options) {
    if (!camera || camera.isOrthographicCamera !== true) return;
    const aspect = typeof options?.aspect === "number" && Number.isFinite(options.aspect) ? Math.max(0.001, options.aspect) : getModel3dViewerAspect();
    const maxSize = typeof options?.maxSize === "number" && Number.isFinite(options.maxSize) ? Math.max(0.01, options.maxSize) : 1;
    const frustumHeight = typeof camera.userData?.orthoFrustumHeight === "number" && Number.isFinite(camera.userData.orthoFrustumHeight)
      ? Math.max(0.02, camera.userData.orthoFrustumHeight)
      : Math.max(0.25, maxSize * 2.25);
    camera.userData = camera.userData || {};
    camera.userData.orthoFrustumHeight = frustumHeight;
    camera.left = -frustumHeight * aspect * 0.5;
    camera.right = frustumHeight * aspect * 0.5;
    camera.top = frustumHeight * 0.5;
    camera.bottom = -frustumHeight * 0.5;
  }

  function restoreModel3dViewerCameraState(viewState) {
    const camera = viewer.camera;
    if (!camera || !viewState) return;
    if (viewState.position) camera.position.copy(viewState.position);
    if (viewState.quaternion) camera.quaternion.copy(viewState.quaternion);
    if (typeof viewState.zoom === "number" && Number.isFinite(viewState.zoom)) camera.zoom = viewState.zoom;
    if (camera.isOrthographicCamera && typeof viewState.orthoFrustumHeight === "number" && Number.isFinite(viewState.orthoFrustumHeight)) {
      camera.userData = camera.userData || {};
      camera.userData.orthoFrustumHeight = viewState.orthoFrustumHeight;
      updateModel3dOrthographicCameraBounds(camera, {aspect: getModel3dViewerAspect()});
    }
    camera.updateProjectionMatrix();
    if (viewer.controls) {
      if (viewState.controlsTarget) viewer.controls.target.copy(viewState.controlsTarget);
      viewer.controls.update();
    }
    if (viewer.root && viewState.rootRotation) viewer.root.rotation.copy(viewState.rootRotation);
    input.updateLightRig();
    if (viewer.renderer && viewer.scene) viewer.renderer.render(viewer.scene, camera);
  }

  return {
    captureModel3dViewerCameraState,
    fitModelInCamera,
    getModel3dViewerAspect,
    getModel3dViewerMaxSize,
    restoreModel3dViewerCameraState,
    updateModel3dOrthographicCameraBounds
  };
}
