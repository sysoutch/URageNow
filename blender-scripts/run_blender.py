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

# Ensure we are in Object mode
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

# Get arguments after '--'
args = sys.argv[sys.argv.index('--') + 1:]

# Get arguments using key-value pairs
clear_all_objects = get_arg_value(args, "clear_all_objects", False, bool)

# Clear all existing objects
if clear_all_objects:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

# Switch to material view
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces[0].shading.type = 'MATERIAL'
        break