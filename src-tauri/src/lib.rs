mod paths;
mod runtime;
mod tray;
mod window;

use std::sync::Mutex;
use tauri::Manager;

use runtime::{
    should_autostart_dashboard_runtime, start_dashboard_runtime, DashboardRuntimeState,
};
use tray::install_tray;
use window::{
    desktop_hide, desktop_minimize, desktop_start_dragging, desktop_toggle_maximize,
};

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
                std::thread::spawn(move || start_dashboard_runtime(app_handle));
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
