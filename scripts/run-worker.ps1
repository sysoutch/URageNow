param(
    [ValidateSet("start", "dev", "build", "check")]
    [string]$Mode = "start",
    [string]$Profile = ""
)
$launcherPath = Join-Path $PSScriptRoot "bots\launch.ps1"
& $launcherPath -Role "worker" -Mode $Mode -Profile $Profile
