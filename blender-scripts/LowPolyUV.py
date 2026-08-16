import sys
import bpy
import os


def get_arg_value(args, key, default_value, arg_type=str):
    """Get argument value by key name instead of index."""
    try:
        for arg in args:
            if arg.startswith(f"--{key}="):
                value = arg.split("=", 1)[1]
                if arg_type == int:
                    return int(value)
                if arg_type == float:
                    return float(value)
                if arg_type == bool:
                    return value.lower() == "true"
                return value
        return default_value
    except (ValueError, IndexError):
        return default_value


def ensure_object_mode():
    try:
        if bpy.context.object and bpy.context.object.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        # Ignore mode-set failures when no object is active yet.
        pass


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


# Get arguments after '--'
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

# Get arguments using key-value pairs
filepath = get_arg_value(args, "filepath", "", str)
merge_vertices = get_arg_value(args, "merge_vertices", True, bool)
should_decimate = get_arg_value(args, "should_decimate", True, bool)
decimate_face_count = get_arg_value(args, "decimate_face_count", 1500, int)
max_colors = get_arg_value(args, "max_colors", 16, int)
block_size = get_arg_value(args, "block_size", 8, int)
output_path = get_arg_value(args, "output_path", "", str)
new_mesh_name = get_arg_value(args, "new_mesh_name", "", str)

if not filepath:
    raise RuntimeError("Missing --filepath argument.")

# Clear all existing objects
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

pre_import_names = set(obj.name for obj in bpy.context.scene.objects)

source_path_lower = filepath.lower()
if source_path_lower.endswith(".fbx"):
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
        use_prepost_rot=True,
    )
elif source_path_lower.endswith(".obj"):
    try:
        bpy.ops.wm.obj_import(filepath=filepath)
    except Exception:
        try:
            bpy.ops.import_scene.obj(filepath=filepath, use_image_search=True)
        except Exception:
            bpy.ops.preferences.addon_enable(module="io_scene_obj")
            bpy.ops.import_scene.obj(filepath=filepath, use_image_search=True)
else:
    try:
        bpy.ops.import_scene.gltf(filepath=filepath)
    except Exception:
        bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
        bpy.ops.import_scene.gltf(filepath=filepath)

# Prefer freshly imported objects; fallback to all mesh/empty.
imported_objects = [
    obj
    for obj in bpy.context.scene.objects
    if obj.name not in pre_import_names and obj.type in ("MESH", "EMPTY")
]
if not imported_objects:
    imported_objects = [obj for obj in bpy.context.scene.objects if obj.type in ("MESH", "EMPTY")]

mesh_objects = [obj for obj in imported_objects if obj.type == "MESH"]
if not mesh_objects:
    raise RuntimeError(f"No mesh objects were imported from source model: {filepath}")

if new_mesh_name and new_mesh_name != "null":
    mesh_objects[0].name = new_mesh_name

# parent creation
create_parent = False
if create_parent and len(imported_objects) > 1:
    parent_obj = bpy.data.objects.new("Parent", None)
    bpy.context.collection.objects.link(parent_obj)
    for obj in imported_objects:
        obj.parent = parent_obj

# Make imported mesh selection explicit so both FBX/GLB work the same.
ensure_object_mode()
bpy.ops.object.select_all(action="DESELECT")
for obj in mesh_objects:
    obj.select_set(True)
active_mesh = mesh_objects[0]
bpy.context.view_layer.objects.active = active_mesh

# Apply transforms
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Merge Vertices and Decimate to target face count
if merge_vertices:
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles()
    bpy.ops.object.mode_set(mode="OBJECT")
if should_decimate:
    for mesh_obj in mesh_objects:
        decimate_mesh_object_to_target_faces(mesh_obj, decimate_face_count)

# Run LowpolyUV
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.lowpolyuv(max_colors=max_colors, block_size=block_size)

# Switch back to Object mode
bpy.ops.object.mode_set(mode="OBJECT")

# Prepare export paths
if not output_path or output_path == "null":
    output_path = f"{os.path.splitext(filepath)[0]}.fbx"
output_folder = os.path.dirname(output_path)
texture_dir = os.path.join(output_folder, "textures")
os.makedirs(texture_dir, exist_ok=True)

# Ensure packed textures are unpacked and saved to textures folder
for mat in active_mesh.data.materials:
    if not mat or not mat.use_nodes:
        continue
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        continue
    links = mat.node_tree.links
    has_texture = False
    for link in links:
        if link.to_node == bsdf and link.to_socket.name == "Base Color" and link.from_node.type == "TEX_IMAGE":
            has_texture = True
            img = link.from_node.image
            if img:
                texture_path = os.path.join(texture_dir, f"{img.name}.png")
                img.filepath_raw = texture_path
                img.save(filepath=texture_path)
                print(f"Saved texture manually to: {texture_path}")
            break
    if not has_texture:
        print(f"Material '{mat.name}' has no Base Color texture connected.")

# Ensure textures are packed into the .blend file
bpy.ops.file.pack_all()

# Re-assert selection before export.
ensure_object_mode()
bpy.ops.object.select_all(action="DESELECT")
for obj in mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = active_mesh

# Export lowpoly model
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
print(f"Exported model to: {output_path}")
