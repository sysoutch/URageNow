param(
    [ValidateSet("store-token", "register", "start", "dev", "build", "check", "start-headless", "dev-headless")]
    [string]$Mode = "start",
    [string]$Profile = ""
)
$launcherPath = Join-Path $PSScriptRoot "..\launch.ps1"
& $launcherPath -Role "main" -Mode $Mode -Profile $Profile
