import { asPositiveNumber } from "./primitives.js";
import type { RealWorldDimensions, RealWorldSizeTier } from "@urage/shared/model3d/contracts";

export type { RealWorldDimensions, RealWorldSizeTier } from "@urage/shared/model3d/contracts";

type LengthUnit = "mm" | "cm" | "m" | "km" | "in" | "ft";

type RealWorldDimensionSource = {
  lowPolyRealWorldWidthMeters: unknown;
  lowPolyRealWorldHeightMeters: unknown;
  lowPolyRealWorldDepthMeters: unknown;
};

export function parseRealWorldSizeTier(value: unknown): RealWorldSizeTier | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "tiny" || normalized === "small" || normalized === "medium" || normalized === "large" || normalized === "huge") {
    return normalized;
  }
  return null;
}

function normalizeLengthUnit(value: string | undefined): LengthUnit | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "mm" || normalized === "millimeter" || normalized === "millimeters") {
    return "mm";
  }
  if (normalized === "cm" || normalized === "centimeter" || normalized === "centimeters") {
    return "cm";
  }
  if (normalized === "m" || normalized === "meter" || normalized === "meters") {
    return "m";
  }
  if (normalized === "km" || normalized === "kilometer" || normalized === "kilometers") {
    return "km";
  }
  if (normalized === "in" || normalized === "inch" || normalized === "inches") {
    return "in";
  }
  if (normalized === "ft" || normalized === "foot" || normalized === "feet") {
    return "ft";
  }
  return null;
}

function toMeters(value: number, unit: LengthUnit): number {
  if (unit === "mm") {
    return value / 1000;
  }
  if (unit === "cm") {
    return value / 100;
  }
  if (unit === "m") {
    return value;
  }
  if (unit === "km") {
    return value * 1000;
  }
  if (unit === "in") {
    return value * 0.0254;
  }
  return value * 0.3048;
}

export function parseRealWorldDimensionsText(value: string): RealWorldDimensions | null {
  const normalizedText = value.trim().toLowerCase().replace(/[\u00D7*]/g, "x").replace(/,/g, ".");
  if (!normalizedText) {
    return null;
  }
  const tokenRegex = /(\d+(?:\.\d+)?)\s*(mm|millimeter(?:s)?|cm|centimeter(?:s)?|m|meter(?:s)?|km|kilometer(?:s)?|in|inch(?:es)?|ft|foot|feet)?/gi;
  const tokens: Array<{ amount: number; unit: LengthUnit | null; }> = [];
  for (const match of normalizedText.matchAll(tokenRegex)) {
    const rawAmount = match[1] ?? "";
    const amount = Number.parseFloat(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    tokens.push({
      amount,
      unit: normalizeLengthUnit(match[2])
    });
  }
  if (tokens.length === 0) {
    return null;
  }
  const fallbackUnit = [...tokens].reverse().find(token => token.unit !== null)?.unit ?? null;
  if (!fallbackUnit) {
    return null;
  }
  const metersValues = tokens
    .slice(0, 3)
    .map(token => toMeters(token.amount, token.unit ?? fallbackUnit))
    .filter(amount => Number.isFinite(amount) && amount > 0);
  if (metersValues.length === 0) {
    return null;
  }
  const widthMeters = metersValues[0] as number;
  const heightMeters = metersValues[1] ?? widthMeters;
  const depthMeters = metersValues[2] ?? Math.min(widthMeters, heightMeters);
  if (!(widthMeters > 0) || !(heightMeters > 0) || !(depthMeters > 0)) {
    return null;
  }
  return normalizeRealWorldDimensions({
    widthMeters,
    heightMeters,
    depthMeters
  });
}

export function normalizeRealWorldDimensions(value: RealWorldDimensions | null | undefined): RealWorldDimensions | null {
  if (!value) {
    return null;
  }
  const widthMeters = asPositiveNumber(value.widthMeters);
  const heightMeters = asPositiveNumber(value.heightMeters);
  const depthMeters = asPositiveNumber(value.depthMeters);
  if (widthMeters === null || heightMeters === null || depthMeters === null) {
    return null;
  }
  return {
    widthMeters: Number.parseFloat(widthMeters.toFixed(4)),
    heightMeters: Number.parseFloat(heightMeters.toFixed(4)),
    depthMeters: Number.parseFloat(depthMeters.toFixed(4))
  };
}

export function readRecordRealWorldDimensions(record: RealWorldDimensionSource): RealWorldDimensions | null {
  const widthMeters = asPositiveNumber(record.lowPolyRealWorldWidthMeters);
  const heightMeters = asPositiveNumber(record.lowPolyRealWorldHeightMeters);
  const depthMeters = asPositiveNumber(record.lowPolyRealWorldDepthMeters);
  if (widthMeters === null || heightMeters === null || depthMeters === null) {
    return null;
  }
  return {
    widthMeters,
    heightMeters,
    depthMeters
  };
}

export function deriveRealWorldSizeTierFromDimensions(dimensions: RealWorldDimensions | null | undefined): RealWorldSizeTier | null {
  if (!dimensions) {
    return null;
  }
  const normalized = normalizeRealWorldDimensions(dimensions);
  if (!normalized) {
    return null;
  }
  const largestDimensionMeters = Math.max(normalized.widthMeters, normalized.heightMeters, normalized.depthMeters);
  if (largestDimensionMeters <= 0.12) {
    return "tiny";
  }
  if (largestDimensionMeters <= 0.8) {
    return "small";
  }
  if (largestDimensionMeters <= 2.2) {
    return "medium";
  }
  if (largestDimensionMeters <= 8) {
    return "large";
  }
  return "huge";
}
