import os
import sys
import bpy
import bmesh
from mathutils import Vector

DEFAULT_MERGE_DISTANCE = 0.0001


def get_arg_value(args, key, default_value):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default_value


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_model(filepath):
    lower = filepath.lower()

    if lower.endswith(".fbx"):
        bpy.ops.import_scene.fbx(
            filepath=filepath,
            use_custom_normals=True,
            use_image_search=True,
        )
        return

    if lower.endswith(".glb") or lower.endswith(".gltf"):
        try:
            bpy.ops.import_scene.gltf(filepath=filepath)
        except Exception:
            bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
            bpy.ops.import_scene.gltf(filepath=filepath)
        return

    raise RuntimeError(f"Unsupported model format: {filepath}")


def export_model(output_path):
    lower = output_path.lower()

    if lower.endswith(".fbx"):
        bpy.ops.export_scene.fbx(
            filepath=output_path,
            use_selection=True,
            apply_scale_options="FBX_SCALE_ALL",
            axis_forward="-Z",
            axis_up="Y",
            use_mesh_modifiers=True,
            apply_unit_scale=True,
            path_mode="COPY",
            embed_textures=True,
        )
        return

    if lower.endswith(".glb"):
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format="GLB",
            use_selection=True,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_apply=True,
        )
        return

    if lower.endswith(".gltf"):
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format="GLTF_SEPARATE",
            use_selection=True,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_apply=True,
        )
        return

    raise RuntimeError(f"Unsupported output format: {output_path}")


def sanitize_name(value, fallback):
    cleaned = "".join(char if char.isalnum() or char in ("_", "-", ".") else "_" for char in str(value or ""))
    cleaned = cleaned.strip("._")
    return cleaned or fallback


def merge_selected_vertices(merge_distance):
    edit_object = bpy.context.edit_object
    if not edit_object or edit_object.type != "MESH":
        raise RuntimeError("Active edit object must be a mesh before merging vertices.")

    mesh = edit_object.data
    bm = bmesh.from_edit_mesh(mesh)
    bm.verts.ensure_lookup_table()
    vertices = list(bm.verts)
    if not vertices:
        return 0

    before_count = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=vertices, dist=merge_distance)
    bmesh.update_edit_mesh(mesh, loop_triangles=False, destructive=True)
    return max(0, before_count - len(bm.verts))


def clear_sharp_edges_from_selected_faces():
    edit_object = bpy.context.edit_object
    if not edit_object or edit_object.type != "MESH":
        raise RuntimeError("Active edit object must be a mesh before clearing sharp edges.")

    mesh = edit_object.data
    bm = bmesh.from_edit_mesh(mesh)
    bm.faces.ensure_lookup_table()
    selected_faces = [face for face in bm.faces if face.select]
    if not selected_faces:
        return 0

    selected_edges = {edge for face in selected_faces for edge in face.edges}
    cleared_count = 0
    for edge in selected_edges:
        if edge.smooth:
            continue
        edge.smooth = True
        cleared_count += 1

    bmesh.update_edit_mesh(mesh, loop_triangles=False, destructive=False)
    return cleared_count


def split_mesh_by_loose_parts(merge_distance):
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        return []

    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    active_object = mesh_objects[0]
    bpy.context.view_layer.objects.active = active_object

    if active_object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    if len(mesh_objects) > 1:
        bpy.ops.object.join()

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="VERT")
    bpy.ops.mesh.select_all(action="SELECT")
    merge_selected_vertices(merge_distance)
    clear_sharp_edges_from_selected_faces()
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    split_objects = [item for item in bpy.context.selected_objects if item.type == "MESH"]
    split_objects.sort(key=lambda item: item.name.lower())
    return split_objects


def process_meshes(merge_distance):
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]

    if not mesh_objects:
        raise RuntimeError("No mesh objects found after import.")
    separated_objects = split_mesh_by_loose_parts(merge_distance)

    final_mesh_count = len([obj for obj in bpy.context.scene.objects if obj.type == "MESH"])
    if not separated_objects:
        separated_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    print(f"Separated loose parts: {max(len(separated_objects), final_mesh_count)} mesh object(s).")
    return separated_objects


def move_geometry_center_to_origin(obj):
    center_world = sum((obj.matrix_world @ Vector(corner) for corner in obj.bound_box), Vector()) / 8
    offset_local = obj.matrix_world.inverted().to_3x3() @ center_world

    for vertex in obj.data.vertices:
        vertex.co -= offset_local

    obj.data.update()


def export_selected_model(output_path, objects, merge_distance):
    bpy.ops.object.select_all(action="DESELECT")

    for obj in objects:
        obj.select_set(True)

    bpy.context.view_layer.objects.active = objects[0]

    if len(objects) > 1:
        bpy.ops.object.join()
        objects = [bpy.context.view_layer.objects.active]

    active_obj = bpy.context.view_layer.objects.active

    if active_obj.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="VERT")
    bpy.ops.mesh.select_all(action="SELECT")
    merge_selected_vertices(merge_distance)
    clear_sharp_edges_from_selected_faces()
    bpy.ops.object.mode_set(mode="OBJECT")

    # Replacement for bpy.ops.view3d.snap_selected_to_cursor(use_offset=True)
    # This moves the vertices, not the object transform.
    move_geometry_center_to_origin(active_obj)

    export_model(output_path)

    print(f"Exported split model to: {output_path}")
    return [output_path]


def export_split_models(output_path, objects, export_mode, merge_distance):
    if not objects:
        raise RuntimeError("No separated mesh objects were available for export.")

    if export_mode == "single_file":
        return export_selected_model(output_path, objects, merge_distance)

    output_directory = os.path.dirname(output_path)
    output_name = os.path.basename(output_path)
    output_stem, output_ext = os.path.splitext(output_name)
    base_directory = os.path.join(output_directory, sanitize_name(output_stem, "split_parts"))
    os.makedirs(base_directory, exist_ok=True)

    exported_paths = []
    part_stem = sanitize_name(output_stem, "split_part")
    for index, obj in enumerate(objects, start=1):
        obj.name = f"{part_stem}_part_{index:03d}"
        part_file_name = f"{part_stem}_part_{index:03d}{output_ext}"
        part_output_path = os.path.join(base_directory, part_file_name)
        exported_paths.extend(export_selected_model(part_output_path, [obj], merge_distance))
    return exported_paths


def main():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments.")

    args = sys.argv[sys.argv.index("--") + 1:]

    filepath = get_arg_value(args, "filepath", "").strip()
    output_path = get_arg_value(args, "output_path", "").strip()
    export_mode = get_arg_value(args, "export_mode", "per_part").strip().lower()
    merge_distance_raw = get_arg_value(args, "merge_distance", str(DEFAULT_MERGE_DISTANCE)).strip()

    if not filepath:
        raise RuntimeError("--filepath is required.")

    if not output_path:
        raise RuntimeError("--output_path is required.")

    if export_mode not in {"per_part", "single_file"}:
        raise RuntimeError("--export_mode must be per_part or single_file.")

    try:
        merge_distance = float(merge_distance_raw)
    except ValueError as error:
        raise RuntimeError("--merge_distance must be a valid number.") from error

    merge_distance = max(0.0, merge_distance)

    # Ensure object mode
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    clear_scene()

    import_model(filepath)

    separated_objects = process_meshes(merge_distance)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    exported_paths = export_split_models(output_path, separated_objects, export_mode, merge_distance)
    print(f"Exported split part count: {len(exported_paths)}")


if __name__ == "__main__":
    main()
