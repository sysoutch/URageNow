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


def triangulate_mesh_object(mesh_obj):
    if not mesh_obj or mesh_obj.type != "MESH":
        return
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    triangulate_modifier = mesh_obj.modifiers.new(name="Triangulate before low-poly decimation", type="TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=triangulate_modifier.name, report=True)


def allocate_total_face_budget(mesh_objects, target_faces):
    """Distribute one model-wide face budget across its imported meshes."""
    face_counts = [len(mesh_obj.data.polygons) for mesh_obj in mesh_objects]
    total_faces = sum(face_counts)
    if target_faces <= 0 or total_faces <= target_faces:
        return face_counts

    # Largest-remainder allocation keeps the total budget stable while retaining
    # every imported mesh, rather than applying the full budget to each mesh.
    raw_budgets = [(face_count / total_faces) * target_faces for face_count in face_counts]
    budgets = [max(1, int(raw_budget)) for raw_budget in raw_budgets]
    remaining = target_faces - sum(budgets)
    ranked_indices = sorted(
        range(len(mesh_objects)),
        key=lambda index: raw_budgets[index] - int(raw_budgets[index]),
        reverse=True
    )
    if remaining > 0:
        for index in ranked_indices[:remaining]:
            budgets[index] += 1
    elif remaining < 0:
        for index in reversed(ranked_indices):
            if remaining == 0:
                break
            if budgets[index] > 1:
                budgets[index] -= 1
                remaining += 1
    return budgets


def apply_installed_lowpolyuv_addon(mesh_objects, max_palette_colors, pixel_block_size):
    """Apply the installed LowPolyUV addon to every imported mesh.

    The addon owns palette clustering and UV snapping. Keeping that algorithm in
    one place ensures headless exports match the interactive Blender workflow.
    """
    if not hasattr(bpy.ops.uv, "lowpolyuv"):
        raise RuntimeError(
            "The LowPolyUV Blender addon is not enabled. Enable the installed addon "
            "before running a lowpoly export."
        )
    for mesh_obj in mesh_objects:
        ensure_object_mode()
        bpy.ops.object.select_all(action="DESELECT")
        mesh_obj.select_set(True)
        bpy.context.view_layer.objects.active = mesh_obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        result = bpy.ops.uv.lowpolyuv(
            workflow_method="TEXTURE",
            texture_method="NEW",
            scale_factor=0.0,
            max_colors=max(1, min(256, max_palette_colors)),
            block_size=max(1, pixel_block_size),
            use_downscale=True,
            downscale_max=512,
            use_metallic=False,
            use_flat_shading=True
        )
        if "FINISHED" not in result:
            raise RuntimeError(f"LowPolyUV addon did not finish for mesh: {mesh_obj.name}")
    ensure_object_mode()


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

# The scene was cleared before import, so every mesh now present belongs to
# the source asset. Name-based filtering can miss FBX siblings with a reused
# name, leaving part of the model untouched.
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
# Use Blender's built-in UV projection after topology reduction. This keeps
# UV generation independent from the decimation step and makes the exported
# geometry predictable across headless Blender runs.
if should_decimate:
    for mesh_obj in mesh_objects:
        triangulate_mesh_object(mesh_obj)
    source_face_count = sum(len(mesh_obj.data.polygons) for mesh_obj in mesh_objects)
    mesh_face_budgets = allocate_total_face_budget(mesh_objects, decimate_face_count)
    print(f"Decimating {len(mesh_objects)} meshes from {source_face_count} faces to a total target of {sum(mesh_face_budgets)} faces.")
    for mesh_obj, mesh_face_budget in zip(mesh_objects, mesh_face_budgets):
        decimate_mesh_object_to_target_faces(mesh_obj, mesh_face_budget)
    decimated_face_count = sum(len(mesh_obj.data.polygons) for mesh_obj in mesh_objects)
    print(f"Decimation completed with {decimated_face_count} faces.")

ensure_object_mode()
bpy.ops.object.select_all(action="DESELECT")
for mesh_obj in mesh_objects:
    mesh_obj.select_set(True)
bpy.context.view_layer.objects.active = active_mesh
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project()
bpy.ops.object.mode_set(mode="OBJECT")
for mesh_obj in mesh_objects:
    for polygon in mesh_obj.data.polygons:
        polygon.use_smooth = False

# Prepare export paths
if not output_path or output_path == "null":
    output_path = f"{os.path.splitext(filepath)[0]}.fbx"
output_folder = os.path.dirname(output_path)
texture_dir = os.path.join(output_folder, "textures")
os.makedirs(texture_dir, exist_ok=True)

# Delegate palette generation and UV snapping to the installed LowPolyUV
# addon. This is intentionally the same implementation used interactively in
# Blender, rather than a second approximation maintained by the dashboard.
apply_installed_lowpolyuv_addon(mesh_objects, max_colors, block_size)

# The addon creates in-memory palette images. Give them export paths before
# packing so the FBX contains the same generated palette when opened elsewhere.
for image in bpy.data.images:
    if image.name.endswith("_PaletteTexture") and not image.filepath_raw:
        image.filepath_raw = os.path.join(texture_dir, f"{image.name}.png")
        image.file_format = "PNG"
        image.save()
        print(f"Saved LowPolyUV addon palette texture to: {image.filepath_raw}")

# Ensure textures are packed into the .blend file
bpy.ops.file.pack_all()

# Re-assert selection before export.
ensure_object_mode()
bpy.ops.object.select_all(action="DESELECT")
for obj in mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = active_mesh
# Export the explicitly applied mesh without evaluating optional display
# modifiers during FBX export.
bpy.ops.export_scene.fbx(
    filepath=output_path,
    use_selection=True,
    apply_scale_options="FBX_SCALE_ALL",
    axis_forward="-Z",
    axis_up="Y",
    use_mesh_modifiers=False,
    apply_unit_scale=True,
    path_mode="COPY",
    embed_textures=True,
)
print(f"Exported model to: {output_path}")
