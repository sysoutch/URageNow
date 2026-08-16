"""Write a compact JSON report for the active Houdini session."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import hou


def main(output_path: str | None = None) -> dict:
    """Write scene counts and selected node paths to a JSON report."""
    output_path = os.path.abspath(output_path or os.path.join(hou.getenv("HIP") or os.getcwd(), "urage-houdini-scene-report.json"))
    selected = hou.selectedNodes()
    nodes = hou.node("/").allSubChildren() if hou.node("/") else []
    report = {
        "suite": "houdini",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "scenePath": hou.hipFile.path(),
        "selectedNodes": [node.path() for node in selected],
        "nodeCount": len(nodes),
    }
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as report_file:
        json.dump(report, report_file, indent=2)
    return report
