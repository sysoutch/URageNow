"""Reset global transforms for explicitly selected Cinema 4D objects."""

import c4d


def main() -> list[str]:
    """Set selected objects to identity global matrices and return their names."""
    document = c4d.documents.GetActiveDocument()
    selected = document.GetActiveObjects(c4d.GETACTIVEOBJECTFLAGS_SELECTIONORDER)
    if not selected:
        raise RuntimeError("Select at least one object before freezing transforms.")
    for obj in selected:
        obj.SetMg(c4d.Matrix())
    c4d.EventAdd()
    return [obj.GetName() for obj in selected]
