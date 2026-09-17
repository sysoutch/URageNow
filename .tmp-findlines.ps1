$patterns = @('image-studio-card','image-edit-source-dropzone','Recent Images','recent-image-list','imagegen-recent','ai-dropzone')
foreach ($pattern in $patterns) {
  Write-Output ("== " + $pattern)
  Select-String -Path 'dashboard/src/pageSections/aiView.ts' -Pattern ([regex]::Escape($pattern)) | ForEach-Object { $_.LineNumber }
}