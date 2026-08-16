# URage Cinema 4D Scripts

Cinema 4D uses its own `c4d` Python API. These scripts are intended for the Script Manager and do not depend on Blender or the dashboard.

| Folder | Script | Purpose |
|---|---|---|
| `scene` | `scene_report.py` | Write a JSON inventory of the active document. |
| `transform` | `freeze_selected_transforms.py` | Reset global transforms for selected objects. |
| `export` | `export_selected_fbx.py` | Save a copy using Cinema 4D's FBX exporter. |

Set the output path in the exporter before running. Cinema 4D's exporter ID can differ across releases, so the script discovers the registered FBX exporter and gives an actionable error when it is unavailable.
