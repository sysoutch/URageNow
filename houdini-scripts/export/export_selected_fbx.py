"""Export selected OBJ-level nodes through an FBX ROP."""

from __future__ import annotations

import os

import hou


def main(output_path: str, overwrite: bool = False) -> str:
    """Render a temporary FBX ROP for selected OBJ nodes."""
    selected = [node for node in hou.selectedNodes() if node.type().category() == hou.objNodeTypeCategory()]
    if not selected:
        raise hou.Error("Select one or more OBJ-level nodes before exporting FBX.")
    output_path = os.path.abspath(output_path)
    if not output_path.lower().endswith(".fbx"):
        raise ValueError("The export path must end with .fbx.")
    if os.path.exists(output_path) and not overwrite:
        raise FileExistsError("Refusing to overwrite an existing FBX: " + output_path)
    out = hou.node("/out")
    if not out:
        raise hou.Error("The /out network is not available in this Houdini session.")
    rop = out.createNode("filmboxfbx", "urage_export_fbx")
    try:
        rop.parm("sopoutput").set(output_path)
        rop.parm("startnode").set(selected[0].path())
        rop.render()
    finally:
        rop.destroy()
    return output_path
