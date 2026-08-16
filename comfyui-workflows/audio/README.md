# Audio Workflows

ComfyUI workflows for audio generation, speech-to-text (STT), and text-to-speech (TTS).

## Root Workflow

### `audio.json`
**Audio Generation from Text Prompt**

Generates sound effects or audio clips from text descriptions using Stable Audio Open model.
1. Load checkpoint (stable-audio-open-1.0)
2. Load CLIP (t5-base.safetensors) for text encoding
3. Encode positive prompt (e.g., "dog bark sound effect") and negative prompt
4. Generate audio using KSampler with empty latent audio
5. VAE decode audio and save as audio file

**Required Models:**
- `stable-audio-open-1.0.safetensors` - Audio generation checkpoint
- `t5-base.safetensors` - CLIP text encoder

## Speech-to-Text (STT)

### `stt/stt.json`
**Speech Recognition with Whisper**

Converts audio input to text using Whisper model with word-level alignments.
1. Load audio file
2. Apply Whisper large-v3-turbo model for speech recognition
3. Output transcribed text and segment alignments
4. Preview text and alignment results

**Required Extensions:**
- ComfyUI-Whisper

## Text-to-Speech (TTS)

### `tts/tts.json`
**Basic Text-to-Speech with Kokoro**

Generates speech from text using the Kokoro TTS model.
1. Generate text using KokoroGenerator
2. Configure speaker (e.g., "zm_yunxi") and speed
3. Save output as MP3 audio file

**Required Models:**
- Kokoro TTS model files

### `tts/qwen_tts_custom_voice.json`
**Qwen3-TTS with Custom Voice Profile**

Generates speech using Qwen3-TTS with a custom voice profile defined through detailed character description.
1. Define custom voice with character name, background, personality traits
2. Input text to synthesize
3. Configure model settings (1.7B, bf16 precision)
4. Output synthesized audio

**Required Extensions:**
- ComfyUI-Qwen3-TTS (FB_Qwen3TTSCustomVoice node)

### `tts/qwen_tts_design_voice.json`
**Qwen3-TTS Voice Design**

Creates speech using voice design parameters that describe the desired voice characteristics.
1. Define voice through character description and voice information
2. Input text to synthesize
3. Configure model settings (sdpa attention, Chinese language)
4. Output synthesized audio

**Required Extensions:**
- ComfyUI-Qwen3-TTS (FB_Qwen3TTSVoiceDesign node)

### `tts/qwen_tts_voice_clone.json`
**Qwen3-TTS Voice Cloning**

Clones a voice from reference audio and generates speech with that voice.
1. Load reference audio file for voice cloning
2. Define target text to synthesize
3. Use x-vector only mode for voice extraction
4. Output cloned voice audio (FLAC format)

**Required Extensions:**
- ComfyUI-Qwen3-TTS (FB_Qwen3TTSVoiceClone node)