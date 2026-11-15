"""Combine mesh objects into one clean mesh (boolean union), like Bool Tool's Union.

This module holds the whole combine pipeline with no UI, so it is shared by:
  - the URage Mesh Combiner add-on operators (inside Blender), and
  - blender-scripts/combine/combine_meshes.py (headless, run by URage Now).

Pipeline:
  1. prepare    Unparent, make mesh data single-user, apply transforms.
  2. separate   Optional: weld split vertices, then split each object by loose parts.
     clean      Delete interior faces (inner walls whose edges have 3+ faces) and
                degenerate faces; Exact booleans leave holes around them.
  3. group      Find the parts that overlap: their surfaces cross (BVH triangle test) or
                one sits completely inside another. Overlap chains form one group.
  4. combine    "union": each overlapping group gets one n-ary Boolean Union (faces hidden
                inside other parts are removed). Parts that overlap nothing stay as they
                are, like Bool Tool only fuses what intersects. overlap_only=False fuses all.
                "join": plain join of every part (keeps every face).
  5. clean up   Weld by distance and delete loose vertices/edges on fused results, then
                shade them smooth with hard edges: edges where the imported custom normals
                were split (marked sharp while welding) plus edges sharper than 30 degrees.
  6. optional   join_result puts every result into one object.

If a group's n-ary union fails or returns an empty mesh, parts are unioned one by one; a part
that still fails is joined instead of dropped, and reported in the result.
"""

import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

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
# Surfaces closer than this count as touching/overlapping (on top of the weld distance).
OVERLAP_EPSILON = 0.00001
# Vertices tested to decide that a part sits completely inside another one.
CONTAINMENT_SAMPLES = 8
# Fused results lose their custom normals; edges sharper than this are shaded flat again.
SHADE_SHARP_ANGLE_DEGREES = 30.0
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
        overlap_only=True,
        join_result=False,
        clean_parts=True,
    ):
        self.method = method if method in COMBINE_METHODS else "union"
        self.solver = solver if solver in SOLVER_CANDIDATES else DEFAULT_SOLVER
        self.separate_loose_parts = bool(separate_loose_parts)
        self.merge_distance = max(0.0, min(MAX_MERGE_DISTANCE, float(merge_distance)))
        self.self_intersection = bool(self_intersection)
        self.hole_tolerant = bool(hole_tolerant)
        self.min_part_faces = max(0, int(min_part_faces))
        self.result_name = result_name or "Combined"
        # Bool Tool behaviour: only fuse parts that overlap; parts that do not touch stay apart.
        self.overlap_only = bool(overlap_only)
        # Put every result (fused groups and untouched parts) into one object at the end.
        self.join_result = bool(join_result)
        # Delete interior/duplicate faces before the union; they make Exact booleans leave holes.
        self.clean_parts = bool(clean_parts)


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
    # Welding averages custom normals; first turn their splits into sharp edges so hard edges survive.
    bpy.ops.mesh.remove_doubles(threshold=merge_distance, use_sharp_edge_from_normals=True)
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


def clean_part(obj, merge_distance):
    """Delete degenerate faces and interior faces (inner walls). Returns faces removed."""
    before = face_count(obj)
    select_only([obj])
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(obj.data)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=max(merge_distance, OVERLAP_EPSILON))
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.mesh.select_mode(type="FACE")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.mesh.select_interior_faces()
    if any(face.select for face in bmesh.from_edit_mesh(obj.data).faces):
        bpy.ops.mesh.delete(type="FACE")
    bpy.ops.object.mode_set(mode="OBJECT")
    return before - face_count(obj)


