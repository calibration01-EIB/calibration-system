# tools/build-frm-eib04-template.ps1
# สร้าง assets/frm-eib04-template.xlsx จาก ตัวอย่าง/WRM1.xlsx (run ครั้งเดียวตอน dev)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$src  = Join-Path $root "ตัวอย่าง\WRM1.xlsx"
$dst  = Join-Path $root "assets\frm-eib04-template.xlsx"
Copy-Item $src $dst -Force
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-Entry($zip, $name) {
  $e = $zip.GetEntry($name); if (-not $e) { throw "missing entry $name" }
  $r = New-Object IO.StreamReader($e.Open(), [Text.Encoding]::UTF8)
  $t = $r.ReadToEnd(); $r.Close(); $t
}
function Write-Entry($zip, $name, $text) {
  $zip.GetEntry($name).Delete()
  $e = $zip.CreateEntry($name)
  $w = New-Object IO.StreamWriter($e.Open(), (New-Object Text.UTF8Encoding($false)))
  $w.Write($text); $w.Close()
}
function Assert($cond, $msg) { if (-not $cond) { throw "ASSERT FAIL: $msg" } }

$zip = [IO.Compression.ZipFile]::Open($dst, 'Update')

# ---------- sheet1.xml ----------
$sheet = Read-Entry $zip 'xl/worksheets/sheet1.xml'
# 1) ลบแถวข้อมูล/ลายเซ็น (r >= 10)
$sheet = [regex]::Replace($sheet, '<row r="(\d+)"[^>]*>.*?</row>',
  { param($m) if ([int]$m.Groups[1].Value -ge 10) { '' } else { $m.Value } }, 'Singleline')
Assert (-not ($sheet -match '<row r="10"')) 'rows >= 10 removed'
# 2) ลบ merge ของแถว >= 10 แล้วนับ count ใหม่
$sheet = [regex]::Replace($sheet, '<mergeCell ref="[A-Z]+(\d+):[A-Z]+\d+"/>',
  { param($m) if ([int]$m.Groups[1].Value -ge 10) { '' } else { $m.Value } })
$count = ([regex]::Matches($sheet, '<mergeCell ')).Count
$sheet = [regex]::Replace($sheet, '<mergeCells count="\d+">', "<mergeCells count=""$count"">")
# 3) dimension
$sheet = $sheet -replace '<dimension ref="[^"]*"/>', '<dimension ref="A1:AR9"/>'
# 4) เซลล์ checkbox แถว 6 -> inlineStr + token
$sheet = [regex]::Replace($sheet, '<c r="Z6" s="(\d+)" t="s"><v>\d+</v></c>',
  '<c r="Z6" s="$1" t="inlineStr"><is><t xml:space="preserve">{{CHK_DRUG}} Drug product</t></is></c>')
$sheet = [regex]::Replace($sheet, '<c r="AI6" s="(\d+)" t="s"><v>\d+</v></c>',
  '<c r="AI6" s="$1" t="inlineStr"><is><t xml:space="preserve">{{CHK_COS}} Cosmetic product</t></is></c>')
$sheet = [regex]::Replace($sheet, '<c r="AN6" s="(\d+)" t="s"><v>\d+</v></c>',
  '<c r="AN6" s="$1" t="inlineStr"><is><t xml:space="preserve">{{CHK_OTHER}} Other {{OTHER_TEXT}}</t></is></c>')
foreach ($tok in '{{CHK_DRUG}}','{{CHK_COS}}','{{CHK_OTHER}}') { Assert ($sheet.Contains($tok)) "sheet token $tok" }
Write-Entry $zip 'xl/worksheets/sheet1.xml' $sheet

# ---------- drawing1.xml ----------
$dr = Read-Entry $zip 'xl/drawings/drawing1.xml'
# 1) ลบรูป ✓ (Picture 15/16) และกล่อง checkbox เปล่า (sp ที่ไม่มี <a:t>)  โลโก้ 'รูปภาพ 20' ต้องอยู่
$dr = [regex]::Replace($dr, '<xdr:(one|two)CellAnchor[^>]*>.*?</xdr:\1CellAnchor>',
  { param($m) $b = $m.Value
    $isTickPic  = ($b -match '<xdr:pic>') -and ($b -match 'name="Picture 1[56]"')
    $isEmptyBox = ($b -match '<xdr:sp ') -and (-not ($b -match '<a:t>'))
    if ($isTickPic -or $isEmptyBox) { '' } else { $b } }, 'Singleline')
Assert ($dr -match 'รูปภาพ 20') 'logo still present'
Assert (-not ($dr -match 'Picture 1[56]')) 'tick pics removed'
# 2) ค่า -> token
$dr = $dr.Replace('<a:t>January</a:t>', '<a:t>{{MONTH}}</a:t>')
$dr = $dr.Replace('<a:t>2026</a:t>', '<a:t>{{YEAR}}</a:t>')
$dr = $dr.Replace('<a:t>BALANCE</a:t>', '<a:t>{{GROUP}}</a:t>')
$dr = $dr.Replace('<a:t>General Raw Material:WRM1</a:t>', '<a:t>{{UNIT}}</a:t>')
$dr = $dr.Replace('<a:t>Warehouse - Raw Material</a:t>', '<a:t>{{SECTION}}</a:t>')
# 3) label checkbox สอบเทียบภายใน/ภายนอก -> เติม token นำหน้า
#    ฝั่งภายในโดนซอยเป็น run '<a:t>สอบเทียบ</a:t>' + '<a:t>ภายใน</a:t>' (run 'สอบเทียบ' เดี่ยวมีที่เดียว)
$dr = $dr.Replace('<a:t>สอบเทียบ</a:t>', '<a:t>{{CHK_INT}} สอบเทียบ</a:t>')
$dr = $dr.Replace('<a:t>สอบเทียบภายนอก ', '<a:t>{{CHK_EXT}} สอบเทียบภายนอก ')
foreach ($tok in '{{MONTH}}','{{YEAR}}','{{GROUP}}','{{UNIT}}','{{SECTION}}','{{CHK_INT}}','{{CHK_EXT}}') {
  Assert ($dr.Contains($tok)) "drawing token $tok"
}
Write-Entry $zip 'xl/drawings/drawing1.xml' $dr
$zip.Dispose()
Write-Output "OK -> $dst"
