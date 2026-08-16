function createDashboardThreeDViewerResourceDisposalHelpers(input) {
  const viewer = input.viewer;
  const cancelFrame = input.cancelAnimationFrame || (handle => window.cancelAnimationFrame(handle));

  function removeRigHelper() {
    if (viewer.rigHelper && viewer.scene) viewer.scene.remove(viewer.rigHelper);
    viewer.rigHelper = null;
  }

  function restoreMeshGeometry(mesh) {
    const originalGeometry = viewer.meshGeometryDefaults.get(mesh);
    if (!originalGeometry || mesh.geometry === originalGeometry) return originalGeometry || mesh.geometry;
    if (mesh.geometry && mesh.geometry !== originalGeometry && typeof mesh.geometry.dispose === "function") mesh.geometry.dispose();
    mesh.geometry = originalGeometry;
    return originalGeometry;
  }

  function disposeOverrideMaterial(material) {
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    materials.forEach(item => {
      if (item?.userData?.model3dViewportOverride === true && typeof item.dispose === "function") item.dispose();
    });
  }

  function resetMaterialCaches() {
    viewer.materialDefaults = new WeakMap();
    viewer.meshMaterialDefaults = new WeakMap();
  }

  function restoreMeshMaterial(mesh) {
    const originalMaterial = viewer.meshMaterialDefaults.get(mesh);
    if (!originalMaterial) {
      if (mesh.material) viewer.meshMaterialDefaults.set(mesh, mesh.material);
      return mesh.material;
    }
    if (mesh.material !== originalMaterial) {
      disposeOverrideMaterial(mesh.material);
      mesh.material = originalMaterial;
    }
    return originalMaterial;
  }

  function disposeRootResources(root) {
    if (!root) return;
    input.forEachMesh(root, mesh => {
      restoreMeshGeometry(mesh);
      restoreMeshMaterial(mesh);
      if (mesh.geometry && typeof mesh.geometry.dispose === "function") mesh.geometry.dispose();
    });
    input.forEachMaterial(root, material => {
      if (material.map && typeof material.map.dispose === "function") material.map.dispose();
      if (typeof material.dispose === "function") material.dispose();
    });
  }

  function disposeViewerRoot() {
    if (viewer.animateHandle) {
      if (typeof input.cancelAnimation === "function") input.cancelAnimation();
      else {
        cancelFrame(viewer.animateHandle);
        viewer.animateHandle = 0;
      }
    }
    if (!viewer.scene || !viewer.root) {
      viewer.root = null;
      viewer.loadedModelId = "";
      viewer.loadedModelKey = "";
      return;
    }
    removeRigHelper();
    viewer.scene.remove(viewer.root);
    disposeRootResources(viewer.root);
    resetMaterialCaches();
    viewer.meshGeometryDefaults = new WeakMap();
    viewer.root = null;
    viewer.loadedModelId = "";
    viewer.loadedModelKey = "";
    viewer.currentLoadId = "";
  }

  function unloadPreview() {
    viewer.previewActive = false;
    disposeViewerRoot();
    input.setStatus("Three.js preview unloaded. Click the preview to load the selected model.");
  }

  return {
    disposeOverrideMaterial,
    disposeRootResources,
    disposeViewerRoot,
    removeRigHelper,
    resetMaterialCaches,
    restoreMeshGeometry,
    restoreMeshMaterial,
    unloadPreview
  };
}
