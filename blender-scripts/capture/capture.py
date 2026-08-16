import argparse
import math
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
    parser.add_argument("--output", default="screenshot.png")
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1080)
    parser.add_argument("--quality", type=int, default=90)
    parser.add_argument("--engine", choices=["BLENDER_EEVEE_NEXT", "CYCLES", "BLENDER_WORKBENCH"], default="BLENDER_WORKBENCH")
    parser.add_argument("--camera", default=None)
    parser.add_argument("--select", default=None)
    parser.add_argument("--projection", choices=["ORTHO", "PERSP"], default="ORTHO")
    parser.add_argument("--shading", choices=["TEXTURE", "MATERIAL"], default="TEXTURE")
    parser.add_argument("--shadows", choices=["on", "off"], default="off")
    parser.add_argument("--zoom", type=float, default=1.0)
    parser.add_argument("--rotate", action="store_true")
    parser.add_argument("--rotate-target", choices=["camera", "object"], default="camera")
    parser.add_argument("--axis", choices=["X", "Y", "Z"], default="Z")
    parser.add_argument("--degrees", type=float, default=360)
    parser.add_argument("--frames", type=int, default=36)
    parser.add_argument("--gif-folder", default="gif_frames")
    parser.add_argument("--background", choices=["transparent", "solidcolor", "skybox"], default="transparent")
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
    raise RuntimeError(f"Unsupported source model for capture: {filepath}")


def load_scene_from_args(args):
    filepath = str(args.filepath or "").strip()
    if not filepath:
        return
    clear_scene()
    import_model(filepath)


def ensure_light():
    lights = [o for o in bpy.context.scene.objects if o.type == "LIGHT"]
    if lights:
        return lights[0]
    bpy.ops.object.light_add(type="SUN")
    light = bpy.context.object
    light.name = "AutoSun"
    light.location = (5, -5, 10)
    light.rotation_euler = (math.radians(45), 0, math.radians(45))
    light.data.energy = 3.0
    print(f"Created light: {light.name}")
    return light


def get_mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def parse_background_color(value):
    raw = str(value or "").strip()
    if raw.startswith("#") and len(raw) == 7:
        try:
            return tuple(int(raw[index:index + 2], 16) / 255.0 for index in (1, 3, 5))
        except ValueError:
            pass
    try:
        components = [float(component.strip()) for component in raw.split(",")]
    except ValueError:
        components = []
    if len(components) != 3:
        return (0.0, 0.0, 0.0)
    if max(components) > 1.0:
        components = [component / 255.0 for component in components]
    return tuple(max(0.0, min(1.0, component)) for component in components)


def ensure_world(scene):
    world = scene.world
    if not world:
        world = bpy.data.worlds.new("World")
        scene.world = world
    world.use_nodes = True
    return world


def configure_solid_background(scene, color):
    world = ensure_world(scene)
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs[0].default_value = (*color, 1)
        background.inputs[1].default_value = 1.0


