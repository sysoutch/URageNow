use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

use crate::runtime::{
    open_runtime_log, restart_dashboard_runtime, stop_dashboard_runtime, DashboardRuntimeState,
};
use crate::window::show_main_window;

pub(crate) fn install_tray(app: &tauri::App) -> tauri::Result<()> {
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
