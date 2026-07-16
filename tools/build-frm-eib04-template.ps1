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
# 4) จัดกล่องข้อความไม่ให้ชนเส้นตาราง
# 4.1 label สอบเทียบภายใน/ภายนอก: เดิมคร่อมเส้นแถว 5/6 -> ย้ายลงแถว 6 (แถวเดียวกับ Drug/Cosmetic) + ขยายกว้างกันโดน clip หลังเติม token ☑
$dr = $dr.Replace('<xdr:from><xdr:col>0</xdr:col><xdr:colOff>179070</xdr:colOff><xdr:row>4</xdr:row><xdr:rowOff>333375</xdr:rowOff></xdr:from><xdr:ext cx="2131802" cy="341055"/>',
                  '<xdr:from><xdr:col>0</xdr:col><xdr:colOff>179070</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>9525</xdr:rowOff></xdr:from><xdr:ext cx="2450000" cy="238125"/>')
$dr = $dr.Replace('<a:off x="179070" y="1647825"/><a:ext cx="2131802" cy="341055"/>',
                  '<a:off x="179070" y="1704975"/><a:ext cx="2450000" cy="238125"/>')
$dr = $dr.Replace('<xdr:from><xdr:col>4</xdr:col><xdr:colOff>434340</xdr:colOff><xdr:row>4</xdr:row><xdr:rowOff>352425</xdr:rowOff></xdr:from><xdr:ext cx="2212722" cy="589777"/>',
                  '<xdr:from><xdr:col>4</xdr:col><xdr:colOff>434340</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>9525</xdr:rowOff></xdr:from><xdr:ext cx="2500000" cy="238125"/>')
$dr = $dr.Replace('<a:off x="3063240" y="1666875"/><a:ext cx="2212722" cy="589777"/>',
                  '<a:off x="3063240" y="1704975"/><a:ext cx="2500000" cy="238125"/>')
Assert (([regex]::Matches($dr, '<xdr:row>5</xdr:row><xdr:rowOff>9525</xdr:rowOff>')).Count -eq 2) 'chk labels moved to row 6'
# inset บน/ล่าง = 0 เฉพาะกล่อง CHK (กล่อง header บริษัทใช้ bodyPr หน้าตาเดียวกัน ห้ามโดน) ให้ตัวหนังสือ 14pt พอดีแถว 20.25pt
foreach ($tok in '{{CHK_INT}}','{{CHK_EXT}}') {
  $dr = [regex]::Replace($dr,
    '(<a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="none") (rtlCol="0" anchor="t">(?:(?!</xdr:sp>).)*?' + [regex]::Escape($tok) + ')',
    '$1 tIns="0" bIns="0" $2', 'Singleline')
}
Assert (([regex]::Matches($dr, 'tIns="0"')).Count -eq 2) 'chk labels insets zeroed'
# 4.2 ค่า UNIT/SECTION: anchor ล่างให้ตัวหนังสือนั่งบนเส้น (ชื่อยาว wrap ขึ้นบนแทนที่จะลอยทับเส้น)
foreach ($tok in '{{UNIT}}','{{SECTION}}') {
  $dr = [regex]::Replace($dr,
    '(<a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="square" rtlCol="0" anchor=")t("/>(?:(?!</xdr:sp>).)*?' + [regex]::Escape($tok) + ')',
    '${1}b$2', 'Singleline')
}
Assert (([regex]::Matches($dr, 'anchor="b"')).Count -eq 2) 'unit/section bottom-anchored'
# 4.3 กล่อง UNIT สูงขึ้น (เผื่อชื่อยาว 2 บรรทัด) + กล่อง SECTION กว้างขึ้นถึงคอลัมน์ AR
$dr = $dr.Replace('<xdr:row>3</xdr:row><xdr:rowOff>346075</xdr:rowOff>', '<xdr:row>3</xdr:row><xdr:rowOff>150000</xdr:rowOff>')
$dr = $dr.Replace('<xdr:to><xdr:col>42</xdr:col><xdr:colOff>582083</xdr:colOff>', '<xdr:to><xdr:col>43</xdr:col><xdr:colOff>400000</xdr:colOff>')
Write-Entry $zip 'xl/drawings/drawing1.xml' $dr

# ---------- workbook.xml + app.xml: ชื่อชีทหลัก WRM1 (2) -> เลขฟอร์ม ----------
$wb = Read-Entry $zip 'xl/workbook.xml'
$wb = $wb.Replace('name="WRM1 (2)"', 'name="FRM-EIB04"')
$wb = $wb.Replace("'WRM1 (2)'!", "'FRM-EIB04'!")
Assert ($wb.Contains('name="FRM-EIB04"')) 'sheet renamed'
Assert (-not ($wb -match [regex]::Escape('WRM1 (2)'))) 'no old sheet name left in workbook'
Write-Entry $zip 'xl/workbook.xml' $wb
$app = Read-Entry $zip 'docProps/app.xml'
$app = $app.Replace('WRM1 (2)', 'FRM-EIB04')
Write-Entry $zip 'docProps/app.xml' $app
$zip.Dispose()
Write-Output "OK -> $dst"
