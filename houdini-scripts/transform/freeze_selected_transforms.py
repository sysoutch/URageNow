"""Bake selected OBJ transforms into their geometry with Houdini's native API."""

import hou


def main() -> list[str]:
    """Freeze selected OBJ nodes and return their paths."""
    selected = [node for node in hou.selectedNodes() if node.type().category() == hou.objNodeTypeCategory()]
    if not selected:
        raise hou.Error("Select at least one OBJ-level node before freezing transforms.")
    for node in selected:
        node.movePreTransformIntoParmTransform()
        node.setPreTransform(hou.Matrix4(1))
    return [node.path() for node in selected]
