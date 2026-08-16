param(
  [string]$InstallDirectory = ""
)

$ErrorActionPreference = 'Stop'

function Test-Executable([string]$Command) {
  try {
    $null = Get-Command $Command -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Get-ExecutablePath([string]$Command) {
  try {
    return (Get-Command $Command -ErrorAction Stop).Source
  } catch {
    return $null
  }
}

if (Test-Executable 'ffmpeg') {
  Write-Host 'FFmpeg is already available in PATH.'
  $resolved = Get-ExecutablePath 'ffmpeg'
  if ($resolved) {
    Write-Host "FFmpeg executable: $resolved"
  }
  ffmpeg -version | Select-Object -First 1
  exit 0
}

if (-not (Test-Executable 'winget')) {
  throw 'winget is not available on this machine. Install FFmpeg manually or configure FFMPEG_EXECUTABLE_PATH.'
}

Write-Host 'Installing FFmpeg with winget (Gyan build)...'
$wingetArguments = @('install', '--id', 'Gyan.FFmpeg', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
if (-not [string]::IsNullOrWhiteSpace($InstallDirectory)) {
  $wingetArguments += @('--location', $InstallDirectory)
  Write-Host "Requesting custom install location: $InstallDirectory"
}
winget @wingetArguments

if (-not (Test-Executable 'ffmpeg')) {
  $common = @(
    'C:\ffmpeg\bin\ffmpeg.exe',
    'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
    'C:\Program Files\FFmpeg\bin\ffmpeg.exe',
    'C:\Program Files\Gyan\FFmpeg\bin\ffmpeg.exe',
    'C:\Program Files\Gyan\ffmpeg\bin\ffmpeg.exe'
  )
  $found = $common | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $found) {
    $wingetPackagesRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wingetPackagesRoot) {
      $found = Get-ChildItem -Path $wingetPackagesRoot -Directory -Filter 'Gyan.FFmpeg*' -ErrorAction SilentlyContinue |
        ForEach-Object { Get-ChildItem -Path $_.FullName -Directory -ErrorAction SilentlyContinue } |
        ForEach-Object { Join-Path $_.FullName 'bin\ffmpeg.exe' } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
    }
  }
  if ($found) {
    Write-Host "FFmpeg installed at: $found"
    Write-Host 'If PATH is not refreshed yet, set FFMPEG_EXECUTABLE_PATH to this path or restart the shell.'
    exit 0
  }
  throw 'FFmpeg install completed but ffmpeg is still not resolvable in this shell.'
}

Write-Host 'FFmpeg installed successfully.'
$resolved = Get-ExecutablePath 'ffmpeg'
if ($resolved) {
  Write-Host "FFmpeg executable: $resolved"
}
ffmpeg -version | Select-Object -First 1
