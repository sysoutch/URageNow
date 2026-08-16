param(
    [ValidateSet("start", "stop", "restart")]
    [string]$Action = "start",
    [string]$BaseUrl = "http://127.0.0.1:4782"
)
$runtimeControlPath = Join-Path $PSScriptRoot "..\runtime-control.ps1"
& $runtimeControlPath -Messenger "discord" -Action $Action -BaseUrl $BaseUrl
