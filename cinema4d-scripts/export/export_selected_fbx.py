"""Save selected Cinema 4D objects into a new FBX document."""

from __future__ import annotations

import os

import c4d


def main(output_path: str, overwrite: bool = False) -> str:
    """Copy selected objects into a temporary document and save them as FBX."""
    source = c4d.documents.GetActiveDocument()
    selected = source.GetActiveObjects(c4d.GETACTIVEOBJECTFLAGS_SELECTIONORDER)
    if not selected:
        raise RuntimeError("Select one or more objects before exporting FBX.")
    output_path = os.path.abspath(output_path)
    if not output_path.lower().endswith(".fbx"):
        raise ValueError("The export path must end with .fbx.")
    if os.path.exists(output_path) and not overwrite:
        raise FileExistsError("Refusing to overwrite an existing FBX: " + output_path)
    temporary = c4d.documents.BaseDocument()
    for obj in selected:
        clone = obj.GetClone(c4d.COPYFLAGS_0)
        temporary.InsertObject(clone)
    result = c4d.documents.SaveDocument(temporary, output_path, c4d.SAVEDOCUMENTFLAGS_DONTADDTORECENTLIST, c4d.FORMAT_FBX_EXPORT)
    if not result:
        raise RuntimeError("Cinema 4D could not save the selected objects as FBX.")
    return output_path
