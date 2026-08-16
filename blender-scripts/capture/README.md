# Blender Capture Script

Automated Blender rendering script for:
- screenshots
- transparent renders
- solid background renders
- skybox renders
- rotating object turntables
- PNG frame export for GIF creation

Designed for Windows CMD + Blender background mode (`-b`).

---

# Features

- Auto-detect first mesh object
- Auto-create front-facing camera
- Flat texture shading (Workbench)
- Transparent PNG rendering
- Solid color backgrounds
- Skybox/world rendering
- Object rotation animation
- PNG sequence export
- Adjustable render size
- Adjustable quality
- Direct standalone `.fbx` / `.obj` / `.glb` / `.gltf` import for headless capture runs
- Dedicated flat-texture delight screenshot pass via `delight.py`
- Works fully headless

---

# Requirements

- Blender 4.5+
- Windows CMD / PowerShell
- Optional: ImageMagick for GIF creation

---

# Files

```text
capture.py
README.md
```

---

# Basic Usage

```bat
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b "C:\files\test.blend" --python "C:\Files\URageStudio\blender-scripts\blender_capture.py" -- --output "C:\files\screenshot.png"
```

---

# Transparent Render

```bat
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b "C:\files\test.blend" --python "C:\Files\URageStudio\blender-scripts\blender_capture.py" -- --output "C:\files\screenshot.png" --background transparent
```

---

# Solid Background Render

Black:

```bat
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b "C:\files\test.blend" --python "C:\Files\URageStudio\blender-scripts\blender_capture.py" -- --output "C:\files\screenshot.png" --background solidcolor --bg-color 0,0,0
```

White:

```bat
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b "C:\files\test.blend" --python "C:\Files\URageStudio\blender-scripts\blender_capture.py" -- --output "C:\files\screenshot.png" --background solidcolor --bg-color 1,1,1
```

Gray:

```bat
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b "C:\files\test.blend" --python "C:\Files\URageStudio\blender-scripts\blender_capture.py" -- --output "C:\files\screenshot.png" --background solidcolor --bg-color 0.5,0.5,0.5
```

---

# Skybox / World Background

```bat
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b "C:\files\test.blend" --python "C:\Files\URageStudio\blender-scripts\blender_capture.py" -- --output "C:\files\screenshot.png" --background skybox
```

---

# Rotating Turntable Render

```bat
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b "C:\files\test.blend" --python "C:\Files\URageStudio\blender-scripts\blender_capture.py" -- --background transparent --rotate --axis Z --frames 60 --gif-folder "C:\files\gif_frames"
```

---

# Create GIF

Requires ImageMagick:

```bat
magick -delay 4 -loop 0 "C:\files\gif_frames\frame_*.png" "C:\files\spin.gif"
```

---

# Arguments

| Argument | Description |
|---|---|
| `--output` | Output PNG path |
| `--width` | Render width |
| `--height` | Render height |
| `--quality` | PNG quality |
| `--engine` | Render engine |
| `--camera` | Use existing camera |
| `--select` | Select object by name |
| `--rotate` | Enable rotation rendering |
| `--axis` | Rotation axis |
| `--degrees` | Total rotation amount |
| `--frames` | Number of rendered frames |
| `--gif-folder` | Output frame folder |
| `--background` | transparent / solidcolor / skybox |
| `--bg-color` | RGB values for solidcolor |

---

# Defaults

```text
Engine: BLENDER_WORKBENCH
Background: transparent
Rotation Axis: Z
Frames: 36
Resolution: 1920x1080
```

---

# Notes

- If no object is specified, the first mesh object is used automatically.
- If no camera exists, one is created automatically.
- Camera is positioned directly in front of the object.
- Workbench mode uses:
  - Flat lighting
  - Texture colors
  - Fast viewport-style rendering

---

# Example Full Command

```bat
"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b "C:\files\test.blend" --python "C:\Files\URageStudio\blender-scripts\blender_capture.py" -- --output "C:\files\screenshot.png" --width 1080 --height 1080 --background transparent --rotate --axis Z --frames 60 --gif-folder "C:\files\gif_frames"
```
