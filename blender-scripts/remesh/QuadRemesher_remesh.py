import sys
import bpy
import os
import time
import addon_utils
from bpy_extras.io_utils import ImportHelper

# Global variables for duplicate and original object
duplicate_obj = None
original_obj = None
quad_count = 2500
adaptive_size = 50
adapt_quad_count = True
symmetry_x = False
symmetry_y = False
symmetry_z = False

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

def show_message_and_quit():
    def draw(self, context):
        self.layout.label(text="Blender will close in 5 seconds...")
    bpy.context.window_manager.popup_menu(draw, title="Goodbye!", icon='INFO')
    bpy.app.timers.register(lambda: quit_blender(), first_interval=5.0)

def quit_blender():
    print("Quitting Blender now...")
    bpy.ops.wm.quit_blender()
    return None

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

    # Ensure the object is a mesh and has UV layers
    if obj.type != 'MESH':
        print(f"  Object {obj.name} is not a mesh. Skipping UV creation.")
        return

    # If the object has no UV layers, create one
    if not obj.data.uv_layers:
        print("  No existing UV layers found. Creating a new one.")
    
    # Clear existing UV layers
    if obj.data.uv_layers:
        while obj.data.uv_layers:
            obj.data.uv_layers.remove(obj.data.uv_layers[0])
        print("  Cleared existing UV layers.")

    # Create a new UV map
    obj.data.uv_layers.new(name="BakeUV")
    print("  New UV layer created.")

    # Switch to Edit mode for UV unwrapping
    try:
        bpy.ops.object.mode_set(mode='EDIT')
        if bpy.context.object.mode != 'EDIT':
            print("  Failed to enter Edit mode!")
            return
    except Exception as e:
        print(f"  Error while entering Edit mode: {str(e)}")
        return

    # Select all mesh elements in Edit mode
    bpy.ops.mesh.select_all(action='SELECT')

    # Smart UV Project (unwrap)
    print("  Using Smart UV Project...")
    try:
        bpy.ops.uv.smart_project(
            angle_limit=1.15,  # ~66 degrees
            island_margin=0.001,
            area_weight=0.0,
            correct_aspect=True,
            scale_to_bounds=False
        )
        print("  UV unwrapping successful.")
    except Exception as e:
        print(f"  Error during Smart UV Project: {str(e)}")
        return

    # Switch back to Object mode
    bpy.ops.object.mode_set(mode='OBJECT')

    print("  Smart UV Project completed!")

def apply_quad_remesher():
    # Apply Quad Remesher
    bpy.context.scene.qremesher.target_count = quad_count
    bpy.context.scene.qremesher.adaptive_size = adaptive_size
    bpy.context.scene.qremesher.adapt_quad_count = adapt_quad_count
    bpy.context.scene.qremesher.symmetry_x = symmetry_x
    bpy.context.scene.qremesher.symmetry_y = symmetry_y
    bpy.context.scene.qremesher.symmetry_z = symmetry_z
    bpy.ops.qremesher.remesh()
    
def update_status(message):
    bpy.context.scene["operation_status"] = message
    print(message)  # Print messages to console for tracking progress

def delayed_operations():
    """Scheduled function after 5 seconds"""
    # Initialize status
    update_status("Delayed operations starting...")

    # After Quad Remesher, find the new remeshed object
    new_duplicate_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.name == "Retopo_" + original_obj.name + "_QuadRemesh":
            new_duplicate_obj = obj
            break

    if new_duplicate_obj:
        duplicate_obj = new_duplicate_obj
        update_status(f"  Active object after remesh: {duplicate_obj.name}")
    else:
        bpy.app.timers.register(delayed_operations, first_interval=5.0)
        update_status("  Error: New duplicate object not found after remeshing.")
        return

    # Ensure object is of type MESH
    if duplicate_obj.type != 'MESH':
        update_status(f"  Object {duplicate_obj.name} is not a valid mesh!")
        return

    # Print object data (for debugging)
    update_status(f"  Object data: {len(duplicate_obj.data.vertices)} vertices, {len(duplicate_obj.data.edges)} edges, {len(duplicate_obj.data.polygons)} polygons")

    # Ensure we're in Edit mode for geometry operations
    try:
        bpy.ops.object.mode_set(mode='EDIT')
        if bpy.context.object.mode != 'EDIT':
            update_status("  Failed to enter Edit mode!")
            return
    except Exception as e:
        update_status(f"  Error while entering Edit mode: {str(e)}")
        return
    
    # Select and remove doubles
    try:
        bpy.ops.mesh.select_all(action='SELECT')  # Select all vertices
        bpy.ops.mesh.remove_doubles(threshold=0.0001)  # Merge duplicate vertices
        update_status("  Merged vertices (after remove_doubles)")
    except Exception as e:
        update_status(f"  Error during remove_doubles: {str(e)}")
        return
    
    # Apply transformations (to finalize geometry and make sure the object's scale/rotation is applied)
    bpy.ops.object.mode_set(mode='OBJECT')  # Switch back to Object mode
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    update_status("  Transformations applied")

    bpy.ops.object.shade_auto_smooth()
    update_status("  object smoothed")

    # Force update to ensure changes are reflected properly
    bpy.context.view_layer.update()
    
    # Ensure we're back in Object mode
    if bpy.context.object.mode != 'OBJECT':
        update_status("  Error: Could not switch back to Object mode!")
        return
    
    # AFTER geometry operations (OBJECT mode)
    # Create UVs (on duplicate object)
    update_status("  Creating UVs...")
    create_bake_optimized_uvs(duplicate_obj)

    update_status("  UV map created")

    # Set up selection for BakeLab2 baking
    bpy.ops.object.select_all(action='DESELECT')
    original_obj.select_set(True)      # Source object
    bpy.ops.object.shade_auto_smooth()
    duplicate_obj.select_set(True)     # Target object  
    bpy.context.view_layer.objects.active = duplicate_obj  # Make target active
                
    # Bake using BakeLab2
    bpy.context.scene.BakeLabProps.bake_mode = 'TO_ACTIVE'
    bpy.context.scene.BakeLabProps.bake_margin = 2
    bpy.context.scene.BakeLabProps.anti_alias = 2
    while len(bpy.context.scene.BakeLabMaps) > 0:
        bpy.ops.bakelab.removemapitem()
    bpy.ops.bakelab.newmapitem(width=2048, height=2048)
    bpy.ops.bakelab.newmapitem(type='Normal', width=2048, height=2048)
    update_status("  bake")
    bpy.ops.bakelab.bake()
    
    update_status("  Texture(s) baked with bakelab2")
    def timer_function():
        bpy.app.timers.unregister(timer_function)
        update_status("  apply Bakelab Materials")
        applyBakelabMaterials()
        return None
        
    bpy.app.timers.register(timer_function, first_interval=12)

