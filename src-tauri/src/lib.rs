use std::fs::OpenOptions;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Url, WebviewWindow};

const DASHBOARD_HOST: &str = "127.0.0.1";
const DASHBOARD_PORT: u16 = 4782;
const DASHBOARD_URL: &str = "http://127.0.0.1:4782/?desktopShell=tauri";
const DASHBOARD_READY_TIMEOUT: Duration = Duration::from_secs(30);
const DASHBOARD_READY_POLL: Duration = Duration::from_millis(250);

struct DashboardRuntimeState {
    child: Mutex<Option<Child>>,
    log_path: PathBuf,
}

fn should_autostart_dashboard_runtime() -> bool {
    if let Ok(value) = std::env::var("URAGE_STUDIO_AUTOSTART_DASHBOARD") {
        return !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "0" | "false" | "no" | "off"
        );
    }
    !cfg!(dev)
}

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

fn resolve_repo_root() -> Result<PathBuf, String> {
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

fn find_packaged_sidecar(app: &AppHandle) -> Option<PathBuf> {
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

fn find_packaged_native_application_broker(app: &AppHandle) -> Option<PathBuf> {
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
        None => {
            Err("The packaged dashboard runtime sidecar is missing. Reinstall URage NOW.".into())
        }
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

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Desktop window is unavailable.".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn navigate_to_dashboard(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Desktop window is unavailable.".to_string())?;
    let dashboard_url =
        Url::parse(DASHBOARD_URL).map_err(|error| format!("Dashboard URL is invalid: {error}"))?;
    window
        .navigate(dashboard_url)
        .map_err(|error| format!("Failed to open the dashboard: {error}"))?;
    show_main_window(app)
}

fn show_startup_error(app: &AppHandle, error: &str) {
    eprintln!("{error}");
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = window.set_title("URage NOW - Startup failed");
    let error_page = "data:text/html,%3Cmeta%20charset%3Dutf-8%3E%3Ctitle%3EURage%20Studio%20startup%20failed%3C%2Ftitle%3E%3Cstyle%3Ebody%7Bfont-family%3Asystem-ui%3Bbackground%3A%23130b11%3Bcolor%3A%23f4e9ef%3Bpadding%3A3rem%3Bline-height%3A1.6%7Dmain%7Bmax-width%3A48rem%3Bmargin%3Aauto%3Bpadding%3A2rem%3Bborder%3A1px%20solid%20%238b335d%3Bborder-radius%3A1rem%3Bbackground%3A%231d1119%7Dcode%7Bcolor%3A%23ff78b7%7D%3C%2Fstyle%3E%3Cmain%3E%3Ch1%3EDashboard%20startup%20failed%3C%2Fh1%3E%3Cp%3EThe%20desktop%20shell%20could%20not%20start%20the%20local%20dashboard.%3C%2Fp%3E%3Cp%3EUse%20the%20tray%20menu%20to%20view%20the%20runtime%20log%20or%20restart%20the%20runtime.%3C%2Fp%3E%3C%2Fmain%3E";
    if let Ok(url) = Url::parse(error_page) {
        let _ = window.navigate(url);
    }
    let _ = show_main_window(app);
}

fn start_dashboard_runtime(app: AppHandle) {
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

fn stop_dashboard_runtime(state: &DashboardRuntimeState) {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(mut child) = guard.take() {
            stop_owned_child(&mut child);
        }
    }
}

fn restart_dashboard_runtime(app: AppHandle) {
    let state = app.state::<DashboardRuntimeState>();
    stop_dashboard_runtime(&state);
    thread::spawn(move || start_dashboard_runtime(app));
}

fn open_runtime_log(state: &DashboardRuntimeState) {
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

fn install_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Restart Runtime", true, None::<&str>)?;
    let logs = MenuItem::with_id(app, "logs", "View Logs", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &restart, &logs, &quit])?;
    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, event| match event.id.as_ref() {
        "open" => {
            let _ = show_main_window(app);
        }
        "restart" => restart_dashboard_runtime(app.clone()),
        "logs" => open_runtime_log(&app.state::<DashboardRuntimeState>()),
        "quit" => {
            stop_dashboard_runtime(&app.state::<DashboardRuntimeState>());
            app.exit(0);
        }
        _ => {}
    })
    .build(app)?;
    Ok(())
}

#[tauri::command]
fn desktop_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn desktop_start_dragging(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn desktop_toggle_maximize(window: WebviewWindow) -> Result<bool, String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|error| error.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn desktop_hide(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_minimize,
            desktop_start_dragging,
            desktop_toggle_maximize,
            desktop_hide
        ])
        .setup(|app| {
            let log_path = app
                .path()
                .app_log_dir()
                .map_err(|error| error.to_string())?
                .join("dashboard-runtime.log");
            app.manage(DashboardRuntimeState {
                child: Mutex::new(None),
                log_path,
            });
            install_tray(app)?;
            if should_autostart_dashboard_runtime() {
                let app_handle = app.handle().clone();
                thread::spawn(move || start_dashboard_runtime(app_handle));
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running URage NOW desktop shell");
}
