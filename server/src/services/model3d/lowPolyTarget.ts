import { appConfig } from "../../config/appConfig.js";
import { asInteger } from "./primitives.js";
import { deriveRealWorldSizeTierFromDimensions, type RealWorldDimensions, type RealWorldSizeTier } from "./realWorld.js";

export function resolveFaceCountFromRealWorldSizeTier(sizeTier: RealWorldSizeTier | null | undefined): number | null {
  if (sizeTier === "tiny") {
    return 500;
  }
  if (sizeTier === "small") {
    return 1000;
  }
  if (sizeTier === "medium") {
    return 1500;
  }
  if (sizeTier === "large") {
    return 3000;
  }
  if (sizeTier === "huge") {
    return 5000;
  }
  return null;
}

export function resolveFaceCountFromRealWorldDimensions(dimensions: RealWorldDimensions | null | undefined): number | null {
  const sizeTier = deriveRealWorldSizeTierFromDimensions(dimensions);
  return resolveFaceCountFromRealWorldSizeTier(sizeTier);
}

export function resolveLowPolyTargetFaceCount(
  inputValue: number | undefined,
  existingValue: number | null,
  realWorldSizeTier?: RealWorldSizeTier | null,
  realWorldDimensions?: RealWorldDimensions | null
): number {
  const inputCount = asInteger(inputValue);
  if (inputCount !== null) {
    return inputCount;
  }
  const sizeCount = resolveFaceCountFromRealWorldSizeTier(realWorldSizeTier);
  if (sizeCount !== null) {
    return sizeCount;
  }
  const dimensionsCount = resolveFaceCountFromRealWorldDimensions(realWorldDimensions);
  if (dimensionsCount !== null) {
    return dimensionsCount;
  }
  const existingCount = asInteger(existingValue);
  if (existingCount !== null) {
    return existingCount;
  }
  return appConfig.lowPolyDefaultTargetFaceCount;
}