def applyBakelabMaterials():
    # Move original object to X = -1
    if original_obj:
        original_obj.location.x -= duplicate_obj.dimensions.x
        update_status(f"  Original object moved to: {original_obj.location.x}")
        
    bpy.ops.bakelab.generate_mats()
    #bpy.app.timers.register(applyBakelabNormalMaterial, first_interval=5)
    bpy.ops.bakelab.finish()
    #bpy.ops.bakelab.removemapitem()
    #bpy.ops.bakelab.removemapitem()
    update_material()
    update_status("  Texture(s) baked with bakelab2")
    duplicate_obj.update_tag()
    
    # Export the model to FBX format
    original_obj.select_set(False) # I know deselecting all object would be nicer, but somehow it doesnt select the duplicate_obj anymore that way.
    #bpy.ops.object.select_all(action='DESELECT')
    # Check if the duplicate object is a parent and has mesh children
    if duplicate_obj.type == 'EMPTY' and duplicate_obj.children:
        # Loop through the children and select the mesh ones
        for child in duplicate_obj.children:
            if child.type == 'MESH':  # Check if the child is a mesh object
                # Select the mesh object
                child.select_set(True)
                print(f"Selected child mesh: {child.name}")
    else:
        # If there are no children or it's not a parent, just select the duplicate object itself
        duplicate_obj.select_set(True)
        #bpy.context.view_layer.objects.active = duplicate_obj
        print(f"Selected object: {duplicate_obj.name}")
        
    #duplicate_obj.select_set(True)
    #bpy.context.view_layer.objects.active = duplicate_obj

    # If you made changes to materials, you might want to make sure they are updated:
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH':
            # Update all material slots for the object
            obj.data.materials.update()
    
    bpy.ops.object.shade_auto_smooth()

    # Prepare export paths
    output_path = filepath.replace('.glb', '.fbx')
    output_folder = os.path.dirname(output_path)
    texture_dir = os.path.join(output_folder, "textures")
    os.makedirs(texture_dir, exist_ok=True)

    update_status("Prepared export paths")
    
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
                            #update_status("save_render")
                            img.save(filepath=texture_path)
                            print(f"Saved texture manually to: {texture_path}")
                        break
                if not has_texture:
                    print(f"Material '{mat.name}' has no Base Color texture connected.")

    update_status("export fbx")
    # Set the scene to export only selected objects (disable other settings as necessary)
    bpy.ops.export_scene.fbx(
        filepath=output_path,
        use_selection=True,
        apply_scale_options='FBX_SCALE_ALL',
        axis_forward='-Z',
        axis_up='Y',
        use_mesh_modifiers=True,
        apply_unit_scale=True,
    )
    update_status("export done. mat: "+mat.name)
    show_message_and_quit()
    
# Ensure we are in Object mode
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

# Get arguments after '--'
args = sys.argv[sys.argv.index('--') + 1:]

# Get arguments using key-value pairs
filepath = get_arg_value(args, "filepath", "", str)
quad_count = get_arg_value(args, "quad_count", 2500, int)
adaptive_size = get_arg_value(args, "adaptive_size", 50, int)
adapt_quad_count = get_arg_value(args, "adapt_quad_count", True, bool)
symmetry_x = get_arg_value(args, "symmetry_x", False, bool)
symmetry_y = get_arg_value(args, "symmetry_y", False, bool)
symmetry_z = get_arg_value(args, "symmetry_z", False, bool)

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

# Merge Vertices (on original object)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0001)
bpy.ops.object.mode_set(mode='OBJECT')

# Duplicate object for remeshing
original_obj = bpy.context.active_object
original_name = bpy.context.active_object.name

# Duplicate the object and set it as the active object
bpy.ops.object.duplicate()
duplicate_obj = bpy.context.active_object
duplicate_obj.name = original_name + "_QuadRemesh"

# Apply transforms
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# Select only the duplicate object
bpy.ops.object.select_all(action='DESELECT')
duplicate_obj.select_set(True)
bpy.context.view_layer.objects.active = duplicate_obj

# Confirm that the duplicate object was created successfully
print(f"Duplicate Object: {duplicate_obj.name}")

# Call delayed operations using timers
bpy.app.timers.register(delayed_operations, first_interval=5.0)

# Quad Remesher (3rd Party)
apply_quad_remesher()

# Switch to material view
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces[0].shading.type = 'MATERIAL'
        break
