# Run every tests/*.test.html in headless Chrome and report PASS/FAIL counts found in the DOM.
# This machine has no Node, so the test harnesses are plain HTML pages that write results into the page.
# Usage: powershell -File tools\run-tests.ps1
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) { Write-Error "Chrome not found at $chrome"; exit 2 }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$tests = Get-ChildItem (Join-Path $root 'tests') -Filter *.test.html | Sort-Object Name
$tmp = Join-Path $env:TEMP ('runtests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tmp | Out-Null

$bad = 0
try {
  foreach ($t in $tests) {
    $url = 'file:///' + ($t.FullName -replace '\\', '/')
    $prof = Join-Path $tmp ('p-' + $t.BaseName)
    $dom = & $chrome --headless=new --disable-gpu --no-sandbox --log-level=3 `
      --allow-file-access-from-files --user-data-dir="$prof" `
      --virtual-time-budget=20000 --dump-dom $url | Out-String

    # ตัด <script> ออกก่อนนับ - ไม่งั้นจะไปนับคำว่า PASS/FAIL ที่อยู่ในซอร์สของ harness เอง
    $visible = [regex]::Replace($dom, '(?s)<script.*?</script>', '')
    $pass = ([regex]::Matches($visible, '\bPASS\b')).Count
    $fail = ([regex]::Matches($visible, '\bFAIL\b')).Count
    $status = if ($fail -gt 0) { $bad++; 'FAIL' } elseif ($pass -gt 0) { 'PASS' } else { $bad++; 'NO-RESULT' }
    Write-Output ("{0,-10} {1,-40} pass={2} fail={3}" -f $status, $t.Name, $pass, $fail)
    if ($fail -gt 0) {
      foreach ($m in [regex]::Matches($visible, '[^<>\r\n]*\bFAIL\b[^<>\r\n]*')) {
        Write-Output ("           ! " + $m.Value.Trim())
      }
    }
  }
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Output ("---- {0} test pages, {1} with problems" -f $tests.Count, $bad)
exit ([int]($bad -gt 0))
