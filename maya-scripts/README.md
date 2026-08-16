# URage Maya Scripts

Small, self-contained Maya Python scripts for repeatable scene preparation and export. These are **Maya-native** (`maya.cmds`); they are not Blender scripts renamed to `.py`.

## Install and run

Copy a folder into a Maya scripts path, or run its file from Maya's Script Editor using Python. Each script exposes a `main()` function and returns a small result object where practical.

| Folder | Script | Purpose |
|---|---|---|
| `scene` | `scene_report.py` | Write a JSON inventory of the current scene and selection. |
| `transform` | `freeze_selected_transforms.py` | Freeze translation, rotation, and scale on selected transforms. |
| `export` | `export_selected_fbx.py` | Export selected transforms to an FBX file. |

`export_selected_fbx.py` loads Maya's `fbxmaya` plug-in when available and fails clearly when it is not installed. It does not overwrite an existing destination unless `overwrite=True` is passed.

## Conventions

- Keep one operation per script folder.
- Do not assume the dashboard is running; scripts should be useful from Maya alone.
- Do not silently mutate the whole scene. Operations act on an explicit selection unless their name says otherwise.
- A future remote catalog may package these folders, but that needs a real, published repository URL rather than an invented GitHub source.
