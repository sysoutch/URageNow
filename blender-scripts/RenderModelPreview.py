from pathlib import Path
import os
import sys
import bpy
from math import atan2, cos, sin, sqrt, tau
from mathutils import Vector


# ---------------------------------------------------------------------------
# Command-line arguments
# ---------------------------------------------------------------------------

def get_arg_value(args, key, default_value):
    prefix = f"--{key}="

    for arg in args:
        if arg.startswith(prefix):
            return arg[len(prefix):]

    return default_value


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


# ---------------------------------------------------------------------------
# Model importing
# ---------------------------------------------------------------------------

# Modern Blender operator + legacy fallback configuration.
#
# Each entry contains:
#   modern:       operator under bpy.ops.wm
#   addon:        legacy addon module
#   legacy_group: operator namespace under bpy.ops
#   legacy:       legacy operator name
#
# Example:
#   .obj
#       modern  -> bpy.ops.wm.obj_import
#       legacy  -> bpy.ops.import_scene.obj
#
MODEL_IMPORTERS = {
    ".obj": {
        "modern": "obj_import",
        "addon": "io_scene_obj",
        "legacy_group": "import_scene",
        "legacy": "obj",
    },
    ".stl": {
        "modern": "stl_import",
        "addon": "io_mesh_stl",
        "legacy_group": "import_mesh",
        "legacy": "stl",
    },
    ".ply": {
        "modern": "ply_import",
        "addon": "io_mesh_ply",
        "legacy_group": "import_mesh",
        "legacy": "ply",
    },
    ".3mf": {
        "modern": "three_dmf_import",
        "addon": "io_mesh_3mf",
        "legacy_group": "import_mesh",
        "legacy": "three_dmf",
    },
}


def import_model(filepath):
    """Import a supported 3D model and return the imported objects."""

    path = Path(filepath).expanduser().resolve()

    if not path.is_file():
        raise FileNotFoundError(
            f"Model file does not exist: {path}"
        )

    ext = path.suffix.lower()

    # Record existing objects so we can identify what the importer created.
    before = set(bpy.context.scene.objects)

    try:
        # Formats with dedicated import operators.
        if ext == ".fbx":
            bpy.ops.import_scene.fbx(
                filepath=str(path),
                use_custom_normals=True,
                use_image_search=True,
            )

        elif ext in {".glb", ".gltf"}:
            bpy.ops.import_scene.gltf(
                filepath=str(path),
            )

        # Formats with modern WM importers and legacy fallbacks.
        elif ext in MODEL_IMPORTERS:
            config = MODEL_IMPORTERS[ext]

            modern_operator = getattr(
                bpy.ops.wm,
                config["modern"],
                None,
            )

            if modern_operator is not None:
                modern_operator(filepath=str(path))

            else:
                # Enable the legacy addon only when necessary.
                bpy.ops.preferences.addon_enable(
                    module=config["addon"]
                )

                operator_group = getattr(
                    bpy.ops,
                    config["legacy_group"],
                )

                legacy_operator = getattr(
                    operator_group,
                    config["legacy"],
                )

                legacy_operator(
                    filepath=str(path)
                )

        else:
            raise ValueError(
                f"Unsupported model format: "
                f"{ext or '<no extension>'}"
            )

    except Exception as exc:
        raise RuntimeError(
            f"Failed to import {path.name} ({ext}): {exc}"
        ) from exc

    # Return only objects created by this import operation.
    imported = [
        obj
        for obj in bpy.context.scene.objects
        if obj not in before
    ]

    return imported


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def get_mesh_objects(objects=None):
    if objects is None:
        objects = bpy.context.scene.objects

    return [
        obj
        for obj in objects
        if obj.type == "MESH"
    ]


def get_world_bounds(objects):
    bbox_points = []

    for obj in objects:
        for corner in obj.bound_box:
            bbox_points.append(
                obj.matrix_world @ Vector(corner)
            )

    if not bbox_points:
        return Vector((0.0, 0.0, 0.0)), 1.0

    min_corner = Vector((
        min(point.x for point in bbox_points),
        min(point.y for point in bbox_points),
        min(point.z for point in bbox_points),
    ))

    max_corner = Vector((
        max(point.x for point in bbox_points),
        max(point.y for point in bbox_points),
        max(point.z for point in bbox_points),
    ))

    center = (min_corner + max_corner) * 0.5

    size = max(
        max_corner.x - min_corner.x,
        max_corner.y - min_corner.y,
        max_corner.z - min_corner.z,
        0.01,
    )

    return center, size


def center_and_scale_objects(objects):
    if not objects:
        return None, 1.0

    # Flatten the import hierarchy before measuring.
    #
    # Sketchfab glTF files often use several rotated parent nodes.
    # Preview framing operates on meshes and therefore benefits from
    # working directly with their world-space transforms.
    for obj in objects:
        world_matrix = obj.matrix_world.copy()

        obj.parent = None
        obj.matrix_world = world_matrix

    center, size = get_world_bounds(objects)

    # Move model center to world origin.
    for obj in objects:
        obj.location -= center

    # Normalize model size.
    scale = 1.8 / max(size, 0.01)

    for obj in objects:
        obj.scale = obj.scale * scale

    bpy.context.view_layer.update()

    return get_world_bounds(objects)


# ---------------------------------------------------------------------------
# Camera
# ---------------------------------------------------------------------------

def look_at(target, camera_obj):
    direction = target - camera_obj.location
    rotation = direction.to_track_quat("-Z", "Y")
    camera_obj.rotation_euler = rotation.to_euler()


