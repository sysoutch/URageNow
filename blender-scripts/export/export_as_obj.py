import sys
import bpy
import os

def get_arg_value(args, key, default_value, arg_type=str):
    """Get argument value by key name instead of index"""
    try:
        # Look for key-value pairs in the format "--key=value"
        for arg in args:
            if arg.startswith(f"--{key}="):
                # Handle "--key=value" format
                value = arg.split('=', 1)[1]
                if arg_type == int:
                    return int(value)
                elif arg_type == float:
                    return float(value)
                elif arg_type == bool:
                    return value.lower() == "true"
                else:
                    return value
        return default_value
    except (ValueError, IndexError):
        return default_value

# Get arguments after '--'
args = sys.argv[sys.argv.index('--') + 1:]

# Get arguments using key-value pairs
filepath = get_arg_value(args, "filepath", "", str)

# Clear all existing objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

if filepath.lower().endswith('.fbx'):
    # Import the FBX file
    bpy.ops.import_scene.fbx(
        filepath=filepath,
        use_image_search=True,        # Automatically search for textures
        use_custom_normals=True,      # Import custom normals if available
        use_anim=True,                # Import animations
        anim_offset=1.0,              # Offset animation start frame
        use_subsurf=False,            # Disable subsurf modifier
        automatic_bone_orientation=True,  # Auto-fix bone orientations
        ignore_leaf_bones=True,       # Ignore end bones (common for game rigs)
        force_connect_children=False, # Don’t connect disconnected bones
        use_prepost_rot=True          # Use pre/post rotation from FBX
    )
else:
    # Enable the GLTF importer add-on
    bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    # Import the GLB file
    bpy.ops.import_scene.gltf(filepath=filepath)

# Get all imported objects
imported_objects = [obj for obj in bpy.context.scene.objects if obj.type in ('MESH', 'EMPTY')]

if imported_objects:
    # Rename the first imported mesh object
    first_mesh = None
    for obj in imported_objects:
        if obj.type == 'MESH':
            first_mesh = obj
            break
    
    if first_mesh:
        first_mesh.name = "Renamed_Model"
        
        # Optional: Rename the object's mesh data as well
        if first_mesh.data:
            first_mesh.data.name = "Renamed_Model_Mesh"
    
    # Optional parent creation (disabled here)
    create_parent = False
    
    if create_parent and len(imported_objects) > 1:
        parent_obj = bpy.data.objects.new("World_Parent", None)
        bpy.context.collection.objects.link(parent_obj)
        for obj in imported_objects:
            obj.parent = parent_obj

# Apply transforms using Blender 4.5+ operator
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Prepare export paths
if not output_path or output_path == "null":
    output_path = filepath.replace('.glb', '.fbx')
output_folder = os.path.dirname(output_path)
texture_dir = os.path.join(output_folder, "textures")
os.makedirs(texture_dir, exist_ok=True)

# Ensure packed textures are unpacked and saved to textures folder
for mat in bpy.context.active_object.data.materials:
    if mat.use_nodes:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            links = mat.node_tree.links
            has_texture = False
            for link in links:
                if (link.to_node == bsdf and link.to_socket.name == 'Base Color' and link.from_node.type == 'TEX_IMAGE'):
                    has_texture = True
                    img = link.from_node.image
                    if img:
                        # Save image manually to textures folder
                        texture_path = os.path.join(texture_dir, f"{img.name}.png")
                        img.filepath_raw = texture_path
                        img.save(filepath=texture_path)
                        print(f"Saved texture manually to: {texture_path}")
                    break
            if not has_texture:
                print(f"Material '{mat.name}' has no Base Color texture connected.")

# Ensure textures are packed into the .blend file
bpy.ops.file.pack_all()

# Export the model to OBJ format
bpy.ops.wm.obj_export(filepath=output_path)
print(f"Exported model to: {output_path}")