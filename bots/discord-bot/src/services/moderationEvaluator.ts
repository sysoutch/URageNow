import { analyzeImageInputsWithLlava, type LlavaImageAnalysis } from "@urage/server/services/llm/ollama";
import {
  compileUserRegexPattern,
  compileWildcardPattern
} from "@urage/server/services/moderationRules";
import type { GuildDashboardSettings } from "@urage/shared/dashboard/runtimeContracts";
import type { ModerationSimulationResult } from "@urage/shared/moderation/contracts";

export interface RuleMatchResult {
  matched: boolean;
  reason: string;
}

export function findConfiguredRuleMatch(content: string, settings: GuildDashboardSettings): RuleMatchResult | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  for (const pattern of settings.antiSpamTextRulePatterns) {
    const regex = compileUserRegexPattern(pattern);
    if (regex.test(trimmed)) {
      return {
        matched: true,
        reason: `Matched custom spam regex: ${pattern}`
      };
    }
  }

  for (const pattern of settings.antiSpamBlockedLinkPatterns) {
    const regex = compileWildcardPattern(pattern);
    if (regex.test(trimmed)) {
      return {
        matched: true,
        reason: `Matched blocked link pattern: ${pattern}`
      };
    }
  }

  return null;
}

export function shouldFlagImageAnalysis(
  analysis: {
    isSpam: boolean;
    isNsfw: boolean;
    isCryptoSpam: boolean;
    showsCryptoImage: boolean;
  },
  settings: GuildDashboardSettings
): boolean {
  return (
    (settings.antiSpamImageFlagSpam && analysis.isSpam)
    || (settings.antiSpamImageFlagNsfw && analysis.isNsfw)
    || (settings.antiSpamImageFlagCryptoSpam && analysis.isCryptoSpam)
    || (settings.antiSpamImageFlagCryptoImage && analysis.showsCryptoImage)
  );
}

export async function simulateModerationCheck(
  text: string,
  imageInputs: string[],
  settings: GuildDashboardSettings
): Promise<ModerationSimulationResult> {
  const textRuleMatch = findConfiguredRuleMatch(text, settings);

  if (!settings.antiSpamEnabled) {
    return {
      featureEnabled: false,
      matchedTextRule: textRuleMatch?.matched === true,
      textRuleReason: textRuleMatch?.reason ?? null,
      imageCount: imageInputs.length,
      imageAnalysisEnabled: settings.antiSpamAnalyzeImages,
      imageFlagged: false,
      imageReason: null,
      imageRawResponse: null,
      wouldFlagDuplicatePost: false,
      wouldFlagMonitoredImageChannel: false,
      summary: "Anti-spam is currently disabled, so this payload would not be acted on."
    };
  }

  let imageAnalysis: LlavaImageAnalysis | null = null;
  let imageReason: string | null = null;
  let imageFlagged = false;

  if (imageInputs.length > 0) {
    if (!settings.antiSpamAnalyzeImages) {
      imageReason = "Image analysis is disabled in the current moderation settings.";
    } else {
      imageAnalysis = await analyzeImageInputsWithLlava(imageInputs);
      imageFlagged = shouldFlagImageAnalysis(imageAnalysis, settings);
      imageReason = imageAnalysis.reason;
    }
  }

  const wouldFlagDuplicatePost = textRuleMatch?.matched === true || imageFlagged;
  const wouldFlagMonitoredImageChannel = imageFlagged;

  const summaryParts: string[] = [];
  if (textRuleMatch?.matched) {
    summaryParts.push(`Text rules would flag the duplicate message: ${textRuleMatch.reason}`);
  }
  if (imageInputs.length > 0 && imageReason) {
    summaryParts.push(
      imageFlagged
        ? `Image analysis would flag the attachment set: ${imageReason}`
        : `Image analysis would allow the attachment set: ${imageReason}`
    );
  }
  if (summaryParts.length === 0) {
    summaryParts.push("No current anti-spam rule would flag this test payload.");
  }

  return {
    featureEnabled: true,
    matchedTextRule: textRuleMatch?.matched === true,
    textRuleReason: textRuleMatch?.reason ?? null,
    imageCount: imageInputs.length,
    imageAnalysisEnabled: settings.antiSpamAnalyzeImages,
    imageFlagged,
    imageReason,
    imageRawResponse: imageAnalysis?.rawResponse ?? null,
    wouldFlagDuplicatePost,
    wouldFlagMonitoredImageChannel,
    summary: summaryParts.join("\n")
  };
}
