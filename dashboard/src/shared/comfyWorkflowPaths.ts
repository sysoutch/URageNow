export const comfyWorkflowPaths = {
  model3d: {
    primary: "comfyui-workflows/3d/3dmodel_redone.json",
    multiview: "comfyui-workflows/3d/3dmodel_multiview.json",
    fallback: "comfyui-workflows/3d/3d-model.json"
  },
  image: {
    generate: "comfyui-workflows/image/image_qwen_image.json",
    edit: "comfyui-workflows/image/image_edit.json",
    upscale: "comfyui-workflows/image/upscale.json",
    layered: "comfyui-workflows/image/image_qwen_image_layered.json",
    delight: "comfyui-workflows/image/image_delight.json",
    removeBackground: {
      source: "comfyui-workflows/image/remove_background.json",
      lora: "comfyui-workflows/image/lora_rembg.json",
      "lora-crop": "comfyui-workflows/image/lora_rembg_crop.json"
    }
  },
  audio: {
    generate: "comfyui-workflows/audio/audio.json"
  },
  speech: {
    tts: {
      standard: "comfyui-workflows/audio/tts/tts.json",
      voiceClone: "comfyui-workflows/audio/tts/qwen_tts_voice_clone.json",
      customVoice: "comfyui-workflows/audio/tts/qwen_tts_custom_voice.json",
      designVoice: "comfyui-workflows/audio/tts/qwen_tts_design_voice.json"
    },
    stt: "comfyui-workflows/audio/stt/stt.json",
    sts: "comfyui-workflows/audio/sts/sts.json"
  },
  music: {
    generate: "comfyui-workflows/music/music.json"
  },
  video: {
    generate: "comfyui-workflows/video/video_from_text.json",
    text: "comfyui-workflows/video/video_from_text.json",
    imageText: "comfyui-workflows/video/video_from_image_text.json"
  }
} as const;

export const comfyImageRemoveBackgroundWorkflowRelativePaths = comfyWorkflowPaths.image.removeBackground;
export type ComfyImageRemoveBackgroundWorkflowMode = keyof typeof comfyImageRemoveBackgroundWorkflowRelativePaths;

export function getDashboardClientComfyWorkflowPathsScript(): string {
  const compactClientPaths = {
    model3d: {
      primary: comfyWorkflowPaths.model3d.primary,
      multiview: comfyWorkflowPaths.model3d.multiview
    },
    image: {
      generate: comfyWorkflowPaths.image.generate,
      edit: comfyWorkflowPaths.image.edit,
      upscale: comfyWorkflowPaths.image.upscale,
      layered: comfyWorkflowPaths.image.layered,
      delight: comfyWorkflowPaths.image.delight,
      removeBackground: comfyWorkflowPaths.image.removeBackground
    },
    audio: comfyWorkflowPaths.audio.generate,
    speech: comfyWorkflowPaths.speech,
    music: comfyWorkflowPaths.music.generate,
    video: comfyWorkflowPaths.video
  };
  return `globalThis.dashboardComfyWorkflowPaths = Object.freeze(${JSON.stringify(compactClientPaths)});`;
}
