param(
    [ValidateSet("main", "worker")]
    [string]$Role = "main",
    [ValidateSet("store-token", "register", "start", "dev", "build", "check", "start-headless", "dev-headless")]
    [string]$Mode = "start",
    [string]$Profile = ""
)
$launcherPath = Join-Path $PSScriptRoot "launch.ps1"
& $launcherPath -Role $Role -Mode $Mode -Profile $Profile
