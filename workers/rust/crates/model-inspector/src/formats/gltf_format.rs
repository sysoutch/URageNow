use std::path::Path;

use worker_contracts::{
    GeometryStats, InspectionStats, MaterialFact, MaterialTextureSlots, ResourceStats, TextureFact,
};

use crate::formats::shared::expand_bounds;

fn normalize_name(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn texture_reference_label(texture: &gltf::Texture<'_>) -> Option<String> {
    let image = texture.source();
    let source_name = normalize_name(image.name());
    let uri = match image.source() {
        gltf::image::Source::Uri { uri, .. } => {
            Some(uri.trim().to_owned()).filter(|value| !value.is_empty())
        }
        gltf::image::Source::View { .. } => None,
    };
    source_name
        .or(uri)
        .or_else(|| Some(format!("texture-{}", texture.index())))
}

fn image_reference_label(image: &gltf::Image<'_>) -> Option<String> {
    normalize_name(image.name()).or_else(|| match image.source() {
        gltf::image::Source::Uri { uri, .. } => {
            Some(uri.trim().to_owned()).filter(|value| !value.is_empty())
        }
        gltf::image::Source::View { .. } => Some(format!("embedded-image-{}", image.index())),
    })
}

pub fn inspect(path: &Path) -> Result<InspectionStats, String> {
    let imported =
        gltf::import(path).map_err(|error| format!("Failed to parse glTF/GLB: {error}"))?;
    let document = imported.0;
    let buffers = imported.1;
    let images = imported.2;

    let mut mesh_count = 0usize;
    let mut primitive_count = 0usize;
    let mut vertex_count = 0usize;
    let mut face_count = 0usize;
    let mut normal_count = 0usize;
    let mut bounds = None;
    let mut uv_channel_flags = [false; 8];

    for mesh in document.meshes() {
        mesh_count += 1;
        for primitive in mesh.primitives() {
            primitive_count += 1;
            let reader = primitive
                .reader(|buffer| buffers.get(buffer.index()).map(|data| data.0.as_slice()));
            if let Some(positions) = reader.read_positions() {
                let mut local_vertex_count = 0usize;
                for [x, y, z] in positions {
                    local_vertex_count += 1;
                    expand_bounds(&mut bounds, x, y, z);
                }
                vertex_count += local_vertex_count;
            }
            if let Some(normals) = reader.read_normals() {
                normal_count += normals.count();
            }
            for (channel_index, flag) in uv_channel_flags.iter_mut().enumerate() {
                if reader.read_tex_coords(channel_index as u32).is_some() {
                    *flag = true;
                }
            }
            if let Some(indices) = reader.read_indices() {
                face_count += indices.into_u32().count() / 3;
            }
        }
    }

    let mut texture_usage_counts = vec![0usize; document.textures().len()];
    let materials = document
        .materials()
        .map(|material| {
            let pbr = material.pbr_metallic_roughness();
            let base_color_texture = pbr
                .base_color_texture()
                .map(|info| info.texture())
                .map(|texture| (texture.index(), texture_reference_label(&texture)));
            let metallic_roughness_texture = pbr
                .metallic_roughness_texture()
                .map(|info| info.texture())
                .map(|texture| (texture.index(), texture_reference_label(&texture)));
            let normal_texture = material
                .normal_texture()
                .map(|info| info.texture())
                .map(|texture| (texture.index(), texture_reference_label(&texture)));
            let emissive_texture = material
                .emissive_texture()
                .map(|info| info.texture())
                .map(|texture| (texture.index(), texture_reference_label(&texture)));
            let occlusion_texture = material
                .occlusion_texture()
                .map(|info| info.texture())
                .map(|texture| (texture.index(), texture_reference_label(&texture)));
            for texture_index in [
                base_color_texture.as_ref().map(|value| value.0),
                metallic_roughness_texture.as_ref().map(|value| value.0),
                normal_texture.as_ref().map(|value| value.0),
                emissive_texture.as_ref().map(|value| value.0),
                occlusion_texture.as_ref().map(|value| value.0),
            ]
            .into_iter()
            .flatten()
            {
                if let Some(count) = texture_usage_counts.get_mut(texture_index) {
                    *count += 1;
                }
            }
            MaterialFact {
                name: normalize_name(material.name()),
                alpha_mode: Some(
                    match material.alpha_mode() {
                        gltf::material::AlphaMode::Opaque => "opaque",
                        gltf::material::AlphaMode::Mask => "mask",
                        gltf::material::AlphaMode::Blend => "blend",
                    }
                    .to_owned(),
                ),
                double_sided: Some(material.double_sided()),
                texture_slots: MaterialTextureSlots {
                    base_color: base_color_texture.and_then(|value| value.1),
                    normal: normal_texture.and_then(|value| value.1),
                    metallic_roughness: metallic_roughness_texture.and_then(|value| value.1),
                    emissive: emissive_texture.and_then(|value| value.1),
                    occlusion: occlusion_texture.and_then(|value| value.1),
                },
            }
        })
        .collect::<Vec<_>>();

    let textures = document
        .textures()
        .map(|texture| {
            let image = texture.source();
            let image_data = images.get(image.index());
            TextureFact {
                name: normalize_name(texture.name()).or_else(|| normalize_name(image.name())),
                reference: image_reference_label(&image),
                mime_type: match image.source() {
                    gltf::image::Source::Uri { mime_type, .. } => mime_type.map(str::to_owned),
                    gltf::image::Source::View { mime_type, .. } => Some(mime_type.to_owned()),
                },
                width: image_data.map(|data| data.width),
                height: image_data.map(|data| data.height),
                usage_count: texture_usage_counts
                    .get(texture.index())
                    .copied()
                    .unwrap_or(0),
            }
        })
        .collect::<Vec<_>>();

    Ok(InspectionStats {
        geometry: GeometryStats {
            mesh_count,
            primitive_count,
            vertex_count,
            face_count,
            normal_count,
            uv_channel_count: uv_channel_flags.into_iter().filter(|flag| *flag).count(),
        },
        resources: ResourceStats {
            scene_count: document.scenes().count(),
            node_count: document.nodes().count(),
            material_count: document.materials().count(),
            texture_count: document.textures().count(),
            animation_count: document.animations().count(),
        },
        bounds,
        materials,
        textures,
    })
}