def configure_skybox(scene):
    world = ensure_world(scene)
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputWorld")
    background = nodes.new(type="ShaderNodeBackground")
    sky = nodes.new(type="ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    background.inputs["Strength"].default_value = 0.35
    links.new(sky.outputs["Color"], background.inputs["Color"])
    links.new(background.outputs["Background"], output.inputs["Surface"])


def select_object(name=None):
    bpy.ops.object.select_all(action="DESELECT")
    if name:
        obj = bpy.data.objects.get(name)
        if not obj:
            raise ValueError(f"Object not found: {name}")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        return obj
    mesh_objects = get_mesh_objects()
    if not mesh_objects:
        raise ValueError("No mesh object found in scene.")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    print(f"Auto-selected {len(mesh_objects)} mesh objects")
    return mesh_objects[0]


def setup_render(args):
    scene = bpy.context.scene
    render_engine = args.engine
    if args.background == "skybox" and render_engine == "BLENDER_WORKBENCH":
        render_engine = "BLENDER_EEVEE_NEXT"
        print("Skybox capture uses Eevee Next because Workbench cannot render world sky shaders.")
    scene.render.engine = render_engine
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = max(0, min(100, 100 - args.quality))
    background_color = parse_background_color(args.bg_color)
    if render_engine == "BLENDER_WORKBENCH":
        shading = scene.display.shading
        shading.show_shadows = args.shadows == "on"
        shading.show_cavity = args.shadows == "on"
        shading.background_type = "VIEWPORT"
        shading.background_color = background_color
        if args.shading == "TEXTURE":
            shading.light = "FLAT"
            shading.color_type = "TEXTURE"
        elif args.shading == "MATERIAL":
            shading.light = "STUDIO"
            shading.color_type = "MATERIAL"
    elif render_engine == "BLENDER_EEVEE_NEXT":
        if hasattr(scene, "eevee") and hasattr(scene.eevee, "use_shadows"):
            scene.eevee.use_shadows = args.shadows == "on"
        for light in bpy.data.lights:
            light.use_shadow = args.shadows == "on"
    elif render_engine == "CYCLES":
        for light in bpy.data.lights:
            light.use_shadow = args.shadows == "on"
            if hasattr(light, "cycles"):
                light.cycles.cast_shadow = args.shadows == "on"
    scene.render.film_transparent = False
    if args.background == "transparent":
        scene.render.film_transparent = True
    elif args.background == "solidcolor":
        configure_solid_background(scene, background_color)
    elif args.background == "skybox":
        configure_skybox(scene)
    return render_engine


def get_scene_mesh_center_and_size():
    objects = get_mesh_objects()
    if not objects:
        raise ValueError("No mesh objects found for bounds.")
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
    horizontal = max(size.x, size.y, 0.01)
    vertical = max(size.z, 0.01)
    return center, horizontal, vertical


def get_camera_target(center):
    return Vector((center.x, center.y, center.z))


def get_camera_frame_scale(horizontal_size, vertical_size, aspect_ratio):
    return max(horizontal_size, vertical_size * max(aspect_ratio, 0.01), 0.01)


def setup_camera(args):
    scene = bpy.context.scene
    center, horizontal_size, vertical_size = get_scene_mesh_center_and_size()
    target = get_camera_target(center)
    aspect_ratio = max(args.width, 1) / max(args.height, 1)
    frame_scale = get_camera_frame_scale(horizontal_size, vertical_size, aspect_ratio)
    if args.camera:
        cam = bpy.data.objects.get(args.camera)
        if not cam:
            raise ValueError(f"Camera not found: {args.camera}")
    else:
        bpy.ops.object.camera_add()
        cam = bpy.context.object
        cam.name = "AutoCamera"
        cam.data.name = "AutoCamera"
        print(f"Created camera: {cam.name}")
    distance = (frame_scale * 2.8) / max(args.zoom, 0.01)
    cam.location = (target.x, target.y - distance, target.z)
    cam.rotation_euler = (math.radians(90), 0, 0)
    cam.data.type = args.projection
    if args.projection == "ORTHO":
        cam.data.ortho_scale = frame_scale * 1.35 / max(args.zoom, 0.01)
    elif args.projection == "PERSP":
        cam.data.lens = 52
    cam.data.clip_end = 10000
    scene.camera = cam
    look_at(cam, target)
    return cam


def render_still(output_path):
    folder = os.path.dirname(output_path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    print(f"Saved screenshot: {output_path}")


def look_at(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def rotate_camera_frames(cam, args):
    os.makedirs(args.gif_folder, exist_ok=True)
    center, _, _ = get_scene_mesh_center_and_size()
    target = get_camera_target(center)
    original_camera_location = cam.location.copy()
    original_camera_rotation = cam.rotation_euler.copy()
    radius = math.sqrt(((original_camera_location.x - center.x) ** 2) + ((original_camera_location.y - center.y) ** 2))
    height = original_camera_location.z - target.z
    for i in range(args.frames):
        angle = math.radians(args.degrees) * (i / args.frames)
        if args.axis == "Z":
            cam.location = (
                center.x + math.sin(angle) * radius,
                center.y - math.cos(angle) * radius,
                target.z + height
            )
        elif args.axis == "X":
            cam.location = (
                center.x,
                center.y - math.cos(angle) * radius,
                target.z + math.sin(angle) * radius
            )
        elif args.axis == "Y":
            cam.location = (
                center.x + math.sin(angle) * radius,
                center.y,
                target.z + math.cos(angle) * radius
            )
        look_at(cam, target)
        bpy.context.view_layer.update()
        frame_path = os.path.join(args.gif_folder, f"frame_{i:04d}.png")
        bpy.context.scene.render.filepath = frame_path
        bpy.ops.render.render(write_still=True)
        print(f"Saved frame {i + 1}/{args.frames}: {frame_path}")
    cam.location = original_camera_location
    cam.rotation_euler = original_camera_rotation
    bpy.context.view_layer.update()


def rotate_group_frames(args):
    os.makedirs(args.gif_folder, exist_ok=True)
    objects = get_mesh_objects()
    if not objects:
        raise ValueError("No mesh objects found to rotate.")
    center, _, _ = get_scene_mesh_center_and_size()
    empty = bpy.data.objects.new("TurntableEmpty", None)
    bpy.context.collection.objects.link(empty)
    empty.location = center
    original_data = []
    for obj in objects:
        original_data.append((obj, obj.parent, obj.matrix_world.copy()))
        obj.parent = empty
        obj.matrix_world = original_data[-1][2]
    original_empty_rotation = empty.rotation_euler.copy()
    for i in range(args.frames):
        angle = math.radians(args.degrees) * (i / args.frames)
        empty.rotation_euler = original_empty_rotation.copy()
        empty.rotation_euler.rotate_axis(args.axis, angle)
        bpy.context.view_layer.update()
        frame_path = os.path.join(args.gif_folder, f"frame_{i:04d}.png")
        bpy.context.scene.render.filepath = frame_path
        bpy.ops.render.render(write_still=True)
        print(f"Saved frame {i + 1}/{args.frames}: {frame_path}")
    empty.rotation_euler = original_empty_rotation
    for obj, original_parent, original_matrix in original_data:
        obj.parent = original_parent
        obj.matrix_world = original_matrix
    bpy.data.objects.remove(empty, do_unlink=True)
    bpy.context.view_layer.update()


def rotate_frames(cam, args):
    if args.rotate_target == "camera":
        rotate_camera_frames(cam, args)
        return
    rotate_group_frames(args)


def main():
    args = parse_args()
    load_scene_from_args(args)
    obj = select_object(args.select)
    render_engine = setup_render(args)
    if render_engine != "BLENDER_WORKBENCH":
        ensure_light()
    cam = setup_camera(args)
    render_still(args.output)
    if args.rotate:
        rotate_frames(cam, args)


if __name__ == "__main__":
    main()