def drop_small_parts(parts, min_part_faces):
    if min_part_faces <= 0:
        return parts, 0
    kept = [obj for obj in parts if face_count(obj) >= min_part_faces]
    dropped = [obj for obj in parts if obj not in kept]
    for obj in dropped:
        bpy.data.objects.remove(obj, do_unlink=True)
    return kept, len(dropped)


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
        bpy.ops.mesh.remove_doubles(threshold=merge_distance, use_sharp_edge_from_normals=True)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.delete_loose(use_verts=True, use_edges=True, use_faces=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def shade_sharp_by_angle(obj):
    """Smooth faces but keep edges sharper than SHADE_SHARP_ANGLE_DEGREES flat, so a fused
    low-poly model keeps its hard edges and a dense model still looks smooth."""
    select_only([obj])
    # The boolean interpolates imported custom normals across the new faces, which smears
    # shading over flat caps; drop them so the angle-based sharp edges take effect.
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    angle = math.radians(SHADE_SHARP_ANGLE_DEGREES)
    if hasattr(bpy.ops.object, "shade_smooth_by_angle"):
        bpy.ops.object.shade_smooth_by_angle(angle=angle, keep_sharp_edges=True)
    else:  # Blender before 4.1
        bpy.ops.object.shade_smooth()
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = angle


def count_non_manifold_edges(obj):
    """0 means the mesh is closed (watertight): good for booleans, baking and physics."""
    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data)
        return sum(1 for edge in bm.edges if not edge.is_manifold)
    finally:
        bm.free()


# --- Overlap detection ----------------------------------------------------------------

def _bounds(obj):
    """Axis-aligned bounds in world space (transforms are applied, so local == world)."""
    coords = [vertex.co for vertex in obj.data.vertices]
    return (
        Vector((min(c.x for c in coords), min(c.y for c in coords), min(c.z for c in coords))),
        Vector((max(c.x for c in coords), max(c.y for c in coords), max(c.z for c in coords))),
    )


def _bounds_overlap(a, b, margin):
    return all(a[0][axis] - margin <= b[1][axis] and b[0][axis] - margin <= a[1][axis] for axis in range(3))


def _bounds_contain(outer, inner):
    return all(outer[0][axis] <= inner[0][axis] and inner[1][axis] <= outer[1][axis] for axis in range(3))


def _build_bvh(obj, epsilon):
    bm = bmesh.new()
    try:
        bm.from_mesh(obj.data)
        return BVHTree.FromBMesh(bm, epsilon=epsilon)
    finally:
        bm.free()


def _point_inside(point, bvh):
    """Inside a closed mesh when the nearest surface faces away from the point."""
    location, normal, _index, _distance = bvh.find_nearest(point)
    return location is not None and (location - point).dot(normal) > 0


