import os
import sys
import bpy
from math import atan2, cos, sin, sqrt, tau
from mathutils import Vector

def get_arg_value(args, key, default_value):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default_value

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

def import_model(filepath):
    lower = filepath.lower()
    if lower.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=filepath, use_custom_normals=True, use_image_search=True)
        return
    if lower.endswith(".glb") or lower.endswith(".gltf"):
        bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
        bpy.ops.import_scene.gltf(filepath=filepath)
        return
    raise RuntimeError(f"Unsupported model format for preview render: {filepath}")

def get_mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]

def get_world_bounds(objects):
    bbox_points = []
    for obj in objects:
        for corner in obj.bound_box:
            bbox_points.append(obj.matrix_world @ Vector(corner))
    if not bbox_points:
        return Vector((0.0, 0.0, 0.0)), 1.0
    min_corner = Vector((
        min(point.x for point in bbox_points),
        min(point.y for point in bbox_points),
        min(point.z for point in bbox_points)
    ))
    max_corner = Vector((
        max(point.x for point in bbox_points),
        max(point.y for point in bbox_points),
        max(point.z for point in bbox_points)
    ))
    return (min_corner + max_corner) * 0.5, max(max_corner.x - min_corner.x, max_corner.y - min_corner.y, max_corner.z - min_corner.z, 0.01)

def center_and_scale_objects(objects):
    if not objects:
        return
    # Flatten the import hierarchy before measuring. Sketchfab glTF files often
    # use several rotated parent nodes; preview framing operates on meshes and
    # must not mix their world-space bounds with local-space translation.
    for obj in objects:
        world_matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world_matrix
    center, size = get_world_bounds(objects)
    for obj in objects:
        obj.location -= center
    scale = 1.8 / max(size, 0.01)
    for obj in objects:
        obj.scale = obj.scale * scale
    bpy.context.view_layer.update()
    return get_world_bounds(objects)

def look_at(target, camera_obj):
    direction = target - camera_obj.location
    rotation = direction.to_track_quat("-Z", "Y")
    camera_obj.rotation_euler = rotation.to_euler()

def setup_camera_and_lights(target, max_size):
    scene = bpy.context.scene
    distance = max(1.0, max_size * 2.45)
    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera_obj = bpy.data.objects.new("PreviewCamera", camera_data)
    scene.collection.objects.link(camera_obj)
    camera_obj.location = target + Vector((distance * 0.78, -distance * 0.78, distance * 0.52))
    camera_obj.data.lens = 52
    look_at(target, camera_obj)
    scene.camera = camera_obj

    key_data = bpy.data.lights.new("KeyLight", type="AREA")
    key_data.energy = 900
    key_data.size = 2.2
    key_obj = bpy.data.objects.new("KeyLight", key_data)
    scene.collection.objects.link(key_obj)
    key_obj.location = target + Vector((distance * 0.9, -distance * 0.62, distance * 0.95))
    look_at(target, key_obj)

    fill_data = bpy.data.lights.new("FillLight", type="AREA")
    fill_data.energy = 350
    fill_data.size = 3.0
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    scene.collection.objects.link(fill_obj)
    fill_obj.location = target + Vector((-distance * 0.72, distance * 0.62, distance * 0.45))
    look_at(target, fill_obj)
    return camera_obj

def setup_world():
    scene = bpy.context.scene
    if scene.world is None:
        scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.use_nodes = True
    nodes = scene.world.node_tree.nodes
    links = scene.world.node_tree.links
    nodes.clear()
    background = nodes.new(type="ShaderNodeBackground")
    background.inputs["Color"].default_value = (0.07, 0.13, 0.26, 1.0)
    background.inputs["Strength"].default_value = 1.0
    output = nodes.new(type="ShaderNodeOutputWorld")
    links.new(background.outputs["Background"], output.inputs["Surface"])

def configure_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

def render_preview(output_path):
    scene = bpy.context.scene
    configure_render()
    scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)

def render_turntable_frames(output_dir, frame_count, camera_obj, orbit_center):
    scene = bpy.context.scene
    configure_render()
    os.makedirs(output_dir, exist_ok=True)
    base_location = camera_obj.location.copy()
    base_angle = atan2(base_location.y, base_location.x)
    orbit_radius = sqrt((base_location.x * base_location.x) + (base_location.y * base_location.y))
    camera_height = base_location.z
    for frame_index in range(frame_count):
        angle = (tau * frame_index) / frame_count
        orbit_angle = base_angle + angle
        camera_obj.location = Vector((
            orbit_radius * cos(orbit_angle),
            orbit_radius * sin(orbit_angle),
            camera_height
        ))
        look_at(orbit_center, camera_obj)
        bpy.context.view_layer.update()
        frame_path = os.path.join(output_dir, f"frame_{frame_index:04d}.png")
        scene.render.filepath = frame_path
        bpy.ops.render.render(write_still=True)
        print(f"Rendered frame to: {frame_path}")
    camera_obj.location = base_location
    look_at(orbit_center, camera_obj)

def main():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments.")
    args = sys.argv[sys.argv.index("--") + 1:]
    filepath = get_arg_value(args, "filepath", "").strip()
    output_path = get_arg_value(args, "output_path", "").strip()
    output_dir = get_arg_value(args, "output_dir", "").strip()
    frame_count_raw = get_arg_value(args, "frame_count", "1").strip()
    try:
        frame_count = max(1, int(frame_count_raw))
    except ValueError:
        frame_count = 1
    if not filepath:
        raise RuntimeError("--filepath is required.")
    if not output_path and not output_dir:
        raise RuntimeError("Either --output_path or --output_dir is required.")
    clear_scene()
    import_model(filepath)
    mesh_objects = get_mesh_objects()
    if not mesh_objects:
        raise RuntimeError("No mesh objects found after import.")
    target, max_size = center_and_scale_objects(mesh_objects)
    camera_obj = setup_camera_and_lights(target, max_size)
    setup_world()
    if output_dir and frame_count > 1:
        render_turntable_frames(output_dir, frame_count, camera_obj, target)
        print(f"Rendered model turntable frames to: {output_dir}")
        return
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    render_preview(output_path)
    print(f"Rendered model preview to: {output_path}")

if __name__ == "__main__":
    main()
