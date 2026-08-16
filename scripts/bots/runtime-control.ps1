param(
    [ValidateSet("discord", "telegram", "matrix", "whatsapp")]
    [string]$Messenger,
    [ValidateSet("start", "stop", "restart")]
    [string]$Action = "start",
    [string]$BaseUrl = "http://127.0.0.1:4782"
)
$ErrorActionPreference = "Stop"
$baseUrlRaw = $BaseUrl
if ($null -eq $baseUrlRaw) {
    $baseUrlRaw = ""
}
$normalizedBaseUrl = $baseUrlRaw.Trim().TrimEnd("/")
if ([string]::IsNullOrWhiteSpace($normalizedBaseUrl)) {
    throw "BaseUrl is required."
}
$endpoint = "$normalizedBaseUrl/api/messenger-runtimes/control"
$payload = @{
    messenger = $Messenger
    action = $Action
} | ConvertTo-Json -Compress
try {
    $result = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType "application/json" -Body $payload
} catch {
    $message = $_.Exception.Message
    throw "Failed runtime control call to $endpoint. Ensure dashboard is running. Detail: $message"
}
$runtime = $result.runtime
if ($null -eq $runtime) {
    Write-Host "Runtime control call succeeded."
    exit 0
}
$label = [string]$runtime.label
$status = [string]$runtime.status
$messageText = [string]$runtime.message
Write-Host "$label runtime -> $status"
if (-not [string]::IsNullOrWhiteSpace($messageText)) {
    Write-Host $messageText
}
