export type RustModelKind = "glb" | "gltf" | "fbx" | "obj" | "blend" | "unknown";

export interface RustModelFileFact {
  exists: boolean;
  extension: string | null;
  fileName: string | null;
  sizeBytes: number | null;
}

export interface RustModelVector3 {
  x: number;
  y: number;
  z: number;
}

export interface RustModelBounds3 {
  min: RustModelVector3;
  max: RustModelVector3;
}

export interface RustModelGeometryStats {
  meshCount: number;
  primitiveCount: number;
  vertexCount: number;
  faceCount: number;
  normalCount: number;
  uvChannelCount: number;
}

export interface RustModelResourceStats {
  sceneCount: number;
  nodeCount: number;
  materialCount: number;
  textureCount: number;
  animationCount: number;
}

export interface RustModelMaterialTextureSlots {
  baseColor: string | null;
  normal: string | null;
  metallicRoughness: string | null;
  emissive: string | null;
  occlusion: string | null;
}

export interface RustModelMaterialFact {
  name: string | null;
  alphaMode: string | null;
  doubleSided: boolean | null;
  textureSlots: RustModelMaterialTextureSlots;
}

export interface RustModelTextureFact {
  name: string | null;
  reference: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  usageCount: number;
}

export interface RustModelInspectionStats {
  geometry: RustModelGeometryStats;
  resources: RustModelResourceStats;
  bounds: RustModelBounds3 | null;
  materials: RustModelMaterialFact[];
  textures: RustModelTextureFact[];
}

export interface RustModelInspectionResult {
  inputPath: string;
  file: RustModelFileFact;
  kind: RustModelKind;
  inspected: boolean;
  parser: string | null;
  stats: RustModelInspectionStats | null;
  warnings: string[];
}

export type RustValidationSeverity = "warning" | "error";

export interface RustValidationIssue {
  severity: RustValidationSeverity;
  code: string;
  message: string;
}

export interface RustAssetValidationResult {
  inputPath: string;
  valid: boolean;
  issues: RustValidationIssue[];
  inspection: RustModelInspectionResult;
}
