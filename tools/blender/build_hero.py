"""Build the SoccerShooter balanced-midfielder hero in the connected Blender session.

The MPFB base and bundled system assets are CC0. The kit, face details, export
structure and any changes in this script are original SoccerShooter work.
This script only edits the dedicated `Hero Athlete - Stage 12 v01` scene.
"""

from __future__ import annotations

import os
import math
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from bl_ext.blender_org.mpfb.services.humanservice import HumanService


SCENE_NAME = "Hero Athlete - Stage 12 v01"
ROOT = "/Users/pcg/Desktop/soccershooter-movement-test"
DATA = "/Users/pcg/Library/Application Support/Blender/5.2/extensions/.user/blender_org/mpfb/data"
SOURCE_BLEND = os.path.join(ROOT, "art/characters/source/hero.blend")
EXPORT_GLB = os.path.join(ROOT, "art/characters/export/hero.glb")
JERSEY_ALBEDO = os.path.join(ROOT, "art/characters/textures/jersey-knit-garnet-source.png")
BOOT_ALBEDO = os.path.join(ROOT, "art/characters/textures/boot-microfiber-teal-source.png")


def material(name: str, color: tuple[float, float, float, float], roughness: float,
             metallic: float = 0.0, subsurface: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    output = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
    output.location = (420, 40)
    shader = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    shader.location = (120, 40)
    mat.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if "Subsurface Weight" in shader.inputs:
        shader.inputs["Subsurface Weight"].default_value = subsurface
    if "Subsurface Radius" in shader.inputs:
        shader.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.25)
    return mat