def setup_camera_and_lights(target, max_size):
    scene = bpy.context.scene

    distance = max(1.0, max_size * 2.45)

    # Camera
    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera_obj = bpy.data.objects.new(
        "PreviewCamera",
        camera_data,
    )

    scene.collection.objects.link(camera_obj)

    camera_obj.location = target + Vector((
        distance * 0.78,
        -distance * 0.78,
        distance * 0.52,
    ))

    camera_obj.data.lens = 52

    look_at(target, camera_obj)

    scene.camera = camera_obj

    # Key light
    key_data = bpy.data.lights.new(
        "KeyLight",
        type="AREA",
    )

    key_data.energy = 900
    key_data.size = 2.2

    key_obj = bpy.data.objects.new(
        "KeyLight",
        key_data,
    )

    scene.collection.objects.link(key_obj)

    key_obj.location = target + Vector((
        distance * 0.9,
        -distance * 0.62,
        distance * 0.95,
    ))

    look_at(target, key_obj)

    # Fill light
    fill_data = bpy.data.lights.new(
        "FillLight",
        type="AREA",
    )

    fill_data.energy = 350
    fill_data.size = 3.0

    fill_obj = bpy.data.objects.new(
        "FillLight",
        fill_data,
    )

    scene.collection.objects.link(fill_obj)

    fill_obj.location = target + Vector((
        -distance * 0.72,
        distance * 0.62,
        distance * 0.45,
    ))

    look_at(target, fill_obj)

    return camera_obj


# ---------------------------------------------------------------------------
# World / rendering
# ---------------------------------------------------------------------------

def setup_world():
    scene = bpy.context.scene

    if scene.world is None:
        scene.world = bpy.data.worlds.new("PreviewWorld")

    scene.world.use_nodes = True

    nodes = scene.world.node_tree.nodes
    links = scene.world.node_tree.links

    nodes.clear()

    background = nodes.new(
        type="ShaderNodeBackground"
    )

    background.inputs["Color"].default_value = (
        0.07,
        0.13,
        0.26,
        1.0,
    )

    background.inputs["Strength"].default_value = 1.0

    output = nodes.new(
        type="ShaderNodeOutputWorld"
    )

    links.new(
        background.outputs["Background"],
        output.inputs["Surface"],
    )


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

    bpy.ops.render.render(
        write_still=True
    )


def render_turntable_frames(
    output_dir,
    frame_count,
    camera_obj,
    orbit_center,
):
    scene = bpy.context.scene

    configure_render()

    os.makedirs(
        output_dir,
        exist_ok=True,
    )

    base_location = camera_obj.location.copy()

    base_angle = atan2(
        base_location.y,
        base_location.x,
    )

    orbit_radius = sqrt(
        base_location.x * base_location.x
        + base_location.y * base_location.y
    )

    camera_height = base_location.z

    for frame_index in range(frame_count):
        angle = (tau * frame_index) / frame_count
        orbit_angle = base_angle + angle

        camera_obj.location = Vector((
            orbit_radius * cos(orbit_angle),
            orbit_radius * sin(orbit_angle),
            camera_height,
        ))

        look_at(
            orbit_center,
            camera_obj,
        )

        bpy.context.view_layer.update()

        frame_path = os.path.join(
            output_dir,
            f"frame_{frame_index:04d}.png",
        )

        scene.render.filepath = frame_path

        bpy.ops.render.render(
            write_still=True
        )

        print(
            f"Rendered frame to: {frame_path}"
        )

    # Restore camera.
    camera_obj.location = base_location

    look_at(
        orbit_center,
        camera_obj,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if "--" not in sys.argv:
        raise RuntimeError(
            "Missing Blender script arguments."
        )

    args = sys.argv[
        sys.argv.index("--") + 1:
    ]

    filepath = get_arg_value(
        args,
        "filepath",
        "",
    ).strip()

    output_path = get_arg_value(
        args,
        "output_path",
        "",
    ).strip()

    output_dir = get_arg_value(
        args,
        "output_dir",
        "",
    ).strip()

    frame_count_raw = get_arg_value(
        args,
        "frame_count",
        "1",
    ).strip()

    try:
        frame_count = max(
            1,
            int(frame_count_raw),
        )
    except ValueError:
        frame_count = 1

    if not filepath:
        raise RuntimeError(
            "--filepath is required."
        )

    if not output_path and not output_dir:
        raise RuntimeError(
            "Either --output_path or "
            "--output_dir is required."
        )

    # Start clean.
    clear_scene()

    # Import only this model and keep track of its objects.
    imported_objects = import_model(filepath)

    # Only meshes participate in bounds/camera calculations.
    mesh_objects = get_mesh_objects(imported_objects)

    if not mesh_objects:
        raise RuntimeError(
            "No mesh objects found after import."
        )

    # Normalize the model.
    target, max_size = center_and_scale_objects(
        mesh_objects
    )

    # Camera and lighting.
    camera_obj = setup_camera_and_lights(
        target,
        max_size,
    )

    setup_world()

    # Turntable.
    if output_dir and frame_count > 1:
        render_turntable_frames(
            output_dir,
            frame_count,
            camera_obj,
            target,
        )

        print(
            f"Rendered model turntable frames to: "
            f"{output_dir}"
        )

        return

    # Single preview.
    output_parent = os.path.dirname(
        os.path.abspath(output_path)
    )

    os.makedirs(
        output_parent,
        exist_ok=True,
    )

    render_preview(output_path)

    print(
        f"Rendered model preview to: "
        f"{output_path}"
    )


if __name__ == "__main__":
    main()
