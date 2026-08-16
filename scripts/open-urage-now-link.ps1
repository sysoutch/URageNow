param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Uri
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Web
$incoming = [Uri]$Uri
if ($incoming.Scheme -ne "urage-now" -or $incoming.Host -ne "import") {
  throw "Only urage-now://import links are supported."
}

$query = [System.Web.HttpUtility]::ParseQueryString($incoming.Query)
if ($query["source"] -ne "sketchfab") {
  throw "Only Sketchfab imports are supported."
}

$uid = [string]$query["uid"]
if ($uid -notmatch "^[a-fA-F0-9]{32}$") {
  throw "The Sketchfab model ID is invalid."
}

$dashboardBaseUrl = [string]$env:URAGE_DASHBOARD_URL
if ([string]::IsNullOrWhiteSpace($dashboardBaseUrl)) {
  $dashboardBaseUrl = "http://127.0.0.1:4782"
}
$dashboardUri = [Uri]$dashboardBaseUrl
if ($dashboardUri.Scheme -notin @("http", "https")) {
  throw "URAGE_DASHBOARD_URL must be an HTTP or HTTPS URL."
}

$target = [System.UriBuilder]$dashboardUri
$target.Path = $target.Path.TrimEnd("/") + "/"
$targetQuery = [System.Web.HttpUtility]::ParseQueryString("")
$targetQuery["urageImport"] = "sketchfab"
$targetQuery["uid"] = $uid
foreach ($key in @("name", "modelUrl", "downloadUrl")) {
  $value = [string]$query[$key]
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    $targetQuery[$key] = $value.Substring(0, [Math]::Min($value.Length, 500))
  }
}
$target.Query = $targetQuery.ToString()

Start-Process $target.Uri.AbsoluteUri
