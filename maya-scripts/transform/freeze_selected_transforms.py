"""Freeze transforms for explicitly selected Maya transform nodes."""

from maya import cmds


def main() -> list[str]:
    """Freeze translation, rotation, and scale; return affected node paths."""
    selection = cmds.ls(selection=True, long=True, type="transform") or []
    if not selection:
        raise RuntimeError("Select at least one transform before freezing transforms.")
    cmds.makeIdentity(selection, apply=True, translate=True, rotate=True, scale=True, normal=False)
    return selection
