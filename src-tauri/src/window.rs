use tauri::{AppHandle, Manager, Url, WebviewWindow};

const DASHBOARD_URL: &str = "http://127.0.0.1:4782/?desktopShell=tauri";

pub(crate) fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Desktop window is unavailable.".to_string())?;

    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub(crate) fn navigate_to_dashboard(app: &AppHandle) -> Result<(), String> {
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

pub(crate) fn show_startup_error(app: &AppHandle, error: &str) {
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

#[tauri::command]
pub(crate) fn desktop_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn desktop_start_dragging(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn desktop_toggle_maximize(window: WebviewWindow) -> Result<bool, String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|error| error.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub(crate) fn desktop_hide(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}
