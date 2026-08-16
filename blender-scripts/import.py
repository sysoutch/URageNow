import json
import os
import sys
import bpy

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff", ".gif"}
URAGE_PATH_KEY = "urage_source_filepath"
URAGE_IMPORT_PATH_KEY = "urage_import_filepath"
URAGE_KIND_KEY = "urage_asset_kind"


def coerce_arg_value(value, default_value, arg_type):
    try:
        if arg_type == int:
            return int(value)
        if arg_type == float:
            return float(value)
        if arg_type == bool:
            return str(value).lower() == "true"
        return value
    except (TypeError, ValueError):
        return default_value


def get_arg_value(args, key, default_value, arg_type=str):
    """Get a Blender script argument by --key=value or --key value."""
    for index, arg in enumerate(args):
        if arg.startswith(f"--{key}="):
            return coerce_arg_value(arg.split("=", 1)[1], default_value, arg_type)
        if arg == f"--{key}" and index + 1 < len(args):
            return coerce_arg_value(args[index + 1], default_value, arg_type)
    return default_value


def safe_name(value, fallback):
    name = str(value or "").strip()
    return name if name else fallback


def ensure_object_mode():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def update_model_materials():
    for obj in bpy.context.selected_objects:
        if obj.type != "MESH":
            continue
        for mat_slot in obj.material_slots:
            mat = mat_slot.material
            if not mat:
                continue
            if not mat.use_nodes:
                mat.use_nodes = True

            nodes = mat.node_tree.nodes
            links = mat.node_tree.links
            principled = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
            if not principled:
                continue

            metallic_input = principled.inputs.get("Metallic")
            if metallic_input and metallic_input.is_linked:
                links.remove(metallic_input.links[0])
            if metallic_input:
                metallic_input.default_value = 0.0

            roughness_input = principled.inputs.get("Roughness")
            if roughness_input and roughness_input.is_linked:
                links.remove(roughness_input.links[0])
            if roughness_input:
                roughness_input.default_value = 0.8


def load_image_size(image):
    width, height = image.size
    return max(1, int(width or 1)), max(1, int(height or 1))


def tag_urage_source(objects, source_filepath, kind="model", import_filepath=""):
    source_path = os.path.abspath(source_filepath)
    import_path = os.path.abspath(import_filepath or source_filepath)
    extension = os.path.splitext(source_path)[1].lower()
    for obj in objects:
        if not obj:
            continue
        obj[URAGE_PATH_KEY] = source_path
        obj[URAGE_IMPORT_PATH_KEY] = import_path
        obj[URAGE_KIND_KEY] = kind
        obj["urage_source_extension"] = extension


def create_image_plane(filepath, name, location=(0, 0, 0), source_filepath=""):
    image = bpy.data.images.load(filepath, check_existing=True)
    width, height = load_image_size(image)
    aspect = width / height

    bpy.ops.mesh.primitive_plane_add(size=2, location=location)
    plane = bpy.context.object
    plane.name = safe_name(name, os.path.basename(filepath) or "Image Plane")
    plane.scale = (aspect, 1, 1)

    material = bpy.data.materials.new(plane.name + " Material")
    material.use_nodes = True
    material.blend_method = "BLEND"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture_node = nodes.new(type="ShaderNodeTexImage")
    texture_node.image = image
    if principled:
        links.new(texture_node.outputs["Color"], principled.inputs["Base Color"])
        if "Alpha" in texture_node.outputs and "Alpha" in principled.inputs:
            links.new(texture_node.outputs["Alpha"], principled.inputs["Alpha"])
        if "Metallic" in principled.inputs:
            principled.inputs["Metallic"].default_value = 0
        if "Roughness" in principled.inputs:
            principled.inputs["Roughness"].default_value = 0.72
    plane.data.materials.append(material)
    bpy.context.view_layer.objects.active = plane
    plane.select_set(True)
    tag_urage_source([plane], source_filepath or filepath, "image", filepath)
    return plane


