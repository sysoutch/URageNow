import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import type { RealWorldSizeTier } from "@urage/server/services/model3d";

export interface LowPolySizeChoice {
  tier: RealWorldSizeTier;
  label: string;
  faceCount: number;
}

export interface LowPolyInteractionContext {
  modelId: string;
  sourceMessageId: string | null;
}

export function getLowPolyTargetFaceCountForTier(tier: RealWorldSizeTier, choices: LowPolySizeChoice[], defaultFaceCount: number): number {
  const matched = choices.find(entry => entry.tier === tier);
  return matched?.faceCount ?? defaultFaceCount;
}

export function parseRealWorldSizeTier(value: string): RealWorldSizeTier | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "tiny" || normalized === "small" || normalized === "medium" || normalized === "large" || normalized === "huge") {
    return normalized;
  }
  return null;
}

export function parseLowPolyInteractionContext(payload: string): LowPolyInteractionContext | null {
  const normalized = payload.trim();
  if (!normalized) {
    return null;
  }
  const separatorIndex = normalized.lastIndexOf(":");
  if (separatorIndex <= 0) {
    return { modelId: normalized, sourceMessageId: null };
  }
  const modelId = normalized.slice(0, separatorIndex).trim();
  const sourceMessageId = normalized.slice(separatorIndex + 1).trim();
  if (!modelId) {
    return null;
  }
  if (!/^\d{17,22}$/.test(sourceMessageId)) {
    return { modelId: normalized, sourceMessageId: null };
  }
  return { modelId, sourceMessageId };
}

export function buildLowPolyInteractionPayload(modelId: string, sourceMessageId?: string): string {
  const normalizedModelId = modelId.trim();
  const normalizedSourceMessageId = sourceMessageId?.trim() ?? "";
  if (normalizedSourceMessageId && /^\d{17,22}$/.test(normalizedSourceMessageId)) {
    return `${normalizedModelId}:${normalizedSourceMessageId}`;
  }
  return normalizedModelId;
}

export function parseLowPolySizeButtonValue(customId: string, sizePrefix: string): { modelId: string; sourceMessageId: string | null; tier: RealWorldSizeTier; } | null {
  const payload = customId.slice(sizePrefix.length).trim();
  const separatorIndex = payload.lastIndexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }
  const context = parseLowPolyInteractionContext(payload.slice(0, separatorIndex));
  const tier = parseRealWorldSizeTier(payload.slice(separatorIndex + 1));
  if (!context?.modelId || !tier) {
    return null;
  }
  return { modelId: context.modelId, sourceMessageId: context.sourceMessageId, tier };
}

export function parseLowPolyModalValue(customId: string, prefix: string): LowPolyInteractionContext | null {
  return parseLowPolyInteractionContext(customId.slice(prefix.length));
}

export function buildLowPolySizePickerComponents(input: {
  modelId: string;
  sourceMessageId?: string;
  sizeChoices: LowPolySizeChoice[];
  sizePrefix: string;
  dimensionsPrefix: string;
  complexityPrefix: string;
  autoPrefix: string;
}): Array<ActionRowBuilder<ButtonBuilder>> {
  const payload = buildLowPolyInteractionPayload(input.modelId, input.sourceMessageId);
  const firstRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...input.sizeChoices.slice(0, 5).map(entry => (
      new ButtonBuilder()
        .setCustomId(`${input.sizePrefix}${payload}:${entry.tier}`)
        .setLabel(entry.label)
        .setStyle(ButtonStyle.Secondary)
    ))
  );
  const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${input.dimensionsPrefix}${payload}`)
      .setLabel("ðŸ“ Dimensions")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${input.complexityPrefix}${payload}`)
      .setLabel("ðŸ§  AI Complexity")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${input.autoPrefix}${payload}`)
      .setLabel("ðŸ¤– AI Size")
      .setStyle(ButtonStyle.Primary)
  );
  return [firstRow, secondRow];
}

