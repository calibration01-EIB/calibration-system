# รัน tools/verify-app-load.html ด้วย headless Chrome แล้วพิมพ์ผล
# เครื่องนี้ไม่มี Node — นี่คือตัวแทน `node --check` + smoke test ตอนแยก/ย้ายไฟล์ JS
# ใช้: powershell -File tools\verify-app-load.ps1
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) { Write-Error "Chrome not found at $chrome"; exit 2 }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$page = Join-Path $here 'verify-app-load.html'
$url = 'file:///' + ($page -replace '\\', '/')
$prof = Join-Path $env:TEMP ('verify-app-load-' + [guid]::NewGuid().ToString('N'))

try {
  # อย่าใส่ 2>$null — PowerShell 5.1 จะห่อ stderr ของ native exe เป็น ErrorRecord แล้วพังทั้งสคริปต์
  # ใช้ --log-level=3 ปิดเสียง Chrome แทน
  $dom = & $chrome --headless=new --disable-gpu --no-sandbox --log-level=3 `
    --allow-file-access-from-files --user-data-dir="$prof" `
    --virtual-time-budget=15000 --dump-dom $url | Out-String
} finally {
  if (Test-Path $prof) { Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($dom -match '(?s)<pre id="out">(.*?)</pre>') {
  $text = $matches[1] -replace '&lt;', '<' -replace '&gt;', '>' -replace '&amp;', '&' -replace '&quot;', '"'
  Write-Output $text
  if ($text -match 'SUMMARY CLEAN') { exit 0 } else { exit 1 }
} else {
  Write-Output 'HARNESS_FAIL: no <pre id="out"> in dumped DOM'
  exit 2
}
