"""Remesh a model into a clean, lighter mesh that keeps its look.

Pipeline: import -> join meshes -> duplicate -> remesh the duplicate -> UV unwrap ->
bake the original's base color (and optionally normals) onto it -> export only the
remeshed object.

Methods:
  quadriflow   Blender's built-in quad remesher. Runs headless (--background).
  voxel        Blender's built-in voxel remesher. Runs headless; robust on broken meshes.
  quadremesher Exoside Quad Remesher add-on. Its engine runs asynchronously and reports
               back through Blender's event loop, so Blender must run WITH a window
               (no --background). This script then polls for the result and quits.

Usage:
  blender [--background] --python remesh_model.py --python-exit-code 1 -- \
    --filepath=in.glb --output_path=out.glb --method=quadriflow --target_faces=5000

The script prints "Exported model to: <path>" and "REMESH_RESULT faces=<n>" on success,
and "REMESH_ERROR <message>" on failure (and exits with code 1).
"""

import math
import os
import sys
import traceback

import bpy

# --- Tunables -------------------------------------------------------------------------

DEFAULT_TARGET_FACES = 5000
MIN_TARGET_FACES = 100
MAX_TARGET_FACES = 200000
DEFAULT_TEXTURE_SIZE = 2048
ALLOWED_TEXTURE_SIZES = (512, 1024, 2048, 4096)
MERGE_DISTANCE = 0.0001
# QuadriFlow needs a manifold input. Generated models rarely are, so when the first
# attempt fails we voxel-remesh at this many times the target density, then retry.
QUADRIFLOW_VOXEL_PREPASS_DENSITY = 4.0
# Bake rays start this fraction of the bounding-box diagonal outside the low mesh.
BAKE_CAGE_EXTRUSION_RATIO = 0.01
BAKE_MAX_RAY_DISTANCE_RATIO = 0.05
BAKE_MARGIN_PX = 8
SMART_UV_ANGLE_LIMIT_RADIANS = math.radians(66.0)
SMART_UV_ISLAND_MARGIN = 0.003
# Quad Remesher polling: how often to look for its "Retopo_*" result, and when to give up.
QUADREMESHER_POLL_SECONDS = 1.0
QUADREMESHER_TIMEOUT_SECONDS = 15 * 60
QUAD_REMESHER_RESULT_PREFIX = "Retopo_"
SOURCE_OBJECT_NAME = "RemeshSource"
TARGET_OBJECT_NAME = "Remeshed"


# --- Arguments ------------------------------------------------------------------------

def get_arg_value(args, key, default_value):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default_value


def parse_bool(value, default=False):
    normalized = str(value).strip().lower()
    if normalized in ("1", "true", "yes", "on"):
        return True
    if normalized in ("0", "false", "no", "off"):
        return False
    return default


def parse_int(value, default, minimum, maximum):
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def read_options():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments after '--'.")
    args = sys.argv[sys.argv.index("--") + 1:]
    method = get_arg_value(args, "method", "quadriflow").strip().lower()
    if method not in ("quadriflow", "voxel", "quadremesher"):
        raise RuntimeError(f"Unknown remesh method: {method}")
    texture_size = parse_int(get_arg_value(args, "texture_size", DEFAULT_TEXTURE_SIZE), DEFAULT_TEXTURE_SIZE, 256, 8192)
    if texture_size not in ALLOWED_TEXTURE_SIZES:
        texture_size = DEFAULT_TEXTURE_SIZE
    options = {
        "filepath": get_arg_value(args, "filepath", "").strip(),
        "output_path": get_arg_value(args, "output_path", "").strip(),
        "method": method,
        "target_faces": parse_int(get_arg_value(args, "target_faces", DEFAULT_TARGET_FACES), DEFAULT_TARGET_FACES, MIN_TARGET_FACES, MAX_TARGET_FACES),
        "bake_textures": parse_bool(get_arg_value(args, "bake_textures", "true"), True),
        "bake_normal": parse_bool(get_arg_value(args, "bake_normal", "true"), True),
        "texture_size": texture_size,
        "preserve_sharp": parse_bool(get_arg_value(args, "preserve_sharp", "true"), True),
        "symmetry_x": parse_bool(get_arg_value(args, "symmetry_x", "false"), False),
        "adaptive_size": parse_int(get_arg_value(args, "adaptive_size", 50), 50, 0, 100),
        # Off by default so the face budget is respected; on lets detailed areas take more quads.
        "adapt_quad_count": parse_bool(get_arg_value(args, "adapt_quad_count", "false"), False),
    }
    if not options["filepath"]:
        raise RuntimeError("--filepath is required.")
    if not options["output_path"]:
        raise RuntimeError("--output_path is required.")
    return options


