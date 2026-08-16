import bpy
import os
import sys


def get_arg_value(args, key, default=None):
    prefix = f"--{key}="
    for arg in args:
        if arg.startswith(prefix):
            return arg[len(prefix):]
    return default


def parse_bool(raw_value, default=False):
    if raw_value is None:
        return default
    value = str(raw_value).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def parse_optional_float(raw_value):
    if raw_value is None:
        return None
    value = str(raw_value).strip()
    if not value:
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    if bpy.data.meshes:
        for mesh in list(bpy.data.meshes):
            bpy.data.meshes.remove(mesh, do_unlink=True)
    if bpy.data.materials:
        for material in list(bpy.data.materials):
            if material.users == 0:
                bpy.data.materials.remove(material, do_unlink=True)


def import_model(filepath):
    extension = os.path.splitext(filepath)[1].lower()
    if extension == ".fbx":
        bpy.ops.import_scene.fbx(filepath=filepath)
        return
    if extension == ".obj":
        bpy.ops.wm.obj_import(filepath=filepath)
        return
    if extension in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=filepath)
        return
    raise RuntimeError(f"Unsupported model format for material finish pass: {filepath}")


def update_material_finish(material, metallic_value=None, roughness_value=None):
    if material is None:
        return
    if not material.use_nodes:
        if metallic_value is not None:
            material.metallic = metallic_value
        if roughness_value is not None:
            material.roughness = roughness_value
        return
    for node in material.node_tree.nodes:
        if node.type != "BSDF_PRINCIPLED":
            continue
        if metallic_value is not None:
            metallic_input = node.inputs.get("Metallic")
            if metallic_input is not None:
                metallic_input.default_value = metallic_value
        if roughness_value is not None:
            roughness_input = node.inputs.get("Roughness")
            if roughness_input is not None:
                roughness_input.default_value = roughness_value
    if metallic_value is not None:
        material.metallic = metallic_value
    if roughness_value is not None:
        material.roughness = roughness_value


def apply_material_finish(mesh_objects, metallic_enabled=None, roughness_value=None):
    metallic_value = None if metallic_enabled is None else (1.0 if metallic_enabled else 0.0)
    if roughness_value is not None:
        roughness_value = max(0.0, min(1.0, roughness_value))
    visited = set()
    for obj in mesh_objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material.name_full in visited:
                continue
            visited.add(material.name_full)
            update_material_finish(material, metallic_value, roughness_value)


def export_model(output_path):
    extension = os.path.splitext(output_path)[1].lower()
    export_dir = os.path.dirname(output_path)
    if export_dir:
        os.makedirs(export_dir, exist_ok=True)
    if extension == ".fbx":
        bpy.ops.export_scene.fbx(filepath=output_path, use_selection=False)
        return
    if extension == ".obj":
        bpy.ops.wm.obj_export(filepath=output_path, export_selected_objects=False)
        return
    if extension in {".glb", ".gltf"}:
        export_format = "GLB" if extension == ".glb" else "GLTF_SEPARATE"
        bpy.ops.export_scene.gltf(filepath=output_path, export_format=export_format, use_selection=False)
        return
    raise RuntimeError(f"Unsupported output format for material finish pass: {output_path}")


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    filepath = get_arg_value(args, "filepath", "")
    output_path = get_arg_value(args, "output_path", "")
    metallic_raw = get_arg_value(args, "metallic_enabled", None)
    roughness_raw = get_arg_value(args, "roughness_value", None)
    if not filepath or not output_path:
        raise RuntimeError("Both --filepath and --output_path are required.")
    metallic_enabled = None if metallic_raw is None else parse_bool(metallic_raw, False)
    roughness_value = parse_optional_float(roughness_raw)
    clear_scene()
    import_model(filepath)
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("No mesh objects were found after import.")
    apply_material_finish(mesh_objects, metallic_enabled, roughness_value)
    export_model(output_path)
    print(f"Exported model to: {output_path}")


if __name__ == "__main__":
    main()
