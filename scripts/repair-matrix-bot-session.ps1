[CmdletBinding()]
param(
  [string]$HomeserverUrl = "https://matrix.urage.net",
  [string]$BotUserId = "@uragebot:urage.net",
  [switch]$SkipRuntimeRestart
)

$ErrorActionPreference = "Stop"
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$matrixEnvironmentPath = Join-Path $repositoryRoot "bots\matrix-bot\.env"
$runtimeControlPath = Join-Path $PSScriptRoot "bots\matrix\run-matrix-runtime.ps1"
$secretManagerPath = Join-Path $PSScriptRoot "manage-native-secret.ts"
$tsxPath = Join-Path $repositoryRoot "node_modules\.bin\tsx.cmd"

function Read-PlainSecret([string]$Prompt) {
  $secureValue = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function New-RandomPassword {
  $bytes = New-Object byte[] 36
  $randomNumberGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomNumberGenerator.GetBytes($bytes)
  } finally {
    $randomNumberGenerator.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Invoke-MatrixJson([string]$Method, [string]$Uri, [hashtable]$Headers, $Body = $null) {
  $parameters = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json" }
  if ($null -ne $Body) {
    $parameters.Body = $Body | ConvertTo-Json -Depth 5
  }
  return Invoke-RestMethod @parameters
}

function Set-EnvironmentValue([string]$Source, [string]$Name, [string]$Value) {
  $expression = "(?m)^\s*" + [regex]::Escape($Name) + "\s*=.*$"
  $line = "$Name=$Value"
  if ($Source -match $expression) {
    return [regex]::Replace($Source, $expression, $line)
  }
  return $Source.TrimEnd() + [Environment]::NewLine + $line + [Environment]::NewLine
}

if (-not (Test-Path $matrixEnvironmentPath)) {
  throw "Matrix runtime configuration was not found at $matrixEnvironmentPath. Copy bots/matrix-bot/.env.example first."
}
if (-not (Test-Path $tsxPath)) {
  throw "The local tsx launcher is missing. Run npm install from $repositoryRoot first."
}
if ($HomeserverUrl -notmatch "^https://") {
  throw "HomeserverUrl must use HTTPS."
}
if ($BotUserId -notmatch "^@[^:]+:.+$") {
  throw "BotUserId must be a full Matrix user ID."
}

$normalizedHomeserverUrl = $HomeserverUrl.TrimEnd("/")
$adminToken = Read-PlainSecret "Paste a Synapse ADMIN access token (input is hidden)"
if ([string]::IsNullOrWhiteSpace($adminToken)) {
  throw "An admin access token is required."
}

Write-Host "Stopping the Matrix runtime..."
& $runtimeControlPath -Action stop

$headers = @{ Authorization = "Bearer $adminToken" }
$encodedBotUserId = [uri]::EscapeDataString($BotUserId)
$botPassword = New-RandomPassword

Write-Host "Invalidating old $BotUserId sessions and access tokens..."
Invoke-MatrixJson "POST" "$normalizedHomeserverUrl/_synapse/admin/v1/reset_password/$encodedBotUserId" $headers @{
  new_password = $botPassword
  logout_devices = $true
} | Out-Null

Write-Host "Creating a fresh Matrix device for the bot..."
$login = Invoke-MatrixJson "POST" "$normalizedHomeserverUrl/_matrix/client/v3/login" @{} @{
  type = "m.login.password"
  identifier = @{ type = "m.id.user"; user = $BotUserId }
  password = $botPassword
  initial_device_display_name = "URage NOW Matrix Bot"
}
$newToken = [string]$login.access_token
if ([string]::IsNullOrWhiteSpace($newToken) -or [string]::IsNullOrWhiteSpace([string]$login.device_id)) {
  throw "Matrix login did not return a new access token and device ID."
}

$stateSuffix = (Get-Date -Format "yyyyMMdd-HHmmss")
$newStateDirectory = Join-Path $repositoryRoot "data\matrix-bot\uragebot-repaired-$stateSuffix"
$environmentSource = Get-Content -LiteralPath $matrixEnvironmentPath -Raw
$environmentSource = Set-EnvironmentValue $environmentSource "MATRIX_ACCESS_TOKEN" ""
$environmentSource = Set-EnvironmentValue $environmentSource "MATRIX_STATE_DIRECTORY" $newStateDirectory
Set-Content -LiteralPath $matrixEnvironmentPath -Value $environmentSource -NoNewline

Write-Host "Storing the new token in the current Windows user's credential store..."
$newToken | & $tsxPath $secretManagerPath set matrix.default.access-token
if ($LASTEXITCODE -ne 0) {
  throw "The new Matrix token could not be stored in the native credential store."
}

if (-not $SkipRuntimeRestart) {
  Write-Host "Starting the Matrix runtime with the new device state..."
  & $runtimeControlPath -Action start
}

Write-Host "Matrix bot session repair completed."
Write-Host "Bot device ID: $($login.device_id)"
Write-Host "New state directory: $newStateDirectory"
Write-Host "The new access token was stored securely and was not printed."
Write-Host "Open the dashboard Matrix health panel and wait for ready: true before sending messages."
