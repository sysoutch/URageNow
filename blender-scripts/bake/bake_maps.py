"""Bake texture maps from a source mesh onto a target mesh, with two engines.

engine="builtin"  Blender's own Cycles baker. Synchronous, runs headless (--background).
engine="bakelab"  The BakeLab2 add-on. Its bake is a modal operator driven by window
                  timers, so Blender must run WITH a window; this module polls it.

Both bake "selected to active": rays go from the target's surface to the source.
For a self-bake (flatten a model's materials into one texture set) the target is
simply a duplicate of the source.

Maps: albedo, normal, roughness, metallic, ao, emission.
  BakeLab has no metallic pass, so metallic is skipped there (logged).

Used two ways:
  * imported by remesh/remesh_model.py (`bake(...)`), and
  * as the 3D Studio "Bake" quick action:
      blender [--background] --python bake_maps.py --python-exit-code 1 -- \
        --filepath=target.glb [--source_path=high.glb] --output_path=out.glb \
        --engine=builtin --maps=albedo,normal,roughness --texture_size=2048
    Prints "Exported model to: <path>" and "BAKE_RESULT maps=<list>", or
    "BAKE_ERROR <message>" (exit code 1).
"""

import importlib.util
import math
import os
import sys
import traceback

import bpy

# --- Tunables -------------------------------------------------------------------------

ALL_MAPS = ("albedo", "normal", "roughness", "metallic", "ao", "emission")
DEFAULT_MAPS = ("albedo", "normal")
ALLOWED_TEXTURE_SIZES = (512, 1024, 2048, 4096)
DEFAULT_TEXTURE_SIZE = 2048
# Rays start this fraction of the bounding-box diagonal outside the target surface.
CAGE_EXTRUSION_RATIO = 0.01
MAX_RAY_DISTANCE_RATIO = 0.05
BAKE_MARGIN_PX = 8
# One sample is exact for color/normal/value passes; AO needs real sampling.
FAST_PASS_SAMPLES = 1
AO_SAMPLES = 64
SMART_UV_ANGLE_LIMIT_RADIANS = math.radians(66.0)
SMART_UV_ISLAND_MARGIN = 0.006  # matches the original QuadRemesh + BakeLab workflow
MERGE_DISTANCE = 0.0001
BAKELAB_POLL_SECONDS = 0.5
BAKELAB_TIMEOUT_SECONDS = 30 * 60
BAKELAB_PACKAGE_NAME = "urage_bakelab"
# Used when --bakelab_path / URAGE_BAKELAB_PATH are not given.
DEFAULT_BAKELAB_PATH = r"C:\Files\github\URage-suite\URage Addons\blender\Blender-BakeLab2"

BAKELAB_MAP_TYPES = {
    "albedo": "Albedo",
    "normal": "Normal",
    "roughness": "Roughness",
    "ao": "AO",
    "emission": "Emission",
}
BAKELAB_TYPE_TO_MAP = {lab_type: name for name, lab_type in BAKELAB_MAP_TYPES.items()}
NON_COLOR_MAPS = {"normal", "roughness", "metallic", "ao"}


def log(message):
    print(f"[bake] {message}", flush=True)


# --- Shared scene helpers -------------------------------------------------------------

def ensure_object_mode():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def set_only_active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bounding_diagonal(obj):
    dims = obj.dimensions
    return max(1e-6, math.sqrt(dims.x ** 2 + dims.y ** 2 + dims.z ** 2))


def smart_uv_unwrap(obj):
    set_only_active(obj)
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=SMART_UV_ANGLE_LIMIT_RADIANS, island_margin=SMART_UV_ISLAND_MARGIN, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def normalize_maps(maps):
    requested = [name.strip().lower() for name in maps if name and name.strip()]
    selected = [name for name in ALL_MAPS if name in requested]
    return selected or list(DEFAULT_MAPS)


def principled_nodes(obj):
    for slot in obj.material_slots:
        material = slot.material
        if not material or not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                yield material, node


def zero_socket(material, node, socket_names):
    for name in socket_names:
        socket = node.inputs.get(name)
        if socket is None:
            continue
        for link in list(socket.links):
            material.node_tree.links.remove(link)
        socket.default_value = 0.0


def neutralize_source_metallic(source):
    """Diffuse color = base color * (1 - metallic): a metallic source bakes black.

    Call this only on a throwaway copy, never on data that gets exported.
    """
    for material, node in principled_nodes(source):
        zero_socket(material, node, ("Metallic", "Transmission Weight", "Transmission"))


