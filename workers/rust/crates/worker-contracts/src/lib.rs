use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFact {
    pub exists: bool,
    pub extension: Option<String>,
    pub file_name: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Vector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds3 {
    pub min: Vector3,
    pub max: Vector3,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeometryStats {
    pub mesh_count: usize,
    pub primitive_count: usize,
    pub vertex_count: usize,
    pub face_count: usize,
    pub normal_count: usize,
    pub uv_channel_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceStats {
    pub scene_count: usize,
    pub node_count: usize,
    pub material_count: usize,
    pub texture_count: usize,
    pub animation_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialTextureSlots {
    pub base_color: Option<String>,
    pub normal: Option<String>,
    pub metallic_roughness: Option<String>,
    pub emissive: Option<String>,
    pub occlusion: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialFact {
    pub name: Option<String>,
    pub alpha_mode: Option<String>,
    pub double_sided: Option<bool>,
    pub texture_slots: MaterialTextureSlots,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextureFact {
    pub name: Option<String>,
    pub reference: Option<String>,
    pub mime_type: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub usage_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectionStats {
    pub geometry: GeometryStats,
    pub resources: ResourceStats,
    pub bounds: Option<Bounds3>,
    pub materials: Vec<MaterialFact>,
    pub textures: Vec<TextureFact>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInspectionResult {
    pub input_path: String,
    pub file: FileFact,
    pub kind: ModelKind,
    pub inspected: bool,
    pub parser: Option<String>,
    pub stats: Option<InspectionStats>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ModelKind {
    Glb,
    Gltf,
    Fbx,
    Obj,
    Blend,
    Unknown,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ValidationSeverity {
    Warning,
    Error,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationIssue {
    pub severity: ValidationSeverity,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetValidationResult {
    pub input_path: String,
    pub valid: bool,
    pub issues: Vec<ValidationIssue>,
    pub inspection: ModelInspectionResult,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageProbe {
    pub width: u32,
    pub height: u32,
    pub color_type: String,
    pub has_alpha: bool,
    pub animated: bool,
    pub frame_count: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioProbe {
    pub codec: String,
    pub duration_seconds: Option<f64>,
    pub channel_count: Option<u16>,
    pub sample_rate_hz: Option<u32>,
    pub bits_per_sample: Option<u16>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoProbe {
    pub codec: String,
    pub container: String,
    pub duration_seconds: Option<f64>,
    pub track_count: Option<u32>,
    pub frame_count: Option<u64>,
    pub average_frame_rate: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbeResult {
    pub input_path: String,
    pub file: FileFact,
    pub kind: MediaKind,
    pub probed: bool,
    pub parser: Option<String>,
    pub image: Option<ImageProbe>,
    pub audio: Option<AudioProbe>,
    pub video: Option<VideoProbe>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MediaKind {
    Image,
    Audio,
    Video,
    Model3d,
    Unknown,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedDirectoryFile {
    pub relative_path: String,
    pub file_name: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedModelArtifact {
    pub id: String,
    pub directory_path: String,
    pub top_level_file_count: usize,
    pub nested_file_count: usize,
    pub files: Vec<IndexedDirectoryFile>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndexResult {
    pub input_path: String,
    pub indexed: bool,
    pub artifact_count: usize,
    pub orphan_files: Vec<IndexedDirectoryFile>,
    pub artifacts: Vec<IndexedModelArtifact>,
    pub warnings: Vec<String>,
}
