export type RustMediaKind = "image" | "audio" | "video" | "model3d" | "unknown";

export interface RustMediaFileFact {
  exists: boolean;
  extension: string | null;
  fileName: string | null;
  sizeBytes: number | null;
}

export interface RustImageProbe {
  width: number;
  height: number;
  colorType: string;
  hasAlpha: boolean;
  animated: boolean;
  frameCount: number | null;
}

export interface RustAudioProbe {
  codec: string;
  durationSeconds: number | null;
  channelCount: number | null;
  sampleRateHz: number | null;
  bitsPerSample: number | null;
}

export interface RustVideoProbe {
  codec: string;
  container: string;
  durationSeconds: number | null;
  trackCount: number | null;
  frameCount: number | null;
  averageFrameRate: number | null;
}

export interface RustMediaProbeResult {
  inputPath: string;
  file: RustMediaFileFact;
  kind: RustMediaKind;
  probed: boolean;
  parser: string | null;
  image: RustImageProbe | null;
  audio: RustAudioProbe | null;
  video: RustVideoProbe | null;
  warnings: string[];
}

export interface ProbeGeneratedMediaInput {
  assetKind: "image" | "audio" | "video";
  imageId?: string;
  audioId?: string;
  videoId?: string;
  fileName: string;
}
