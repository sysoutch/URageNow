export type RealWorldSizeTier = "tiny" | "small" | "medium" | "large" | "huge";

export interface RealWorldDimensions {
  widthMeters: number;
  heightMeters: number;
  depthMeters: number;
}

export interface GeneratedModelLodArtifact {
  level: number;
  targetFaceCount: number;
  fileName: string;
  url?: string;
}

export interface GeneratedModelRecord {
  id: string;
  createdAt: string;
  prompt: string;
  description?: string;
  targetFaceCount: number | null;
  lowPolyTargetFaceCount: number | null;
  sourceImageFileName: string;
  comfyPromptId: string;
  generationDurationSeconds: number | null;
  modelFileName: string;
  originalModelFileName: string | null;
  lowPolyModelFileName: string | null;
  albedoGeometryModelFileName: string | null;
  albedoGeometryPreviewImageFileName: string | null;
  albedoGeometryPreviewGifFileName: string | null;
  lowPolyPreviewImageFileName: string | null;
  lowPolyPreviewGifFileName: string | null;
  lowPolyRealWorldSizeTier: RealWorldSizeTier | null;
  lowPolyRealWorldReference: string | null;
  lowPolyRealWorldWidthMeters: number | null;
  lowPolyRealWorldHeightMeters: number | null;
  lowPolyRealWorldDepthMeters: number | null;
  previewGifFileName: string | null;
  previewImageFileName: string | null;
  uvMapFileName: string | null;
  uvMapInpaintFileName: string | null;
  normalMapFileName: string | null;
  multiViewFileNames: string[];
  lodArtifacts: GeneratedModelLodArtifact[];
}

export interface GeneratedModelPublicRecord extends GeneratedModelRecord {
  modelUrl: string;
  sourceImageUrl: string | null;
  originalModelUrl: string | null;
  lowPolyModelUrl: string | null;
  albedoGeometryModelUrl: string | null;
  albedoGeometryPreviewImageUrl: string | null;
  albedoGeometryPreviewGifUrl: string | null;
  lowPolyPreviewImageUrl: string | null;
  lowPolyPreviewGifUrl: string | null;
  previewGifUrl: string | null;
  previewImageUrl: string | null;
  uvMapUrl: string | null;
  uvMapInpaintUrl: string | null;
  normalMapUrl: string | null;
  multiViewUrls: string[];
}

export interface AutoRigVerificationPreview {
  modelId: string;
  classification: Record<string, unknown>;
  rigProfile: string;
  landmarks: Record<string, [number, number, number]>;
  markerProjection: { centerX: number; centerZ: number; orthoScale: number } | null;
  editableLandmarks: string[];
  previewImages: Array<{ view: string; dataUrl: string }>;
}

export interface SeparateByLoosePartsResult {
  generated: GeneratedModelPublicRecord | null;
  models: GeneratedModelPublicRecord[];
  partCount: number;
  exportMode: "per_part" | "single_file";
}
