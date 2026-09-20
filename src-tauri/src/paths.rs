use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn is_repo_root(path: &Path) -> bool {
    path.join("package.json").is_file()
        && path.join("runtime").join("dashboardRuntime.ts").is_file()
}

fn find_repo_root(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .find(|path| is_repo_root(path))
        .map(Path::to_path_buf)
}

pub(crate) fn resolve_repo_root() -> Result<PathBuf, String> {
    if let Ok(repo_root) = std::env::var("URAGE_STUDIO_REPO_ROOT") {
        let explicit_root = PathBuf::from(repo_root.trim());
        if is_repo_root(&explicit_root) {
            return Ok(explicit_root);
        }
    }

    std::env::current_dir()
        .ok()
        .and_then(|path| find_repo_root(&path))
        .or_else(|| {
            std::env::current_exe()
                .ok()
                .and_then(|path| path.parent().and_then(find_repo_root))
        })
        .ok_or_else(|| "Could not locate the URage NOW development checkout.".to_string())
}

pub(crate) fn find_packaged_sidecar(app: &AppHandle) -> Option<PathBuf> {
    let executable_name = if cfg!(windows) {
        "urage-dashboard-runtime.exe"
    } else {
        "urage-dashboard-runtime"
    };

    let executable_directory = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));
    let resource_directory = app.path().resource_dir().ok();

    executable_directory
        .into_iter()
        .chain(resource_directory)
        .map(|directory| directory.join(executable_name))
        .find(|candidate| candidate.is_file())
}

pub(crate) fn find_packaged_native_application_broker(app: &AppHandle) -> Option<PathBuf> {
    let executable_name = if cfg!(windows) {
        "urage-native-application-broker.exe"
    } else {
        "urage-native-application-broker"
    };

    let executable_directory = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));
    let resource_directory = app.path().resource_dir().ok();

    executable_directory
        .into_iter()
        .chain(resource_directory)
        .map(|directory| directory.join(executable_name))
        .find(|candidate| candidate.is_file())
}
