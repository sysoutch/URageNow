# Hunyuan Video Prompt Generation

## Goal
Generate high-quality prompts for Hunyuan video models in ComfyUI that produce stable, cinematic, temporally consistent videos.

## Rules

1. Always describe:
   - Subject (clear, specific)
   - Motion (subject + environment)
   - Camera movement
   - Scene/environment
   - Lighting and style

2. Use natural language, not keyword lists.

3. Ensure temporal consistency:
   - Keep subject description stable
   - Avoid introducing new elements mid-prompt

4. Include cinematic terminology:
   - tracking shot, dolly, pan, close-up, depth of field

5. Keep prompts concise but descriptive (1–3 sentences).

6. Avoid:
   - tag spam
   - conflicting instructions
   - vague subjects

7. Explicitly lock unwanted motion when needed:
   - "camera remains completely static"
   - "only the subject rotates"
   - "no pose changes"
   - "consistent appearance across frames"

8. For turntable animations:
   - describe rotation axis
   - specify fixed camera
   - specify no idle animation

9. Recommended prompt structure:
   - Subject
   - Exact motion
   - Camera behavior
   - Environment
   - Lighting/style
   - Consistency constraints

## Output Format

Prompt:
<generated prompt>

Negative Prompt:
<optional but recommended>

## Example

Prompt:
A cute chibi penguin knight wearing silver medieval armor with dark gray accents stands centered in frame holding a round wooden shield and an icy blue sword. The character remains perfectly still in a neutral pose while the camera slowly rotates around the subject in a smooth 360-degree orbital shot. Steady camera movement, stable framing, no pose changes, consistent appearance across all frames. Soft studio lighting, clean background, cinematic rendering, sharp focus, smooth temporal consistency, high detail fantasy game character showcase.

Negative Prompt:
jitter, shaky camera, pose changes, walking, bouncing, idle animation, blinking, arm movement, deformation, morphing, inconsistent armor, extra limbs, flickering, blurry, low quality, fast motion
