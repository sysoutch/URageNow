import bpy
import sys
import addon_utils

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

addon_module_name = get_arg_value(args, "addon_module_name", "", str)
is_installed, is_enabled = addon_utils.check(addon_module_name)
print(f"[check_addon.py] name={addon_module_name} installed={is_installed} enabled={is_enabled}")