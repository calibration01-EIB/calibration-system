# tools/build-frm-eib04-template.ps1
# สร้าง assets/frm-eib04-template.xlsx จาก ตัวอย่าง/FRM-EIB04 (TP) เเผนสอบเทียบเครื่องมือ.xlsx
# (ต้นแบบผู้ใช้จัดเอง 2026-07-16: หัวฟอร์มอยู่ในเซลล์ทั้งหมด ไม่มีกล่องข้อความค่า, 8 เครื่อง/หน้า)
# หมายเหตุ: ไฟล์นี้มีภาษาไทย ต้อง save เป็น UTF-8 มี BOM
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$src  = Join-Path $root "ตัวอย่าง\FRM-EIB04 (TP) เเผนสอบเทียบเครื่องมือ.xlsx"
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

# ---------- sharedStrings (อ่านอย่างเดียว เพื่อแปลงหัวฟอร์มเป็น inlineStr) ----------
$ssXml = Read-Entry $zip 'xl/sharedStrings.xml'
$sis = [regex]::Matches($ssXml, '<si>(.*?)</si>', 'Singleline')
function Get-SharedText($idx) {
  ([regex]::Matches($sis[$idx].Groups[1].Value, '<t[^>]*>([^<]*)</t>') | ForEach-Object { $_.Groups[1].Value }) -join ''
}

# ---------- sheet1.xml ----------
$sheet = Read-Entry $zip 'xl/worksheets/sheet1.xml'

# 1) เซลล์ checkbox -> inlineStr + token ☑/☐ (เซลล์เส้นใต้ Month/Year/กลุ่ม/หน่วยงาน/แผนก คงเดิม
#    ค่าไปลง TextBox ใน drawing แทน จะได้เห็นเส้น ______ แบบฟอร์มกระดาษ)
$headerCells = @(
  @{ ref = 'B6';  prefix = '{{CHK_INT}} ' },
  @{ ref = 'E6';  prefix = '{{CHK_EXT}} ' },
  @{ ref = 'Z6';  prefix = '{{CHK_DRUG}} ' },
  @{ ref = 'AI6'; prefix = '{{CHK_COS}} ' },
  @{ ref = 'AN6'; prefix = '{{CHK_OTHER}} '; tokens = @('{{OTHER_TEXT}}') }
)
foreach ($hc in $headerCells) {
  $m = [regex]::Match($sheet, '<c r="' + $hc.ref + '" s="(\d+)" t="s"><v>(\d+)</v></c>')
  Assert $m.Success ("header cell " + $hc.ref)
  $txt = Get-SharedText ([int]$m.Groups[2].Value)
  if ($hc.tokens) { foreach ($tok in $hc.tokens) { $txt = ([regex]'_{2,}').Replace($txt, $tok, 1) } }
  if ($hc.prefix) { $txt = $hc.prefix + $txt }
  $esc = $txt.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;')
  $repl = '<c r="' + $hc.ref + '" s="' + $m.Groups[1].Value + '" t="inlineStr"><is><t xml:space="preserve">' + $esc + '</t></is></c>'
  $sheet = $sheet.Replace($m.Value, $repl)
}
foreach ($tok in '{{CHK_INT}}','{{CHK_EXT}}','{{CHK_DRUG}}','{{CHK_COS}}','{{CHK_OTHER}}','{{OTHER_TEXT}}') {
  Assert ($sheet.Contains($tok)) "sheet token $tok"
}

# 2) ลบแถวตัวอย่างข้อมูล/ปิดตาราง/ลายเซ็น (r >= 10) — JS สร้างเองตอน export
$sheet = [regex]::Replace($sheet, '<row r="(\d+)"[^>]*(?:/>|>.*?</row>)',
  { param($m) if ([int]$m.Groups[1].Value -ge 10) { '' } else { $m.Value } }, 'Singleline')
Assert (-not ($sheet -match '<row r="10"')) 'rows >= 10 removed'

# 3) ลบ merge ของแถว >= 10 แล้วนับ count ใหม่
$sheet = [regex]::Replace($sheet, '<mergeCell ref="[A-Z]+(\d+):[A-Z]+\d+"/>',
  { param($m) if ([int]$m.Groups[1].Value -ge 10) { '' } else { $m.Value } })
$count = ([regex]::Matches($sheet, '<mergeCell ')).Count
$sheet = [regex]::Replace($sheet, '<mergeCells count="\d+">', "<mergeCells count=""$count"">")

# 4) dimension
$sheet = $sheet -replace '<dimension ref="[^"]*"/>', '<dimension ref="A1:AR9"/>'
Write-Entry $zip 'xl/worksheets/sheet1.xml' $sheet

# ---------- styles.xml: เพิ่มชุดแถบฟ้า (ต้นแบบไม่มีตัวอย่างแถบสี) ----------
# clone style ช่องวัน generic (xf 159/160/161 = border 9/10/11) + fill ฟ้า FF00B0F0 + จัดกลาง
# id ที่ได้: 178=day1Blue/botNum1, 179=dayBlue/botNum, 180=day31Blue/botNum31 — ต้องตรง FRM_STYLE ใน js/15-plan-export.js
$st = Read-Entry $zip 'xl/styles.xml'
$fillsM = [regex]::Match($st, '<fills count="(\d+)">')
$blueFillId = [int]$fillsM.Groups[1].Value
$st = $st.Replace($fillsM.Value, '<fills count="' + ($blueFillId + 1) + '">')
$st = $st.Replace('</fills>', '<fill><patternFill patternType="solid"><fgColor rgb="FF00B0F0"/><bgColor indexed="64"/></patternFill></fill></fills>')
$xfsM = [regex]::Match($st, '<cellXfs count="(\d+)">')
$xfBase = [int]$xfsM.Groups[1].Value
Assert ($xfBase -eq 178) "cellXfs count 178 (got $xfBase) — ถ้าต้นแบบเปลี่ยน ต้องแก้ FRM_STYLE ใน js/15-plan-export.js ให้ตรง"
$st = $st.Replace($xfsM.Value, '<cellXfs count="' + ($xfBase + 3) + '">')
$blueXfs = ''
foreach ($bId in 9, 10, 11) {
  $blueXfs += '<xf numFmtId="0" fontId="5" fillId="' + $blueFillId + '" borderId="' + $bId + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" shrinkToFit="1"/></xf>'
}
$st = $st.Replace('</cellXfs>', $blueXfs + '</cellXfs>')
Write-Entry $zip 'xl/styles.xml' $st

