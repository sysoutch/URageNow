# Music Workflows

ComfyUI workflows for music generation using AceStep Audio model.

## Workflows

### `music.json`
**J-Pop / Anime Music Generation from Lyrics**

Generates a complete J-Pop style music track with anime-style soft female vocals from lyrics and tags using AceStep Audio model (3.5B parameters).

**Workflow Steps:**
1. Load checkpoint (ace_step_v1_3.5b.safetensors)
2. Modify model for AuraFlow sampling with shift 5.0
3. Apply Reinhard tonemap operation (multiplier: 1.0) for CFG scaling
4. Encode tags: "anime, soft female vocals, kawaii pop, j-pop, childish, piano, guitar, synthesizer, fast, happy, cheerful, lighthearted"
5. Encode lyrics in German describing a character named with poetic verses
6. Generate 120-second audio using EmptyAceStepLatentAudio
7. Sample with KSampler (50 steps, euler sampler, CFG: 5)
8. VAE decode audio and save as MP3

**Prompt Configuration:**
- **Tags**: anime, soft female vocals, kawaii pop, j-pop, childish, piano, guitar, synthesizer, fast, happy, cheerful, lighthearted
- **Lyrics**: German-language song with multiple verses describing a character's personality and appearance

**Required Models:**
- `ace_step_v1_3.5b.safetensors` - AceStep Audio model (3.5B parameters)

**Settings:**
- Duration: 120 seconds
- Steps: 50
- CFG: 5
- Sampler: euler
- Scheduler: simple
- Seed: 489450691171922