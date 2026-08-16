"""Export explicit Maya selection as FBX without changing the source scene."""

from __future__ import annotations

import os

from maya import cmds


def main(output_path: str, overwrite: bool = False) -> str:
    """Export selected transforms to `output_path` and return its absolute path."""
    selection = cmds.ls(selection=True, long=True) or []
    if not selection:
        raise RuntimeError("Select one or more nodes before exporting FBX.")
    output_path = os.path.abspath(output_path)
    if not output_path.lower().endswith(".fbx"):
        raise ValueError("The FBX export path must end with .fbx.")
    if os.path.exists(output_path) and not overwrite:
        raise FileExistsError("Refusing to overwrite an existing FBX: " + output_path)
    if not cmds.pluginInfo("fbxmaya", query=True, loaded=True):
        try:
            cmds.loadPlugin("fbxmaya", quiet=True)
        except RuntimeError as error:
            raise RuntimeError("Maya FBX plug-in 'fbxmaya' is required for export.") from error
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    cmds.file(output_path, force=True, options="v=0;", type="FBX export", exportSelected=True)
    return output_path
