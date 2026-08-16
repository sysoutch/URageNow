use anyhow::{bail, Context, Result};
use clap::{Parser, ValueEnum};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Clone, Copy, Debug, ValueEnum)]
enum ApplicationId {
    #[value(name = "bambu-studio")]
    BambuStudio,
    #[value(name = "blender")]
    Blender,
}

impl ApplicationId {
    fn as_str(&self) -> &'static str {
        match self {
            Self::BambuStudio => "bambu-studio",
            Self::Blender => "blender",
        }
    }
}

#[derive(Debug, Parser)]
struct Args {
    #[arg(long)]
    application_id: ApplicationId,
    #[arg(long)]
    executable: PathBuf,
    #[arg(long)]
    working_directory: Option<PathBuf>,
    #[arg(long = "argument")]
    arguments: Vec<String>,
    #[arg(long, default_value_t = false)]
    detached: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchResult {
    launched: bool,
    pid: u32,
    application_id: String,
}

fn executable_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn validate_application(args: &Args) -> Result<()> {
    let executable_name = executable_name(&args.executable);
    let allowed = match args.application_id {
        ApplicationId::BambuStudio => {
            matches!(
                executable_name.as_str(),
                "bambu-studio.exe"
                    | "bambustudio.exe"
                    | "bambu-studio"
                    | "bambustudio"
                    | "flatpak"
                    | "open"
            ) || (executable_name.ends_with(".appimage") && executable_name.contains("bambu"))
        }
        ApplicationId::Blender => matches!(executable_name.as_str(), "blender.exe" | "blender"),
    };
    if !allowed {
        bail!("Application executable is not allowlisted.");
    }
    if args
        .arguments
        .iter()
        .any(|argument| argument.contains('\0'))
    {
        bail!("Application arguments must not contain NUL bytes.");
    }
    if matches!(args.application_id, ApplicationId::Blender)
        && !args.arguments.iter().any(|argument| argument == "--python")
    {
        bail!("Blender launches must use the URage Python import entrypoint.");
    }
    if matches!(args.application_id, ApplicationId::BambuStudio) {
        let model_path = args
            .arguments
            .last()
            .map(PathBuf::from)
            .context("Bambu Studio requires one model path.")?;
        let extension = model_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !matches!(
            extension.as_str(),
            "3mf" | "amf" | "fbx" | "glb" | "gltf" | "obj" | "step" | "stl" | "stp"
        ) {
            bail!("Bambu Studio model extension is not allowlisted.");
        }
        if !model_path.is_file() {
            bail!("Bambu Studio model path does not exist.");
        }
    }
    if matches!(args.application_id, ApplicationId::Blender) {
        let python_index = args
            .arguments
            .iter()
            .position(|argument| argument == "--python")
            .context("Blender Python entrypoint is missing.")?;
        let script_path = args
            .arguments
            .get(python_index + 1)
            .map(PathBuf::from)
            .context("Blender Python script path is missing.")?;
        if !script_path.is_file() {
            bail!("Blender Python script path does not exist.");
        }
        let asset_argument = args.arguments.iter().find_map(|argument| {
            argument
                .strip_prefix("--filepath=")
                .or_else(|| argument.strip_prefix("--filelist="))
        });
        let asset_path = asset_argument
            .map(PathBuf::from)
            .context("Blender launch requires an explicit URage filepath or file-list argument.")?;
        if !asset_path.is_file() {
            bail!("Blender asset or file-list path does not exist.");
        }
    }
    Ok(())
}

fn main() -> Result<()> {
    let args = Args::parse();
    validate_application(&args)?;
    if args.executable.is_absolute() && !args.executable.exists() {
        bail!("Application executable does not exist.");
    }
    if let Some(working_directory) = &args.working_directory {
        if !working_directory.is_dir() {
            bail!("Application working directory does not exist.");
        }
    }
    let mut command = Command::new(&args.executable);
    command
        .args(&args.arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(working_directory) = &args.working_directory {
        command.current_dir(working_directory);
    }
    #[cfg(windows)]
    if args.detached {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x00000008 | 0x00000200);
    }
    let child = command.spawn().with_context(|| {
        format!(
            "Failed to launch {} through the native broker.",
            args.application_id.as_str()
        )
    })?;
    println!(
        "{}",
        serde_json::to_string(&LaunchResult {
            launched: true,
            pid: child.id(),
            application_id: args.application_id.as_str().to_string(),
        })?
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(application_id: ApplicationId, executable: &str, arguments: Vec<String>) -> Args {
        Args {
            application_id,
            executable: PathBuf::from(executable),
            working_directory: None,
            arguments,
            detached: false,
        }
    }

    #[test]
    fn rejects_unknown_application() {
        assert!(ApplicationId::from_str("terminal", true).is_err());
    }

    #[test]
    fn rejects_arbitrary_blender_arguments() {
        let input = args(
            ApplicationId::Blender,
            "blender.exe",
            vec!["--background".to_string()],
        );
        assert!(validate_application(&input).is_err());
    }

    #[test]
    fn accepts_bambu_appimage_name_before_path_validation() {
        let input = args(
            ApplicationId::BambuStudio,
            "/opt/Bambu_Studio.AppImage",
            vec!["missing.stl".to_string()],
        );
        let error = validate_application(&input).unwrap_err().to_string();
        assert_eq!(error, "Bambu Studio model path does not exist.");
    }
}