# ---------- drawing1.xml: ลบกล่องสี่เหลี่ยม checkbox เปล่า (ใช้ ☑/☐ ในเซลล์แทน) โลโก้+หัวบริษัทคงไว้
#            + เพิ่ม TextBox ค่า Month/Year/Group/Unit/Section ทับเส้น ______ (ตำแหน่งจาก WRM1 เดิม + จูน v83:
#            unit/section anchor ล่างนั่งบนเส้น, unit สูงรับชื่อ 2 บรรทัด, section กว้างถึงคอลัมน์ AR) ----------
$dr = Read-Entry $zip 'xl/drawings/drawing1.xml'
$dr = [regex]::Replace($dr, '<xdr:(one|two)CellAnchor[^>]*>.*?</xdr:\1CellAnchor>',
  { param($m) $b = $m.Value
    $isEmptyBox = ($b -match '<xdr:sp ') -and (-not ($b -match '<a:t>'))
    if ($isEmptyBox) { '' } else { $b } }, 'Singleline')
Assert ($dr -match 'รูปภาพ 20') 'logo still present'
Assert (-not ($dr -match 'สี่เหลี่ยมผืนผ้า')) 'checkbox rectangles removed'
Assert ($dr -match 'TextBox 2') 'company header still present'

function New-ValueBox($id, $name, $from, $to, $anchor, $alignCtr, $token) {
  $algn = if ($alignCtr) { '<a:pPr algn="ctr"/>' } else { '' }
  '<xdr:twoCellAnchor><xdr:from>' + $from + '</xdr:from><xdr:to>' + $to + '</xdr:to>' +
  '<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="' + $id + '" name="' + $name + '"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr>' +
  '<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></xdr:spPr>' +
  '<xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="square" rtlCol="0" anchor="' + $anchor + '"/><a:lstStyle/>' +
  '<a:p>' + $algn + '<a:r><a:rPr lang="en-US" sz="1100"/><a:t>' + $token + '</a:t></a:r><a:endParaRPr lang="th-TH" sz="1100"/></a:p>' +
  '</xdr:txBody></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>'
}
function Anchor($col, $colOff, $row, $rowOff) {
  '<xdr:col>' + $col + '</xdr:col><xdr:colOff>' + $colOff + '</xdr:colOff><xdr:row>' + $row + '</xdr:row><xdr:rowOff>' + $rowOff + '</xdr:rowOff>'
}
$boxes =
  (New-ValueBox 3001 'ValueBox Month'   (Anchor 17 130171 3 28576)  (Anchor 22 148163 3 314326) 't' $true  '{{MONTH}}') +
  (New-ValueBox 3002 'ValueBox Year'    (Anchor 24 114300 3 17992)  (Anchor 29 123825 3 303742) 't' $true  '{{YEAR}}') +
  (New-ValueBox 3003 'ValueBox Group'   (Anchor 18 104775 4 47625)  (Anchor 26 171450 4 304800) 't' $true  '{{GROUP}}') +
  (New-ValueBox 3004 'ValueBox Unit'    (Anchor 35 68787  3 150000) (Anchor 39 457200 4 361951) 'b' $false '{{UNIT}}') +
  (New-ValueBox 3005 'ValueBox Section' (Anchor 40 402167 3 254002) (Anchor 42 582083 4 380999) 'b' $false '{{SECTION}}')
  # section สิ้นสุดใน AQ (คอลัมน์ 1-based 43) เท่านั้น — ถ้าเลยเข้า AR พื้นที่พิมพ์จะกว้างเกินหน้า เกิดหน้าเปล่าแนวนอน; ชื่อยาว wrap ขึ้น 2 บรรทัด
$dr = $dr.Replace('</xdr:wsDr>', $boxes + '</xdr:wsDr>')
foreach ($tok in '{{MONTH}}','{{YEAR}}','{{GROUP}}','{{UNIT}}','{{SECTION}}') {
  Assert ($dr.Contains($tok)) "drawing token $tok"
}
Write-Entry $zip 'xl/drawings/drawing1.xml' $dr

# ---------- workbook.xml + app.xml: ชื่อชีท "FRM-EIB04(TP) " -> "FRM-EIB04" ----------
$wb = Read-Entry $zip 'xl/workbook.xml'
$wb = $wb.Replace('name="FRM-EIB04(TP) "', 'name="FRM-EIB04"')
$wb = $wb.Replace("'FRM-EIB04(TP) '!", "'FRM-EIB04'!")
Assert ($wb.Contains('name="FRM-EIB04"')) 'sheet renamed'
Assert (-not ($wb -match [regex]::Escape('FRM-EIB04(TP)'))) 'no old sheet name left in workbook'
Write-Entry $zip 'xl/workbook.xml' $wb
$app = Read-Entry $zip 'docProps/app.xml'
$app = $app.Replace('FRM-EIB04(TP) ', 'FRM-EIB04')
Write-Entry $zip 'docProps/app.xml' $app

$zip.Dispose()
Write-Output "OK -> $dst"
