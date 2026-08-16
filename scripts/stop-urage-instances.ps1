[CmdletBinding()]
param(
  [int[]]$Port,
  [switch]$All
)

$ErrorActionPreference = "Stop"
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$knownRuntimePorts = @(4782, 4791, 4792, 4793, 5581)
$targetPorts = if ($Port -and $Port.Count -gt 0) {
  $Port
} elseif ($All) {
  $knownRuntimePorts
} else {
  @(4782)
}

foreach ($targetPort in ($targetPorts | Sort-Object -Unique)) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $targetPort -ErrorAction SilentlyContinue)
  if ($listeners.Count -eq 0) {
    Write-Host "Port $targetPort is already free."
    continue
  }

  foreach ($listener in ($listeners | Sort-Object OwningProcess -Unique)) {
    $processId = [int]$listener.OwningProcess
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    $commandLine = [string]$processInfo.CommandLine
    if ([string]::IsNullOrWhiteSpace($commandLine) -or -not $commandLine.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase) -and $commandLine -notmatch [regex]::Escape($repositoryRoot)) {
      Write-Warning "Refused to stop PID $processId on port $targetPort because it is not a URage NOW process."
      continue
    }

    Stop-Process -Id $processId -Force
    Write-Host "Stopped URage NOW PID $processId on port $targetPort."
  }
}
