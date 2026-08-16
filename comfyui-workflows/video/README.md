# Video Workflows

ComfyUI workflows for video generation using HunyuanVideo 1.5 model.

## Workflows

### `video_from_text.json`
**Text-to-Video Generation**

Generates videos from text prompts using HunyuanVideo 1.5 text-to-video model (720p).

**Workflow Steps:**
1. Load VAE (hunyuanvideo15_vae_fp16.safetensors)
2. Load UNET model (hunyuanvideo1.5_720p_t2v_fp16.safetensors)
3. Load dual CLIP encoders:
   - `qwen_2.5_vl_7b_fp8_scaled.safetensors` - Main text encoder
   - `byt5_small_glyphxl_fp16.safetensors` - ByT5 glyph XL encoder
4. Encode positive prompt (Chinese text describing an animated scene)
5. Apply EasyCache for optimized inference
6. Modify model with ModelSamplingSD3 (shift: 7)
7. Generate empty latent (512x512, 13 frames)
8. Sample with BasicScheduler (25 steps, simple scheduler) using euler sampler
9. VAE decode frames
10. Create video at 6 FPS and save as H.264 MP4

**Prompt Example:**
A vibrant 2D animated scene of a young inventor piloting a self-built ornithopter over a sky city, flying between giant windmills and floating islands, with dynamic lighting and optimistic atmosphere.

**Settings:**
- Resolution: 512x512
- Frames: 13
- Steps: 25
- CFG: 6
- FPS: 6
- Seed: 887963123424675

### `video_from_image_text.json`
**Image-to-Video Generation**

Generates videos from a reference image + text description using HunyuanVideo 1.5 image-to-video model (720p).

**Workflow Steps:**
1. Load VAE (hunyuanvideo15_vae_fp16.safetensors)
2. Load UNET model (hunyuanvideo1.5_720p_i2v_fp16.safetensors) - image-to-video variant
3. Load CLIP Vision model (sigclip_vision_patch14_384.safetensors)
4. Load dual CLIP encoders for text:
   - `qwen_2.5_vl_7b_fp8_scaled.safetensors`
   - `byt5_small_glyphxl_fp16.safetensors`
5. Load reference image
6. Encode image with CLIPVision
7. Encode positive text prompt describing video transformation
8. Apply EasyCache for optimized inference
9. Modify model with ModelSamplingSD3 (shift: 7)
10. Generate latent using HunyuanVideo15ImageToVideo node (combines image + text conditioning)
11. Sample with BasicScheduler (25 steps, simple scheduler) using euler sampler
12. VAE decode frames
13. Create video at 6 FPS and save as H.264 MP4

**Prompt Example:**
A hand pinching gesture appears to hold a bright full moon displayed on a computer monitor, which then glows brighter, detaches from the screen with a soft shimmer, and emerges into real space casting warm light.

**Settings:**
- Resolution: 512x512
- Frames: 13
- Steps: 25
- CFG: 5
- FPS: 6
- Seed: 887963123424675

## Required Models

Both workflows require the following models:

**Video Model:**
- `hunyuanvideo1.5_720p_t2v_fp16.safetensors` - Text-to-video model
- `hunyuanvideo1.5_720p_i2v_fp16.safetensors` - Image-to-video model

**VAE:**
- `hunyuanvideo15_vae_fp16.safetensors` - HunyuanVideo VAE

**Text Encoders:**
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` - Qwen 2.5 VL text encoder
- `byt5_small_glyphxl_fp16.safetensors` - ByT5 glyph XL encoder

**Vision Encoder (image-to-video only):**
- `sigclip_vision_patch14_384.safetensors` - CLIP Vision encoder

## Required Extensions
- ComfyUI-HunyuanVideo (or equivalent HunyuanVideo integration)