use std::fs::OpenOptions;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

use crate::paths::{
    find_packaged_native_application_broker, find_packaged_sidecar, resolve_repo_root,
};
use crate::window::{navigate_to_dashboard, show_startup_error};

const DASHBOARD_HOST: &str = "127.0.0.1";
const DASHBOARD_PORT: u16 = 4782;
const DASHBOARD_READY_TIMEOUT: Duration = Duration::from_secs(30);
const DASHBOARD_READY_POLL: Duration = Duration::from_millis(250);

pub(crate) struct DashboardRuntimeState {
    pub(crate) child: Mutex<Option<Child>>,
    pub(crate) log_path: PathBuf,
}

pub(crate) fn should_autostart_dashboard_runtime() -> bool {
    if let Ok(value) = std::env::var("URAGE_STUDIO_AUTOSTART_DASHBOARD") {
        return !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "0" | "false" | "no" | "off"
        );
    }

    !cfg!(dev)
}

fn runtime_log_streams(log_path: &Path) -> Result<(Stdio, Stdio), String> {
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create the desktop log directory: {error}"))?;
    }

    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|error| format!("Could not open the dashboard runtime log: {error}"))?;

    let error_log = log
        .try_clone()
        .map_err(|error| format!("Could not clone the dashboard runtime log: {error}"))?;

    Ok((Stdio::from(log), Stdio::from(error_log)))
}

fn spawn_packaged_runtime(
    app: &AppHandle,
    sidecar: PathBuf,
    log_path: &Path,
) -> Result<Child, String> {
    let resource_root = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not resolve packaged resources: {error}"))?;
    let runtime_root = resource_root.join("runtime-bundle");
    let entrypoint = runtime_root.join("runtime").join("dashboardRuntime.ts");

    if !entrypoint.is_file() {
        return Err(format!(
            "The packaged dashboard entrypoint is missing at {}.",
            entrypoint.display()
        ));
    }

    let data_root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve the application data directory: {error}"))?
        .join("data");

    std::fs::create_dir_all(&data_root)
        .map_err(|error| format!("Could not create the application data directory: {error}"))?;

    let (stdout, stderr) = runtime_log_streams(log_path)?;
    let mut command = Command::new(sidecar);

    command
        .args(["--import", "tsx", "runtime/dashboardRuntime.ts"])
        .current_dir(runtime_root)
        .env("DASHBOARD_DATA_DIR", data_root)
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr);

    if let Some(broker_path) = find_packaged_native_application_broker(app) {
        command.env("URAGE_NATIVE_APPLICATION_BROKER_PATH", broker_path);
    }

    command
        .spawn()
        .map_err(|error| format!("Failed to start the packaged dashboard runtime: {error}"))
}

fn spawn_development_runtime(log_path: &Path) -> Result<Child, String> {
    let repo_root = resolve_repo_root()?;
    let (stdout, stderr) = runtime_log_streams(log_path)?;

    let mut command = if cfg!(windows) {
        let mut command = Command::new("npm.cmd");
        command.args(["run", "start:dashboard:local"]);
        command
    } else {
        let mut command = Command::new("npm");
        command.args(["run", "start:dashboard:local"]);
        command
    };

    command
        .current_dir(repo_root)
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|error| format!("Failed to start the development dashboard runtime: {error}"))
}

fn spawn_dashboard_runtime(app: &AppHandle, log_path: &Path) -> Result<Child, String> {
    match find_packaged_sidecar(app) {
        Some(sidecar) => spawn_packaged_runtime(app, sidecar, log_path),
        None if cfg!(dev) => spawn_development_runtime(log_path),
        None => Err("The packaged dashboard runtime sidecar is missing. Reinstall URage NOW.".into()),
    }
}

fn dashboard_socket_address() -> Result<std::net::SocketAddr, String> {
    (DASHBOARD_HOST, DASHBOARD_PORT)
        .to_socket_addrs()
        .map_err(|error| format!("Failed to resolve dashboard socket: {error}"))?
        .next()
        .ok_or_else(|| "Failed to resolve dashboard socket.".to_string())
}

fn is_dashboard_runtime_ready() -> bool {
    dashboard_socket_address().ok().is_some_and(|address| {
        TcpStream::connect_timeout(&address, Duration::from_millis(300)).is_ok()
    })
}

fn wait_for_dashboard_runtime() -> Result<(), String> {
    let address = dashboard_socket_address()?;
    let started_at = Instant::now();

    loop {
        if TcpStream::connect_timeout(&address, Duration::from_millis(300)).is_ok() {
            return Ok(());
        }

        if started_at.elapsed() >= DASHBOARD_READY_TIMEOUT {
            return Err(format!(
                "Dashboard runtime did not become ready within {} seconds.",
                DASHBOARD_READY_TIMEOUT.as_secs()
            ));
        }

        thread::sleep(DASHBOARD_READY_POLL);
    }
}

pub(crate) fn start_dashboard_runtime(app: AppHandle) {
    if !is_dashboard_runtime_ready() {
        let state = app.state::<DashboardRuntimeState>();

        match spawn_dashboard_runtime(&app, &state.log_path) {
            Ok(child) => {
                if let Ok(mut guard) = state.child.lock() {
                    *guard = Some(child);
                }
            }
            Err(error) => {
                show_startup_error(&app, &error);
                return;
            }
        }
    }

    match wait_for_dashboard_runtime() {
        Ok(()) => {
            if let Err(error) = navigate_to_dashboard(&app) {
                show_startup_error(&app, &error);
            }
        }
        Err(error) => show_startup_error(&app, &error),
    }
}

#[cfg(windows)]
fn stop_owned_child(child: &mut Child) {
    let process_id = child.id().to_string();

    let _ = Command::new("taskkill")
        .args(["/PID", &process_id, "/T", "/F"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    let _ = child.wait();
}

#[cfg(not(windows))]
fn stop_owned_child(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

pub(crate) fn stop_dashboard_runtime(state: &DashboardRuntimeState) {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(mut child) = guard.take() {
            stop_owned_child(&mut child);
        }
    }
}

pub(crate) fn restart_dashboard_runtime(app: AppHandle) {
    let state = app.state::<DashboardRuntimeState>();
    stop_dashboard_runtime(&state);
    thread::spawn(move || start_dashboard_runtime(app));
}

pub(crate) fn open_runtime_log(state: &DashboardRuntimeState) {
    let _ = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&state.log_path);

    #[cfg(windows)]
    let _ = Command::new("notepad.exe").arg(&state.log_path).spawn();

    #[cfg(target_os = "macos")]
    let _ = Command::new("open").arg(&state.log_path).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = Command::new("xdg-open").arg(&state.log_path).spawn();
}