# --- Built-in Cycles engine -----------------------------------------------------------

def _new_image(name, size, non_color):
    image = bpy.data.images.new(name, size, size, alpha=False)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    return image


def _bake_selected_to_active(source, target, bake_type, diagonal, pass_filter=None):
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    kwargs = {
        "type": bake_type,
        "use_selected_to_active": True,
        "cage_extrusion": diagonal * CAGE_EXTRUSION_RATIO,
        "max_ray_distance": diagonal * MAX_RAY_DISTANCE_RATIO,
        "margin": BAKE_MARGIN_PX,
    }
    if pass_filter:
        kwargs["pass_filter"] = pass_filter
    bpy.ops.object.bake(**kwargs)


def _route_socket_to_emission(source, socket_name):
    """Temporarily feed a Principled input into Emission so it can be baked as EMIT.

    Returns an undo list. Used for metallic, which Cycles cannot bake directly.
    """
    undo = []
    for material, node in principled_nodes(source):
        tree = material.node_tree
        value_socket = node.inputs.get(socket_name)
        color_socket = node.inputs.get("Emission Color") or node.inputs.get("Emission")
        strength_socket = node.inputs.get("Emission Strength")
        if value_socket is None or color_socket is None:
            continue
        saved = {
            "color_links": [(link.from_socket, link.to_socket) for link in color_socket.links],
            "color_value": tuple(color_socket.default_value),
            "strength": strength_socket.default_value if strength_socket else None,
        }
        for link in list(color_socket.links):
            tree.links.remove(link)
        if value_socket.links:
            tree.links.new(value_socket.links[0].from_socket, color_socket)
        else:
            value = float(value_socket.default_value)
            color_socket.default_value = (value, value, value, 1.0)
        if strength_socket:
            strength_socket.default_value = 1.0
        undo.append((tree, color_socket, strength_socket, saved))
    return undo


def _restore_emission(undo):
    for tree, color_socket, strength_socket, saved in undo:
        for link in list(color_socket.links):
            tree.links.remove(link)
        for from_socket, to_socket in saved["color_links"]:
            tree.links.new(from_socket, to_socket)
        color_socket.default_value = saved["color_value"]
        if strength_socket is not None and saved["strength"] is not None:
            strength_socket.default_value = saved["strength"]


