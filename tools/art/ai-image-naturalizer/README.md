# AI Image Naturalizer

A lightweight, browser-based HTML5 tool for making overly-clean AI-generated images feel more natural.

The tool applies several subtle layers of controlled imperfection—film grain, local color variation, chromatic grain, and organic multi-scale texture—while attempting to preserve important image structure and edges.

Everything runs locally in the browser. No server or upload is required.

---

## Features

### Image Input

* Upload images directly from your computer.
* Drag and drop images into the workspace.
* Supports standard browser image formats such as PNG, JPEG, and WebP.
* Processing is performed at the original image resolution.

### Before / After Preview

The preview area includes an interactive comparison slider.

* **Left side:** original image.
* **Right side:** naturalized image.
* Drag the vertical slider to compare the two versions.
* The comparison happens directly on top of the image.
* A **Preview Effect** checkbox can completely disable the processed layer and show the original image.
* Original and Naturalized labels make the comparison easier to understand.

### Naturalization Controls

#### Film Grain

Adds fine luminance variation resembling photographic grain.

Higher values create a more obvious grain structure.

#### Color Variation

Introduces extremely small hue and saturation variations based on the existing pixel colors.

This avoids simply placing gray noise over the image.

#### Chromatic Grain

Adds subtle RGB-channel variation.

Low values can introduce tiny color imperfections similar to those found in real imaging systems.

#### Organic Texture

Adds larger-scale noise at multiple spatial frequencies.

This helps break up unnaturally uniform surfaces and gradients.

#### Softness

Controls the spatial scale of the generated noise.

Higher softness produces broader, smoother variation.

Lower softness produces finer, more detailed variation.

#### Overall Blend

Controls the strength of the complete effect.

This is useful for quickly reducing an aggressive effect without having to adjust every individual setting.

---

## Image-Aware Processing

The naturalizer is designed to avoid treating every pixel identically.

### Local Color Preservation

When enabled, noise is applied primarily through changes to the existing pixel's lightness, hue, and saturation.

This means a blue wall receives blue-ish variation rather than having neutral gray noise pasted over it.

### Edge Protection

Strong local edges receive less processing.

This helps preserve:

* Facial features
* Hair
* Text
* Object boundaries
* Fine architectural details
* High-contrast edges

The goal is to introduce imperfections into relatively smooth areas without unnecessarily degrading important structures.

### Multi-Scale Noise

Instead of relying on a single layer of random pixels, the tool combines several spatial frequencies:

```text
Fine noise
    ↓
Film grain / micro variation

Medium noise
    ↓
Material and surface variation

Large noise
    ↓
Broad organic variation
```

This generally produces a more natural result than simply applying uniform random noise.

---

## Presets

Three starting presets are included.

### Subtle

Designed for images that already look relatively natural.

Typical characteristics:

* Low grain
* Very low chromatic variation
* Minimal texture
* Low overall blend

Good starting point for portraits and clean photographic scenes.

### Photo

A balanced general-purpose setting.

Adds enough variation to reduce the overly-perfect appearance while remaining relatively subtle.

This is the recommended default preset.

### Strong

Designed for particularly synthetic-looking AI imagery.

Uses stronger:

* Grain
* Color variation
* Organic texture
* Chromatic variation

Use carefully on faces and highly detailed subjects.

---

## Seed

The generator uses a deterministic seed.

This means the same:

* Image
* Settings
* Seed

will produce the same generated texture.

This is useful when experimenting with settings or comparing different versions.

### Random Seed

The Random Seed button generates a new texture pattern without changing the processing settings.

This can be useful when the strength looks right but the particular grain pattern does not.

---

## Export

The **Export PNG** button exports the processed image at its original resolution.

The preview's display size and comparison slider do not affect the exported resolution.

The exported file is named:

```text
naturalized-image.png
```

---

# Design Philosophy

The purpose of this tool is not to make an image visibly noisy.

The desired result is closer to:

> "Why does this image suddenly feel more photographic?"

rather than:

> "Why did someone add noise to this image?"

For that reason, the recommended approach is to use several very weak effects simultaneously rather than one strong effect.

For example:

