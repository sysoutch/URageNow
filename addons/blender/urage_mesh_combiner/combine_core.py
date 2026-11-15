"""Combine mesh objects into one clean mesh (boolean union), like Bool Tool's Union.

This module holds the whole combine pipeline with no UI, so it is shared by:
  - the URage Mesh Combiner add-on operators (inside Blender), and
  - blender-scripts/combine/combine_meshes.py (headless, run by URage Now).

Pipeline:
  1. prepare    Unparent, make mesh data single-user, apply transforms.
  2. separate   Optional: weld split vertices, then split each object by loose parts.
  3. combine    "union": one n-ary Boolean Union (removes faces hidden inside other parts).
                "join":  plain join (keeps every face, only welds touching vertices).
  4. clean up   Weld by distance and delete loose vertices/edges.

If the n-ary union fails or returns an empty mesh, parts are unioned one by one; a part
that still fails is joined instead of dropped, and reported in the result.
"""

import bmesh
import bpy

# --- Tunables -------------------------------------------------------------------------

DEFAULT_MERGE_DISTANCE = 0.0001
MAX_MERGE_DISTANCE = 0.1
# Parts smaller than this many faces are skipped as debris when min_part_faces is used.
DEFAULT_MIN_PART_FACES = 0
COMBINE_METHODS = ("union", "join")
# Our solver names -> Blender's enum names. Blender 5 renamed FAST to FLOAT and 4.5 added MANIFOLD.
SOLVER_CANDIDATES = {
    "exact": ("EXACT",),
    "fast": ("FLOAT", "FAST"),
    "manifold": ("MANIFOLD", "EXACT"),
}
DEFAULT_SOLVER = "exact"
TEMP_COLLECTION_NAME = "URageCombineOperands"
UNION_MODIFIER_NAME = "URageCombineUnion"


class CombineOptions:
    """Settings for one combine run. Plain attributes so operators and scripts share it."""

    def __init__(
        self,
        method="union",
        solver=DEFAULT_SOLVER,
        separate_loose_parts=False,
        merge_distance=DEFAULT_MERGE_DISTANCE,
        self_intersection=True,
        hole_tolerant=True,
        min_part_faces=DEFAULT_MIN_PART_FACES,
        result_name="Combined",
    ):
        self.method = method if method in COMBINE_METHODS else "union"
        self.solver = solver if solver in SOLVER_CANDIDATES else DEFAULT_SOLVER
        self.separate_loose_parts = bool(separate_loose_parts)
        self.merge_distance = max(0.0, min(MAX_MERGE_DISTANCE, float(merge_distance)))
        self.self_intersection = bool(self_intersection)
        self.hole_tolerant = bool(hole_tolerant)
        self.min_part_faces = max(0, int(min_part_faces))
        self.result_name = result_name or "Combined"


def log(message):
    print(f"[combine] {message}", flush=True)


# --- Selection helpers ----------------------------------------------------------------

def ensure_object_mode():
    active = bpy.context.view_layer.objects.active
    if active and active.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def select_only(objects, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or (objects[0] if objects else None)


def face_count(obj):
    return len(obj.data.polygons) if obj and obj.type == "MESH" else 0


def resolve_solver(solver):
    """Return the first Blender boolean solver enum this Blender version knows."""
    available = {item.identifier for item in bpy.types.BooleanModifier.bl_rna.properties["solver"].enum_items}
    for candidate in SOLVER_CANDIDATES.get(solver, SOLVER_CANDIDATES[DEFAULT_SOLVER]):
        if candidate in available:
            return candidate
    return "EXACT"


# --- Pipeline steps -------------------------------------------------------------------

def prepare_objects(objects):
    """Bake each object's world transform into its own, unshared mesh data."""
    ensure_object_mode()
    select_only(objects)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    # Linked duplicates share mesh data; applying transforms or booleans would change all of them.
    bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return [obj for obj in objects if obj.type == "MESH"]


def weld(obj, merge_distance):
    """Merge by distance on the whole mesh. Generated meshes split vertices on UV seams,
    which would otherwise make every triangle its own loose part."""
    if merge_distance <= 0:
        return
    select_only([obj])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="VERT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=merge_distance)
    bpy.ops.object.mode_set(mode="OBJECT")


def separate_by_loose_parts(objects, merge_distance):
    """Split every object into one object per connected piece."""
    parts = []
    for obj in objects:
        weld(obj, merge_distance)
        select_only([obj])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.separate(type="LOOSE")
        bpy.ops.object.mode_set(mode="OBJECT")
        parts.extend(item for item in bpy.context.selected_objects if item.type == "MESH")
    # Deduplicate while keeping order (the original object is part of the selection too).
    unique = list(dict.fromkeys(parts))
    log(f"Separated {len(objects)} object(s) into {len(unique)} loose part(s).")
    return unique


def drop_small_parts(parts, min_part_faces):
    if min_part_faces <= 0:
        return parts, 0
    kept = [obj for obj in parts if face_count(obj) >= min_part_faces]
    dropped = [obj for obj in parts if obj not in kept]
    for obj in dropped:
        bpy.data.objects.remove(obj, do_unlink=True)
    return kept, len(dropped)


def pick_base(parts):
    """The biggest part (by faces) carries the modifier; it keeps its materials first."""
    return max(parts, key=face_count)


def _new_union_modifier(base, options):
    modifier = base.modifiers.new(name=UNION_MODIFIER_NAME, type="BOOLEAN")
    modifier.operation = "UNION"
    modifier.solver = resolve_solver(options.solver)
    # Exact-solver options; guarded because older or newer Blender versions may lack some.
    for attribute, value in (
        ("use_self", options.self_intersection),
        ("use_hole_tolerant", options.hole_tolerant),
        ("material_mode", "TRANSFER"),
    ):
        if hasattr(modifier, attribute):
            try:
                setattr(modifier, attribute, value)
            except (TypeError, ValueError):
                pass
    return modifier


def _apply_modifier(base, modifier):
    select_only([base])
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def _remove_leftover_modifiers(base):
    """A failed modifier_apply leaves the modifier on the object; drop it before retrying."""
    for modifier in list(base.modifiers):
        if modifier.name.startswith(UNION_MODIFIER_NAME):
            base.modifiers.remove(modifier)


def _restore_mesh(obj, backup):
    old = obj.data
    obj.data = backup
    if old.users == 0:
        bpy.data.meshes.remove(old)


def _remove_objects(objects):
    for obj in objects:
        if obj and obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)