def texture_material(mat: bpy.types.Material, texture_path: str, bump_strength: float,
                     bump_distance: float) -> bpy.types.Image:
    """Attach a packed repeat weave height texture and subtle source bump."""
    image = bpy.data.images.load(texture_path, check_existing=True)
    image.colorspace_settings.name = "sRGB"
    image.pack()
    image.filepath = "//../textures/" + os.path.basename(texture_path)
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    coords = nodes.new("ShaderNodeTexCoord")
    coords.location = (-760, 160)
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.extension = "REPEAT"
    tex.interpolation = "Linear"
    tex.location = (-520, 160)
    links.new(coords.outputs["UV"], tex.inputs["Vector"])
    gray = nodes.new("ShaderNodeRGBToBW")
    gray.location = (-300, -20)
    links.new(tex.outputs["Color"], gray.inputs["Color"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-110, -20)
    ramp.color_ramp.elements[0].position = 0.025
    ramp.color_ramp.elements[1].position = 0.24
    links.new(gray.outputs["Val"], ramp.inputs["Fac"])
    bump = nodes.new("ShaderNodeBump")
    bump.location = (-100, -160)
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = bump_distance
    links.new(ramp.outputs["Color"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return image


def make_tangent_normal(source: bpy.types.Image, filepath: str, strength: float) -> bpy.types.Image:
    """Convert a seamless grayscale material tile into a valid tangent normal map."""
    width, height = source.size
    rgba = np.asarray(source.pixels[:], dtype=np.float32).reshape(height, width, 4)
    gray = rgba[:, :, :3].mean(axis=2)
    dx = (np.roll(gray, -1, axis=1) - np.roll(gray, 1, axis=1)) * (width * strength * 0.5)
    dy = (np.roll(gray, -1, axis=0) - np.roll(gray, 1, axis=0)) * (height * strength * 0.5)
    normals = np.stack((-dx, -dy, np.ones_like(gray)), axis=2)
    normals /= np.maximum(np.linalg.norm(normals, axis=2, keepdims=True), 1e-7)
    pixels = np.empty((height, width, 4), dtype=np.float32)
    pixels[:, :, :3] = normals * 0.5 + 0.5
    pixels[:, :, 3] = 1.0
    image = bpy.data.images.new(os.path.basename(filepath), width=width, height=height,
                                alpha=False, float_buffer=False)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = filepath
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def make_tinted_albedo(source: bpy.types.Image, filepath: str,
                       base_color: tuple[float, float, float], mix: float) -> bpy.types.Image:
    """Keep the authored fabric weave while tempering its contrast for gameplay."""
    width, height = source.size
    rgba = np.asarray(source.pixels[:], dtype=np.float32).reshape(height, width, 4)
    base = np.asarray(base_color, dtype=np.float32).reshape(1, 1, 3)
    pixels = np.empty_like(rgba)
    pixels[:, :, :3] = base * (1.0 - mix) + rgba[:, :, :3] * mix
    pixels[:, :, 3] = 1.0
    image = bpy.data.images.new(os.path.basename(filepath), width=width, height=height,
                                alpha=False, float_buffer=False)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = filepath
    image.file_format = "PNG"
    image.save(); image.pack()
    return image


def make_teal_cleat_albedo(source: bpy.types.Image, filepath: str) -> bpy.types.Image:
    """Shift only the source boot's blue panels to the home teal; keep white trim."""
    width, height = source.size
    rgba = np.asarray(source.pixels[:], dtype=np.float32).reshape(height, width, 4)
    rgb = rgba[:, :, :3]
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    blue_panel = (rgb[:, :, 2] > rgb[:, :, 0] * 1.12) & \
                 (rgb[:, :, 2] > rgb[:, :, 1] * 0.96) & ((high - low) > 0.035)
    luminance = rgb[:, :, 0] * 0.24 + rgb[:, :, 1] * 0.66 + rgb[:, :, 2] * 0.10
    shade = np.clip(luminance / 0.20, 0.0, 1.25)[:, :, None]
    teal = np.asarray((0.018, 0.22, 0.25), dtype=np.float32).reshape(1, 1, 3)
    pixels = rgba.copy()
    pixels[:, :, :3] = np.where(blue_panel[:, :, None], teal * shade, rgb)
    image = bpy.data.images.new(os.path.basename(filepath), width=width, height=height,
                                alpha=False, float_buffer=False)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = filepath
    image.file_format = "PNG"
    image.save(); image.pack()
    return image


def apply_normal_map(mat: bpy.types.Material, image: bpy.types.Image,
                     label: str, strength: float = 0.3,
                     albedo: bpy.types.Image | None = None) -> None:
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    # Replace the non-exportable Blender bump graph with a real glTF normal map.
    for link in list(shader.inputs["Normal"].links):
        links.remove(link)
    uv = nodes.new("ShaderNodeTexCoord"); uv.location = (-760, -250)
    tex = nodes.new("ShaderNodeTexImage"); tex.image = image; tex.extension = "REPEAT"
    tex.interpolation = "Linear"; tex.location = (-520, -250)
    normal = nodes.new("ShaderNodeNormalMap"); normal.location = (-250, -250)
    normal.inputs["Strength"].default_value = strength
    links.new(uv.outputs["UV"], tex.inputs["Vector"])
    links.new(tex.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    if albedo:
        albedo_node = nodes.new("ShaderNodeTexImage"); albedo_node.image = albedo
        albedo_node.extension = "REPEAT"; albedo_node.interpolation = "Linear"
        albedo_node.location = (-520, 100)
        links.new(uv.outputs["UV"], albedo_node.inputs["Vector"])
        links.new(albedo_node.outputs["Color"], shader.inputs["Base Color"])


def bake_normal_map(scene: bpy.types.Scene, obj: bpy.types.Object,
                    mat: bpy.types.Material, image_path: str,
                    resolution: int = 1024) -> bpy.types.Image:
    """Bake the fabric micro-normal into a glTF-supported tangent-space map."""
    previous_engine = scene.render.engine
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    shader = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bump = next(n for n in nodes if n.type == "BUMP")
    normal_image = bpy.data.images.new(os.path.basename(image_path),
                                       width=resolution, height=resolution,
                                       alpha=False, float_buffer=False)
    target = nodes.new("ShaderNodeTexImage")
    target.image = normal_image
    target.location = (-520, -260)
    for node in nodes:
        node.select = False
    target.select = True
    nodes.active = target
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", use_clear=True, margin=12)
    normal_image.filepath_raw = image_path
    normal_image.file_format = "PNG"
    normal_image.colorspace_settings.name = "Non-Color"
    normal_image.save()
    normal_image.pack()
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = normal_image
    tex.extension = "REPEAT"
    tex.location = (-260, -260)
    normal = nodes.new("ShaderNodeNormalMap")
    normal.space = "TANGENT"
    normal.location = (-40, -240)
    links.new(target.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    # The source bump remains in the node graph for Blender lookdev only; avoid
    # stacking it on top of the baked normal map.
    for link in list(shader.inputs["Normal"].links):
        if link.from_node == bump:
            links.remove(link)
    scene.render.engine = previous_engine
    return normal_image


def assign_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def shell_from_body(body: bpy.types.Object, name: str, mat: bpy.types.Material,
                    z_min: float, z_max: float, side: int = 0,
                    x_min: float = 0.0, x_max: float = 10.0,
                    short_sleeve: bool = False, cloth_drape: float = 0.0) -> bpy.types.Object:
    obj = body.copy()
    obj.data = body.data.copy()
    bpy.context.scene.collection.objects.link(obj)
    obj.name = name
    obj.data.name = name + " mesh"
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    # Remove MPFB helper faces before cutting clothing. Its `body` vertex group
    # marks renderable anatomy; helper overlays otherwise leak out at garment hems.
    body_group = body.vertex_groups.get("body")
    if body_group:
        group_index = body_group.index
        helper_face_indices = set()
        for poly in body.data.polygons:
            if all(not any(membership.group == group_index and membership.weight > 0.5
                           for membership in body.data.vertices[index].groups)
                   for index in poly.vertices):
                helper_face_indices.add(poly.index)
        bm.faces.ensure_lookup_table()
        bm.faces.index_update()
        hidden_helpers = [face for face in bm.faces if face.index in helper_face_indices]
        if hidden_helpers:
            bmesh.ops.delete(bm, geom=hidden_helpers, context="FACES")
    # Plane cuts keep garment hems clean and even instead of following irregular
    # polygon centroids across the source body mesh.
    for cut_z in ((z_min, z_max, 1.31) if short_sleeve else (z_min, z_max)):
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((0, 0, cut_z)),
                               plane_no=Vector((0, 0, 1)), clear_inner=False,
                               clear_outer=False, dist=0.00001)
    doomed = []
    for face in bm.faces:
        c = face.calc_center_median()
        if c.z < z_min or c.z > z_max or abs(c.x) < x_min or abs(c.x) > x_max:
            doomed.append(face)
            continue
        if short_sleeve and abs(c.x) > 0.235 and c.z < 1.31:
            doomed.append(face)
            continue
        if side < 0 and c.x >= 0:
            doomed.append(face)
        elif side > 0 and c.x <= 0:
            doomed.append(face)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    # Close the bisected sleeve and garment boundaries so solidify creates a
    # clean sewn edge instead of jagged, uncapped triangles.
    boundary = [edge for edge in bm.edges if len(edge.link_faces) == 1]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bm.normal_update()
    for vertex in bm.verts:
        p = vertex.co.copy()
        envelope = min(1.0, max(0.0, (p.z-z_min)/0.06), max(0.0, (z_max-p.z)/0.06))
        fold = cloth_drape * envelope * (math.sin(p.z * 28.0 + p.x * 10.0) +
                                         0.45 * math.sin(p.z * 17.0 - p.x * 19.0))
        garment_offset = 0.006 + (0.012 if name.startswith("LOD0_Jersey") else 0.0) + fold
        vertex.co += vertex.normal * garment_offset
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    assign_material(obj, mat)
    obj.parent = body.parent
    arm = next((m.object for m in body.modifiers if m.type == "ARMATURE"), None)
    # Preserve MPFB's Mask modifier: it removes its hidden helper geometry from
    # the source mesh. Dropping it turns hidden rig markers into visible strips.
    for modifier in obj.modifiers:
        if modifier.type == "ARMATURE" and arm:
            modifier.object = arm
    solid = obj.modifiers.new("Fabric edge thickness", "SOLIDIFY")
    solid.thickness = 0.007
    solid.offset = 0.0
    obj.modifiers.new("Soft kit seams", "WEIGHTED_NORMAL")
    obj.hide_render = False
    obj.hide_viewport = False
    return obj


def add_bone_mesh(scene: bpy.types.Scene, rig: bpy.types.Object, name: str,
                  mesh: bpy.types.Mesh, bone: str, mat: bpy.types.Material) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    assign_material(obj, mat)
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(mesh.vertices))), 1.0, "REPLACE")
    arm = obj.modifiers.new("Athlete rig", "ARMATURE")
    arm.object = rig
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def make_ellipsoid(name: str, location: tuple[float, float, float],
                   scale: tuple[float, float, float], mat: bpy.types.Material,
                   rig: bpy.types.Object | None = None, bone: str | None = None,
                   rotation_z: float = 0.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler.z = rotation_z
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if rig and bone:
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        arm = obj.modifiers.new("Athlete rig", "ARMATURE")
        arm.object = rig
        obj.parent = rig
        obj.matrix_parent_inverse = rig.matrix_world.inverted()
    return obj


def bind_to_bone(obj: bpy.types.Object, rig: bpy.types.Object, bone: str) -> bpy.types.Object:
    world = obj.matrix_world.copy()
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    arm = obj.modifiers.new("Athlete rig", "ARMATURE")
    arm.object = rig
    obj.parent = rig
    obj.matrix_world = world
    return obj


def add_seam_curve(scene: bpy.types.Scene, rig: bpy.types.Object, name: str,
                   points: list[tuple[float, float, float]], radius: float,
                   mat: bpy.types.Material, bone: str = "spine_03") -> bpy.types.Object:
    curve = bpy.data.curves.new(name + " path", "CURVE")
    curve.dimensions = "3D"; curve.resolution_u = 2; curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY"); spline.points.add(len(points)-1)
    for point, co in zip(spline.points, points): point.co = (*co, 1.0)
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new(name, curve); scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object; assign_material(obj, mat)
    return bind_to_bone(obj, rig, bone)


def add_boot(scene: bpy.types.Scene, rig: bpy.types.Object, x: float,
             suffix: str, bone: str, upper: bpy.types.Material,
             sole_mat: bpy.types.Material, accent: bpy.types.Material) -> None:
    # Foot-shaped sole: narrow at heel, broad through the forefoot, rounded toe.
    outline = [(-.018,-.222),(.018,-.222),(.049,-.209),(.064,-.181),
               (.067,-.137),(.061,-.075),(.054,.015),(.047,.079),
               (.034,.112),(-.034,.112),(-.047,.079),(-.054,.015),
               (-.061,-.075),(-.067,-.137),(-.064,-.181),(-.049,-.209)]
    verts = [(x + dx, y, z) for z in (.004, .023) for dx, y in outline]
    count = len(outline)
    faces = [tuple(range(count-1, -1, -1)), tuple(range(count, count*2))]
    faces += [(i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count)]
    mesh = bpy.data.meshes.new("Anatomical football sole mesh")
    mesh.from_pydata(verts, [], faces); mesh.update()
    sole_obj = bpy.data.objects.new("Boot outsole " + suffix, mesh)
    scene.collection.objects.link(sole_obj)
    sole_obj.name = "Boot outsole " + suffix
    sole_bevel = sole_obj.modifiers.new("Rounded outsole edge", "BEVEL")
    sole_bevel.width = 0.006
    sole_bevel.segments = 4
    bpy.ops.object.modifier_apply(modifier=sole_bevel.name)
    assign_material(sole_obj, sole_mat)
    for polygon in sole_obj.data.polygons:
        polygon.use_smooth = True
    bind_to_bone(sole_obj, rig, bone)

    # Lofted upper follows the last of a real low-cut boot rather than a capsule.
    sections = [(-.219,.012,.044,.010),(-.202,.044,.052,.030),
                (-.169,.060,.061,.041),(-.120,.064,.067,.044),
                (-.055,.060,.068,.044),(.010,.051,.067,.041),
                (.065,.043,.064,.037),(.105,.031,.060,.031),
                (.116,.018,.058,.022)]
    ring_n = 20
    verts=[]
    for y, rx, zc, rz in sections:
        for i in range(ring_n):
            a=2*math.pi*i/ring_n
            verts.append((x+rx*math.cos(a),y,zc+rz*math.sin(a)))
    faces=[]
    for row in range(len(sections)-1):
        for i in range(ring_n):
            a=row*ring_n+i; b=row*ring_n+(i+1)%ring_n
            faces.append((a,b,b+ring_n,a+ring_n))
    faces.extend([tuple(range(ring_n-1,-1,-1)),
                  tuple(range((len(sections)-1)*ring_n,len(sections)*ring_n))])
    upper_mesh=bpy.data.meshes.new("Anatomical boot upper mesh")
    upper_mesh.from_pydata(verts,[],faces); upper_mesh.update()
    upper_obj=bpy.data.objects.new("Boot upper " + suffix, upper_mesh)
    scene.collection.objects.link(upper_obj)
    assign_material(upper_obj, upper)
    for polygon in upper_obj.data.polygons: polygon.use_smooth = True
    bind_to_bone(upper_obj, rig, bone)
    # Fine, restrained lace bars sit across the vamp and share the foot bone.
    for index, y in enumerate((-0.145, -0.112, -0.079, -0.046)):
        make_ellipsoid(f"Boot lace {suffix} {index + 1}",
                              (x, y, 0.105 - abs(y + 0.08) * 0.02),
                              (0.023, 0.003, 0.0016), accent, rig, bone,
                              rotation_z=(0.18 if index % 2 == 0 else -0.18))


def add_boot_details(scene: bpy.types.Scene, rig: bpy.types.Object, x: float,
                     bone: str, accent: bpy.types.Material,
                     outsole: bpy.types.Material) -> None:
    # Six low-profile molded studs per boot; included in the same weighted shoe mesh.
    bm = bmesh.new()
    for y in (-0.17, -0.105, -0.04, 0.04, 0.095):
        offsets = (0.045, -0.045) if y < 0.02 else (0.0,)
        for dx in offsets:
            cone = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False,
                                         segments=10, radius1=0.010,
                                         radius2=0.0065, depth=0.023)
            bmesh.ops.translate(bm, verts=cone["verts"],
                                vec=Vector((x + dx, y, -0.010)))
    mesh = bpy.data.meshes.new("Molded boot studs mesh")
    bm.to_mesh(mesh)
    bm.free()
    studs = add_bone_mesh(scene, rig, "Molded studs " + bone, mesh, bone, outsole)
    for poly in studs.data.polygons:
        poly.use_smooth = True
    # A slim inset side panel is blended into the upper; no floating toe overlays.
    make_ellipsoid("Boot lateral panel " + bone, (x + (0.052 if x > 0 else -0.052), -0.075, 0.064),
                   (0.003, 0.046, 0.012), accent, rig, bone)


def add_lod_collection(scene: bpy.types.Scene, source_objects: list[bpy.types.Object],
                       name: str, ratio: float) -> None:
    coll = bpy.data.collections.new(name)
    scene.collection.children.link(coll)
    for source in source_objects:
        if source.type != "MESH" or source.name.startswith("Collision"):
            continue
        dup = source.copy()
        dup.data = source.data.copy()
        dup.name = name + " - " + source.name
        coll.objects.link(dup)
        # Each runtime level remains independently poseable and carries the same skin weights.
        dec = dup.modifiers.new("LOD reduction", "DECIMATE")
        dec.ratio = ratio
        dec.use_collapse_triangulate = True
        dup.hide_render = True
        dup.hide_viewport = True
        dup.hide_set(True)


def limit_skin_weights(meshes: list[bpy.types.Object], bone_names: set[str]) -> None:
    """Enforce glTF's four-influence skinning limit and normalize each vertex."""
    for obj in meshes:
        groups = {group.index: group for group in obj.vertex_groups if group.name in bone_names}
        for vertex in obj.data.vertices:
            weights = []
            for membership in vertex.groups:
                group = groups.get(membership.group)
                if group and membership.weight > 1e-6:
                    weights.append((group, membership.weight))
            if not weights:
                continue
            weights.sort(key=lambda item: item[1], reverse=True)
            keep = weights[:4]
            total = sum(weight for _, weight in keep)
            for group, _ in weights:
                group.remove([vertex.index])
            for group, weight in keep:
                group.add([vertex.index], weight / total, "REPLACE")


def main() -> None:
    original_scene = bpy.context.window.scene
    scene = bpy.data.scenes.get(SCENE_NAME) or bpy.data.scenes.new(SCENE_NAME)
    bpy.context.window.scene = scene
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.MPFB_NH_scale_factor = "METER"
    scene.MPFB_NH_add_phenotype = True
    scene.MPFB_NH_phenotype_gender = "male"
    scene.MPFB_NH_phenotype_age = "young"
    scene.MPFB_NH_phenotype_muscle = "averagemuscle"
    scene.MPFB_NH_phenotype_race = "universal"
    bpy.ops.mpfb.create_human()
    body = bpy.context.object
    body.name = "Hero Body"
    body.data.name = "Hero Body LOD0"
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    scene.MPFB_ADR_standard_rig = "game_engine"
    scene.MPFB_ADR_import_weights = True
    bpy.ops.mpfb.add_standard_rig()
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    rig.name = "Hero Game Engine Rig"
    rig.data.name = "SoccerShooter Shared Athlete Skeleton"
    body.parent = rig
    body.name = "LOD0_HeroBody"
    # Use the CC0 modeled footwear from the bundled system assets instead of a
    # hand-built placeholder. Import before any body cleanup so its weight map
    # can resolve against the original MPFB vertex indices.
    HumanService.add_mhclo_asset(os.path.join(DATA, "clothes/shoes06/shoes06.mhclo"),
                                 body, asset_type="Clothes", subdiv_levels=0,
                                 material_type="MAKESKIN")
    footwear = next(o for o in scene.objects if o.name.endswith("shoes06"))
    footwear.name = "LOD0_Footwear"
    HumanService.add_mhclo_asset(os.path.join(DATA, "clothes/male_casualsuit04/male_casualsuit04.mhclo"),
                                 body, asset_type="Clothes", subdiv_levels=0,
                                 material_type="MAKESKIN")
    sport_suit = next(o for o in scene.objects if o.name.endswith("male_casualsuit04"))
    sport_suit.name = "MPFB_Jersey_Source"
    for modifier in list(body.modifiers):
        if modifier.type == "MASK" and modifier.name == "Delete.male_casualsuit04":
            body.modifiers.remove(modifier)

    # Use licensed bundled hair and brow assets, fitted and weighted by MPFB.
    HumanService.add_mhclo_asset(os.path.join(DATA, "hair/short02/short02.mhclo"),
                                 body, asset_type="Hair", subdiv_levels=0, material_type="MAKESKIN")
    hair = next(o for o in scene.objects if o.name.endswith("short02"))
    hair.name = "LOD0_Hair"
    HumanService.add_mhclo_asset(os.path.join(DATA, "eyebrows/eyebrow003/eyebrow003.mhclo"),
                                 body, asset_type="Eyebrows", subdiv_levels=0, material_type="MAKESKIN")
    brows = next(o for o in scene.objects if o.name.endswith("eyebrow003"))
    brows.name = "LOD0_Eyebrows"

    skin = material("Skin - warm neutral", (0.32, 0.19, 0.13, 1.0), 0.58, subsurface=0.055)
    jersey_color = (0.20, 0.006, 0.032, 1.0)
    jersey_mat = material("Kit - home garnet", jersey_color, 0.82)
    shorts_mat = material("Kit - deep navy", (0.022, 0.048, 0.095, 1.0), 0.82)
    socks_mat = material("Kit - ivory socks", (0.8, 0.82, 0.78, 1.0), 0.8)
    gold = material("Kit - muted gold", (0.42, 0.25, 0.07, 1.0), 0.78, metallic=0.02)
    hair_mat = material("Hair - deep espresso", (0.034, 0.022, 0.018, 1.0), 0.82)
    boot_mat = material("Boot - midnight teal", (0.004, 0.028, 0.040, 1.0), 0.52, metallic=0.01)
    boot_sole_mat = material("Boot - graphite sole", (0.012, 0.018, 0.024, 1.0), 0.68)
    eye_white = material("Eyes - soft ivory", (0.58, 0.48, 0.4, 1.0), 0.42)
    pupil = material("Eyes - dark", (0.025, 0.018, 0.016, 1.0), 0.32)
    assign_material(body, skin)
    assign_material(hair, hair_mat)
    assign_material(brows, hair_mat)

    # Hide the original bare toes and instep inside the authored boot volume.
    body_bm = bmesh.new(); body_bm.from_mesh(body.data)
    buried_foot_faces = []
    for face in body_bm.faces:
        c = face.calc_center_median()
        if 0.015 < c.z < 0.115 and 0.12 < abs(c.x) < 0.30 and -0.24 < c.y < 0.13:
            buried_foot_faces.append(face)
    if buried_foot_faces:
        bmesh.ops.delete(body_bm, geom=buried_foot_faces, context="FACES")
        loose = [v for v in body_bm.verts if not v.link_faces]
        if loose: bmesh.ops.delete(body_bm, geom=loose, context="VERTS")
    body_bm.to_mesh(body.data); body_bm.free(); body.data.update()

    # Keep the actual fitted short-sleeve tee mesh (with sewn sleeve and neck
    # edges) and trim away only the jeans from the bundled casual outfit.
    bm = bmesh.new(); bm.from_mesh(sport_suit.data)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                           plane_co=Vector((0,0,1.035)), plane_no=Vector((0,0,1)),
                           clear_inner=True, clear_outer=False, dist=0.00001)
    lower_faces = [f for f in bm.faces if f.calc_center_median().z < 1.035]
    if lower_faces: bmesh.ops.delete(bm, geom=lower_faces, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context="VERTS")
    boundary = [e for e in bm.edges if len(e.link_faces)==1]
    if boundary: bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bm.to_mesh(sport_suit.data); bm.free(); sport_suit.data.update()
    sport_suit.name = "LOD0_Jersey"
    assign_material(sport_suit, jersey_mat)
    sport_suit.modifiers.new("Jersey fabric thickness", "SOLIDIFY").thickness = 0.006
    sport_suit.modifiers.new("Jersey edge normals", "WEIGHTED_NORMAL")
    jersey = sport_suit
    shorts = shell_from_body(body, "LOD0_Shorts", shorts_mat, 0.715, 1.055, x_max=0.32)
    left_sock = shell_from_body(body, "LOD0_LeftSock", socks_mat, 0.105, 0.70,
                                side=-1, x_min=0.0, x_max=0.34)
    right_sock = shell_from_body(body, "LOD0_RightSock", socks_mat, 0.105, 0.70,
                                 side=1, x_min=0.0, x_max=0.34)
    for sock in (left_sock, right_sock):
        sock.modifiers.new("Calf compression", "SUBSURF").levels = 1

    jersey_image = texture_material(jersey_mat, JERSEY_ALBEDO, 0.12, 0.00055)
    boot_image = texture_material(boot_mat, BOOT_ALBEDO, 0.18, 0.0008)
    jersey_normal = make_tangent_normal(jersey_image,
        os.path.join(ROOT, "art/characters/textures/jersey-knit-normal.png"), 0.00075)
    boot_normal = make_tangent_normal(boot_image,
        os.path.join(ROOT, "art/characters/textures/boot-microfiber-normal.png"), 0.00035)
    jersey_albedo = make_tinted_albedo(jersey_image,
        os.path.join(ROOT, "art/characters/textures/jersey-knit-garnet.png"), jersey_color[:3], 0.26)
    boot_albedo = make_tinted_albedo(boot_image,
        os.path.join(ROOT, "art/characters/textures/boot-microfiber-teal.png"), (0.004,0.028,0.040), 0.18)
    apply_normal_map(jersey_mat, jersey_normal, "Jersey knit normal", 0.14, jersey_albedo)
    apply_normal_map(boot_mat, boot_normal, "Boot microfiber normal", 0.12, boot_albedo)

    shorts_color = (0.022, 0.048, 0.095)
    shorts_albedo = make_tinted_albedo(jersey_image,
        os.path.join(ROOT, "art/characters/textures/shorts-poly-knit-navy.png"), shorts_color, 0.07)
    shorts_normal = make_tangent_normal(jersey_image,
        os.path.join(ROOT, "art/characters/textures/shorts-poly-knit-normal.png"), 0.00025)
    apply_normal_map(shorts_mat, shorts_normal, "Shorts poly-knit normal", 0.08, shorts_albedo)
    # Keep the game sock cloth clean and ivory; the garnet jersey weave has
    # larger color variation that reads as speckling when stretched on calves.

    # Reuse the CC0 shoes06 mesh and UV layout, recoloring just its blue panels
    # to the home palette while retaining its laces, white overlays, and detail.
    shoe_source = bpy.data.images.get("shoes06_diffuse.png")
    if shoe_source is None:
        raise RuntimeError("Bundled CC0 shoes06 diffuse texture was not loaded")
    shoe_albedo = make_teal_cleat_albedo(shoe_source,
        os.path.join(ROOT, "art/characters/textures/cleat-home-teal.png"))
    shoe_mat = material("Cleat - home teal CC0 source", (0.018, 0.22, 0.25, 1.0), 0.44)
    shoe_nodes = shoe_mat.node_tree.nodes
    shoe_shader = next(n for n in shoe_nodes if n.type == "BSDF_PRINCIPLED")
    shoe_tex = shoe_nodes.new("ShaderNodeTexImage"); shoe_tex.image = shoe_albedo
    shoe_tex.interpolation = "Linear"; shoe_tex.location = (-320, 120)
    shoe_uv = shoe_nodes.new("ShaderNodeTexCoord")
    shoe_mat.node_tree.links.new(shoe_uv.outputs["UV"], shoe_tex.inputs["Vector"])
    shoe_mat.node_tree.links.new(shoe_tex.outputs["Color"], shoe_shader.inputs["Base Color"])
    assign_material(footwear, shoe_mat)

    for sign, label, bone in ((-1, "R", "foot_r"), (1, "L", "foot_l")):
        # Eyeballs stay subtle at gameplay distance but prevent the blank-mask look.
        eye_x = sign * 0.042
        make_ellipsoid(f"Eye {label}", (eye_x, -0.138, 1.625), (0.012, 0.0055, 0.007), eye_white, rig, "head")
        make_ellipsoid(f"Pupil {label}", (eye_x, -0.1435, 1.625), (0.0042, 0.0025, 0.0048), pupil, rig, "head")

    # Small embroidered chest mark and stitched number, kept on the garment.
    bpy.ops.object.text_add(location=(0.15, -0.211, 1.32), rotation=(math.pi / 2, 0, 0))
    number = bpy.context.object
    number.name = "Home kit chest number"
    number.data.body = "8"
    number.data.size = 0.105
    number.data.extrude = 0.0005
    number.data.bevel_depth = 0.0003
    number.data.bevel_resolution = 1
    assign_material(number, gold)
    bpy.ops.object.convert(target="MESH")
    number = bpy.context.object
    group = number.vertex_groups.new(name="spine_03")
    group.add(list(range(len(number.data.vertices))), 1.0, "REPLACE")
    number_arm = number.modifiers.new("Athlete rig", "ARMATURE")
    number_arm.object = rig
    number.parent = rig
    number.matrix_parent_inverse = rig.matrix_world.inverted()

    # Bake detail to game-compatible tangent-space normal textures; the source
    # image files remain in the repo and are packed into the GLB.
    # Tangent normals are derived from the seamless source texture above. Baking
    # a same-mesh normal pass would only capture the base mesh and create a flat map.

    # Hide the supplemental eyes' source shells under the animated footballer; all mesh objects
    # are rooted to one armature, with a collision capsule retained for runtime physics.
    coll_mesh = bpy.data.meshes.new("Hero Collision Capsule Mesh")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12,
                          radius1=0.21, radius2=0.18, depth=1.64)
    bm.to_mesh(coll_mesh)
    bm.free()
    collider = bpy.data.objects.new("Collision_HeroCapsule", coll_mesh)
    scene.collection.objects.link(collider)
    collider.location.z = 0.83
    collider.hide_render = True
    collider.hide_viewport = True
    collider.display_type = "WIRE"
    collider["runtime_role"] = "collision_capsule"

    hero_meshes = [o for o in scene.objects if o.type == "MESH" and o != collider]
    limit_skin_weights(hero_meshes, {bone.name for bone in rig.data.bones})
    add_lod_collection(scene, hero_meshes, "HERO_LOD1_8to12k", 0.34)
    add_lod_collection(scene, hero_meshes, "HERO_LOD2_3to5k", 0.14)
    scene["asset_id"] = "soccershooter.balanced_midfielder.hero"
    scene["asset_stage"] = 12
    scene["source_license"] = "MPFB human/system assets: CC0; kit/design: original"
    scene["forward_axis"] = "-Y in Blender source; glTF conversion handled by exporter"

    # Save source blend and export the complete tagged asset. Existing arena scene is untouched.
    os.makedirs(os.path.dirname(SOURCE_BLEND), exist_ok=True)
    os.makedirs(os.path.dirname(EXPORT_GLB), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=SOURCE_BLEND, copy=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj == collider or obj.name.startswith("HERO_LOD"):
            continue
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=EXPORT_GLB, export_format="GLB", export_apply=False,
                              export_animations=False, export_skins=True,
                              export_materials="EXPORT", export_texcoords=True,
                              export_normals=True, export_tangents=False,
                              export_cameras=False, export_lights=False,
                              export_extras=True, use_selection=True)
    print("HERO_ASSET_RESULT", SOURCE_BLEND, EXPORT_GLB,
          "objects", len(scene.objects), "meshes", len(hero_meshes),
          "rig_bones", len(rig.data.bones))
    bpy.context.window.scene = original_scene


main()
