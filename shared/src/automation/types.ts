export type AutomationSource = "template" | "jokes-file" | "ollama" | "image" | "model-3d" | "unity-publisher-gift";
export type AutomationScope = "schedule" | "member-join";
export type AutomationTargetMessenger = "discord" | "telegram" | "matrix";
export type AutomationTextSourceSelectionMode = "random" | "no-repeat";
export type ScheduleTriggerMode = "cron" | "interval";
export type ScheduleIntervalUnit = "minutes" | "hours" | "days" | "weeks";
export type ModelAutomationPostTargetMode = "channel" | "thread" | "forum-post" | "forum-create-and-post";
export type ModelAutomationThreadNameMode = "fixed" | "increment" | "model-name";
export type ModelAutomationModelNameSource = "llm" | "filename";
export type ModelAutomationTextureUploadTarget = "target" | "selected";
export type ModelAutomationModelUploadTarget = "target" | "selected";
export type ImagePostProcessingPostMode = "combined" | "separate";
export type ImageAutomationPostTargetMode = "channel" | "thread" | "forum-post" | "forum-create-and-post";
export type ImageAutomationThreadNameMode = "fixed" | "increment" | "image-name";
export type ImagePostProcessingStep = "remove-background" | "delight" | "pixel-art";
export type ImageAutomationSelectedChannelImageMode = "notice-only" | "original" | "all" | "custom";
export type ImageAutomationVideoMode = "text-to-video" | "text-image-to-video" | "both";
export type ImageAutomationCandidateSelectionMode = "llm" | "first";
export type ImageAutomationCandidateQueueMode = "sequential" | "comfy";
export type ImageAutomationCandidateProcessingMode = "selected" | "all";
export type ImageGifPlaybackMode = "loop" | "pingpong";

export interface ImagePostProcessingRecipe {
  label: string;
  steps: ImagePostProcessingStep[];
}

export interface ImageVariantPostTarget {
  labels: string[];
  channelId: string;
  targetMode: ImageAutomationPostTargetMode;
  threadName: string;
  forumChannelId: string;
  forumChannelName: string;
  postMode?: ImagePostProcessingPostMode;
}

export interface ImagePostProcessingOptions {
  removeBackground: boolean;
  delight: boolean;
  pixelArt: boolean;
  videoConvertToGif?: boolean;
  videoGifPlaybackMode?: ImageGifPlaybackMode;
  videoGifRemoveBackground?: boolean;
  videoGifPixelArt?: boolean;
  postMode: ImagePostProcessingPostMode;
  recipes?: ImagePostProcessingRecipe[];
}

export interface VideoWorkflowSettings {
  workflowPath: string;
  imageWorkflowPath: string;
  negativePrompt: string;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  steps?: number;
}

export interface ModelAutomationPostOptions {
  targetMode: ModelAutomationPostTargetMode;
  threadNameMode: ModelAutomationThreadNameMode;
  threadName: string;
  threadNameBase: string;
  modelNameSource: ModelAutomationModelNameSource;
  forumChannelId: string;
  forumChannelName: string;
  lowPolyForumChannelId: string;
  lowPolyForumChannelName: string;
  sendInitialToSelectedChannel: boolean;
  sendSourceImageToSelectedChannel: boolean;
  initialExtraText: string;
  modelUploadTarget: ModelAutomationModelUploadTarget;
  includeModelFile: boolean;
  includePreviewMedia: boolean;
  includeSourceImage: boolean;
  includeEmbed: boolean;
  includeButtons: boolean;
  includeEmbedInInitial: boolean;
  uploadTextureMessages: boolean;
  uploadMultiViewTextures: boolean;
  uploadUvMapTextures: boolean;
  uploadNormalMapTextures: boolean;
  textureUploadTarget: ModelAutomationTextureUploadTarget;
  destinationExtraText: string;
  generateLowPolyVersion: boolean;
  lowPolyUseLlmTargetFaces: boolean;
  lowPolyLlmDecisionSource: "input-image" | "model-render";
  lowPolyTargetFaceCount: number;
}

export interface ImageAutomationPostOptions {
  targetMode: ImageAutomationPostTargetMode;
  threadNameMode: ImageAutomationThreadNameMode;
  threadName: string;
  threadNameBase: string;
  forumChannelId: string;
  forumChannelName: string;
  sendInitialToSelectedChannel: boolean;
  selectedChannelImageMode: ImageAutomationSelectedChannelImageMode;
  selectedChannelImageLabels: string[];
  initialExtraText: string;
  destinationExtraText: string;
  includeEmbed: boolean;
  variantTargets: ImageVariantPostTarget[];
}

export interface AutomationAction {
  source: AutomationSource;
  template: string;
  prompt: string;
  promptTextFile?: string;
  textSourceSelectionMode?: AutomationTextSourceSelectionMode;
  jokesFile: string;
  textFiles?: string[];
  modelImage?: string;
  modelImagePoolId?: string;
  imageAutoPrompt?: boolean;
  imageAutoFileName?: boolean;
  imageAutoDescription?: boolean;
  imageCandidateSelectionEnabled?: boolean;
  imageCandidateCount?: number;
  imageCandidateSelectionMode?: ImageAutomationCandidateSelectionMode;
  imageCandidateQueueMode?: ImageAutomationCandidateQueueMode;
  imageCandidateProcessingMode?: ImageAutomationCandidateProcessingMode;
  imageCreateVideo?: boolean;
  imageVideoMode?: ImageAutomationVideoMode;
  imageVideoPromptDirection?: string;
  imageVideoWorkflowSettings?: VideoWorkflowSettings;
  imagePostProcessingOptions?: ImagePostProcessingOptions;
  imagePostOptions?: ImageAutomationPostOptions;
  modelAutoPrompt?: boolean;
  modelUseLlmMetadata?: boolean;
  modelUseLlmModelFileName?: boolean;
  modelUseLlmModelDescription?: boolean;
  modelAskLlmIfShouldBeMetallic?: boolean;
  modelAskLlmForRealWorldHeightAndScale?: boolean;
  modelGenerationTarget?: "local" | "remote";
  modelMetadataTarget?: "local" | "remote";
  modelMetadataTiming?: "before" | "after" | "parallel";
  modelUnloadLlmBeforeGenerate?: boolean;
  modelRandomSource?: boolean;
  modelSendStartNotice?: boolean;
  modelPostOptions?: ModelAutomationPostOptions;
}

export interface ScheduledAutomation {
  id: string;
  guildId: string;
  name: string;
  enabled: boolean;
  targetMessenger: AutomationTargetMessenger;
  channelId: string;
  triggerMode: ScheduleTriggerMode;
  cron: string;
  intervalValue: number;
  intervalUnit: ScheduleIntervalUnit;
  repeatCount: number;
  repeatDelaySeconds: number;
  action: AutomationAction;
  createdAt: string;
  lastRunAt: string | null;
}

export interface JoinAutomation {
  id: string;
  guildId: string;
  name: string;
  enabled: boolean;
  channelId: string;
  delaySeconds: number;
  action: AutomationAction;
}

export interface AutomationPreset {
  id: string;
  scope: AutomationScope;
  name: string;
  description: string;
  scheduleDefaults?: {
    triggerMode: ScheduleTriggerMode;
    cron: string;
    intervalValue: number;
    intervalUnit: ScheduleIntervalUnit;
    repeatCount: number;
    repeatDelaySeconds: number;
    action: AutomationAction;
  };
  joinDefaults?: {
    delaySeconds: number;
    action: AutomationAction;
  };
}
