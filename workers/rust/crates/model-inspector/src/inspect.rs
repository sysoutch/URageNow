use std::fs;
use std::path::Path;

use worker_contracts::{FileFact, ModelInspectionResult, ModelKind};

use crate::formats::{gltf_format, obj_format};

fn resolve_kind(extension: Option<&str>) -> ModelKind {
    match extension {
        Some("glb") => ModelKind::Glb,
        Some("gltf") => ModelKind::Gltf,
        Some("fbx") => ModelKind::Fbx,
        Some("obj") => ModelKind::Obj,
        Some("blend") => ModelKind::Blend,
        Some(_) | None => ModelKind::Unknown,
    }
}

pub fn inspect_model(input: &str) -> ModelInspectionResult {
    let path = Path::new(input);
    let metadata = fs::metadata(path).ok();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::to_owned);
    let kind = resolve_kind(extension.as_deref());
    let mut warnings = Vec::new();
    let mut inspected = false;
    let mut parser = None;
    let mut stats = None;

    if !path.exists() {
        warnings.push("Input file does not exist.".to_owned());
    } else if !path.is_file() {
        warnings.push("Input path is not a file.".to_owned());
    } else {
        match kind {
            ModelKind::Glb | ModelKind::Gltf => {
                parser = Some("gltf".to_owned());
                match gltf_format::inspect(path) {
                    Ok(result) => {
                        inspected = true;
                        if result.geometry.face_count == 0 {
                            warnings.push("Model has zero detected faces.".to_owned());
                        }
                        if result.geometry.vertex_count == 0 {
                            warnings.push("Model has zero detected vertices.".to_owned());
                        }
                        if result.geometry.uv_channel_count == 0 {
                            warnings.push("Model has no detected UV channels.".to_owned());
                        }
                        if result.resources.material_count == 0 {
                            warnings.push("Model has no detected materials.".to_owned());
                        }
                        if result.resources.texture_count == 0 {
                            warnings.push("Model has no detected textures.".to_owned());
                        }
                        stats = Some(result);
                    }
                    Err(error) => warnings.push(error),
                }
            }
            ModelKind::Obj => {
                parser = Some("obj".to_owned());
                match obj_format::inspect(path) {
                    Ok(result) => {
                        inspected = true;
                        if result.geometry.face_count == 0 {
                            warnings.push("Model has zero detected faces.".to_owned());
                        }
                        if result.geometry.vertex_count == 0 {
                            warnings.push("Model has zero detected vertices.".to_owned());
                        }
                        if result.geometry.uv_channel_count == 0 {
                            warnings.push("Model has no detected UV channels.".to_owned());
                        }
                        if result.resources.material_count == 0 {
                            warnings.push("Model has no detected materials.".to_owned());
                        }
                        if result.resources.texture_count == 0 {
                            warnings.push("Model has no detected textures.".to_owned());
                        }
                        stats = Some(result);
                    }
                    Err(error) => warnings.push(error),
                }
            }
            ModelKind::Fbx => {
                warnings.push("FBX deep inspection is not implemented yet.".to_owned())
            }
            ModelKind::Blend => {
                warnings.push("Blend deep inspection is not implemented yet.".to_owned())
            }
            ModelKind::Unknown => warnings.push("Unrecognized model extension.".to_owned()),
        }
    }

    ModelInspectionResult {
        input_path: input.to_owned(),
        file: FileFact {
            exists: path.exists(),
            extension,
            file_name,
            size_bytes: metadata.map(|value| value.len()),
        },
        kind,
        inspected,
        parser,
        stats,
        warnings,
    }
}
