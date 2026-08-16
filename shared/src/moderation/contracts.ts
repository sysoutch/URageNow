export interface ModerationSimulationResult {
  featureEnabled: boolean;
  matchedTextRule: boolean;
  textRuleReason: string | null;
  imageCount: number;
  imageAnalysisEnabled: boolean;
  imageFlagged: boolean;
  imageReason: string | null;
  imageRawResponse: string | null;
  wouldFlagDuplicatePost: boolean;
  wouldFlagMonitoredImageChannel: boolean;
  summary: string;
}