# --- Scene helpers --------------------------------------------------------------------

def log(message):
    print(f"[remesh] {message}", flush=True)


def ensure_object_mode():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def set_only_active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def clear_scene():
    ensure_object_mode()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_model(filepath):
    lower = filepath.lower()
    if lower.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=filepath, use_custom_normals=True, use_image_search=True)
    elif lower.endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=filepath)
    elif lower.endswith((".glb", ".gltf")):
        bpy.ops.import_scene.gltf(filepath=filepath)
    else:
        raise RuntimeError(f"Unsupported input format for remesh: {filepath}")


def build_source_object():
    """Join every imported mesh into one object with transforms applied."""
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh objects found after import.")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    # Unparent so transform_apply bakes the hierarchy's world transform into the mesh.
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    source = bpy.context.view_layer.objects.active
    source.name = SOURCE_OBJECT_NAME
    # Drop the now-empty import hierarchy (glTF roots, armature-less empties).
    for obj in list(bpy.context.scene.objects):
        if obj is not source and obj.type == "EMPTY":
            bpy.data.objects.remove(obj, do_unlink=True)
    set_only_active(source)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=MERGE_DISTANCE)
    bpy.ops.object.mode_set(mode="OBJECT")
    return source


def duplicate_as_target(source):
    set_only_active(source)
    bpy.ops.object.duplicate()
    target = bpy.context.view_layer.objects.active
    target.name = TARGET_OBJECT_NAME
    target.data.materials.clear()
    return target


def surface_area(obj):
    return sum(polygon.area for polygon in obj.data.polygons)


def bounding_diagonal(obj):
    dims = obj.dimensions
    return max(1e-6, math.sqrt(dims.x ** 2 + dims.y ** 2 + dims.z ** 2))


# --- Remesh methods -------------------------------------------------------------------

def voxel_remesh(obj, target_faces):
    # A voxel remesh produces roughly one quad per voxel-sized patch of surface.
    voxel_size = max(1e-5, math.sqrt(surface_area(obj) / max(1, target_faces)))
    obj.data.remesh_voxel_size = voxel_size
    obj.data.use_remesh_preserve_volume = True
    set_only_active(obj)
    bpy.ops.object.voxel_remesh()
    log(f"Voxel remesh (voxel size {voxel_size:.5f}) -> {len(obj.data.polygons)} faces")


def quadriflow_remesh(obj, target_faces, preserve_sharp, symmetry_x):
    set_only_active(obj)
    before = len(obj.data.polygons)
    result = bpy.ops.object.quadriflow_remesh(
        mode="FACES",
        target_faces=target_faces,
        use_mesh_symmetry=symmetry_x,
        use_preserve_sharp=preserve_sharp,
        use_preserve_boundary=False,
        smooth_normals=True,
        seed=0,
    )
    return "FINISHED" in result and len(obj.data.polygons) != before


def remesh_with_quadriflow(obj, target_faces, preserve_sharp, symmetry_x):
    try:
        if quadriflow_remesh(obj, target_faces, preserve_sharp, symmetry_x):
            log(f"QuadriFlow -> {len(obj.data.polygons)} faces")
            return
    except RuntimeError as error:
        log(f"QuadriFlow failed on the raw mesh ({error}); retrying after a voxel pre-pass.")
    # Non-manifold input: make it watertight first, then quad it.
    voxel_remesh(obj, int(target_faces * QUADRIFLOW_VOXEL_PREPASS_DENSITY))
    make_manifold(obj)
    try:
        if quadriflow_remesh(obj, target_faces, preserve_sharp, symmetry_x):
            log(f"QuadriFlow (after voxel pre-pass) -> {len(obj.data.polygons)} faces")
            return
    except RuntimeError as error:
        log(f"QuadriFlow still failed after the voxel pre-pass ({error}).")
    # Last resort: keep the watertight voxel mesh and decimate it to the budget,
    # so the user still gets a usable, lighter mesh instead of an error.
    decimate_to_faces(obj, target_faces)
    log(f"Fell back to voxel + decimate -> {len(obj.data.polygons)} faces")


