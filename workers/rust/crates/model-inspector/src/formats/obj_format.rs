use std::collections::HashSet;
use std::path::Path;

use worker_contracts::{
    GeometryStats, InspectionStats, MaterialFact, MaterialTextureSlots, ResourceStats, TextureFact,
};

use crate::formats::shared::expand_bounds;

fn push_texture(textures: &mut HashSet<String>, value: &Option<String>) {
    if let Some(entry) = value
        .as_ref()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
    {
        textures.insert(entry.to_owned());
    }
}

fn normalize_optional_string(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(str::to_owned)
}

pub fn inspect(path: &Path) -> Result<InspectionStats, String> {
    let options = tobj::LoadOptions {
        triangulate: true,
        single_index: true,
        ..Default::default()
    };
    let loaded =
        tobj::load_obj(path, &options).map_err(|error| format!("Failed to parse OBJ: {error}"))?;
    let models = loaded.0;
    let materials = loaded.1.unwrap_or_default();

    let mut primitive_count = 0usize;
    let mut vertex_count = 0usize;
    let mut face_count = 0usize;
    let mut normal_count = 0usize;
    let mut uv_channel_count = 0usize;
    let mut bounds = None;

    for model in &models {
        primitive_count += 1;
        vertex_count += model.mesh.positions.len() / 3;
        face_count += model.mesh.indices.len() / 3;
        normal_count += model.mesh.normals.len() / 3;
        if uv_channel_count == 0 && !model.mesh.texcoords.is_empty() {
            uv_channel_count = 1;
        }
        for position in model.mesh.positions.chunks_exact(3) {
            expand_bounds(&mut bounds, position[0], position[1], position[2]);
        }
    }

    let mut texture_references = HashSet::new();
    let materials = materials
        .iter()
        .map(|material| {
            push_texture(&mut texture_references, &material.diffuse_texture);
            push_texture(&mut texture_references, &material.normal_texture);
            push_texture(&mut texture_references, &material.ambient_texture);
            push_texture(&mut texture_references, &material.specular_texture);
            push_texture(&mut texture_references, &material.shininess_texture);
            push_texture(&mut texture_references, &material.dissolve_texture);
            MaterialFact {
                name: if material.name.trim().is_empty() {
                    None
                } else {
                    Some(material.name.trim().to_owned())
                },
                alpha_mode: None,
                double_sided: None,
                texture_slots: MaterialTextureSlots {
                    base_color: normalize_optional_string(&material.diffuse_texture),
                    normal: normalize_optional_string(&material.normal_texture),
                    metallic_roughness: normalize_optional_string(&material.specular_texture),
                    emissive: normalize_optional_string(&material.ambient_texture),
                    occlusion: normalize_optional_string(&material.shininess_texture),
                },
            }
        })
        .collect::<Vec<_>>();

    let textures = texture_references
        .iter()
        .map(|reference| {
            let usage_count = materials
                .iter()
                .filter(|material| {
                    [
                        material.texture_slots.base_color.as_ref(),
                        material.texture_slots.normal.as_ref(),
                        material.texture_slots.metallic_roughness.as_ref(),
                        material.texture_slots.emissive.as_ref(),
                        material.texture_slots.occlusion.as_ref(),
                    ]
                    .into_iter()
                    .flatten()
                    .any(|value| value == reference)
                })
                .count();
            TextureFact {
                name: None,
                reference: Some(reference.clone()),
                mime_type: None,
                width: None,
                height: None,
                usage_count,
            }
        })
        .collect::<Vec<_>>();

    Ok(InspectionStats {
        geometry: GeometryStats {
            mesh_count: models.len(),
            primitive_count,
            vertex_count,
            face_count,
            normal_count,
            uv_channel_count,
        },
        resources: ResourceStats {
            scene_count: if models.is_empty() { 0 } else { 1 },
            node_count: models.len(),
            material_count: materials.len(),
            texture_count: textures.len(),
            animation_count: 0,
        },
        bounds,
        materials,
        textures,
    })
}
