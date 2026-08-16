$ErrorActionPreference = "Stop"
$handlerPath = Join-Path $PSScriptRoot "open-urage-now-link.ps1"
if (-not (Test-Path -LiteralPath $handlerPath)) {
  throw "The URage NOW protocol handler was not found: $handlerPath"
}

$protocolKey = "HKCU:\Software\Classes\urage-now"
New-Item -Path $protocolKey -Force | Out-Null
Set-ItemProperty -Path $protocolKey -Name "(Default)" -Value "URL:URage NOW Protocol"
Set-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value ""
New-Item -Path "$protocolKey\shell\open\command" -Force | Out-Null
$command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $handlerPath + '" "%1"'
Set-ItemProperty -Path "$protocolKey\shell\open\command" -Name "(Default)" -Value $command
Write-Host "Registered urage-now:// for the current Windows user."
