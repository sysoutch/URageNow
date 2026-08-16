# URage Houdini Scripts

Houdini starter scripts use the native `hou` Python API. Run them from Houdini's Python Source Editor or add their folders to Houdini's script path.

| Folder | Script | Purpose |
|---|---|---|
| `scene` | `scene_report.py` | Write a JSON inventory of the active HIP scene. |
| `transform` | `freeze_selected_transforms.py` | Bake selected OBJ-level transforms into geometry. |
| `export` | `export_selected_fbx.py` | Create an FBX ROP for selected OBJ nodes and render it. |

The transform script changes geometry and should be used on a branch/save you intend to modify. The export script creates a temporary output node but does not replace existing output files unless `overwrite=True` is supplied.
