param(
    [ValidateSet("main", "worker", "dashboard")]
    [string]$Role = "main",
    [ValidateSet("store-token", "register", "start", "dev", "build", "check", "start-headless", "dev-headless")]
    [string]$Mode = "start",
    [string]$Profile = "",
    [switch]$NoMessengerAutostart
)
$ErrorActionPreference = "Stop"

function Get-PlainTextFromSecureString {
    param([System.Security.SecureString]$SecureString)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Import-EnvFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
            continue
        }
        $separatorIndex = $trimmed.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }
        $key = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1)
        if ([string]::IsNullOrWhiteSpace($key)) {
            continue
        }
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

function Invoke-NpmScript {
    param([string]$ScriptName)
    npm.cmd run $ScriptName
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

function Invoke-DiscordNpmScript {
    param([string]$ScriptName)
    npm.cmd --prefix $discordProjectRoot run $ScriptName
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

function Invoke-WorkerEntrypoint {
    param([bool]$Watch = $false)
    if ($Watch) {
        Invoke-NpmScript -ScriptName "worker:dev"
    } else {
        Invoke-NpmScript -ScriptName "worker:start"
    }
}

function Ensure-DashboardCss {
    Invoke-NpmScript -ScriptName "build:dashboard:css:if-needed"
}

function Load-RoleEnvironment {
    param(
        [string]$ResolvedRole,
        [string]$ResolvedProfile
    )
    if ($ResolvedRole -eq "worker") {
        $filesToLoad = @(
            (Join-Path $discordProjectRoot ".env.public"),
            (Join-Path $discordProjectRoot ".env.public.local"),
            (Join-Path $repoRoot ".env.public"),
            (Join-Path $repoRoot ".env.public.local"),
            (Join-Path $workerEnvRoot ".env.worker.local")
        )
        if (-not [string]::IsNullOrWhiteSpace($ResolvedProfile)) {
            $filesToLoad += Join-Path $workerEnvRoot ".env.worker.$ResolvedProfile.local"
        }
        foreach ($file in $filesToLoad) {
            Import-EnvFile -Path $file
        }
        return
    }
    $filesToLoad = @(
        (Join-Path $discordProjectRoot ".env.public"),
        (Join-Path $discordProjectRoot ".env.public.local"),
        (Join-Path $discordProjectRoot ".env.main.local"),
        (Join-Path $repoRoot ".env.public"),
        (Join-Path $repoRoot ".env.public.local"),
        (Join-Path $repoRoot ".env.main.local")
    )
    if (-not [string]::IsNullOrWhiteSpace($ResolvedProfile)) {
        $filesToLoad += Join-Path $discordProjectRoot ".env.main.$ResolvedProfile.local"
        $filesToLoad += Join-Path $repoRoot ".env.main.$ResolvedProfile.local"
    }
    foreach ($file in $filesToLoad) {
        Import-EnvFile -Path $file
    }
}

function Load-StoredDiscordToken {
    if (-not [string]::IsNullOrWhiteSpace($env:DISCORD_TOKEN_RUNTIME)) {
        return
    }
    $secretTool = Join-Path $repoRoot "node_modules\.bin\tsx.cmd"
    $secretScript = Join-Path $repoRoot "scripts\manage-native-secret.ts"
    $storedToken = ""
    if (Test-Path -LiteralPath $secretTool) {
        $storedToken = & $secretTool $secretScript get discord.default.token 2>$null
    }
    if ([string]::IsNullOrWhiteSpace($storedToken)) {
        $storedToken = [Environment]::GetEnvironmentVariable("DISCORD_TOKEN_SECURE_STORE", "User")
    }
    if (-not [string]::IsNullOrWhiteSpace($storedToken)) {
        $env:DISCORD_TOKEN_RUNTIME = $storedToken
    }
}

function Ensure-MainTokenAvailable {
    param([string]$ResolvedMode)
    if ($Role -ne "main") {
        return
    }
    if ($NoMessengerAutostart) {
        return
    }
    if ($ResolvedMode -eq "build" -or $ResolvedMode -eq "check") {
        return
    }
    Load-StoredDiscordToken
    if ([string]::IsNullOrWhiteSpace($env:DISCORD_TOKEN_RUNTIME)) {
        throw "No Discord token found. Set a process environment override or run scripts\\bots\\discord\\store-discord-token.cmd as the same user that runs this runtime."
    }
}

function Apply-RoleRuntimeOverrides {
    param(
        [string]$ResolvedRole,
        [string]$ResolvedMode
    )
    if ($ResolvedRole -eq "dashboard") {
        $env:DASHBOARD_ENABLED = "true"
        return
    }
    if ($ResolvedRole -eq "main" -and ($ResolvedMode -eq "start-headless" -or $ResolvedMode -eq "dev-headless")) {
        $env:DASHBOARD_ENABLED = "false"
    }
    if ($NoMessengerAutostart) {
        $env:URAGE_DISABLE_MESSENGER_AUTOSTART = "true"
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\")
$discordProjectRoot = Join-Path $repoRoot "bots\discord-bot"
$workerEnvRoot = Join-Path $repoRoot "workers\remote-worker\env"

Set-Location $repoRoot

if ($Role -eq "worker" -and ($Mode -eq "store-token" -or $Mode -eq "register" -or $Mode -eq "start-headless" -or $Mode -eq "dev-headless")) {
    throw "Mode '$Mode' is only supported for the main bot role."
}
if ($Role -eq "dashboard" -and ($Mode -eq "store-token" -or $Mode -eq "register" -or $Mode -eq "start-headless" -or $Mode -eq "dev-headless")) {
    throw "Mode '$Mode' is only supported for the main bot role."
}
if ($Role -eq "dashboard") {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    Write-Host "Dashboard Windows identity: $identity"
    Write-Host "Dashboard user profile: $env:USERPROFILE"
}

if ($Mode -eq "store-token") {
    if ($Role -ne "main") {
        throw "store-token is only supported for the main bot role."
    }
    $secureToken = Read-Host "Enter Discord bot token" -AsSecureString
    $plainToken = Get-PlainTextFromSecureString -SecureString $secureToken
    if ([string]::IsNullOrWhiteSpace($plainToken)) {
        throw "No token entered."
    }
    $secretTool = Join-Path $repoRoot "node_modules\.bin\tsx.cmd"
    $secretScript = Join-Path $repoRoot "scripts\manage-native-secret.ts"
    $plainToken | & $secretTool $secretScript set discord.default.token
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to store the Discord token in the native credential store."
    }
    exit 0
}

Load-RoleEnvironment -ResolvedRole $Role -ResolvedProfile $Profile
Apply-RoleRuntimeOverrides -ResolvedRole $Role -ResolvedMode $Mode
if ($Role -eq "main" -or $Role -eq "dashboard") {
    Load-StoredDiscordToken
}
Ensure-MainTokenAvailable -ResolvedMode $Mode

switch ("$($Role):$($Mode)") {
    "main:register" { Invoke-DiscordNpmScript -ScriptName "register" }
    "main:start" {
        Ensure-DashboardCss
        Invoke-NpmScript -ScriptName "runtime:start"
    }
    "main:dev" {
        Ensure-DashboardCss
        Invoke-NpmScript -ScriptName "runtime:dev"
    }
    "main:start-headless" {
        Invoke-NpmScript -ScriptName "runtime:start"
    }
    "main:dev-headless" { Invoke-NpmScript -ScriptName "runtime:dev" }
    "main:build" {
        Invoke-NpmScript -ScriptName "build:dashboard"
    }
    "main:check" {
        Invoke-NpmScript -ScriptName "check:discord"
        Invoke-NpmScript -ScriptName "check:dashboard"
    }
    "dashboard:start" {
        Ensure-DashboardCss
        Invoke-NpmScript -ScriptName "runtime:start"
    }
    "dashboard:dev" {
        Ensure-DashboardCss
        Invoke-NpmScript -ScriptName "runtime:dev"
    }
    "dashboard:build" {
        Invoke-NpmScript -ScriptName "build:dashboard"
    }
    "dashboard:check" {
        Invoke-NpmScript -ScriptName "check:dashboard"
    }
    "worker:start" {
        Invoke-WorkerEntrypoint
    }
    "worker:dev" {
        Invoke-WorkerEntrypoint -Watch $true
    }
    "worker:build" { Invoke-NpmScript -ScriptName "build:worker" }
    "worker:check" { Invoke-NpmScript -ScriptName "check:worker" }
    default { throw "Unsupported combination Role='$Role' Mode='$Mode'." }
}
