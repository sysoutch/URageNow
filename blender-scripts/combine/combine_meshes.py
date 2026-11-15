"""Combine a model's mesh objects into one clean mesh (boolean union), headless.

Uses the same pipeline as the URage Mesh Combiner add-on
(addons/blender/urage_mesh_combiner/combine_core.py), so the Studio quick action and the
add-on give the same result.

Usage:
  blender --background --python combine_meshes.py --python-exit-code 1 -- \
    --filepath=in.glb --output_path=out.glb \
    [--objects_json='["Body","Hat"]'] [--separate_loose_parts=true] \
    [--method=union|join] [--solver=exact|fast|manifold] [--merge_distance=0.0001] \
    [--min_part_faces=0] [--self_intersection=true] [--hole_tolerant=true]

--objects_json chooses which mesh objects to combine; the others are exported unchanged.
Leave it out (or pass []) to combine every mesh.

Prints "COMBINE_RESULT {json}" on success, "COMBINE_ERROR <message>" on failure (exit 1).
"""

import json
import os
import re
import sys
import traceback

import bpy

SCRIPT_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
ADDON_DIRECTORY = os.path.normpath(os.path.join(SCRIPT_DIRECTORY, "..", "..", "addons", "blender", "urage_mesh_combiner"))
sys.path.insert(0, os.environ.get("URAGE_MESH_COMBINER_PATH") or ADDON_DIRECTORY)
import combine_core  # noqa: E402  (shared with the URage Mesh Combiner add-on)

# Blender adds ".001" to duplicate names and the glTF importer keeps node names, so
# chosen names are also matched without that suffix and case-insensitively.
DUPLICATE_SUFFIX_PATTERN = re.compile(r"\.\d{3}$")


# --- Arguments ------------------------------------------------------------------------

def get_arg_value(args, key, default_value):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default_value


def parse_bool(value, default=False):
    normalized = str(value).strip().lower()
    if normalized in ("1", "true", "yes", "on"):
        return True
    if normalized in ("0", "false", "no", "off"):
        return False
    return default


def read_options():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments.")
    args = sys.argv[sys.argv.index("--") + 1:]
    filepath = get_arg_value(args, "filepath", "").strip()
    output_path = get_arg_value(args, "output_path", "").strip()
    if not filepath or not output_path:
        raise RuntimeError("--filepath and --output_path are required.")
    raw_objects = get_arg_value(args, "objects_json", "").strip()
    try:
        chosen = json.loads(raw_objects) if raw_objects else []
    except json.JSONDecodeError as error:
        raise RuntimeError("--objects_json must be a JSON list of object names.") from error
    if not isinstance(chosen, list):
        raise RuntimeError("--objects_json must be a JSON list of object names.")
    combine = combine_core.CombineOptions(
        method=get_arg_value(args, "method", "union").strip().lower(),
        solver=get_arg_value(args, "solver", combine_core.DEFAULT_SOLVER).strip().lower(),
        separate_loose_parts=parse_bool(get_arg_value(args, "separate_loose_parts", "false")),
        merge_distance=float(get_arg_value(args, "merge_distance", str(combine_core.DEFAULT_MERGE_DISTANCE)) or 0),
        self_intersection=parse_bool(get_arg_value(args, "self_intersection", "true"), True),
        hole_tolerant=parse_bool(get_arg_value(args, "hole_tolerant", "true"), True),
        min_part_faces=int(float(get_arg_value(args, "min_part_faces", "0") or 0)),
        result_name="Combined",
    )
    return {
        "filepath": filepath,
        "output_path": output_path,
        "objects": [str(name) for name in chosen if str(name).strip()],
        "combine": combine,
    }


# --- Scene ----------------------------------------------------------------------------

def clear_scene():
    combine_core.ensure_object_mode()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_model(filepath):
    lower = filepath.lower()
    if lower.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=filepath, use_custom_normals=True, use_image_search=True)
    elif lower.endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=filepath)
    elif lower.endswith((".glb", ".gltf")):
        bpy.ops.import_scene.gltf(filepath=filepath)
    else:
        raise RuntimeError(f"Unsupported input format for combine: {filepath}")


def normalize_name(name):
    return DUPLICATE_SUFFIX_PATTERN.sub("", str(name)).strip().lower()


def pick_objects(meshes, chosen_names):
    if not chosen_names:
        return meshes
    by_exact = {obj.name: obj for obj in meshes}
    picked = []
    missing = []
    for name in chosen_names:
        obj = by_exact.get(name)
        if obj is None:
            # glTF node names can differ from the Blender object name by suffix or case.
            obj = next((item for item in meshes if normalize_name(item.name) == normalize_name(name)
                        or normalize_name(item.data.name) == normalize_name(name)), None)
        if obj is None:
            missing.append(name)
        elif obj not in picked:
            picked.append(obj)
    if missing:
        available = ", ".join(sorted(obj.name for obj in meshes))
        raise RuntimeError(f"Objects not found in the model: {', '.join(missing)}. Available: {available}")
    return picked


def export_glb(objects, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    combine_core.select_only(objects)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        use_selection=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_apply=True,
    )
    print(f"Exported model to: {output_path}", flush=True)


def main():
    try:
        options = read_options()
        clear_scene()
        import_model(options["filepath"])
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        if not meshes:
            raise RuntimeError("No mesh objects found after import.")
        targets = pick_objects(meshes, options["objects"])
        untouched = [obj for obj in meshes if obj not in targets]
        if untouched:
            # Keep the untouched objects where they are once their parents are gone.
            combine_core.prepare_objects(untouched)
        result, report = combine_core.combine_objects(targets, options["combine"])
        # Drop the now-empty import hierarchy so the export holds only meshes.
        for obj in list(bpy.context.scene.objects):
            if obj.type == "EMPTY":
                bpy.data.objects.remove(obj, do_unlink=True)
        export_glb([result, *untouched], options["output_path"])
        report["untouchedObjects"] = len(untouched)
        report["combinedObjectNames"] = [obj_name for obj_name in options["objects"]] or None
        print("COMBINE_RESULT " + json.dumps(report), flush=True)
    except Exception as error:  # noqa: BLE001 - every failure must reach the server
        traceback.print_exc()
        print(f"COMBINE_ERROR {error}", flush=True)
        sys.stdout.flush()
        os._exit(1)


if __name__ == "__main__":
    main()
