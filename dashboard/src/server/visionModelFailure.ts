export type ImageInterpretationFailure = {
  code: "vision_model_required" | "image_interpretation_failed";
  message: string;
};

export function getImageInterpretationFailure(error: unknown): ImageInterpretationFailure {
  const detail = error instanceof Error ? error.message : String(error || "");
  if (/does not support image inputs|images?.*not supported|vision model/i.test(detail)) {
    return {
      code: "vision_model_required",
      message: "Image interpretation requires a vision-capable model. Select one in Studio Settings and try again."
    };
  }
  return {
    code: "image_interpretation_failed",
    message: "Image interpretation failed. Check the selected vision model and try again."
  };
}