def make_manifold(obj):
    """Clean the voxel result: merge, drop stray bits, fill holes, consistent normals."""
    set_only_active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=MERGE_DISTANCE)
    bpy.ops.mesh.delete_loose()
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.fill_holes(sides=0)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def decimate_to_faces(obj, target_faces):
    current = len(obj.data.polygons)
    if current <= target_faces:
        return
    modifier = obj.modifiers.new(name="RemeshDecimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = max(0.001, target_faces / current)
    set_only_active(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def start_quad_remesher(obj, options):
    if not hasattr(bpy.context.scene, "qremesher"):
        raise RuntimeError("The Quad Remesher add-on is not installed or not enabled in this Blender.")
    settings = bpy.context.scene.qremesher
    settings.target_count = options["target_faces"]
    settings.adaptive_size = options["adaptive_size"]
    settings.adapt_quad_count = options["adapt_quad_count"]
    settings.symmetry_x = options["symmetry_x"]
    settings.symmetry_y = False
    settings.symmetry_z = False
    set_only_active(obj)
    bpy.ops.qremesher.remesh()
    log("Quad Remesher started; waiting for its result...")


def find_quad_remesher_result(target):
    expected = QUAD_REMESHER_RESULT_PREFIX + target.name
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.name.startswith(expected):
            return obj
    return None


# --- UV + bake ------------------------------------------------------------------------

def smart_uv_unwrap(obj):
    set_only_active(obj)
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=SMART_UV_ANGLE_LIMIT_RADIANS, island_margin=SMART_UV_ISLAND_MARGIN, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def create_bake_material(target, texture_size, bake_normal):
    material = bpy.data.materials.new(name="RemeshedMaterial")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.8

    color_image = bpy.data.images.new("remesh_basecolor", texture_size, texture_size, alpha=False)
    color_node = nodes.new("ShaderNodeTexImage")
    color_node.image = color_image
    color_node.location = (-500, 250)

    normal_node = None
    if bake_normal:
        normal_image = bpy.data.images.new("remesh_normal", texture_size, texture_size, alpha=False, float_buffer=False)
        normal_image.colorspace_settings.name = "Non-Color"
        normal_node = nodes.new("ShaderNodeTexImage")
        normal_node.image = normal_image
        normal_node.location = (-500, -150)
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.location = (-200, -150)

    target.data.materials.clear()
    target.data.materials.append(material)
    return material, color_node, normal_node


def link_baked_textures(material, color_node, normal_node):
    """Wire the baked images in only after baking, so no bake reads its own output."""
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    links.new(color_node.outputs["Color"], principled.inputs["Base Color"])
    if normal_node:
        normal_map = next(node for node in nodes if node.type == "NORMAL_MAP")
        links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])


def bake_pass(source, target, material, image_node, bake_type, diagonal):
    material.node_tree.nodes.active = image_node
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bake_kwargs = {
        "type": bake_type,
        "use_selected_to_active": True,
        "cage_extrusion": diagonal * BAKE_CAGE_EXTRUSION_RATIO,
        "max_ray_distance": diagonal * BAKE_MAX_RAY_DISTANCE_RATIO,
        "margin": BAKE_MARGIN_PX,
    }
    if bake_type == "DIFFUSE":
        # Only the surface color, no lighting: the result stays usable under any light.
        bake_kwargs["pass_filter"] = {"COLOR"}
    bpy.ops.object.bake(**bake_kwargs)


def save_and_pack(image, directory, stem):
    os.makedirs(directory, exist_ok=True)
    image_path = os.path.join(directory, f"{stem}.png")
    image.filepath_raw = image_path
    image.file_format = "PNG"
    image.save()
    image.pack()
    try:
        os.remove(image_path)
    except OSError:
        pass


def neutralize_source_metallic(source):
    """The diffuse bake returns base color * (1 - metallic); a metallic source bakes black.

    Only the throwaway source copy is touched, never the user's file.
    """
    for slot in source.material_slots:
        material = slot.material
        if not material or not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            for input_name in ("Metallic", "Transmission Weight", "Transmission"):
                socket = node.inputs.get(input_name)
                if socket is None:
                    continue
                for link in list(socket.links):
                    material.node_tree.links.remove(link)
                socket.default_value = 0.0


