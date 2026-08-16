use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use worker_contracts::{AssetIndexResult, IndexedDirectoryFile, IndexedModelArtifact};

pub fn index_assets(input: &Path) -> AssetIndexResult {
    let mut result = AssetIndexResult {
        input_path: normalize_path(input),
        indexed: false,
        artifact_count: 0,
        orphan_files: Vec::new(),
        artifacts: Vec::new(),
        warnings: Vec::new(),
    };

    if !input.exists() {
        result
            .warnings
            .push("Input directory does not exist.".to_owned());
        return result;
    }
    if !input.is_dir() {
        result
            .warnings
            .push("Input path is not a directory.".to_owned());
        return result;
    }

    result.indexed = true;
    let entries = match fs::read_dir(input) {
        Ok(entries) => entries,
        Err(error) => {
            result
                .warnings
                .push(format!("Failed to read input directory: {error}"));
            result.indexed = false;
            return result;
        }
    };

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        let file_name = path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default();
        if file_name.starts_with('.') {
            continue;
        }
        if path.is_file() {
            if let Some(file) = to_indexed_file(input, &path) {
                result.orphan_files.push(file);
            }
            continue;
        }
        if path.is_dir() {
            result.artifacts.push(index_artifact(input, &path));
        }
    }

    result
        .artifacts
        .sort_by(|left, right| right.id.cmp(&left.id));
    result
        .orphan_files
        .sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    result.artifact_count = result.artifacts.len();
    result
}

fn index_artifact(root: &Path, directory: &Path) -> IndexedModelArtifact {
    let id = directory
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "artifact".to_owned());
    let mut files = Vec::new();
    collect_files(root, directory, &mut files);
    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    let mut warnings = Vec::new();
    if files.is_empty() {
        warnings.push("Artifact directory does not contain any files.".to_owned());
    }

    let mut basename_counts = HashMap::<String, usize>::new();
    let mut top_level_file_count = 0usize;
    let mut nested_file_count = 0usize;
    let directory_path = normalize_relative_path(root, directory).unwrap_or_else(|| id.clone());
    for file in &files {
        let depth = file
            .relative_path
            .trim_start_matches(&directory_path)
            .trim_start_matches('/')
            .matches('/')
            .count();
        if depth == 0 {
            top_level_file_count += 1;
        } else {
            nested_file_count += 1;
        }
        let counter = basename_counts.entry(file.file_name.clone()).or_insert(0);
        *counter += 1;
    }
    for (file_name, count) in basename_counts {
        if count > 1 {
            warnings.push(format!(
                "Duplicate sidecar file name detected: {file_name} ({count} copies)."
            ));
        }
    }

    IndexedModelArtifact {
        id,
        directory_path,
        top_level_file_count,
        nested_file_count,
        files,
        warnings,
    }
}

fn collect_files(root: &Path, directory: &Path, files: &mut Vec<IndexedDirectoryFile>) {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        let file_name = path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default();
        if file_name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_files(root, &path, files);
            continue;
        }
        if let Some(file) = to_indexed_file(root, &path) {
            files.push(file);
        }
    }
}

fn to_indexed_file(root: &Path, path: &Path) -> Option<IndexedDirectoryFile> {
    let metadata = fs::metadata(path).ok()?;
    if !metadata.is_file() {
        return None;
    }
    Some(IndexedDirectoryFile {
        relative_path: normalize_relative_path(root, path)?,
        file_name: path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())?,
        size_bytes: metadata.len(),
    })
}

fn normalize_relative_path(root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    Some(relative.to_string_lossy().replace('\\', "/"))
}

fn normalize_path(input: &Path) -> String {
    input
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(input))
        .to_string_lossy()
        .to_string()
}
