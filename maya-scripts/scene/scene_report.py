"""Write a compact report for the current Maya scene."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from maya import cmds


def _default_output_path() -> str:
    workspace = cmds.workspace(query=True, rootDirectory=True) or os.getcwd()
    return os.path.join(workspace, "urage-maya-scene-report.json")


def main(output_path: str | None = None) -> dict:
    """Persist scene and selection metadata, returning the written report."""
    output_path = os.path.abspath(output_path or _default_output_path())
    transforms = cmds.ls(type="transform", long=True) or []
    meshes = cmds.ls(type="mesh", long=True, noIntermediate=True) or []
    report = {
        "suite": "maya",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "scenePath": cmds.file(query=True, sceneName=True) or None,
        "selection": cmds.ls(selection=True, long=True) or [],
        "transformCount": len(transforms),
        "meshCount": len(meshes),
    }
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as report_file:
        json.dump(report, report_file, indent=2)
    return report
