(function () {
    'use strict';

    window.PAS_PIXEL_ART_UI_PRESETS = {
        palettePresets: {
            pico8: {
                name: 'PICO-8',
                hex: [
                    '#000000', '#1d2b53', '#7e2553', '#008751',
                    '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
                    '#ff004d', '#ffa300', '#ffec27', '#00e436',
                    '#29adff', '#83769c', '#ff77a8', '#ffccaa'
                ]
            },
            gb: {
                name: 'Game Boy',
                hex: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
            },
            db16: {
                name: 'DawnBringer 16',
                hex: [
                    '#140c1c', '#442434', '#30346d', '#4e4a4e',
                    '#854c30', '#346524', '#d04648', '#757161',
                    '#597dce', '#d27d2c', '#8595a1', '#6daa2c',
                    '#d2aa99', '#6dc2ca', '#dad45e', '#deeed6'
                ]
            },
            c64: {
                name: 'C64 (Pepto)',
                hex: [
                    '#000000', '#ffffff', '#68372b', '#70a4b2',
                    '#6f3d86', '#588d43', '#352879', '#b8c76f',
                    '#6f4f25', '#433900', '#9a6759', '#444444',
                    '#6c6c6c', '#9ad284', '#6c5eb5', '#959595'
                ]
            }
        },
        commonQuickPreset: {
            checked: { preserveTransparencyCheckbox: true },
            values: { minOpaqueSlider: 15 }
        },
        quickPresets: {
            true_pixel: {
                checked: {
                    autoScaleCheckbox: false,
                    advancedSamplingCheckbox: true,
                    paletteEnableCheckbox: true,
                    lockPaletteCheckbox: false,
                    targetResCheckbox: true,
                    preserveTransparencyCheckbox: true,
                    forceOpaqueBlocksCheckbox: true,
                    gradientCrushCheckbox: true,
                    mergeSimilarCheckbox: true,
                    ditherCleanupCheckbox: true,
                    aaRemoveCheckbox: true,
                    despeckleCheckbox: true,
                    islandsCheckbox: true,
                    applyDitherCheckbox: false,
                    outlineCheckbox: false
                },
                values: {
                    pixelSizeSlider: 1,
                    blockSizeSlider: 1,
                    colorToleranceSlider: 10,
                    blockInsetSlider: 0,
                    alphaCutoffSlider: 2,
                    sampleStepSlider: 1,
                    palettePresetSelect: 'auto',
                    paletteSizeSlider: 12,
                    paletteMethodSelect: 'kmeans',
                    valueStepsSlider: 5,
                    mergeThresholdSlider: 18,
                    mergeMinSizeSlider: 8,
                    ditherStrengthSlider: 68,
                    aaStrengthSlider: 78,
                    despeckleSlider: 52,
                    islandsSlider: 8,
                    targetMaxSlider: 128,
                    targetResampleSelect: 'smooth',
                    outputResolutionSelect: 'target',
                    exportQualitySelect: 'original',
                    overlayModeSelect: 'diff'
                }
            },
            palette_only: {
                checked: {
                    paletteEnableCheckbox: true,
                    lockPaletteCheckbox: false,
                    gradientCrushCheckbox: false,
                    mergeSimilarCheckbox: false,
                    despeckleCheckbox: false,
                    islandsCheckbox: false,
                    aaRemoveCheckbox: false,
                    ditherCleanupCheckbox: false,
                    applyDitherCheckbox: false,
                    outlineCheckbox: false
                },
                values: {
                    palettePresetSelect: 'auto',
                    paletteSizeSlider: 16,
                    paletteMethodSelect: 'kmeans'
                }
            },
            sprite_clean: {
                checked: {
                    paletteEnableCheckbox: true,
                    lockPaletteCheckbox: false,
                    applyDitherCheckbox: false,
                    gradientCrushCheckbox: false,
                    mergeSimilarCheckbox: true,
                    ditherCleanupCheckbox: true,
                    aaRemoveCheckbox: true,
                    despeckleCheckbox: true,
                    islandsCheckbox: true
                },
                values: {
                    palettePresetSelect: 'auto',
                    paletteSizeSlider: 16,
                    paletteMethodSelect: 'kmeans',
                    applyDitherModeSelect: 'ordered',
                    applyDitherSlider: 0,
                    valueStepsSlider: 0,
                    mergeThresholdSlider: 10,
                    mergeMinSizeSlider: 6,
                    ditherStrengthSlider: 35,
                    aaStrengthSlider: 35,
                    despeckleSlider: 25,
                    islandsSlider: 6
                }
            },
            ai_mild: {
                checked: {
                    paletteEnableCheckbox: true,
                    lockPaletteCheckbox: false,
                    gradientCrushCheckbox: true,
                    mergeSimilarCheckbox: true,
                    ditherCleanupCheckbox: true,
                    aaRemoveCheckbox: true,
                    despeckleCheckbox: true,
                    islandsCheckbox: true
                },
                values: {
                    palettePresetSelect: 'auto',
                    paletteSizeSlider: 24,
                    paletteMethodSelect: 'kmeans',
                    valueStepsSlider: 6,
                    mergeThresholdSlider: 10,
                    mergeMinSizeSlider: 6,
                    ditherStrengthSlider: 45,
                    applyDitherModeSelect: 'ordered',
                    aaStrengthSlider: 40,
                    despeckleSlider: 30,
                    islandsSlider: 6
                }
            },
            ai_strong: {
                checked: {
                    paletteEnableCheckbox: true,
                    lockPaletteCheckbox: false,
                    gradientCrushCheckbox: true,
                    mergeSimilarCheckbox: true,
                    ditherCleanupCheckbox: true,
                    aaRemoveCheckbox: true,
                    despeckleCheckbox: true,
                    islandsCheckbox: true,
                    applyDitherCheckbox: false
                },
                values: {
                    palettePresetSelect: 'auto',
                    paletteSizeSlider: 16,
                    paletteMethodSelect: 'kmeans',
                    valueStepsSlider: 4,
                    mergeThresholdSlider: 16,
                    mergeMinSizeSlider: 10,
                    ditherStrengthSlider: 70,
                    aaStrengthSlider: 70,
                    despeckleSlider: 60,
                    islandsSlider: 10,
                    applyDitherModeSelect: 'ordered',
                    applyDitherSlider: 0
                }
            }
        }
    };
}());
