import sys
import bpy


def get_arg_value(args, key, default_value):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default_value


def ensure_object_mode():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def clear_scene():
    ensure_object_mode()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_model(filepath):
    lower = filepath.lower()
    if lower.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=filepath, use_custom_normals=True, use_image_search=True)
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


def decimate_mesh_object_to_target_faces(mesh_obj, target_faces):
    if not mesh_obj or mesh_obj.type != "MESH":
        return
    if target_faces <= 0:
        return
    current_faces = len(mesh_obj.data.polygons)
    if current_faces <= target_faces:
        return
    ratio = max(0.0, min(1.0, float(target_faces) / float(current_faces)))
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    decimate_modifier = mesh_obj.modifiers.new(name="Decimate", type="DECIMATE")
    decimate_modifier.decimate_type = "COLLAPSE"
    decimate_modifier.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=decimate_modifier.name, report=True)


def decimate_scene_to_target_faces(target_faces):
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("No mesh objects found after import.")
    face_counts = [len(obj.data.polygons) for obj in mesh_objects]
    total_faces = sum(face_counts)
    if total_faces <= target_faces:
        return mesh_objects, total_faces, total_faces
    remaining_target = target_faces
    for index, mesh_obj in enumerate(mesh_objects):
        current_faces = face_counts[index]
        if index == len(mesh_objects) - 1:
            object_target = max(1, remaining_target)
        else:
            object_target = max(1, round(target_faces * current_faces / total_faces))
            remaining_target -= object_target
        decimate_mesh_object_to_target_faces(mesh_obj, object_target)
    final_faces = sum(len(obj.data.polygons) for obj in mesh_objects)
    return mesh_objects, total_faces, final_faces


def main():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments.")
    args = sys.argv[sys.argv.index("--") + 1:]
    filepath = get_arg_value(args, "filepath", "").strip()
    output_path = get_arg_value(args, "output_path", "").strip()
    target_faces_raw = get_arg_value(args, "target_faces", "").strip()
    if not filepath:
        raise RuntimeError("--filepath is required.")
    if not output_path:
        raise RuntimeError("--output_path is required.")
    try:
        target_faces = int(target_faces_raw)
    except ValueError as error:
        raise RuntimeError("--target_faces must be a positive integer.") from error
    if target_faces <= 0:
        raise RuntimeError("--target_faces must be a positive integer.")
    clear_scene()
    import_model(filepath)
    mesh_objects, initial_faces, final_faces = decimate_scene_to_target_faces(target_faces)
    bpy.ops.object.select_all(action="DESELECT")
    for mesh_obj in mesh_objects:
        mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    export_model(output_path)
    print(f"Initial face count: {initial_faces}")
    print(f"Target face count: {target_faces}")
    print(f"Final face count: {final_faces}")
    print(f"Exported model to: {output_path}")


if __name__ == "__main__":
    main()
