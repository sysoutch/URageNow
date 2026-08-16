import os
import sys

import bmesh
import bpy


def get_arg_value(args, key, default_value):
    for arg in args:
        if arg.startswith(f"--{key}="):
            return arg.split("=", 1)[1]
    return default_value


def parse_bool(value, default=False):
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in ("1", "true", "yes", "on"):
        return True
    if normalized in ("0", "false", "no", "off"):
        return False
    return default


def parse_float(value, default, minimum, maximum):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def parse_int(value, default, minimum, maximum):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_model(filepath):
    lower = filepath.lower()
    if lower.endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=filepath, use_custom_normals=True, use_image_search=True)
        return
    if lower.endswith(".obj"):
        try:
            bpy.ops.wm.obj_import(filepath=filepath)
        except Exception:
            bpy.ops.preferences.addon_enable(module="io_scene_obj")
            bpy.ops.import_scene.obj(filepath=filepath, use_image_search=True)
        return
    if lower.endswith(".glb") or lower.endswith(".gltf"):
        try:
            bpy.ops.import_scene.gltf(filepath=filepath)
        except Exception:
            bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
            bpy.ops.import_scene.gltf(filepath=filepath)
        return
    raise RuntimeError(f"Unsupported input format for albedo-to-geometry: {filepath}")


def export_model(output_path):
    lower = output_path.lower()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    if lower.endswith(".fbx"):
        bpy.ops.export_scene.fbx(
            filepath=output_path,
            use_selection=True,
            apply_scale_options="FBX_SCALE_ALL",
            axis_forward="-Z",
            axis_up="Y",
            use_mesh_modifiers=True,
            apply_unit_scale=True,
            path_mode="COPY",
            embed_textures=True,
        )
        return
    if lower.endswith(".obj"):
        try:
            bpy.ops.wm.obj_export(filepath=output_path, export_selected_objects=True)
        except Exception:
            bpy.ops.preferences.addon_enable(module="io_scene_obj")
            bpy.ops.export_scene.obj(filepath=output_path, use_selection=True, path_mode="COPY")
        return
    if lower.endswith(".glb"):
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format="GLB",
            use_selection=True,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_apply=True,
        )
        return
    if lower.endswith(".gltf"):
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format="GLTF_SEPARATE",
            use_selection=True,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_apply=True,
        )
        return
    raise RuntimeError(f"Unsupported output format for albedo-to-geometry: {output_path}")


def find_albedo_image(obj):
    for slot in obj.material_slots:
        material = slot.material
        if not material or not material.use_nodes or not material.node_tree:
            continue
        principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if principled:
            base_color = principled.inputs.get("Base Color")
            if base_color and base_color.is_linked:
                for link in base_color.links:
                    if link.from_node.type == "TEX_IMAGE" and link.from_node.image:
                        return link.from_node.image
        fallback = next(
            (node.image for node in material.node_tree.nodes if node.type == "TEX_IMAGE" and node.image),
            None,
        )
        if fallback:
            return fallback
    return None


def sample_brightness(pixel_data, width, height, uv):
    x = int((uv.x % 1.0) * (width - 1))
    y = int((uv.y % 1.0) * (height - 1))
    index = (y * width + x) * 4
    return (pixel_data[index] + pixel_data[index + 1] + pixel_data[index + 2]) / 3.0


