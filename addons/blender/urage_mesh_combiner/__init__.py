"""URage Mesh Combiner: combine objects into one clean mesh with a boolean union.

Adds two operators (3D View > Sidebar > URage, and Object > URage Combine):
  - Combine Meshes: union the selected mesh objects (or every mesh when nothing is selected).
  - Separate & Combine: split each object by loose parts first, then union the parts.
    Use it on one object whose pieces overlap (typical for AI-generated models).

The pipeline lives in combine_core.py so URage Now's headless script uses the same code.
"""

bl_info = {
    "name": "URage Mesh Combiner",
    "author": "URage",
    "version": (1, 0, 0),
    "blender": (4, 2, 0),
    "location": "View3D > Sidebar > URage; Object > URage Combine",
    "description": "Combine objects or loose parts into one clean mesh with a boolean union",
    "category": "Mesh",
}

import bpy
from bpy.props import BoolProperty, EnumProperty, FloatProperty, IntProperty

from . import combine_core

METHOD_ITEMS = (
    ("union", "Union", "Boolean union: one mesh, faces hidden inside other parts are removed"),
    ("join", "Join", "Plain join: keep every face, only weld touching vertices"),
)
SOLVER_ITEMS = (
    ("exact", "Exact", "Slow but robust; handles overlapping and touching parts"),
    ("fast", "Fast", "Quick float solver; can fail on coplanar faces"),
    ("manifold", "Manifold", "Very fast; needs closed (manifold) parts (Blender 4.5+, else Exact)"),
)


class CombineOperatorMixin:
    """Shared settings and execute(); each operator only changes the loose-parts default.
    (A registered operator must not subclass another one, so this is a plain mixin.)"""

    method: EnumProperty(name="Method", items=METHOD_ITEMS, default="union")
    solver: EnumProperty(name="Solver", items=SOLVER_ITEMS, default="exact")
    separate_loose_parts: BoolProperty(
        name="Separate loose parts first",
        description="Split each object into its connected pieces before combining",
        default=False,
    )
    merge_distance: FloatProperty(
        name="Weld distance",
        default=combine_core.DEFAULT_MERGE_DISTANCE,
        min=0.0,
        max=combine_core.MAX_MERGE_DISTANCE,
        precision=6,
        subtype="DISTANCE",
    )
    self_intersection: BoolProperty(name="Self intersection", default=True)
    hole_tolerant: BoolProperty(name="Hole tolerant", description="Handle meshes with holes", default=True)
    min_part_faces: IntProperty(
        name="Skip parts under (faces)",
        description="Delete tiny debris parts with fewer faces than this (0 keeps all)",
        default=combine_core.DEFAULT_MIN_PART_FACES,
        min=0,
    )

    @classmethod
    def poll(cls, context):
        return context.mode == "OBJECT" and any(obj.type == "MESH" for obj in context.view_layer.objects)

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "method")
        row = layout.row()
        row.enabled = self.method == "union"
        row.prop(self, "solver")
        layout.prop(self, "separate_loose_parts")
        layout.prop(self, "merge_distance")
        layout.prop(self, "min_part_faces")
        col = layout.column()
        col.enabled = self.method == "union"
        col.prop(self, "self_intersection")
        col.prop(self, "hole_tolerant")

    def execute(self, context):
        selected = [obj for obj in context.selected_objects if obj.type == "MESH"]
        targets = selected or [obj for obj in context.view_layer.objects if obj.type == "MESH" and obj.visible_get()]
        options = combine_core.CombineOptions(
            method=self.method,
            solver=self.solver,
            separate_loose_parts=self.separate_loose_parts,
            merge_distance=self.merge_distance,
            self_intersection=self.self_intersection,
            hole_tolerant=self.hole_tolerant,
            min_part_faces=self.min_part_faces,
            result_name=(context.active_object.name if context.active_object in targets else targets[0].name) if targets else "Combined",
        )
        try:
            result, report = combine_core.combine_objects(targets, options)
        except RuntimeError as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        combine_core.select_only([result])
        message = f"Combined {report['parts']} part(s) into {report['faces']} faces"
        if report["joinedFallbackParts"]:
            message += f"; {report['joinedFallbackParts']} part(s) could not be unioned and were joined"
        self.report({"WARNING"} if report["joinedFallbackParts"] else {"INFO"}, message)
        return {"FINISHED"}


class URAGE_OT_combine_meshes(CombineOperatorMixin, bpy.types.Operator):
    """Combine the selected mesh objects (or all meshes when nothing is selected) into one mesh"""

    bl_idname = "urage.combine_meshes"
    bl_label = "Combine Meshes"
    bl_options = {"REGISTER", "UNDO"}


class URAGE_OT_separate_and_combine(CombineOperatorMixin, bpy.types.Operator):
    """Split the selected objects by loose parts, then union the parts into one clean mesh"""

    bl_idname = "urage.separate_and_combine"
    bl_label = "Separate & Combine"
    bl_options = {"REGISTER", "UNDO"}

    separate_loose_parts: BoolProperty(
        name="Separate loose parts first",
        description="Split each object into its connected pieces before combining",
        default=True,
    )


class URAGE_PT_combine_panel(bpy.types.Panel):
    bl_label = "Mesh Combiner"
    bl_idname = "URAGE_PT_combine_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "URage"
    bl_context = "objectmode"

    def draw(self, context):
        layout = self.layout
        selected = sum(1 for obj in context.selected_objects if obj.type == "MESH")
        layout.label(text=f"{selected} mesh(es) selected" if selected else "Nothing selected: uses all meshes")
        col = layout.column(align=True)
        col.operator(URAGE_OT_combine_meshes.bl_idname, icon="MOD_BOOLEAN")
        col.operator(URAGE_OT_separate_and_combine.bl_idname, icon="MOD_EXPLODE")


def draw_object_menu(self, context):
    self.layout.separator()
    self.layout.operator(URAGE_OT_combine_meshes.bl_idname, icon="MOD_BOOLEAN")
    self.layout.operator(URAGE_OT_separate_and_combine.bl_idname, icon="MOD_EXPLODE")


CLASSES = (URAGE_OT_combine_meshes, URAGE_OT_separate_and_combine, URAGE_PT_combine_panel)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.VIEW3D_MT_object.append(draw_object_menu)


def unregister():
    bpy.types.VIEW3D_MT_object.remove(draw_object_menu)
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)
