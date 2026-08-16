use model_inspector::inspect_model;
use worker_contracts::{
    AssetValidationResult, ModelInspectionResult, ValidationIssue, ValidationSeverity,
};

fn push_issue(
    issues: &mut Vec<ValidationIssue>,
    severity: ValidationSeverity,
    code: &str,
    message: impl Into<String>,
) {
    issues.push(ValidationIssue {
        severity,
        code: code.to_owned(),
        message: message.into(),
    });
}

fn forward_inspection_warnings(
    issues: &mut Vec<ValidationIssue>,
    inspection: &ModelInspectionResult,
) {
    for warning in &inspection.warnings {
        push_issue(
            issues,
            ValidationSeverity::Warning,
            "inspection_warning",
            warning.clone(),
        );
    }
}

pub fn validate_asset(input: &str) -> AssetValidationResult {
    let inspection = inspect_model(input);
    let mut issues = Vec::new();

    if !inspection.file.exists {
        push_issue(
            &mut issues,
            ValidationSeverity::Error,
            "file_missing",
            "Input file does not exist.",
        );
    }
    if !inspection.inspected {
        push_issue(
            &mut issues,
            ValidationSeverity::Error,
            "inspection_failed",
            "Asset could not be deeply inspected by a supported parser.",
        );
    }

    if let Some(stats) = &inspection.stats {
        if stats.geometry.vertex_count == 0 {
            push_issue(
                &mut issues,
                ValidationSeverity::Error,
                "empty_vertices",
                "Asset contains zero detected vertices.",
            );
        }
        if stats.geometry.face_count == 0 {
            push_issue(
                &mut issues,
                ValidationSeverity::Error,
                "empty_faces",
                "Asset contains zero detected faces.",
            );
        }
        if stats.geometry.uv_channel_count == 0 {
            push_issue(
                &mut issues,
                ValidationSeverity::Warning,
                "missing_uv",
                "Asset has no detected UV channels.",
            );
        }
        if stats.resources.material_count == 0 {
            push_issue(
                &mut issues,
                ValidationSeverity::Warning,
                "missing_materials",
                "Asset has no detected materials.",
            );
        }
        if stats.resources.texture_count == 0 {
            push_issue(
                &mut issues,
                ValidationSeverity::Warning,
                "missing_textures",
                "Asset has no detected textures.",
            );
        }
        if stats.bounds.is_none() {
            push_issue(
                &mut issues,
                ValidationSeverity::Warning,
                "missing_bounds",
                "Asset bounds could not be resolved.",
            );
        }
        if stats.geometry.face_count > 100_000 {
            push_issue(
                &mut issues,
                ValidationSeverity::Warning,
                "heavy_mesh",
                format!(
                    "Asset has a high face count ({}).",
                    stats.geometry.face_count
                ),
            );
        }
        for texture in &stats.textures {
            let Some(max_dimension) = texture.width.into_iter().chain(texture.height).max() else {
                continue;
            };
            if max_dimension > 4096 {
                let label = texture
                    .name
                    .as_deref()
                    .or(texture.reference.as_deref())
                    .unwrap_or("Unnamed texture");
                push_issue(
                    &mut issues,
                    ValidationSeverity::Warning,
                    "oversized_texture",
                    format!("{label} exceeds 4096px on at least one dimension."),
                );
            }
        }
    }

    forward_inspection_warnings(&mut issues, &inspection);
    let valid = !issues
        .iter()
        .any(|issue| issue.severity == ValidationSeverity::Error);

    AssetValidationResult {
        input_path: input.to_owned(),
        valid,
        issues,
        inspection,
    }
}
