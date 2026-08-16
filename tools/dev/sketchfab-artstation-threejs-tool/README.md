# Share 3D Model

This is a single-file static web tool.

No npm.  
No Vite.  
No backend server.  
No OAuth server.  
No build step.

Open:

```text
index.html
```

## What this version fixes

Some valid packed FBX files contain embedded textures, but the embedded texture name ends in `.fbm`.

Three.js `FBXLoader` uses that extension to decide the image type, then logs:

```text
FBXLoader: Image type "fbm" is not supported
```

This build patches the FBX binary **before** `FBXLoader.parse()`.

It replaces embedded `.fbm` texture-name extensions with a real image extension, such as:

```text
.png
.jpg
.tga
.bmp
```

The replacement must be four characters because FBX binary strings have fixed lengths. That is why `.webp` falls back to `.png` internally.

## How to use with your packed FBX

1. Open `index.html`.
2. In **FBX Embedded Texture Patch**, choose the likely embedded image type:
   - try **PNG** first
   - then **JPEG**
   - then **TGA**
   - then **BMP**
3. Click **Choose files** and select the `.fbx`.
4. The status bar will say how many `.fbm` references were patched.

Example status:

```text
Preview loaded: model.fbx. Patched 1 embedded .fbm texture reference(s) to .png.
```

If you selected the wrong type, choose another type and reload the FBX.

## Why this is needed

Your FBX can be valid. The problem is a Three.js `FBXLoader` limitation: it sees `.fbm` and treats it as an image type, even though `.fbm` is normally a texture folder convention or a misleading embedded texture name.

This tool works around that by changing only the embedded texture filename extension before parsing.

## External texture workflow

If your FBX uses external textures instead of packed textures:

1. Use **Choose folder**.
2. Pick the folder containing:
   - the `.fbx`
   - texture images
   - any `.fbm` folder
3. The app will still package everything for Sketchfab upload.

## Sketchfab upload

For FBX / OBJ uploads with textures:

- The app zips the model and selected texture/support files.
- The ZIP is uploaded to Sketchfab.
- This is required because FBX textures are often external.

## Recommendation

GLB remains the most reliable format for browser preview because it embeds textures predictably.

This build is specifically for FBX cases where you need preview and publishing from a static, no-npm tool.
