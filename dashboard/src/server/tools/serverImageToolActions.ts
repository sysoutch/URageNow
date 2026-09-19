import { adjustImageTransparency, createAsciiArt, createNormalMap, cropAndScaleImage, extractImagePalette, naturalizeImage, replaceImageColor, toonShadeImage, createPseudoAlbedo } from "./imageToolTransforms.js";
import { convertImageToPixelArt } from "./pixelArtConverter.js";

export const serverImageToolActions = {
  pixelArt: convertImageToPixelArt,
  normalMap: createNormalMap,
  ascii: createAsciiArt,
  palette: extractImagePalette,
  colorSwap: replaceImageColor,
  transparency: adjustImageTransparency,
  resize: cropAndScaleImage,
  naturalize: naturalizeImage,
  toon: toonShadeImage,
  albedo: createPseudoAlbedo
};