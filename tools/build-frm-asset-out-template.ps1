param(
  [string]$Source = 'C:\Users\8014\Desktop\FRM\ใบนำของออก01.xlsx',
  [string]$Python = 'python'
)
$ErrorActionPreference = 'Stop'
& $Python (Join-Path $PSScriptRoot 'build-asset-out-template.py') $Source
if ($LASTEXITCODE -ne 0) { throw 'Template generation failed' }
