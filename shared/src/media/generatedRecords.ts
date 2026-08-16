export interface GeneratedImageRecord {
  id: string;
  createdAt: string;
  prompt: string;
  description?: string;
  comfyPromptId: string;
  generationDurationSeconds: number | null;
  imageFileName: string;
  seed: number;
  steps: number | null;
  cfg: number | null;
  width: number | null;
  height: number | null;
  model: string;
  modelGeneratedAt: string | null;
  modelGeneratedModelId: string | null;
  metadata?: Record<string, string | number | boolean>;
}

export interface GeneratedImagePublicRecord extends GeneratedImageRecord {
  imageUrl: string;
}

export type GeneratedAudioMode = "audio" | "music";

export interface GeneratedAudioRecord {
  id: string;
  createdAt: string;
  mode: GeneratedAudioMode;
  prompt: string;
  tags: string;
  lyrics: string;
  seconds: number | null;
  comfyPromptId: string;
  audioFileName: string;
  seed: number;
  steps: number | null;
  cfg: number | null;
  model: string;
}

export interface GeneratedAudioPublicRecord extends GeneratedAudioRecord {
  audioUrl: string;
}

export interface GeneratedVideoRecord {
  id: string;
  createdAt: string;
  prompt: string;
  seconds: number | null;
  comfyPromptId: string;
  generationDurationSeconds: number | null;
  videoFileName: string;
  seed: number;
  steps: number | null;
  model: string;
}

export interface GeneratedVideoPublicRecord extends GeneratedVideoRecord {
  videoUrl: string;
}
