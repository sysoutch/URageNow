import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const assets = [];
let assetId = 1;

function getExtension(file) {
  return (file.name.split(".").pop() || "").toLowerCase();
}

function getLoader(file) {
  const ext = getExtension(file);
  if (ext === "obj") {
    return new OBJLoader();
  }
  if (ext === "fbx") {
    return new FBXLoader();
  }
  if (ext === "glb" || ext === "gltf") {
    return new GLTFLoader();
  }
  return null;
}

function extractObject(result) {
  return result && result.scene ? result.scene : result;
}

function normalizeObject(object, scale) {
  const root = object.clone(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxAxis = Math.max(size.x, size.y, size.z, 0.0001);
  root.position.sub(center);
  root.scale.multiplyScalar(scale / maxAxis);
  root.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return root;
}

function loadWithLoader(loader, file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    loader.load(url, result => {
      URL.revokeObjectURL(url);
      resolve(extractObject(result));
    }, undefined, error => {
      URL.revokeObjectURL(url);
      reject(error);
    });
  });
}

export async function importModelFiles(files, options) {
  const imported = [];
  for (const file of files) {
    const loader = getLoader(file);
    if (!loader) {
      continue;
    }
    const object = await loadWithLoader(loader, file);
    const asset = {
      id: String(assetId++),
      name: file.name,
      role: options.role,
      scale: options.scale,
      object: normalizeObject(object, options.scale)
    };
    assets.push(asset);
    imported.push(asset);
  }
  return imported;
}

export function getModelAssets() {
  return assets.slice();
}

export function getTileModel() {
  return assets.filter(asset => asset.role === "tile").at(-1) || null;
}

export function getPropModels() {
  return assets.filter(asset => asset.role === "prop");
}

export function cloneAssetObject(asset) {
  return asset && asset.object ? asset.object.clone(true) : null;
}
