$ErrorActionPreference = "Stop"

$protocolKey = "HKCU:\Software\Classes\urage-now\shell\open\command"
$registration = Get-ItemProperty -Path $protocolKey -Name "(Default)" -ErrorAction Stop
if ([string]::IsNullOrWhiteSpace([string]$registration."(Default)")) {
  throw "The urage-now:// protocol is not registered for this Windows user. Use Settings > Network > Enable URage NOW links first."
}

$testUri = "urage-now://import?source=sketchfab&uid=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&name=Protocol%20test"
Start-Process $testUri
Write-Host "Opened the protocol test. The dashboard should load with an Import from URage.net overlay."
