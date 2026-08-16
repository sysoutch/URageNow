import os
import sys
import bpy
from mathutils import Vector


def get_arg_value(args, key, default_value):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default_value


def parse_positive_float(value, fallback):
    try:
        parsed = float(str(value).strip().replace(",", "."))
    except Exception:
        return fallback
    if parsed <= 0:
        return fallback
    return parsed


def clear_scene():
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
    raise RuntimeError(f"Unsupported model format for scaling: {filepath}")


def get_mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def compute_world_bounds(objects):
    points = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    if not points:
        return None, None
    min_corner = Vector((
        min(point.x for point in points),
        min(point.y for point in points),
        min(point.z for point in points),
    ))
    max_corner = Vector((
        max(point.x for point in points),
        max(point.y for point in points),
        max(point.z for point in points),
    ))
    return min_corner, max_corner


def scale_uniform_to_height(mesh_objects, target_height_meters):
    bpy.context.view_layer.update()
    min_corner, max_corner = compute_world_bounds(mesh_objects)
    if min_corner is None or max_corner is None:
        raise RuntimeError("Failed to compute model bounds for scaling.")
    current_height = max_corner.z - min_corner.z
    if current_height <= 0.000001:
        raise RuntimeError("Model has zero or invalid height; cannot scale.")
    scale_factor = target_height_meters / current_height
    for obj in mesh_objects:
        obj.scale = obj.scale * scale_factor
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def export_model(output_path):
    lower = output_path.lower()
    if lower.endswith(".fbx"):
        bpy.ops.export_scene.fbx(
            filepath=output_path,
            use_selection=False,
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
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_apply=True,
        )
        return
    raise RuntimeError(f"Unsupported output format for scaling: {output_path}")


def main():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments.")
    args = sys.argv[sys.argv.index("--") + 1:]
    filepath = get_arg_value(args, "filepath", "").strip()
    output_path = get_arg_value(args, "output_path", "").strip()
    target_height_meters = parse_positive_float(get_arg_value(args, "target_height_meters", "1.8"), 1.8)
    if not filepath:
        raise RuntimeError("--filepath is required.")
    if not output_path:
        raise RuntimeError("--output_path is required.")

    clear_scene()
    import_model(filepath)
    mesh_objects = get_mesh_objects()
    if not mesh_objects:
        raise RuntimeError("No mesh objects found after import.")
    scale_uniform_to_height(mesh_objects, target_height_meters)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    export_model(output_path)
    print(f"Exported model to: {output_path}")


if __name__ == "__main__":
    main()
