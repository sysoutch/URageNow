import sys
import bpy
import bmesh


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

    cleared_count = 0
    selected_edges = {edge for face in selected_faces for edge in face.edges}
    for edge in selected_edges:
        if edge.smooth:
            continue
        edge.smooth = True
        cleared_count += 1

    bmesh.update_edit_mesh(mesh, loop_triangles=False, destructive=False)
    return cleared_count


def prepare_merged_mesh(merge_distance):
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("No mesh objects found after import.")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    active_object = mesh_objects[0]
    bpy.context.view_layer.objects.active = active_object

    if active_object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    if len(mesh_objects) > 1:
        bpy.ops.object.join()
        active_object = bpy.context.view_layer.objects.active

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="VERT")
    bpy.ops.mesh.select_all(action="SELECT")
    merged_vertex_count = merge_selected_vertices(merge_distance)
    cleared_sharp_edge_count = clear_sharp_edges_from_selected_faces()
    bpy.ops.object.mode_set(mode="OBJECT")
    return active_object, merged_vertex_count, cleared_sharp_edge_count


def main():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments.")

    args = sys.argv[sys.argv.index("--") + 1:]
    filepath = get_arg_value(args, "filepath", "").strip()
    output_path = get_arg_value(args, "output_path", "").strip()
    merge_distance_raw = get_arg_value(args, "merge_distance", str(DEFAULT_MERGE_DISTANCE)).strip()

    if not filepath:
        raise RuntimeError("--filepath is required.")
    if not output_path:
        raise RuntimeError("--output_path is required.")

    try:
        merge_distance = float(merge_distance_raw)
    except ValueError as error:
        raise RuntimeError("--merge_distance must be a valid number.") from error

    merge_distance = max(0.0, merge_distance)

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    clear_scene()
    import_model(filepath)
    merged_object, merged_vertex_count, cleared_sharp_edge_count = prepare_merged_mesh(merge_distance)

    bpy.ops.object.select_all(action="DESELECT")
    merged_object.select_set(True)
    bpy.context.view_layer.objects.active = merged_object
    export_model(output_path)
    print(f"Merged vertices removed: {merged_vertex_count}")
    print(f"Sharp edges cleared: {cleared_sharp_edge_count}")
    print(f"Exported model to: {output_path}")


if __name__ == "__main__":
    main()
