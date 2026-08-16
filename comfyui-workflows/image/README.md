# Image Workflows

ComfyUI workflows for image generation, editing, upscaling, and background removal using various AI models.

## Workflows

### `image_delight.json`
**3D Image Delighting with Background Removal**

Enhances images with 3D lighting effects using Hunyuan3D delight model, including background processing.
1. Load input image
2. Upscale and remove background
3. Resize and crop by mask
4. Apply Hy3DDelightImage for lighting enhancement
5. Remove background from result and save

**Required Models:**
- `hunyuan3d-delight-v2-0` - Delight model
- `4x_foolhardy_Remacri.pth` - Upscale model

### `image_edit.json`
**Qwen Image Editing Workflow**

Edits images based on text prompts using Qwen Image Edit model.
1. Load input image
2. Scale image to target resolution (1MP)
3. Encode prompt using TextEncodeQwenImageEdit with VAE encoding
4. Create negative conditioning
5. Load UNET model (qwen_image_fp8_e4m3fn.safetensors)
6. Sample with KSampler (CFG norm, AuraFlow sampling)
7. VAE decode and save result

**Required Models:**
- `qwen_image_fp8_e4m3fn.safetensors` - Diffusion model
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` - CLIP text encoder
- `qwen_image_vae.safetensors` - VAE

### `image_qwen_image.json`
**Qwen Image Generation from Text**

Generates images from text prompts using Qwen Image model with Lightning LORA for fast sampling.
1. Load diffusion model (qwen_image_fp8_e4m3fn.safetensors)
2. Apply Lightning LORA (Qwen-Image-Lightning-8steps-V1.0.safetensors) for 8-step generation
3. Encode text prompt using CLIP
4. Generate with KSampler (14 steps, euler sampler)
5. VAE decode and save

**Required Models:**
- `qwen_image_fp8_e4m3fn.safetensors` - Base diffusion model
- `Qwen-Image-Lightning-8steps-V1.0.safetensors` - Lightning LORA
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` - CLIP
- `qwen_image_vae.safetensors` - VAE

### `image_qwen_image_layered.json`
**Qwen Image Layered Generation**

Generates layered images from input image + text prompt using Qwen Image Layered model. This is a subgraph-based workflow that supports multiple layer outputs.
1. Load input image and scale to max dimension (640px recommended)
2. Enter text prompt for scene description
3. Process through Qwen-Image-Layered subgraph
4. Output layered result images

**Recommended Settings:**
- Steps: 50, CFG: 4.0 (original settings; workflow uses 20 steps, CFG 2.5)
- Input size: 640px for standard, 1024px for high-res

**Required Models:**
- `qwen_image_layered_bf16.safetensors` - Diffusion model (or `qwen_image_layered_fp8mixed.safetensors` for FP8)
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` - Text encoder
- `qwen_image_layered_vae.safetensors` - VAE

**Storage Location:**
```
models/
├── text_encoders/
│   └── qwen_2.5_vl_7b_fp8_scaled.safetensors
├── diffusion_models/
│   └── qwen_image_layered_bf16.safetensors
└── vae/
    └── qwen_image_layered_vae.safetensors
```

### `lora.json`
**LoRA-Based Image Generation**

Generates images using a checkpoint with LoRA adaptation.
1. Load checkpoint (dreamshaper_8.safetensors)
2. Apply LoRA (blindbox_v1_mix.safetensors) with strength 0.75 model, 1.0 clip
3. Encode positive/negative prompts for chibi-style character
4. Generate with KSampler (30 steps, dpmpp_2m sampler)
5. VAE decode and save

**Required Models:**
- `dreamshaper_8.safetensors` - Base checkpoint
- `blindbox_v1_mix.safetensors` - LoRA weights

### `lora_rembg.json`
**LoRA Image with Background Removal**

Similar to lora.json but adds background removal on the loaded image before processing. Uses TransparentBG for clean background removal.

### `lora_rembg_crop.json`
**LoRA Image with Background Removal and Cropping**

Extends lora_rembg.json by additionally cropping the image using the mask from background removal. Useful for preparing images as reference inputs.

### `remove_background.json`
**Simple Background Removal**

Removes background from an input image using TransparentBG (InSPyReNet).
1. Load image
2. Create transparent background session (base mode)
3. Remove background and save with alpha channel

### `upscale.json`
**Image Upscaling Workflow**

Upscales images using model-based upscaling followed by resizing.
1. Load upscale model (4x_foolhardy_Remacri.pth)
2. Load input image
3. Upscale using ImageUpscaleWithModel
4. Get original image dimensions
5. Resize to match original dimensions
6. Save upscaled result

**Required Models:**
- `4x_foolhardy_Remacri.pth` - 4x upscale model

## Required Extensions
- comfyui-essentials (ImageResize+, GetImageSize+, ImageCropByMask)
- TransparentBG / rembg nodes