def _contained_in(inner, outer, outer_bvh):
    """True when every sampled vertex of `inner` lies inside `outer` (a part hidden inside another)."""
    vertices = inner.data.vertices
    if not vertices:
        return False
    step = max(1, len(vertices) // CONTAINMENT_SAMPLES)
    samples = [vertices[index].co for index in range(0, len(vertices), step)][:CONTAINMENT_SAMPLES]
    return all(_point_inside(point, outer_bvh) for point in samples)


def parts_overlap(a, b, cache, epsilon):
    """Two parts overlap when their surfaces cross or one sits completely inside the other.
    Parts that are only near each other stay apart, like Bool Tool only fuses what intersects."""
    bounds_a, bvh_a = cache[a]
    bounds_b, bvh_b = cache[b]
    if not _bounds_overlap(bounds_a, bounds_b, epsilon):
        return False
    if bvh_a.overlap(bvh_b):
        return True
    if _bounds_contain(bounds_b, bounds_a):
        return _contained_in(a, b, bvh_b)
    if _bounds_contain(bounds_a, bounds_b):
        return _contained_in(b, a, bvh_a)
    return False


def find_overlap_groups(parts, epsilon):
    """Group parts that overlap directly or through a chain of overlapping parts.
    Returns a list of groups (lists of objects), biggest part first inside each group."""
    cache = {obj: (_bounds(obj), _build_bvh(obj, epsilon)) for obj in parts}
    parent = {obj: obj for obj in parts}

    def root(obj):
        while parent[obj] is not obj:
            parent[obj] = parent[parent[obj]]
            obj = parent[obj]
        return obj

    for index, a in enumerate(parts):
        for b in parts[index + 1:]:
            if root(a) is not root(b) and parts_overlap(a, b, cache, epsilon):
                parent[root(b)] = root(a)
    groups = {}
    for obj in parts:
        groups.setdefault(root(obj), []).append(obj)
    return [sorted(group, key=face_count, reverse=True) for group in groups.values()]


# --- Union of one group ---------------------------------------------------------------

def union_group(group, options):
    """Boolean-union one group of parts into its biggest part.
    Returns (result_object, parts joined because their union failed, used per-part fallback)."""
    base = group[0]
    operands = group[1:]
    if not operands:
        return base, [], False
    backup = base.data.copy()
    ok = False
    try:
        ok = union_all_at_once(base, operands, options)
    except RuntimeError as error:
        log(f"N-ary union raised: {error}")
    if ok:
        bpy.data.meshes.remove(backup)
        _remove_objects(operands)
        return base, [], False
    log("N-ary union failed; retrying part by part.")
    _remove_leftover_modifiers(base)
    _restore_mesh(base, backup)
    joined_fallback = union_one_by_one(base, operands, options)
    _remove_objects([obj for obj in operands if obj not in joined_fallback])
    return join_into(base, joined_fallback), joined_fallback, True


# --- Entry point ----------------------------------------------------------------------

def combine_objects(objects, options=None):
    """Combine mesh objects. Returns (result_objects, report dict).

    method "union" + overlap_only (default): only parts that overlap are fused, every
    other part stays as it is. method "union" without overlap_only fuses everything.
    method "join" puts every part into one object without a boolean.
    join_result puts all results into one object at the end.
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
    cleaned_faces = 0
    if options.method == "union" and options.clean_parts:
        cleaned_faces = sum(clean_part(obj, options.merge_distance) for obj in parts)
        if cleaned_faces:
            log(f"Removed {cleaned_faces} interior/degenerate face(s) before the union.")
        emptied = [obj for obj in parts if face_count(obj) == 0]
        _remove_objects(emptied)
        parts = [obj for obj in parts if obj not in emptied]

    if options.method == "union" and options.overlap_only:
        groups = find_overlap_groups(parts, max(options.merge_distance, OVERLAP_EPSILON))
    else:
        groups = [sorted(parts, key=face_count, reverse=True)]
    fuse_groups = [group for group in groups if len(group) > 1]
    fused_part_count = sum(len(group) for group in fuse_groups)
    log(f"{part_count} part(s): {len(fuse_groups)} group(s) with {fused_part_count} part(s) to fuse, "
        f"{part_count - fused_part_count} part(s) left as they are.")

    results = []
    untouched = []
    joined_fallback_count = 0
    used_per_part = False
    for group in groups:
        if len(group) == 1:
            untouched.append(group[0])
            continue
        if options.method == "join":
            result = join_into(group[0], group[1:])
        else:
            result, joined_fallback, per_part = union_group(group, options)
            joined_fallback_count += len(joined_fallback)
            used_per_part = used_per_part or per_part
        clean_up(result, options.merge_distance)
        # Like Bool Tool, the fused result keeps the name of its biggest (base) part.
        results.append(result)

    # Fused results carry smeared, interpolated normals; untouched parts that were welded while
    # separating loose parts lost theirs too. Shade both from sharp edges + angle again.
    for obj in results:
        shade_sharp_by_angle(obj)
    if options.separate_loose_parts:
        for obj in untouched:
            shade_sharp_by_angle(obj)

    # Open edges are counted on fused results only; untouched parts are reported as they came in.
    fused_non_manifold_edges = sum(count_non_manifold_edges(obj) for obj in results)
    all_objects = results + untouched
    if options.join_result and len(all_objects) > 1:
        joined = join_into(all_objects[0], all_objects[1:])
        joined.name = options.result_name
        joined.data.name = options.result_name
        all_objects = [joined]

    used_method = options.method
    if options.method == "union":
        used_method = "union_per_part" if used_per_part else ("union_overlapping" if options.overlap_only else "union")
    report = {
        "method": used_method,
        "solver": modifier_solver_label(options) if options.method == "union" else None,
        "inputObjects": input_object_count,
        "parts": part_count,
        "overlapGroups": len(fuse_groups),
        "fusedParts": fused_part_count,
        "separateParts": len(untouched),
        "droppedParts": dropped_parts,
        "interiorFacesRemoved": cleaned_faces,
        "joinedFallbackParts": joined_fallback_count,
        "resultObjects": len(all_objects),
        "inputFaces": input_faces,
        "faces": sum(face_count(obj) for obj in all_objects),
        "nonManifoldEdges": fused_non_manifold_edges,
    }
    log(f"Fused {fused_part_count} part(s) in {len(fuse_groups)} group(s); "
        f"{report['resultObjects']} object(s), {report['faces']} faces (method={used_method}).")
    return all_objects, report
