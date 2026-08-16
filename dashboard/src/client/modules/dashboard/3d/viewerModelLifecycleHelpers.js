function createDashboardThreeDViewerModelLifecycleHelpers(input) {
  const viewer = input.viewer;

  function clearLoadedIdentity() {
    viewer.loadedModelId = "";
    viewer.loadedModelKey = "";
    viewer.loadedModelFileName = "";
  }

  function removeRoot() {
    if (!viewer.root) return false;
    input.removeRigHelper();
    viewer.scene?.remove(viewer.root);
    input.disposeRootResources(viewer.root);
    viewer.root = null;
    input.resetMaterialCaches();
    return true;
  }

  function beginLoad(loadId) {
    viewer.currentLoadId = loadId;
    clearLoadedIdentity();
    removeRoot();
  }

  function discardIfStale(loadId, fileName, loadedAsset) {
    if (viewer.currentLoadId === loadId) return false;
    const staleRoot = input.resolveRoot(fileName, loadedAsset);
    if (staleRoot) input.disposeRootResources(staleRoot);
    return true;
  }

  function replaceRoot(nextRoot, beforeAttach) {
    removeRoot();
    viewer.root = nextRoot;
    if (typeof beforeAttach === "function") beforeAttach(nextRoot);
    viewer.scene.add(nextRoot);
  }

  return {
    beginLoad,
    clearLoadedIdentity,
    discardIfStale,
    removeRoot,
    replaceRoot
  };
}
