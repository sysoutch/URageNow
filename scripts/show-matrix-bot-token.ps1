[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tsxPath = Join-Path $repositoryRoot "node_modules\.bin\tsx.cmd"
$secretManagerPath = Join-Path $PSScriptRoot "manage-native-secret.ts"

if ((Read-Host "Type PRINT to display the Matrix bot token") -cne "PRINT") {
  Write-Host "Token display cancelled."
  exit 1
}
if (-not (Test-Path $tsxPath)) {
  throw "The local tsx launcher is missing. Run npm install from $repositoryRoot first."
}

& $tsxPath $secretManagerPath get matrix.default.access-token
if ($LASTEXITCODE -ne 0) {
  throw "No Matrix bot token is stored for the current Windows user."
}
