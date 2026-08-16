# 3D Model Workflows

ComfyUI workflows for 3D model generation and editing using Hy3D tools.

## Workflows

### `3dmodel_edit.json`
**3D Model Editing Workflow**

This workflow loads an existing 3D mesh (GLB format), processes it with background removal and upscaling, then applies texture inpainting and export. Key steps:
1. Load input image and 3D mesh
2. Upscale image and remove background
3. Crop image by mask and composite with mesh
4. UV wrap the mesh
5. Multi-view rendering with camera configuration
6. Delight image using Hunyuan3D delight model
7. Paint multi-view textures using Hunyuan3D paint model
8. Bake texture from multiview results
9. Inpaint vertices and apply final texture
10. Export textured mesh as GLB

**Required Models:**
- `4x_foolhardy_Remacri.pth` - Upscale model
- `hunyuan3d-delight-v2-0` - Delight model
- `hunyuan3d-paint-v2-0` - Paint model

### `3dmodel_redone.json`
**Complete 3D Model Generation from Image Workflow**

A comprehensive workflow that generates a textured 3D model from a single input image. Key steps:
1. Load and upscale input image
2. Remove background using TransparentBG
3. Generate mesh using Hy3DGenerateMesh with Hunyuan3D model
4. VAE decode to get 3D geometry
5. Post-process mesh (remove floaters, degenerate faces, reduce faces)
6. UV wrap the mesh
7. Multi-view rendering and camera configuration
8. Delight image for lighting enhancement
9. Paint multi-view textures
10. Bake, inpaint, and apply final texture
11. Export as GLB with preview

**Required Models:**
- `hy3dgen\\hunyuan3d-dit-v2-0-fp16.safetensors` - Mesh generation model
- `4x_foolhardy_Remacri.pth` - Upscale model
- `hunyuan3d-delight-v2-0` - Delight model
- `hunyuan3d-paint-v2-0` - Paint model

### `3dmodel_multiview.json`
**3D Model Generation from MultiView Images**

This workflow generates a mesh from directional image inputs. The dashboard's 3D Studio `Workflow` selector uses this file when `MultiView` is selected and maps the selected source images in order:
1. Front
2. Back
3. Left
4. Right

`Front` and `Back` are required. `Left` and `Right` are optional, and when omitted the dashboard currently falls back to `Left -> Front` and `Right -> Back`.

Key steps:
1. Load front, back, left, and right input images
2. Encode each view with CLIP Vision
3. Build Hunyuan3D multi-view conditioning
4. Generate samples with the multi-view Hunyuan3D checkpoint
5. Decode voxels to mesh
6. Save the generated mesh as GLB

**Required Models:**
- `hunyuan3d-dit-v2-mv_fp16.safetensors` - Multi-view image-to-3D model

## Required Nodes/Extensions
- ComfyUI-Hy3DExtension
- comfyui-essentials (ImageResize+, GetImageSize+)
- TransparentBG / rembg nodes
