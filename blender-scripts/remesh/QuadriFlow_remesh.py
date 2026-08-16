import sys
import bpy

duplicate_obj = None
original_obj = None

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

def create_bake_optimized_uvs(obj):
    """Create Smart UV Project unwrap for baking"""
    print("Creating Smart UV Project unwrap...")
    
    # Store selection
    original_selection = bpy.context.selected_objects[:]
    original_active = bpy.context.view_layer.objects.active
    
    # Select only the target object
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    
    # Enter Edit mode
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    
    # Clear existing UV maps
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    
    # Create new UV map
    obj.data.uv_layers.new(name="BakeUV")
    
    # Smart UV Project (as you preferred)
    print("  Using Smart UV Project...")
    bpy.ops.uv.smart_project(
        angle_limit=1.15,  # ~66 degrees
        island_margin=0.001,
        area_weight=0.0,
        correct_aspect=True,
        scale_to_bounds=False
    )
    
    # Return to Object mode
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Restore selection
    bpy.ops.object.select_all(action='DESELECT')
    for o in original_selection:
        if o.name in bpy.data.objects:
            o.select_set(True)
    if original_active and original_active.name in bpy.data.objects:
        bpy.context.view_layer.objects.active = original_active
        
    print("  Smart UV Project completed!")
    
def apply_quadri_flow_remesh():
    # Apply QuadriFlow remesh
    try:
        bpy.ops.object.quadriflow_remesh(
            mode='FACES',
            target_ratio=1.0,
            target_faces=10000,
            use_mesh_symmetry=False,
            use_preserve_sharp=True,
            use_preserve_boundary=False,
            smooth_normals=True,
            seed=0
        )
        print("QuadriFlow remesh completed successfully!")
    except Exception as e:
        print("Error running quadriflow_remesh:", e)

def bake_with_bakelab2():
    while len(bpy.context.scene.BakeLabMaps) > 0:
        bpy.ops.bakelab.removemapitem()
    bpy.context.scene.BakeLabProps.bake_mode = 'TO_ACTIVE'
    bpy.context.scene.BakeLabProps.bake_margin = 2
    bpy.context.scene.BakeLabProps.anti_alias = 2
    bpy.ops.bakelab.newmapitem(width=2048, height=2048)
    bpy.context.scene.BakeLabMaps[0].samples = 4

    bpy.ops.bakelab.newmapitem(type='Normal', width=2048, height=2048)

    bpy.ops.bakelab.bake()
    
    def timer_function():
        applyBakelabMaterials()
        return None
    
    bpy.app.timers.register(timer_function, first_interval=15)

def delayed_operations(original_obj, duplicate_obj):
    """Function to run after the 10-second delay"""
    print("10-second delay completed. Continuing with UV creation...")
    
    # Merge Vertices
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Create UVs
    create_bake_optimized_uvs(duplicate_obj)
    
    # Set up baking
    # bpy.ops.object.select_all(action='DESELECT')
    # obj.select_set(True)      # Source object
    # duplicate_obj.select_set(True)     # Target object  
    # context.view_layer.objects.active = duplicate_obj  # Make target active

    # Bake using BakeLab2
    # bake_with_bakelab2()

    # Move original object to X = -1
    original_obj.location.x -= duplicate_obj.dimensions.x

    print("All operations completed!")

# Ensure we are in Object mode
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

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

# Select only mesh objects (exclude parent objects like "world")
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.select_set(True)

# Make sure the active object is one of the mesh objects
if bpy.context.selected_objects:
    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]

update_material()

# Merge Vertices
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0001)
bpy.ops.object.mode_set(mode='OBJECT')

# Store reference to original object BEFORE duplicating
original_obj = bpy.context.active_object
original_name = bpy.context.active_object.name

# Duplicate object for remeshing
bpy.ops.object.duplicate()
duplicate_obj = bpy.context.active_object
duplicate_obj.name = original_name + "_QuadRemesh"

# Apply transforms
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# Select only the duplicate object
bpy.ops.object.select_all(action='DESELECT')
duplicate_obj.select_set(True)
bpy.context.view_layer.objects.active = duplicate_obj

# QuadriFlow Remesh
apply_quadri_flow_remesh()

# Add 10-second delay before continuing
def delayed_start():
    """Start the delayed operations after 10 seconds"""
    print("Starting 10-second delay...")
    # Schedule the delayed operations to run after 10 seconds
    bpy.app.timers.register(lambda: delayed_operations(original_obj, duplicate_obj), first_interval=5.0)
    return None

# Call the delayed start function
delayed_start()

# Switch to material view
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces[0].shading.type = 'MATERIAL'
        break