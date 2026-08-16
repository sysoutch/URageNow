import os
import sys
import bpy


def get_arg_value(args, key, default_value):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default_value


def parse_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if not isinstance(value, str):
        return default
    normalized = value.strip().lower()
    if normalized in ("1", "true", "yes", "on"):
        return True
    if normalized in ("0", "false", "no", "off"):
        return False
    return default


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
    raise RuntimeError(f"Unsupported model format for metallic pass: {filepath}")


def all_mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def set_material_metallic(material, metallic_value):
    if material is None:
        return
    if material.use_nodes and material.node_tree:
        for node in material.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            metallic_input = node.inputs.get("Metallic")
            if metallic_input is not None:
                metallic_input.default_value = metallic_value
    else:
        material.metallic = metallic_value


def apply_global_metallic(mesh_objects, metallic_enabled):
    metallic_value = 1.0 if metallic_enabled else 0.0
    seen_materials = set()
    for obj in mesh_objects:
        for slot in obj.material_slots:
            material = slot.material
            if material is None:
                continue
            if material.name in seen_materials:
                continue
            seen_materials.add(material.name)
            set_material_metallic(material, metallic_value)


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
    raise RuntimeError(f"Unsupported output format for metallic pass: {output_path}")


def main():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments.")
    args = sys.argv[sys.argv.index("--") + 1:]
    filepath = get_arg_value(args, "filepath", "").strip()
    output_path = get_arg_value(args, "output_path", "").strip()
    metallic_enabled = parse_bool(get_arg_value(args, "metallic_enabled", "false"), False)
    if not filepath:
        raise RuntimeError("--filepath is required.")
    if not output_path:
        raise RuntimeError("--output_path is required.")

    clear_scene()
    import_model(filepath)
    mesh_objects = all_mesh_objects()
    if not mesh_objects:
        raise RuntimeError("No mesh objects found after import.")
    apply_global_metallic(mesh_objects, metallic_enabled)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    export_model(output_path)
    print(f"Exported model to: {output_path}")


if __name__ == "__main__":
    main()
