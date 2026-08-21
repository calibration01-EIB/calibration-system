# Syntax-check every js/*.js plus the root-level scripts with headless Chrome
# (this machine has no Node).
# sw.js เคยหลุดการตรวจ ทั้งที่พังแล้วเงียบที่สุด — SW register ไม่ผ่าน = ออฟไลน์ตายโดยไม่มี error ในหน้า
# Embeds each file in a non-executing <script type="text/plain"> then compiles it with
# new Function(...) - that throws SyntaxError without running the file's top-level code.
# Usage: powershell -File tools\syntax-check-js.ps1
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) { Write-Error "Chrome not found at $chrome"; exit 2 }

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$tmp = Join-Path $env:TEMP ('jssyntax-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tmp | Out-Null

$files = @(Get-ChildItem (Join-Path $root 'js') -Filter *.js | Sort-Object Name)
foreach ($extra in @('sw.js')) {
  $p = Join-Path $root $extra
  if (Test-Path $p) { $files += Get-Item $p }
}
$bad = 0
try {
  foreach ($f in $files) {
    $src = [System.IO.File]::ReadAllText($f.FullName)
    # ส่งซอร์สเป็น base64 แทนการฝังใน <script type="text/plain"> ตรง ๆ
    # เพราะไฟล์ที่มี "</script" อยู่ในสตริง (เช่น sw.js ที่แทรกแท็กสคริปต์เข้า html)
    # จะทำให้ตัว parser ปิดบล็อกกลางคัน เดิมเลยต้อง SKIP ไฟล์พวกนั้นทิ้ง = ไม่ได้ตรวจเลย
    $b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($src))
    $html = "<!doctype html><meta charset=`"utf-8`"><pre id=`"out`">?</pre>" +
            "<script id=`"src`" type=`"application/base64`">$b64</script>" +
            "<script>try{" +
            "var b=atob(document.getElementById('src').textContent);" +
            "var u=Uint8Array.from(b,function(c){return c.charCodeAt(0)});" +
            "new Function(new TextDecoder('utf-8').decode(u));" +
            "document.getElementById('out').textContent='OK';}catch(e){" +
            "document.getElementById('out').textContent='FAIL '+e.message;}</script>"
    $page = Join-Path $tmp ($f.BaseName + '.html')
    [System.IO.File]::WriteAllText($page, $html, (New-Object System.Text.UTF8Encoding($false)))
    $url = 'file:///' + ($page -replace '\\', '/')
    $prof = Join-Path $tmp ('p-' + $f.BaseName)
    $dom = & $chrome --headless=new --disable-gpu --no-sandbox --log-level=3 `
      --user-data-dir="$prof" --virtual-time-budget=5000 --dump-dom $url | Out-String
    if ($dom -match '(?s)<pre id="out">(.*?)</pre>') {
      $res = $matches[1]
      if ($res -eq 'OK') { Write-Output ("OK       {0}" -f $f.Name) }
      else { Write-Output ("SYNTAX   {0}  ->  {1}" -f $f.Name, $res); $bad++ }
    } else { Write-Output ("HARNESS  {0}  -> no output" -f $f.Name); $bad++ }
  }
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Output ("---- {0} files checked, {1} with problems" -f $files.Count, $bad)
exit ([int]($bad -gt 0))
