import argparse
import os
import sys

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser()
    parser.add_argument("--filepath", default="")
    parser.add_argument("--output", default="delight.png")
    parser.add_argument("--width", type=int, default=1080)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--projection", choices=["ORTHO", "PERSP"], default="ORTHO")
    parser.add_argument("--zoom", type=float, default=1.35)
    parser.add_argument("--background", choices=["transparent", "solidcolor"], default="transparent")
    parser.add_argument("--bg-color", default="0,0,0")
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_model(filepath):
    normalized = filepath.lower()
    if normalized.endswith(".blend"):
        bpy.ops.wm.open_mainfile(filepath=filepath)
        return
    if normalized.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=filepath, use_custom_normals=True, use_image_search=True)
        return
    if normalized.endswith(".obj"):
        try:
            bpy.ops.wm.obj_import(filepath=filepath)
        except Exception:
            try:
                bpy.ops.import_scene.obj(filepath=filepath, use_image_search=True)
            except Exception:
                bpy.ops.preferences.addon_enable(module="io_scene_obj")
                bpy.ops.import_scene.obj(filepath=filepath, use_image_search=True)
        return
    if normalized.endswith(".glb") or normalized.endswith(".gltf"):
        try:
            bpy.ops.import_scene.gltf(filepath=filepath)
        except Exception:
            bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
            bpy.ops.import_scene.gltf(filepath=filepath)
        return
    raise RuntimeError(f"Unsupported source model for delight capture: {filepath}")


def load_scene(filepath):
    if not filepath:
        return
    clear_scene()
    import_model(filepath)


def get_mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def get_scene_mesh_center_and_size():
    objects = get_mesh_objects()
    if not objects:
        raise RuntimeError("No mesh objects found for delight capture.")
    min_corner = Vector((float("inf"), float("inf"), float("inf")))
    max_corner = Vector((float("-inf"), float("-inf"), float("-inf")))
    for obj in objects:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ Vector(corner)
            min_corner.x = min(min_corner.x, world_corner.x)
            min_corner.y = min(min_corner.y, world_corner.y)
            min_corner.z = min(min_corner.z, world_corner.z)
            max_corner.x = max(max_corner.x, world_corner.x)
            max_corner.y = max(max_corner.y, world_corner.y)
            max_corner.z = max(max_corner.z, world_corner.z)
    center = (min_corner + max_corner) / 2
    size = max_corner - min_corner
    return center, max(size.x, size.y, 0.01), max(size.z, 0.01)


def look_at(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_camera(args):
    scene = bpy.context.scene
    center, horizontal_size, vertical_size = get_scene_mesh_center_and_size()
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    cam.name = "DelightCamera"
    target_z = center.z + (vertical_size * 0.16)
    distance = (horizontal_size * 2.8) / max(args.zoom, 0.01)
    cam.location = (center.x, center.y - distance, target_z)
    cam.data.type = args.projection
    if args.projection == "ORTHO":
        cam.data.ortho_scale = max(horizontal_size, vertical_size) * 1.55 / max(args.zoom, 0.01)
    else:
        cam.data.lens = 52
    cam.data.clip_end = 10000
    look_at(cam, Vector((center.x, center.y, target_z)))
    scene.camera = cam


def setup_render(args):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = args.background == "transparent"
    shading = scene.display.shading
    shading.light = "FLAT"
    shading.color_type = "TEXTURE"
    shading.show_shadows = False
    shading.show_cavity = False
    if args.background == "solidcolor":
        r, g, b = [float(x) for x in args.bg_color.split(",")]
        world = scene.world
        if not world:
            world = bpy.data.worlds.new("World")
            scene.world = world
        world.use_nodes = True
        background = world.node_tree.nodes.get("Background")
        if background:
            background.inputs[0].default_value = (r, g, b, 1)


def render_still(output_path):
    folder = os.path.dirname(output_path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    print(f"Saved delight screenshot: {output_path}")


def main():
    args = parse_args()
    load_scene(str(args.filepath or "").strip())
    if not get_mesh_objects():
        raise RuntimeError("No mesh objects found after import.")
    setup_render(args)
    setup_camera(args)
    render_still(args.output)


if __name__ == "__main__":
    main()
