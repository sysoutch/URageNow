import * as THREE from "three";
import { cloneAssetObject, getPropModels, getTileModel } from "./model-assets.js";
import { palettes } from "./state.js";

const rendererState = {
  renderer: null,
  scene: null,
  camera: null,
  cameraKind: "",
  mapRoot: null,
  lights: null,
  canvas: null
};

function makeColor(hex) {
  return new THREE.Color(hex || "#ffffff");
}

function makeMaterial(color, roughness) {
  return new THREE.MeshStandardMaterial({
    color: makeColor(color),
    roughness: typeof roughness === "number" ? roughness : 0.72,
    metalness: 0.02
  });
}

function disposeObject(object) {
  object.traverse(child => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(material => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function ensureRenderer(canvas) {
  if (rendererState.renderer && rendererState.canvas === canvas) {
    return rendererState;
  }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07111f, 0.018);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x111827, 1.9);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(8, 12, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  scene.add(hemi);
  scene.add(key);

  rendererState.renderer = renderer;
  rendererState.scene = scene;
  rendererState.camera = null;
  rendererState.cameraKind = "";
  rendererState.mapRoot = null;
  rendererState.lights = { hemi, key };
  rendererState.canvas = canvas;
  return rendererState;
}

function resizeRenderer(canvas) {
  const renderer = rendererState.renderer;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(640, Math.floor(rect.width));
  const height = Math.max(420, Math.floor(rect.height));
  const needsResize = canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio());
  if (needsResize) {
    renderer.setSize(width, height, false);
  }
  return { width, height, aspect: width / Math.max(1, height) };
}

function ensureCamera(config, viewport) {
  const kind = config.projection === "perspective" ? "perspective" : "orthographic";
  if (rendererState.camera && rendererState.cameraKind === kind) {
    return rendererState.camera;
  }
  rendererState.camera = kind === "perspective"
    ? new THREE.PerspectiveCamera(45, viewport.aspect, 0.1, 1000)
    : new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
  rendererState.cameraKind = kind;
  return rendererState.camera;
}

function getMapWidth(config) {
  return Math.max(config.width, ...config.map.map(row => row.length));
}

function getMapDepth(config) {
  return Math.max(config.depth, config.map.length);
}

function updateCamera(config, viewport) {
  const camera = ensureCamera(config, viewport);
  const mode = config.renderMode || config.mode;
  const mapWidth = getMapWidth(config);
  const mapDepth = getMapDepth(config);
  const mapSize = Math.max(mapWidth, mapDepth, 8);
  const isFlatView = mode === "sidescroller" || mode === "topdown-flat";
  const viewSize = isFlatView ? Math.max(mapWidth, mapDepth, 8) : mapSize;
  const yawDegrees = isFlatView ? 0 : mode === "isometric" ? 45 : config.yaw;
  const pitchDegrees = isFlatView ? 0 : mode === "isometric" ? 35.264 : config.pitch;
  const yaw = yawDegrees * Math.PI / 180;
  const pitch = pitchDegrees * Math.PI / 180;
  const distance = Math.max(10, viewSize * (1.7 - (config.zoom - 45) / 170));
  const target = isFlatView ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 0.2, 0);
  camera.position.set(
    Math.sin(yaw) * Math.cos(pitch) * distance,
    Math.sin(pitch) * distance,
    Math.cos(yaw) * Math.cos(pitch) * distance
  );
  if (isFlatView) {
    camera.position.set(0, 0, distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
  }
  if (!isFlatView) {
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
  }
  if (camera.isPerspectiveCamera) {
    camera.aspect = viewport.aspect;
    camera.fov = mode === "overhead" ? Math.max(18, Math.min(44, 58 - config.zoom * 0.2)) : Math.max(25, Math.min(62, 78 - config.zoom * 0.34));
  } else {
    const frustumHeight = Math.max(5, viewSize * (1.45 - (config.zoom - 45) / 180));
    camera.left = -frustumHeight * viewport.aspect * 0.5;
    camera.right = frustumHeight * viewport.aspect * 0.5;
    camera.top = frustumHeight * 0.5;
    camera.bottom = -frustumHeight * 0.5;
  }
  camera.near = 0.05;
  camera.far = Math.max(100, distance * 8);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function createTileMesh(tile, materials, config) {
  const mode = config.renderMode || config.mode;
  const mapDepth = getMapDepth(config);
  const tileModel = getTileModel();
  if (tileModel && tile.kind !== "empty" && tile.kind !== "ground") {
    const model = cloneAssetObject(tileModel);
    if (model) {
      if (mode === "sidescroller" || mode === "topdown-flat") {
        model.position.set(tile.x + 0.5, mapDepth - tile.z - 0.5, 0.55);
      } else {
        model.position.set(tile.x + 0.5, Math.max(0.04, tile.height), tile.z + 0.5);
      }
      model.scale.multiplyScalar(tile.kind === "path" ? 0.82 : 1);
      return model;
    }
  }
  if (mode === "sidescroller" || mode === "topdown-flat") {
    const depth = mode === "sidescroller" ? 0.35 : Math.max(0.22, tile.height);
    const geometry = new THREE.BoxGeometry(0.96, 0.96, depth);
    const material = tile.kind === "path"
      ? materials.path
      : tile.kind === "ground" || tile.kind === "empty"
        ? materials.ground
        : materials.block;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(tile.x + 0.5, mapDepth - tile.z - 0.5, depth * 0.5);
    mesh.castShadow = mode !== "sidescroller";
    mesh.receiveShadow = mode !== "sidescroller";
    return mesh;
  }

  const height = Math.max(0.04, tile.height);
  const geometry = new THREE.BoxGeometry(0.96, height, 0.96);
  const material = tile.kind === "path"
    ? materials.path
    : tile.kind === "empty"
      ? materials.empty
      : tile.kind === "ground"
        ? materials.ground
        : materials.block;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(tile.x + 0.5, height * 0.5, tile.z + 0.5);
  mesh.castShadow = height > 0.08;
  mesh.receiveShadow = true;
  return mesh;
}

function shouldPlaceProp(tile, config, index) {
  if (tile.kind === "empty" || tile.kind === "ground") {
    return false;
  }
  const density = Math.max(0, Math.min(100, config.propDensity || 0));
  const hash = Math.abs(Math.sin((tile.x + 1) * 12.9898 + (tile.z + 1) * 78.233 + index * 31.17) * 43758.5453);
  return (hash - Math.floor(hash)) * 100 < density;
}

function createPropMesh(asset, tile, config) {
  const mode = config.renderMode || config.mode;
  const mapDepth = getMapDepth(config);
  const model = cloneAssetObject(asset);
  if (!model) {
    return null;
  }
  if (mode === "sidescroller" || mode === "topdown-flat") {
    model.position.set(tile.x + 0.5, mapDepth - tile.z - 0.1, 0.96);
  } else {
    model.position.set(tile.x + 0.5, Math.max(0.1, tile.height + 0.04), tile.z + 0.5);
  }
  model.scale.multiplyScalar(0.72);
  return model;
}

function createMapRoot(config) {
  const palette = palettes[config.palette] || palettes.ruins;
  const mode = config.renderMode || config.mode;
  const mapWidth = getMapWidth(config);
  const mapDepth = getMapDepth(config);
  const root = new THREE.Group();
  const materials = {
    ground: makeMaterial(palette.ground, 0.86),
    path: makeMaterial(palette.path, 0.72),
    block: makeMaterial(palette.top, 0.64),
    empty: makeMaterial(palette.void, 0.92),
    floor: makeMaterial(palette.ground, 0.9)
  };
  if (mode === "sidescroller" || mode === "topdown-flat") {
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(mapWidth + 4, mapDepth + 4), materials.floor);
    backdrop.position.set(mapWidth / 2, mapDepth / 2, -0.1);
    backdrop.receiveShadow = true;
    root.add(backdrop);
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(mapWidth + 8, mapDepth + 8), materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mapWidth / 2, -0.012, mapDepth / 2);
    floor.receiveShadow = true;
    root.add(floor);
  }
  config.map.flat().filter(Boolean).forEach(tile => {
    if (tile.kind === "empty" && mode === "sidescroller") {
      return;
    }
    root.add(createTileMesh(tile, materials, config));
  });
  const propModels = getPropModels();
  if (propModels.length) {
    config.map.flat().filter(Boolean).forEach((tile, index) => {
      if (!shouldPlaceProp(tile, config, index)) {
        return;
      }
      const prop = createPropMesh(propModels[index % propModels.length], tile, config);
      if (prop) {
        root.add(prop);
      }
    });
  }
  root.position.set(-mapWidth / 2, mode === "sidescroller" || mode === "topdown-flat" ? -mapDepth / 2 : 0, mode === "sidescroller" || mode === "topdown-flat" ? 0 : -mapDepth / 2);
  return root;
}