def import_model(filepath):
    before = set(bpy.data.objects)
    extension = os.path.splitext(filepath)[1].lower()
    if extension == ".fbx":
        bpy.ops.import_scene.fbx(
            filepath=filepath,
            use_image_search=True,
            use_custom_normals=True,
            use_anim=True,
            anim_offset=1.0,
            use_subsurf=False,
            automatic_bone_orientation=True,
            ignore_leaf_bones=True,
            force_connect_children=False,
            use_prepost_rot=True
        )
        return [obj for obj in bpy.data.objects if obj not in before]
    if extension == ".obj":
        bpy.ops.wm.obj_import(filepath=filepath)
        return [obj for obj in bpy.data.objects if obj not in before]
    bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    bpy.ops.import_scene.gltf(filepath=filepath)
    return [obj for obj in bpy.data.objects if obj not in before]


def add_image_view_helpers(target):
    bpy.ops.object.light_add(type="AREA", location=(0, -3, 4))
    light = bpy.context.object
    light.name = "URage NOW Key Light"
    light.data.energy = 420
    light.data.size = 5

    bpy.ops.object.camera_add(location=(0, -4, 1.2), rotation=(1.30899694, 0, 0))
    bpy.context.scene.camera = bpy.context.object

    if target:
        bpy.ops.object.select_all(action="DESELECT")
        target.select_set(True)
        bpy.context.view_layer.objects.active = target


def set_material_view():
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            area.spaces[0].shading.type = "MATERIAL"
            break


def get_batch_assets(filelist):
    manifest_path = str(filelist or "").strip()
    if not manifest_path:
        return []
    with open(manifest_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    assets = payload.get("assets", []) if isinstance(payload, dict) else []
    return assets if isinstance(assets, list) else []


def offset_objects(objects, location):
    for obj in objects:
        if obj and hasattr(obj, "location"):
            obj.location.x += location[0]
            obj.location.y += location[1]
            obj.location.z += location[2]


def import_asset(asset, index, total):
    filepath = str(asset.get("filepath") or "").strip()
    source_filepath = str(asset.get("source_filepath") or asset.get("sourceFilepath") or filepath).strip()
    mode = str(asset.get("mode") or "model").strip().lower()
    name = safe_name(asset.get("name"), os.path.basename(filepath))
    if not filepath or not os.path.isfile(filepath):
        raise FileNotFoundError(f"Blender import target was not found: {filepath}")

    columns = max(1, min(4, int(total ** 0.5 + 0.999)))
    row = index // columns
    column = index % columns
    spacing = 3.2
    location = ((column - (columns - 1) / 2) * spacing, row * spacing, 0)
    extension = os.path.splitext(filepath)[1].lower()

    if mode == "image-plane" or extension in IMAGE_EXTENSIONS:
        return [create_image_plane(filepath, name, location, source_filepath)]

    imported = import_model(filepath)
    tag_urage_source(imported, source_filepath, "model", filepath)
    offset_objects(imported, location)
    return imported


ensure_object_mode()
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
filepath = get_arg_value(args, "filepath", "", str)
source_filepath = get_arg_value(args, "source_filepath", filepath, str)
filelist = get_arg_value(args, "filelist", "", str)
mode = get_arg_value(args, "mode", "model", str).strip().lower()
name = get_arg_value(args, "name", os.path.basename(filepath), str)
extension = os.path.splitext(filepath)[1].lower()
batch_assets = get_batch_assets(filelist)

if not batch_assets and (not filepath or not os.path.isfile(filepath)):
    raise FileNotFoundError(f"Blender import target was not found: {filepath}")

clear_scene()

if batch_assets:
    imported_objects = []
    for index, asset in enumerate(batch_assets):
        imported_objects.extend(import_asset(asset, index, len(batch_assets)))
    active_object = imported_objects[0] if imported_objects else None
    add_image_view_helpers(active_object)
else:
    if mode == "image-plane" or extension in IMAGE_EXTENSIONS:
        active_object = create_image_plane(filepath, name, source_filepath=source_filepath)
        add_image_view_helpers(active_object)
    else:
        imported_objects = import_model(filepath)
        tag_urage_source(imported_objects, source_filepath, "model", filepath)
        for obj in bpy.context.selected_objects:
            bpy.context.view_layer.objects.active = obj
        update_model_materials()

if batch_assets:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in imported_objects:
        if obj:
            obj.select_set(True)
    if active_object:
        bpy.context.view_layer.objects.active = active_object
    update_model_materials()
else:
    for obj in bpy.context.selected_objects:
        bpy.context.view_layer.objects.active = obj

set_material_view()
