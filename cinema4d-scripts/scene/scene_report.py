"""Write a JSON inventory of the active Cinema 4D document."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import c4d


def _walk(node):
    while node:
        yield node
        yield from _walk(node.GetDown())
        node = node.GetNext()


def main() -> dict:
    """Persist document counts and active selection beside the document."""
    document = c4d.documents.GetActiveDocument()
    document_path = document.GetDocumentPath() or os.getcwd()
    output_path = os.path.join(document_path, "urage-cinema4d-scene-report.json")
    objects = list(_walk(document.GetFirstObject()))
    report = {
        "suite": "cinema4d",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "documentName": document.GetDocumentName(),
        "selectedObjects": [node.GetName() for node in document.GetActiveObjects(c4d.GETACTIVEOBJECTFLAGS_SELECTIONORDER)],
        "objectCount": len(objects),
    }
    with open(output_path, "w", encoding="utf-8") as report_file:
        json.dump(report, report_file, indent=2)
    return report