```text
Film Grain       10–15
Color Variation   3–7
Chromatic Grain   1–4
Organic Texture   5–12
Softness         30–50
Blend            50–70
```

The exact values depend heavily on the source image.

---

# Performance

The tool processes images using the browser's Canvas API.

Processing is performed pixel-by-pixel, so very large images can take noticeable time.

For example, a 1024×1024 image contains approximately one million pixels, while a 4096×4096 image contains approximately sixteen million.

Large images may therefore take substantially longer to process.

The comparison slider itself does not perform image processing and should remain responsive after the image has been processed.

---

# Browser Compatibility

The application is designed for modern browsers supporting:

* HTML5 Canvas
* `ImageData`
* File API
* Drag and Drop API
* `CanvasRenderingContext2D`
* `HTMLCanvasElement.toBlob()`

Recent versions of Chrome, Edge, Firefox, and Safari should work.

---

# Privacy

Images are processed locally in the browser.

There is no built-in server upload or external image-processing service.

This makes the tool suitable for images that should remain on the user's machine.

---

# Future Implementations

The current implementation intentionally keeps the processing relatively simple. There are several directions that could make the naturalization considerably more sophisticated.

## 1. Real Camera Profiles

Add presets that emulate different photographic pipelines rather than generic noise.

For example:

* Digital camera
* Smartphone
* DSLR
* Film scan
* Disposable camera
* Cinema camera
* Vintage compact camera

Each profile could control multiple parameters simultaneously:

```text
Grain
Color response
Highlight rolloff
Shadow noise
Chromatic aberration
Lens softness
Microcontrast
Vignetting
```

---

## 2. Frequency-Based Grain

Split the effect into explicit frequency bands:

```text
Micro
Fine
Medium
Large
```

Allow the user to independently control each band.

This would make it possible to create grain that resembles real photographic material instead of mathematically uniform noise.

---

## 3. Luminance-Dependent Noise

Real image noise is rarely distributed equally across the entire image.

Future processing could vary noise according to brightness:

```text
Highlights → low noise
Midtones   → moderate noise
Shadows    → higher noise
```

This could make the effect significantly more photographic.

---

## 4. Shadow Color Noise

Dark areas could receive slightly different color noise characteristics from highlights.

For example:

```text
Shadows → slightly cooler / more chromatic
Midtones → neutral
Highlights → lower chromatic noise
```

This would help reproduce the imperfections of real camera sensors.

---

## 5. Film Grain Simulation

A dedicated film-grain engine could simulate different grain structures.

Possible controls:

* Grain size
* Grain density
* Grain clumping
* Grain contrast
* Grain softness
* Grain color
* Grain response to luminance

A film preset could then approximate different film stocks without requiring the user to manually tune every parameter.

---

## 6. Lens Imperfections

Add optional optical imperfections such as:

* Very subtle chromatic aberration
* Lens softness
* Peripheral softness
* Vignetting
* Slight barrel distortion
* Bloom
* Halation
* Diffusion

These should remain extremely subtle by default.

The objective would be to remove the sterile "perfect digital render" appearance rather than visibly distort the image.

---

## 7. Halation

A particularly interesting future feature would be simulated film halation.

Bright areas could generate a very subtle warm/red glow around high-contrast edges.

Example:

```text
Bright object
     ↓
edge detection
     ↓
blurred warm contribution
     ↓
subtle blend
```

This could be especially effective for night scenes, lights, sunsets, and portraits.

---

## 8. Film Response Curves

Instead of modifying pixels independently, the tool could provide a simple tone-response curve.

Potential controls:

* Black point
* Shadow lift
* Midtone contrast
* Highlight compression
* Highlight rolloff
* Overall gamma

This could help emulate the softer tonal response associated with photographic images.

---

## 9. Localized Texture Detection

A more advanced version could analyze the image before applying noise.

Different regions could receive different treatment:

```text
Sky
↓
Very low texture

Skin
↓
Fine, low-contrast texture

Clothing
↓
Medium texture

Walls
↓
Medium organic variation

Vegetation
↓
Higher-frequency variation
```

This would be considerably more effective than applying the exact same noise everywhere.

---

## 10. Face / Skin Protection

