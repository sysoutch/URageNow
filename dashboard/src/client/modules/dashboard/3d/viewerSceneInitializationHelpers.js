function createDashboardThreeDViewerSceneInitializationHelpers(input) {
  const viewer = input.viewer;

  function initialize(three, canvas, loadingManager, scenePalette) {
    const THREE = three.THREE;
    viewer.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
    viewer.renderer.setClearColor(scenePalette.scene, 1);
    viewer.renderer.setPixelRatio(Math.min(input.getDevicePixelRatio(), 2));
    if ("outputColorSpace" in viewer.renderer && THREE.SRGBColorSpace) {
      viewer.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ("outputEncoding" in viewer.renderer && THREE.sRGBEncoding) {
      viewer.renderer.outputEncoding = THREE.sRGBEncoding;
    }
    if ("toneMapping" in viewer.renderer && THREE.ACESFilmicToneMapping) {
      viewer.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      viewer.renderer.toneMappingExposure = 1.16;
    }
    viewer.scene = new THREE.Scene();
    viewer.scene.background = new THREE.Color(scenePalette.scene);
    viewer.defaultBackground = viewer.scene.background;
    viewer.defaultEnvironment = viewer.scene.environment || null;
    viewer.scene.fog = new THREE.Fog(scenePalette.scene, 8, 38);
    viewer.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    viewer.loadingManager = loadingManager;
    viewer.loaders = {
      gltf: new three.GLTFLoader(loadingManager),
      fbx: new three.FBXLoader(loadingManager),
      obj: new three.OBJLoader(loadingManager)
    };
    viewer.controls = new three.OrbitControls(viewer.camera, canvas);
    viewer.controls.enableDamping = true;
    viewer.controls.dampingFactor = 0.08;
    viewer.controls.enablePan = true;
    viewer.controls.screenSpacePanning = true;
    input.bindAxisGizmo();
    viewer.controls.addEventListener("start", input.switchToManualOrbit);
    viewer.controls.addEventListener("end", input.switchToManualOrbit);
    viewer.controls.addEventListener("change", () => {
      input.updateAxisGizmo();
      input.updateLightRig();
      input.requestInteractionFrames(8);
    });
    ["pointerdown", "pointerup", "wheel"].forEach(eventName => {
      canvas.addEventListener(eventName, () => {
        input.switchToManualOrbit();
        if (eventName === "wheel") input.requestInteractionFrames(10);
      }, {passive: true});
    });

    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    const hemisphere = new THREE.HemisphereLight(0xd9ecff, 0x2a1710, 0.75);
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    const fill = new THREE.DirectionalLight(0xfff0df, 0.8);
    const rim = new THREE.DirectionalLight(0x89b8ff, 0.62);
    const keyTarget = new THREE.Object3D();
    const fillTarget = new THREE.Object3D();
    const rimTarget = new THREE.Object3D();
    const grid = new THREE.GridHelper(8, 16, scenePalette.gridMajor, scenePalette.gridMinor);
    const axis = new THREE.AxesHelper(1.4);
    (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(material => {
      if (!material) return;
      material.transparent = true;
      material.opacity = 0.36;
      material.depthWrite = false;
    });
    (Array.isArray(axis.material) ? axis.material : [axis.material]).forEach(material => {
      if (!material) return;
      material.transparent = true;
      material.opacity = 0.92;
      material.depthTest = false;
    });
    axis.renderOrder = 2;
    key.target = keyTarget;
    fill.target = fillTarget;
    rim.target = rimTarget;
    viewer.scene.add(ambient, hemisphere, key, fill, rim, keyTarget, fillTarget, rimTarget, grid, axis);
    viewer.lightRig = {
      THREE,
      ambient,
      hemisphere,
      key,
      fill,
      rim,
      keyTarget,
      fillTarget,
      rimTarget,
      defaultAmbientIntensity: 1.1,
      defaultHemisphereIntensity: 0.75,
      defaultKeyIntensity: 1.25,
      defaultFillIntensity: 0.8,
      defaultRimIntensity: 0.62,
      keyOffset: new THREE.Vector3(2.6, 3.4, 3.8),
      fillOffset: new THREE.Vector3(-2.2, 1.4, 2.8),
      rimOffset: new THREE.Vector3(-3.1, 2.1, -3.2)
    };
    viewer.sceneHelpers = {grid, axis};
    input.updateAxisGizmo();
    input.updateSceneHelpers(1);
    input.updateSceneHelperOptions();
    input.applyLightingProfile();
    input.updateLightRig();
    return viewer;
  }

  return {initialize};
}