def set_active_object(obj):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def replace_object_mesh_from_evaluated(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    old_mesh = obj.data
    obj.data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    obj.modifiers.clear()
    if old_mesh.users == 0:
        bpy.data.meshes.remove(old_mesh)


def apply_topology_modifier(obj, levels, topology_mode):
    if levels <= 0:
        return
    set_active_object(obj)
    if topology_mode == "multiresolution":
        modifier = obj.modifiers.new(name="AlbedoGeometryMultiresolution", type="MULTIRES")
        for _ in range(levels):
            bpy.ops.object.multires_subdivide(modifier=modifier.name, mode="CATMULL_CLARK")
        modifier.levels = levels
        modifier.sculpt_levels = levels
        modifier.render_levels = levels
        replace_object_mesh_from_evaluated(obj)
        return
    modifier = obj.modifiers.new(name="AlbedoGeometrySubdivision", type="SUBSURF")
    modifier.levels = levels
    modifier.render_levels = levels
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def get_vertex_surface_signature(vertex, uv_layer):
    loop_signatures = {
        (
            loop.face.material_index,
            round(loop[uv_layer].uv.x, 6),
            round(loop[uv_layer].uv.y, 6),
        )
        for loop in vertex.link_loops
    }
    return tuple(sorted(loop_signatures))


def merge_duplicate_vertices_preserving_seams(bm, uv_layer, distance):
    if distance <= 0:
        return 0
    groups = {}
    for vertex in bm.verts:
        signature = get_vertex_surface_signature(vertex, uv_layer)
        groups.setdefault(signature, []).append(vertex)
    before = len(bm.verts)
    for vertices in groups.values():
        valid_vertices = [vertex for vertex in vertices if vertex.is_valid]
        if len(valid_vertices) > 1:
            bmesh.ops.remove_doubles(bm, verts=valid_vertices, dist=distance)
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    return before - len(bm.verts)


def merge_object_vertices_preserving_seams(obj, distance):
    if distance <= 0:
        return 0
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    uv_layer = bm.loops.layers.uv.active
    if not uv_layer:
        bm.free()
        raise RuntimeError(f'Mesh "{obj.name}" has no UV map.')
    merged = merge_duplicate_vertices_preserving_seams(bm, uv_layer, distance)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return merged


def blur_vertex_heights(bm, heights, active_indices, iterations):
    result = list(heights)
    active = set(active_indices)
    for _ in range(iterations):
        next_values = list(result)
        for vertex_index in active:
            vertex = bm.verts[vertex_index]
            neighbors = [edge.other_vert(vertex).index for edge in vertex.link_edges if edge.other_vert(vertex).index in active]
            if neighbors:
                next_values[vertex_index] = (result[vertex_index] + sum(result[index] for index in neighbors)) / (len(neighbors) + 1)
        result = next_values
    return result


def generate_geometry(obj, strength, subdivisions, topology_mode, blur, auto_smooth, selected_faces_only, merge_before_subdivide, merge_after_subdivide, merge_distance):
    image = find_albedo_image(obj)
    if not image:
        return False
    merged_before = merge_object_vertices_preserving_seams(obj, merge_distance) if merge_before_subdivide else 0
    apply_topology_modifier(obj, subdivisions, topology_mode)
    merged_after = merge_object_vertices_preserving_seams(obj, merge_distance) if subdivisions > 0 and merge_after_subdivide else 0
    if merged_before or merged_after:
        print(f'Merged duplicate vertices on "{obj.name}": before={merged_before}, after={merged_after}.')
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bm.normal_update()
    uv_layer = bm.loops.layers.uv.active
    if not uv_layer:
        bm.free()
        raise RuntimeError(f'Mesh "{obj.name}" has no UV map.')
    selected_faces = [face for face in bm.faces if face.select]
    if selected_faces_only and not selected_faces:
        bm.free()
        raise RuntimeError(f'Mesh "{obj.name}" has no selected faces stored in the source model.')
    faces = selected_faces if selected_faces_only else list(bm.faces)
    selected_indices = {vertex.index for face in faces for vertex in face.verts}
    if image.source == "FILE" and not image.packed_file:
        try:
            image.reload()
        except RuntimeError:
            pass
    width, height = image.size[0], image.size[1]
    if width <= 0 or height <= 0:
        bm.free()
        raise RuntimeError(f'Albedo image "{image.name}" has no readable pixels.')
    pixel_data = list(image.pixels)
    heights = [0.0] * len(bm.verts)
    counts = [0] * len(bm.verts)
    for face in faces:
        for loop in face.loops:
            vertex_index = loop.vert.index
            heights[vertex_index] += sample_brightness(pixel_data, width, height, loop[uv_layer].uv)
            counts[vertex_index] += 1
    active_indices = [index for index in selected_indices if counts[index] > 0]
    if not active_indices:
        bm.free()
        raise RuntimeError(f'Mesh "{obj.name}" has no UV-mapped vertices to displace.')
    for index in active_indices:
        heights[index] /= counts[index]
    if blur > 0:
        heights = blur_vertex_heights(bm, heights, active_indices, blur)
    minimum = min(heights[index] for index in active_indices)
    maximum = max(heights[index] for index in active_indices)
    height_range = max(maximum - minimum, 0.0001)
    for index in active_indices:
        vertex = bm.verts[index]
        normalized_height = (heights[index] - minimum) / height_range
        vertex.co += vertex.normal.normalized() * normalized_height * strength
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    if auto_smooth:
        set_active_object(obj)
        for polygon in mesh.polygons:
            polygon.use_smooth = True
    return True


def main():
    if "--" not in sys.argv:
        raise RuntimeError("Missing Blender script arguments.")
    args = sys.argv[sys.argv.index("--") + 1:]
    filepath = get_arg_value(args, "filepath", "").strip()
    output_path = get_arg_value(args, "output_path", "").strip()
    strength = parse_float(get_arg_value(args, "strength", "0.05"), 0.05, 0.0, 10.0)
    subdivisions = parse_int(get_arg_value(args, "subdivisions", "0"), 0, 0, 8)
    topology_mode = get_arg_value(args, "topology_mode", "subdivision").strip().lower()
    topology_mode = "multiresolution" if topology_mode == "multiresolution" else "subdivision"
    blur = parse_int(get_arg_value(args, "blur", "1"), 1, 0, 10)
    auto_smooth = parse_bool(get_arg_value(args, "auto_smooth", "true"), True)
    selected_faces_only = parse_bool(get_arg_value(args, "selected_faces_only", "false"), False)
    merge_before_subdivide = parse_bool(get_arg_value(args, "merge_before_subdivide", "true"), True)
    merge_after_subdivide = parse_bool(get_arg_value(args, "merge_after_subdivide", "true"), True)
    merge_distance = parse_float(get_arg_value(args, "merge_distance", "0.000001"), 0.000001, 0.0, 0.1)
    if not filepath:
        raise RuntimeError("--filepath is required.")
    if not output_path:
        raise RuntimeError("--output_path is required.")

    clear_scene()
    import_model(filepath)
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("No mesh objects found after import.")
    processed = 0
    for obj in mesh_objects:
        if generate_geometry(obj, strength, subdivisions, topology_mode, blur, auto_smooth, selected_faces_only, merge_before_subdivide, merge_after_subdivide, merge_distance):
            processed += 1
    if processed == 0:
        raise RuntimeError("No mesh with an albedo image texture was found.")
    export_model(output_path)
    print(f"Processed albedo geometry meshes: {processed}")
    print(f"Exported model to: {output_path}")


if __name__ == "__main__":
    main()
