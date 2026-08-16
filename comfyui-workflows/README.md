# ComfyUI Workflows

Organized collection of ComfyUI workflow JSON files for AI-powered content generation across multiple modalities: 3D models, audio, images, music, and video.

## Directory Structure

| Folder | Description |
|--------|-------------|
| [`3d/`](./3d/) | 3D model generation and editing workflows using Hy3D tools |
| [`audio/`](./audio/) | Audio generation, speech-to-text (STT), and text-to-speech (TTS) workflows |
| [`image/`](./image/) | Image generation, editing, upscaling, and background removal workflows |
| [`music/`](./music/) | Music generation workflow using AceStep Audio model |
| [`video/`](./video/) | Video generation workflows using HunyuanVideo 1.5 (text-to-video & image-to-video) |

## Quick Overview

### 🎨 Image Workflows (`image/`)
- **Qwen Image** — Text-to-image and image editing with Qwen models (including Lightning LORA for fast 8-step generation)
- **Layered Generation** — Multi-layer image output from input image + text prompt
- **LoRA** — Character-style image generation with Dreamshaper + LoRA checkpoints
- **Background Removal** — Clean background removal using TransparentBG / InSPyReNet
- **Upscaling** — Model-based 4x upscaling with `4x_foolhardy_Remacri.pth`

### 🎵 Audio Workflows (`audio/`)
- **Audio Generation** — Sound effects from text prompts via Stable Audio Open
- **Speech-to-Text** — Whisper-based transcription with word-level alignments (`audio/stt/`)
- **Text-to-Speech** — Kokoro TTS and Qwen3-TTS with custom voice, voice design, and voice cloning (`audio/tts/`)

### 🎬 Video Workflows (`video/`)
- **Text-to-Video** — Generate videos from text descriptions using HunyuanVideo 1.5 (720p)
- **Image-to-Video** — Animate a reference image with descriptive text prompts

### 🎶 Music Workflows (`music/`)
- **J-Pop / Anime Music** — Full music track generation with lyrics and tags using AceStep Audio 3.5B

### 🧊 3D Model Workflows (`3d/`)
- **Mesh Generation** — Generate textured 3D models from single images using Hunyuan3D
- **Mesh Editing** — Load, process, texture inpaint, and export existing GLB meshes

## Requirements

Most workflows require custom ComfyUI nodes and models. See individual folder READMEs for specific requirements:

- **ComfyUI-Hy3DExtension** — 3D model generation (Hy3D)
- **ComfyUI-Whisper** — Speech recognition
- **ComfyUI-Qwen3-TTS** — Advanced text-to-speech
- **comfyui-essentials** — Image utilities (resize, crop, etc.)

## License

This is a collection of personal workflow configurations for ComfyUI.