Future versions could detect faces and automatically reduce aggressive processing over skin.

Possible behavior:

* Preserve eyes
* Preserve lips
* Protect facial edges
* Reduce chromatic grain on skin
* Apply very fine texture rather than coarse noise

This would make stronger presets much safer for portraits.

---

## 11. Mask Painting

Allow the user to paint areas where the effect should be:

* Increased
* Reduced
* Completely disabled

For example, the user could protect a face while applying stronger texture to the background.

A simple mask workflow could look like:

```text
Effect strength
      ↓
[ Image ]
      ↓
Paint mask
      ↓
0% ───────────── 100%
```

---

## 12. Blend Modes

Add different mathematical blending modes for the individual layers:

* Overlay
* Soft Light
* Multiply
* Screen
* Add
* Normal

Soft Light would be particularly interesting for subtle texture because it could alter contrast without simply adding brightness or darkness.

---

## 13. Blur-Based Noise

Instead of generating only grid noise, generate high-resolution random noise and blur it at different radii.

For example:

```text
Random noise
      ↓
Blur 0.5px → micro grain

Random noise
      ↓
Blur 2px → fine texture

Random noise
      ↓
Blur 8px → organic variation

Random noise
      ↓
Blur 30px → broad tonal variation
```

This would provide more natural control over spatial frequency.

---

## 14. WebGL / GPU Processing

The current Canvas implementation is intentionally simple and portable.

For large images, processing could eventually move to:

* WebGL
* WebGPU

This would allow substantially faster real-time processing.

The goal would be to make every slider update instantly even on large 4K+ images.

---

## 15. Live Processing

The current system processes the image whenever settings change.

A future GPU implementation could make the entire system genuinely real-time:

```text
Slider movement
      ↓
GPU shader
      ↓
Instant preview
```

This would make experimentation much more fluid.

---

## 16. Multiple Effect Layers

Instead of one combined "Naturalize" effect, expose a layer stack:

```text
Naturalize
 ├── Film Grain
 ├── Color Noise
 ├── Organic Texture
 ├── Halation
 ├── Lens Diffusion
 ├── Vignette
 └── Camera Response
```

Each layer could have:

* Enable/disable
* Strength
* Blend mode
* Seed
* Mask

This would turn the project into a more complete image-processing playground.

---

## 17. A/B Preset Comparison

Allow users to save two or more parameter configurations and compare them directly.

For example:

```text
Original
    │
    ├── Preset A: Photographic
    │
    └── Preset B: Film
```

The existing comparison slider could be extended to compare different processing configurations.

---

## 18. Undo / Redo and Preset History

A history system would allow users to experiment without losing previous settings.

Possible interface:

```text
History

● Original
● Photo preset
● Grain 18
● Texture 12
● Film preset
```

Clicking an entry would restore that state.

---

## 19. Side-by-Side and Split-Screen Modes

In addition to the current slider:

* Split slider
* Side-by-side
* Flicker comparison
* Fullscreen original
* Fullscreen processed

could all be useful.

A "flicker" mode that rapidly switches between original and processed versions would make very subtle differences easier to detect.

---

## 20. Batch Processing

A future version could allow multiple images to be dropped simultaneously.

Example:

```text
images/
    image01.png
    image02.png
    image03.png
    image04.png
```

Apply the same settings and export:

```text
naturalized/
    image01.png
    image02.png
    image03.png
    image04.png
```

---

# Suggested Development Priority

If expanding the project, the most valuable next steps would probably be:

### Tier 1 — Biggest visual improvement

1. Luminance-dependent noise
2. Better multi-frequency grain
3. Film/camera presets
4. Halation
5. Subtle lens imperfections

### Tier 2 — Better usability

6. Effect layer system
7. Mask painting
8. Preset saving
9. Undo/redo
10. A/B comparison modes

### Tier 3 — Performance

11. WebGL/WebGPU processing
12. Real-time 4K preview
13. Batch processing

The biggest opportunity is probably **moving from generic noise toward a simulated camera/image pipeline**. That would make the tool much better at producing the specific kind of imperfection that makes an AI-generated image feel like it passed through a real camera rather than simply having noise added afterward.
