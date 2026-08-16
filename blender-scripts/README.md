# Blender Scripts

These scripts are launched by the dashboard with Blender in background mode. They import a generated model, apply one focused operation, and export the result back into the model store.

## Albedo To Geometry

`albedo_to_geometry.py` converts albedo brightness into real mesh displacement. The 3D Studio quick action sends these arguments:

- `--filepath`: source FBX, OBJ, GLB, or glTF model.
- `--output_path`: output path using one of the supported source formats.
- `--strength`: displacement strength from `0` to `10`.
- `--subdivisions`: topology levels from `0` to `8`.
- `--topology_mode`: `subdivision` or `multiresolution`.
- `--blur`: topology-aware height smoothing passes from `0` to `10`.
- `--auto_smooth`: enables smooth polygon shading.
- `--selected_faces_only`: processes only face selections stored in the source model and fails when no selected faces are available.
- `--merge_before_subdivide`: welds near-duplicate vertices before adding topology.
- `--merge_after_subdivide`: welds near-duplicate vertices after an applied subdivision pass.
- `--merge_distance`: weld threshold from `0` to `0.1`, defaulting to `0.000001`.

The script prefers an image texture linked to a Principled BSDF Base Color input, then falls back to the first image texture in the material.
The post-subdivision weld groups vertices by UV and material signature first, so it does not merge across intentional texture or material seams.

The matching interactive Blender add-on source is maintained at `blender-scripts/addons/blender_albedo_to_geometry_addon.py`. It uses the same topology-aware blur, Base Color texture preference, topology warning, and seam-preserving weld behavior as the dashboard workflow.
The dashboard stores the result as a dedicated **Geometry From Albedo** variant with its own model file and preview media. The selected source variant remains unchanged.
Before processing, the quick-action overlay inspects the selected variant and shows its current face count plus an estimated target count using the subdivision multiplier (`4^levels`). The risk bar is green through 50,000 faces, yellow through 300,000, orange through 1,200,000, and red above 1,200,000. The estimate can differ from Blender's final count after welding and modifier conversion.

Dashboard configuration:

- `BLENDER_MODEL_ALBEDO_TO_GEOMETRY_SCRIPT_PATH` defaults to `blender-scripts/albedo_to_geometry.py`.
- `BLENDER_MODEL_ALBEDO_TO_GEOMETRY_TIMEOUT_MS` defaults to 20 minutes.

Example:

```powershell
& $env:BLENDER_EXECUTABLE_PATH --background --python blender-scripts/albedo_to_geometry.py -- `
  --filepath=C:\models\source.glb `
  --output_path=C:\models\source-displaced.glb `
  --strength=0.05 `
  --subdivisions=1 `
  --topology_mode=subdivision `
  --blur=1 `
  --auto_smooth=true `
  --selected_faces_only=false `
  --merge_before_subdivide=true `
  --merge_after_subdivide=true `
  --merge_distance=0.000001
```

Subdivision level `0` displaces existing vertices only. Levels `1-8` apply either Subdivision Surface or Multiresolution and convert the result to real vertices, edges, and faces before displacement. The workflow can weld duplicates both before and after this topology pass. Weld cleanup does not undo ordinary subdivision topology. Start with `0` or `1` on dense generated models.