function updateSceneTheme(config) {
  const palette = palettes[config.palette] || palettes.ruins;
  const background = makeColor(getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || palette.void);
  rendererState.scene.background = background;
  rendererState.scene.fog.color.copy(rendererState.scene.background);
  rendererState.renderer.setClearColor(background, 1);
  if (rendererState.lights) {
    rendererState.lights.hemi.color = makeColor(palette.top);
    rendererState.lights.key.color = makeColor("#ffffff");
  }
}

export function renderMap(canvas, config) {
  const renderConfig = config.mode === "topdown" ? { ...config, renderMode: "topdown-flat" } : config;
  ensureRenderer(canvas);
  const viewport = resizeRenderer(canvas);
  const camera = updateCamera(renderConfig, viewport);
  updateSceneTheme(renderConfig);
  if (rendererState.mapRoot) {
    rendererState.scene.remove(rendererState.mapRoot);
    disposeObject(rendererState.mapRoot);
  }
  rendererState.mapRoot = createMapRoot(renderConfig);
  rendererState.scene.add(rendererState.mapRoot);
  rendererState.scene.updateMatrixWorld(true);
  rendererState.renderer.render(rendererState.scene, camera);
}

export function rerenderMap(config) {
  if (!rendererState.renderer || !rendererState.canvas) {
    return;
  }
  renderMap(rendererState.canvas, config);
}

export function exportRendererPng() {
  if (!rendererState.renderer) {
    return "";
  }
  rendererState.renderer.render(rendererState.scene, rendererState.camera);
  return rendererState.renderer.domElement.toDataURL("image/png");
}