def union_all_at_once(base, operands, options):
    """One n-ary boolean with a collection operand: fastest, and resolves overlaps between
    every pair of parts at once. Returns True when it produced a non-empty mesh."""
    collection = bpy.data.collections.new(TEMP_COLLECTION_NAME)
    bpy.context.scene.collection.children.link(collection)
    try:
        for obj in operands:
            collection.objects.link(obj)
        modifier = _new_union_modifier(base, options)
        modifier.operand_type = "COLLECTION"
        modifier.collection = collection
        before = face_count(base) + sum(face_count(obj) for obj in operands)
        _apply_modifier(base, modifier)
        after = face_count(base)
        log(f"Union of {len(operands) + 1} parts: {before} -> {after} faces ({modifier_solver_label(options)}).")
        return after > 0
    finally:
        bpy.data.collections.remove(collection)


def union_one_by_one(base, operands, options):
    """Fallback: union each part on its own. A part that breaks the union is joined instead."""
    joined_fallback = []
    for obj in operands:
        before = face_count(base)
        backup = base.data.copy()
        modifier = _new_union_modifier(base, options)
        modifier.operand_type = "OBJECT"
        modifier.object = obj
        try:
            _apply_modifier(base, modifier)
            ok = face_count(base) > 0
        except RuntimeError as error:
            log(f"Union with {obj.name} raised: {error}")
            ok = False
        if not ok:
            # Restore the base mesh and keep the part by joining it.
            _remove_leftover_modifiers(base)
            _restore_mesh(base, backup)
            joined_fallback.append(obj)
            log(f"Union with {obj.name} failed ({before} faces kept); joining it instead.")
        else:
            bpy.data.meshes.remove(backup)
    return joined_fallback


def modifier_solver_label(options):
    return resolve_solver(options.solver).lower()


def join_into(base, others):
    if not others:
        return base
    select_only([base, *others], active=base)
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def clean_up(obj, merge_distance):
    select_only([obj])
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="VERT")
    bpy.ops.mesh.select_all(action="SELECT")
    if merge_distance > 0:
        bpy.ops.mesh.remove_doubles(threshold=merge_distance)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.delete_loose(use_verts=True, use_edges=True, use_faces=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def count_non_manifold_edges(obj):
    """0 means the mesh is closed (watertight): good for booleans, baking and physics."""
    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data)
        return sum(1 for edge in bm.edges if not edge.is_manifold)
    finally:
        bm.free()


# --- Entry point ----------------------------------------------------------------------

def combine_objects(objects, options=None):
    """Combine mesh objects into one. Returns (result_object, report dict).

    objects: the mesh objects to combine; non-mesh objects are ignored.
    A single object only makes sense with separate_loose_parts (otherwise there is
    nothing to combine), so that case raises a clear error.
    """
    options = options or CombineOptions()
    meshes = [obj for obj in objects if obj and obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh objects to combine.")
    if len(meshes) == 1 and not options.separate_loose_parts:
        raise RuntimeError("Only one object was chosen. Turn on 'Separate loose parts first' to combine its pieces.")

    meshes = prepare_objects(meshes)
    input_object_count = len(meshes)
    input_faces = sum(face_count(obj) for obj in meshes)
    parts = separate_by_loose_parts(meshes, options.merge_distance) if options.separate_loose_parts else meshes
    parts, dropped_parts = drop_small_parts(parts, options.min_part_faces)
    if not parts:
        raise RuntimeError("Every part was smaller than the minimum part size.")
    part_count = len(parts)

    base = pick_base(parts)
    operands = [obj for obj in parts if obj is not base]
    joined_fallback = []
    used_method = options.method

    if operands and options.method == "union":
        ok = False
        backup = base.data.copy()
        try:
            ok = union_all_at_once(base, operands, options)
        except RuntimeError as error:
            log(f"N-ary union raised: {error}")
        if ok:
            bpy.data.meshes.remove(backup)
            _remove_objects(operands)
        else:
            log("N-ary union failed; retrying part by part.")
            _remove_leftover_modifiers(base)
            _restore_mesh(base, backup)
            joined_fallback = union_one_by_one(base, operands, options)
            _remove_objects([obj for obj in operands if obj not in joined_fallback])
            base = join_into(base, joined_fallback)
            used_method = "union_per_part"
    elif operands:
        base = join_into(base, operands)

    clean_up(base, options.merge_distance)
    base.name = options.result_name
    base.data.name = options.result_name
    report = {
        "method": used_method,
        "solver": modifier_solver_label(options) if options.method == "union" else None,
        "inputObjects": input_object_count,
        "parts": part_count,
        "droppedParts": dropped_parts,
        "joinedFallbackParts": len(joined_fallback),
        "inputFaces": input_faces,
        "faces": face_count(base),
        "nonManifoldEdges": count_non_manifold_edges(base),
    }
    log(f"Combined {part_count} part(s) -> {report['faces']} faces (method={used_method}).")
    return base, report
