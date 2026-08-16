import sys
import bpy

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

def update_material():
    for obj in bpy.context.selected_objects:
        if obj.type != 'MESH':
            continue
        for mat_slot in obj.material_slots:
            mat = mat_slot.material
            if not mat:
                continue
            if not mat.use_nodes:
                mat.use_nodes = True

            nodes = mat.node_tree.nodes
            links = mat.node_tree.links

            # Find Principled BSDF node
            principled = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if not principled:
                continue

            # Disconnect any links to Metallic input
            metallic_input = principled.inputs.get('Metallic')
            if metallic_input and metallic_input.is_linked:
                link = metallic_input.links[0]
                links.remove(link)

            # Set metallic to 0
            principled.inputs['Metallic'].default_value = 0.0

            # (Optional) Set roughness too
            roughness_input = principled.inputs.get('Roughness')
            if roughness_input and roughness_input.is_linked:
                link = roughness_input.links[0]
                links.remove(link)
            principled.inputs['Roughness'].default_value = 0.8

# Ensure we are in Object mode
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

# Get arguments after '--'
args = sys.argv[sys.argv.index('--') + 1:]

# Get arguments using key-value pairs
filepath = get_arg_value(args, "filepath", "", str)
output_path = get_arg_value(args, "output_path", "", str)
mirror_x = get_arg_value(args, "mirror_x", False, bool)
mirror_y = get_arg_value(args, "mirror_y", False, bool)
mirror_z = get_arg_value(args, "mirror_z", False, bool)

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

# set the imported object as active
for obj in bpy.context.selected_objects:
    bpy.context.view_layer.objects.active = obj

update_material()

# Switch to material view
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces[0].shading.type = 'MATERIAL'
        break
        
# Do what you need to do
bpy.ops.object.modifier_add(type='MIRROR')
bpy.context.object.modifiers["Mirror"].use_axis[0] = mirror_x
bpy.context.object.modifiers["Mirror"].use_axis[1] = mirror_y
bpy.context.object.modifiers["Mirror"].use_axis[2] = mirror_z

# Set the scene to export only selected objects (disable other settings as necessary)
bpy.ops.export_scene.fbx(
    filepath=output_path,
    use_selection=True,
    apply_scale_options='FBX_SCALE_ALL',
    axis_forward='-Z',
    axis_up='Y',
    use_mesh_modifiers=True,
    apply_unit_scale=True,
    path_mode='COPY',  # Auto mode handles embedding and external paths
    embed_textures=True,  # This embeds textures in the FBX
)
print(f"Exported model to: {output_path}")