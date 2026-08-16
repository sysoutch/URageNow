# URage 3ds Max Scripts

3ds Max uses MaxScript rather than Blender Python. These focused starters are safe to run from the MaxScript Editor and deliberately operate on the current selection.

| Folder | Script | Purpose |
|---|---|---|
| `scene` | `scene_report.ms` | Write a text inventory of the active scene. |
| `transform` | `reset_selected_xform.ms` | Reset XForm for selected objects and collapse the modifier stack. |
| `export` | `export_selected_fbx.ms` | Export the current selection as FBX. |

Set `outputPath` in the export/report scripts before running. The FBX export refuses to overwrite by default.
