param(
    [int]$Port = 5173
)

$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)

if ($listeners.Count -eq 0) {
    Write-Host "No listening process found on port $Port."
    exit 0
}

$processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) {
        Write-Host "Process $processId was already gone."
        continue
    }

    Stop-Process -Id $processId -Force -ErrorAction Stop
    Write-Host "Stopped PID $processId ($($process.ProcessName)) on port $Port."
}