def bake_builtin(source, target, maps, texture_size, image_prefix):
    """Bake synchronously with Cycles. Returns {map_name: image}."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    diagonal = bounding_diagonal(source)

    material = bpy.data.materials.new(name=f"{image_prefix}_baked")
    material.use_nodes = True
    target.data.materials.clear()
    target.data.materials.append(material)
    nodes = material.node_tree.nodes
    images = {}

    def bake_into(map_name, bake_type, pass_filter=None, samples=FAST_PASS_SAMPLES):
        image = _new_image(f"{image_prefix}_{map_name}", texture_size, map_name in NON_COLOR_MAPS)
        node = nodes.new("ShaderNodeTexImage")
        node.image = image
        nodes.active = node
        scene.cycles.samples = samples
        log(f"Baking {map_name} (built-in)...")
        _bake_selected_to_active(source, target, bake_type, diagonal, pass_filter)
        images[map_name] = image

    # Metallic first: it reads the real metallic values before they are zeroed for albedo.
    if "metallic" in maps:
        undo = _route_socket_to_emission(source, "Metallic")
        try:
            bake_into("metallic", "EMIT")
        finally:
            _restore_emission(undo)
    if "albedo" in maps:
        neutralize_source_metallic(source)
        bake_into("albedo", "DIFFUSE", pass_filter={"COLOR"})
    if "normal" in maps:
        bake_into("normal", "NORMAL")
    if "roughness" in maps:
        bake_into("roughness", "ROUGHNESS")
    if "ao" in maps:
        bake_into("ao", "AO", samples=AO_SAMPLES)
    if "emission" in maps:
        bake_into("emission", "EMIT")

    build_pbr_material(material, images)
    return images


def multiply_into(color_image, ao_image):
    """color *= ao, per pixel (both images are the same size)."""
    import numpy as np
    if tuple(color_image.size) != tuple(ao_image.size):
        log("AO and albedo sizes differ; AO not applied.")
        return
    count = color_image.size[0] * color_image.size[1] * 4
    color = np.empty(count, dtype=np.float32)
    ao = np.empty(count, dtype=np.float32)
    color_image.pixels.foreach_get(color)
    ao_image.pixels.foreach_get(ao)
    color = color.reshape(-1, 4)
    color[:, :3] *= ao.reshape(-1, 4)[:, :1]
    color_image.pixels.foreach_set(color.ravel())
    color_image.update()
    if color_image.packed_file is not None:
        # Exporters read the packed bytes, so re-pack the edited pixels.
        color_image.pack()


def assign_baked_material(target, images, material_name):
    """Give the target exactly one material built from the baked images."""
    material = bpy.data.materials.new(name=material_name)
    material.use_nodes = True
    for image in images.values():
        node = material.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
    target.data.materials.clear()
    target.data.materials.append(material)
    for polygon in target.data.polygons:
        polygon.material_index = 0
    build_pbr_material(material, images)
    return material


def build_pbr_material(material, images):
    """Wire baked images into a clean Principled material (after all bakes are done)."""
    tree = material.node_tree
    nodes = tree.nodes
    links = tree.links
    principled = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.8
    image_nodes = {node.image.name: node for node in nodes if node.type == "TEX_IMAGE" and node.image}

    def node_for(map_name):
        return image_nodes.get(images[map_name].name) if map_name in images else None

    albedo = node_for("albedo")
    if albedo and "ao" in images:
        # Exporters cannot follow a multiply node, so AO goes into the albedo pixels.
        multiply_into(images["albedo"], images["ao"])
    if albedo:
        links.new(albedo.outputs["Color"], principled.inputs["Base Color"])
    for map_name, socket_name in (("roughness", "Roughness"), ("metallic", "Metallic")):
        node = node_for(map_name)
        if node:
            links.new(node.outputs["Color"], principled.inputs[socket_name])
    emission = node_for("emission")
    if emission:
        emission_socket = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
        links.new(emission.outputs["Color"], emission_socket)
        strength = principled.inputs.get("Emission Strength")
        if strength:
            strength.default_value = 1.0
    normal = node_for("normal")
    if normal:
        normal_map = nodes.new("ShaderNodeNormalMap")
        links.new(normal.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])


# --- BakeLab engine -------------------------------------------------------------------

def _loaded_bakelab_module():
    return sys.modules.get(BAKELAB_PACKAGE_NAME)


def ensure_bakelab(bakelab_path):
    """Load BakeLab2 from the given source folder for this Blender session.

    An installed copy is disabled for this session only (preferences are not saved),
    because older installed versions crash when driven from a script
    (`context.area` is None outside the UI).
    """
    if _loaded_bakelab_module() is not None:
        return
    path = bakelab_path or os.environ.get("URAGE_BAKELAB_PATH") or DEFAULT_BAKELAB_PATH
    init_file = os.path.join(path, "__init__.py")
    if not os.path.isfile(init_file):
        raise RuntimeError(f"BakeLab2 add-on was not found at: {path}")
    import addon_utils
    bpy.context.preferences.use_preferences_save = False
    for module in addon_utils.modules():
        if module.bl_info.get("name") == "BakeLab" and addon_utils.check(module.__name__)[1]:
            addon_utils.disable(module.__name__, default_set=False)
            log(f"Disabled installed BakeLab ({module.__name__}) for this session.")
    spec = importlib.util.spec_from_file_location(BAKELAB_PACKAGE_NAME, init_file, submodule_search_locations=[path])
    module = importlib.util.module_from_spec(spec)
    sys.modules[BAKELAB_PACKAGE_NAME] = module
    spec.loader.exec_module(module)
    module.register()
    log(f"Loaded BakeLab from {path}")


def _window_override():
    window = bpy.context.window_manager.windows[0]
    area = next((item for item in window.screen.areas if item.type == "VIEW_3D"), window.screen.areas[0])
    region = next((item for item in area.regions if item.type == "WINDOW"), None)
    return {"window": window, "screen": window.screen, "area": area, "region": region}


def bake_bakelab_async(source, target, maps, texture_size, bakelab_path, on_done, on_error):
    """Start a BakeLab bake and call on_done(images) when it finishes.

    Requires Blender with a window. Errors are passed to on_error(exception).
    """
    if bpy.app.background:
        raise RuntimeError("BakeLab needs Blender with a window; run without --background.")
    ensure_bakelab(bakelab_path)
    scene = bpy.context.scene
    props = scene.BakeLabProps
    skipped = [name for name in maps if name not in BAKELAB_MAP_TYPES]
    if skipped:
        log(f"BakeLab cannot bake {', '.join(skipped)}; skipped.")
    lab_maps = [name for name in maps if name in BAKELAB_MAP_TYPES]
    if not lab_maps:
        raise RuntimeError("None of the requested maps can be baked with BakeLab.")
    if "albedo" in lab_maps:
        neutralize_source_metallic(source)

    # BakeLab bakes into the target's material slots, so the target needs one.
    target.data.materials.clear()
    target.data.materials.append(bpy.data.materials.new(name="BakeLabPlaceholder"))

    with bpy.context.temp_override(**_window_override()):
        while len(scene.BakeLabMaps) > 0:
            bpy.ops.bakelab.removemapitem()
        for name in lab_maps:
            bpy.ops.bakelab.newmapitem(type=BAKELAB_MAP_TYPES[name], width=texture_size, height=texture_size)
    props.bake_mode = "TO_ACTIVE"
    props.cage_extrusion = bounding_diagonal(source) * CAGE_EXTRUSION_RATIO
    props.bake_margin = BAKE_MARGIN_PX
    props.anti_alias = 1
    props.compute_device = "CPU"
    props.save_or_pack = "PACK"
    for item in scene.BakeLabMaps:
        if hasattr(item, "samples"):
            item.samples = AO_SAMPLES if item.type == "AO" else FAST_PASS_SAMPLES

    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    with bpy.context.temp_override(**_window_override()):
        result = bpy.ops.bakelab.bake()
    if "RUNNING_MODAL" not in result:
        raise RuntimeError(f"BakeLab did not start ({result}).")
    log(f"BakeLab baking {', '.join(lab_maps)}...")
    state = {"elapsed": 0.0, "started": False}

    def poll():
        try:
            bake_state = scene.BakeLabProps.bake_state
            if bake_state == "BAKING":
                state["started"] = True
            if bake_state != "BAKED":
                state["elapsed"] += BAKELAB_POLL_SECONDS
                if state["started"] and bake_state == "NONE":
                    raise RuntimeError("BakeLab cancelled the bake (see its messages above).")
                if state["elapsed"] > BAKELAB_TIMEOUT_SECONDS:
                    raise RuntimeError("BakeLab did not finish in time.")
                return BAKELAB_POLL_SECONDS
            # Read the images from BakeLab's bake record instead of using its
            # "Generate Materials": that skips AO and BakeLab restores the target's
            # old material slots, so a source material would leak into the export.
            images = {}
            for data in scene.BakeLab_Data:
                for map_data in data.map_list:
                    key = BAKELAB_TYPE_TO_MAP.get(map_data.bake_map.type)
                    if key and map_data.image:
                        images[key] = map_data.image
            with bpy.context.temp_override(**_window_override()):
                bpy.ops.bakelab.finish()
            if not images:
                raise RuntimeError("BakeLab finished without any baked image.")
            assign_baked_material(target, images, f"{target.name}_baked")
            log(f"BakeLab finished: {', '.join(sorted(images))}.")
            on_done(images)
        except Exception as error:  # noqa: BLE001 - every failure must reach the caller
            on_error(error)
        return None

    bpy.app.timers.register(poll, first_interval=BAKELAB_POLL_SECONDS)


# --- Public entry point ---------------------------------------------------------------

def bake(source, target, options, on_done, on_error):
    """Bake `source` onto `target` and call on_done(images).

    options: engine ("builtin" | "bakelab"), maps, texture_size, image_prefix, bakelab_path.
    Built-in calls on_done before returning; BakeLab calls it later from a timer.
    """
    ensure_object_mode()
    maps = normalize_maps(options.get("maps") or DEFAULT_MAPS)
    texture_size = options.get("texture_size") or DEFAULT_TEXTURE_SIZE
    if options.get("engine") == "bakelab":
        bake_bakelab_async(source, target, maps, texture_size, options.get("bakelab_path"), on_done, on_error)
        return
    try:
        images = bake_builtin(source, target, maps, texture_size, options.get("image_prefix") or "baked")
    except Exception as error:  # noqa: BLE001
        on_error(error)
        return
    on_done(images)


def pack_images(images, directory, stem):
    """Save each baked image as PNG, pack it into the .blend data, then drop the file.

    Packing lets the glTF exporter embed the images in the GLB.
    """
    os.makedirs(directory, exist_ok=True)
    for key, image in images.items():
        if image.packed_file is not None:
            continue
        image_path = os.path.join(directory, f"{stem}_{key}.png")
        image.filepath_raw = image_path
        image.file_format = "PNG"
        image.save()
        image.pack()
        try:
            os.remove(image_path)
        except OSError:
            pass


# --- Standalone "Bake" quick action ---------------------------------------------------

def _get_arg(args, key, default):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default


def _parse_bool(value, default):
    normalized = str(value).strip().lower()
    if normalized in ("1", "true", "yes", "on"):
        return True
    if normalized in ("0", "false", "no", "off"):
        return False
    return default


def _import_meshes(filepath):
    """Import a file and return its meshes joined into one object with transforms applied."""
    before = set(bpy.context.scene.objects)
    lower = filepath.lower()
    if lower.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=filepath, use_custom_normals=True, use_image_search=True)
    elif lower.endswith(".obj"):
        bpy.ops.wm.obj_import(filepath=filepath)
    elif lower.endswith((".glb", ".gltf")):
        bpy.ops.import_scene.gltf(filepath=filepath)
    else:
        raise RuntimeError(f"Unsupported model format: {filepath}")
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh found in {filepath}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    for obj in imported:
        if obj.name in bpy.data.objects and obj is not joined and obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    return joined


def _export_glb(obj, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    set_only_active(obj)
    bpy.ops.export_scene.gltf(filepath=output_path, export_format="GLB", use_selection=True,
                              export_texcoords=True, export_normals=True, export_materials="EXPORT", export_apply=True)


def _fail(error):
    traceback.print_exc()
    print(f"BAKE_ERROR {error}", flush=True)
    os._exit(1)


def main():
    try:
        if "--" not in sys.argv:
            raise RuntimeError("Missing Blender script arguments after '--'.")
        args = sys.argv[sys.argv.index("--") + 1:]
        filepath = _get_arg(args, "filepath", "").strip()
        source_path = _get_arg(args, "source_path", "").strip()
        output_path = _get_arg(args, "output_path", "").strip()
        if not filepath or not output_path:
            raise RuntimeError("--filepath and --output_path are required.")
        engine = _get_arg(args, "engine", "builtin").strip().lower()
        if engine not in ("builtin", "bakelab"):
            raise RuntimeError(f"Unknown bake engine: {engine}")
        try:
            texture_size = int(_get_arg(args, "texture_size", DEFAULT_TEXTURE_SIZE))
        except ValueError:
            texture_size = DEFAULT_TEXTURE_SIZE
        if texture_size not in ALLOWED_TEXTURE_SIZES:
            texture_size = DEFAULT_TEXTURE_SIZE
        maps = normalize_maps(_get_arg(args, "maps", ",".join(DEFAULT_MAPS)).split(","))
        new_uvs = _parse_bool(_get_arg(args, "new_uvs", "auto"), None)

        ensure_object_mode()
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete(use_global=False)
        target = _import_meshes(filepath)
        target.name = "BakeTarget"
        if source_path:
            source = _import_meshes(source_path)
        else:
            # Self-bake: flatten the model's own materials onto a copy of itself.
            set_only_active(target)
            bpy.ops.object.duplicate()
            source = bpy.context.view_layer.objects.active
        source.name = "BakeSource"
        set_only_active(target)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=MERGE_DISTANCE)
        bpy.ops.object.mode_set(mode="OBJECT")
        # Generated models often have overlapping or missing UVs; a fresh unwrap is the
        # safe default. Keep the existing ones only when asked and they exist.
        if new_uvs is not False or not target.data.uv_layers:
            smart_uv_unwrap(target)
        log(f"engine={engine} maps={','.join(maps)} size={texture_size} source={'separate' if source_path else 'self'}")
        stem = os.path.splitext(os.path.basename(output_path))[0]

        def finish(images):
            try:
                pack_images(images, os.path.dirname(output_path), stem)
                bpy.data.objects.remove(source, do_unlink=True)
                target.name = stem
                _export_glb(target, output_path)
                print(f"Exported model to: {output_path}", flush=True)
                print(f"BAKE_RESULT maps={','.join(maps)} engine={engine}", flush=True)
                sys.stdout.flush()
            except Exception as error:  # noqa: BLE001
                _fail(error)
            if not bpy.app.background:
                os._exit(0)

        bake(source, target, {
            "engine": engine,
            "maps": maps,
            "texture_size": texture_size,
            "image_prefix": stem,
            "bakelab_path": _get_arg(args, "bakelab_path", "").strip() or None,
        }, finish, _fail)
    except Exception as error:  # noqa: BLE001
        _fail(error)


if __name__ == "__main__":
    main()