def bake_original_look(source, target, options):
    neutralize_source_metallic(source)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    # Color and normal passes are deterministic; one sample is enough and keeps it fast.
    scene.cycles.samples = 1
    material, color_node, normal_node = create_bake_material(target, options["texture_size"], options["bake_normal"])
    diagonal = bounding_diagonal(source)
    log("Baking base color...")
    bake_pass(source, target, material, color_node, "DIFFUSE", diagonal)
    if normal_node:
        log("Baking normal map...")
        bake_pass(source, target, material, normal_node, "NORMAL", diagonal)
    link_baked_textures(material, color_node, normal_node)
    stem = os.path.splitext(os.path.basename(options["output_path"]))[0]
    texture_dir = os.path.dirname(options["output_path"])
    save_and_pack(color_node.image, texture_dir, f"{stem}_basecolor")
    if normal_node:
        save_and_pack(normal_node.image, texture_dir, f"{stem}_normal")


# --- Finish ---------------------------------------------------------------------------

def finalize_and_export(source, target, options):
    ensure_object_mode()
    set_only_active(target)
    bpy.ops.object.shade_smooth()
    smart_uv_unwrap(target)
    if options["bake_textures"]:
        bake_original_look(source, target, options)
    bpy.data.objects.remove(source, do_unlink=True)
    for obj in list(bpy.context.scene.objects):
        if obj is not target:
            bpy.data.objects.remove(obj, do_unlink=True)
    target.data.name = TARGET_OBJECT_NAME
    export_model(target, options["output_path"])
    print(f"Exported model to: {options['output_path']}", flush=True)
    print(f"REMESH_RESULT faces={len(target.data.polygons)} method={options['method']}", flush=True)


def export_model(obj, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    set_only_active(obj)
    lower = output_path.lower()
    if lower.endswith(".fbx"):
        bpy.ops.export_scene.fbx(filepath=output_path, use_selection=True, path_mode="COPY", embed_textures=True,
                                 apply_scale_options="FBX_SCALE_ALL", axis_forward="-Z", axis_up="Y")
        return
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        use_selection=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_apply=True,
    )


def fail(error):
    traceback.print_exc()
    print(f"REMESH_ERROR {error}", flush=True)
    sys.stdout.flush()
    # A plain exception would leave a windowed Blender open and exit 0; force a failure code.
    os._exit(1)


def run_quad_remesher_async(source, target, options):
    """Quad Remesher reports back through Blender's event loop, so poll with a timer."""
    state = {"elapsed": 0.0}

    def poll():
        try:
            result = find_quad_remesher_result(target)
            if result is None:
                state["elapsed"] += QUADREMESHER_POLL_SECONDS
                if state["elapsed"] > QUADREMESHER_TIMEOUT_SECONDS:
                    raise RuntimeError("Quad Remesher did not finish in time.")
                return QUADREMESHER_POLL_SECONDS
            bpy.data.objects.remove(target, do_unlink=True)
            result.name = TARGET_OBJECT_NAME
            result.data.materials.clear()
            log(f"Quad Remesher -> {len(result.data.polygons)} faces")
            finalize_and_export(source, result, options)
            sys.stdout.flush()
            os._exit(0)
        except Exception as error:  # noqa: BLE001 - every failure must end the process
            fail(error)
        return None

    start_quad_remesher(target, options)
    bpy.app.timers.register(poll, first_interval=QUADREMESHER_POLL_SECONDS)


def main():
    try:
        options = read_options()
        if options["method"] == "quadremesher" and bpy.app.background:
            raise RuntimeError("Quad Remesher needs Blender with a window; run without --background.")
        log(f"Method={options['method']} target_faces={options['target_faces']} bake={options['bake_textures']}")
        clear_scene()
        import_model(options["filepath"])
        source = build_source_object()
        log(f"Source mesh: {len(source.data.polygons)} faces")
        target = duplicate_as_target(source)
        if options["method"] == "quadremesher":
            run_quad_remesher_async(source, target, options)
            return
        if options["method"] == "voxel":
            voxel_remesh(target, options["target_faces"])
        else:
            remesh_with_quadriflow(target, options["target_faces"], options["preserve_sharp"], options["symmetry_x"])
        finalize_and_export(source, target, options)
    except Exception as error:  # noqa: BLE001
        fail(error)


if __name__ == "__main__":
    main()
