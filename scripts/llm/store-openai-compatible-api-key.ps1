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

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$secretTool = Join-Path $repoRoot "node_modules\.bin\tsx.cmd"
$secretScript = Join-Path $repoRoot "scripts\manage-native-secret.ts"
if (-not (Test-Path -LiteralPath $secretTool)) {
    throw "Dependencies are missing. Run npm install from the repository root first."
}

$secureApiKey = Read-Host "Enter OpenAI-compatible API key" -AsSecureString
$plainApiKey = Get-PlainTextFromSecureString -SecureString $secureApiKey
if ([string]::IsNullOrWhiteSpace($plainApiKey)) {
    throw "No API key entered."
}

$plainApiKey | & $secretTool $secretScript set openai-compatible.default.api-key
if ($LASTEXITCODE -ne 0) {
    throw "Failed to store the OpenAI-compatible API key in the native credential store."
}
