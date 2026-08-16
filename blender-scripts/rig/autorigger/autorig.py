# Compatibility shim for existing launch command:
# blender --background --python /path/to/autorig.py -- <AutoRig args>

import os
import sys

# Blender's --python execution does not always put the script directory on
# sys.path. Keep this file self-contained so existing callers only need to
# point at autorig.py, with the sibling autorig_addon/ folder beside it.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR and SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from autorig_addon.pipeline import autorig


if __name__ == "__main__":
    autorig()
