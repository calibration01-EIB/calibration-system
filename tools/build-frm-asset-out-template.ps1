# สร้าง template ใบขออนุญาตนำทรัพย์สินออกนอกบริษัท จากไฟล์ตัวอย่าง
# - blank ค่าตัวอย่าง คง label + เลย์เอาต์ + โลโก้ + รูป + เส้นกรอบ + merged + styles
$ErrorActionPreference = 'Stop'
$src = "c:\Users\8014\Desktop\calibration-system-main\ตัวอย่าง\RPM1BI11-PP01  A-7 Force DFG100.xlsx"
$out = "c:\Users\8014\Desktop\calibration-system-main\assets\frm-asset-out-template.xlsx"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false; $excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Open($src)
  $ws = $wb.Worksheets.Item(1)
  # 1) เซลล์ label+value รวม → คงเฉพาะ label (ตัด value ตัวอย่าง)
  $ws.Range("A6").Value2  = "ชื่อทรัพย์สิน   "
  $ws.Range("G6").Value2  = "รหัสทรัพย์สิน   "
  $ws.Range("G8").Value2  = "รหัส    ID.No.  "
  $ws.Range("A12").Value2 = "รายละเอียด/ปัญหางานซ่อม   "
  # 2) เซลล์ value แยก → ล้าง
  # หมายเหตุ: ClearContents() ล้มเหลวบนเซลล์ที่ถูกผสาน (COM error "เราทำสิ่งนั้นกับเซลล์ที่ถูกผสานไม่ได้")
  # ใน Excel COM รุ่นนี้ ใช้ Value2 = "" แทนซึ่งได้ผลลัพธ์เดียวกัน (ล้างค่า คงสไตล์/merge)
  foreach ($a in @("H4","H16","G18","B20","H24","I28","J28","I40","J40","C24")) { $ws.Range($a).Value2 = "" }
  # 3) normalize: H40 เคยมี "ชื่อหน่วยงาน RD แพคกิ้ง" ซ้ำ → คง label อย่างเดียว
  $ws.Range("H40").Value2 = "ชื่อหน่วยงาน "
  $ws.Range("H28").Value2 = "ชื่อหน่วยงาน  "
  # J28/J40 label prefix คงไว้ (ค่า cost center ต่อท้ายตอน export) — ตั้งเป็น label ว่าง
  $ws.Range("J28").Value2 = ""
  $ws.Range("J40").Value2 = ""
  $wb.SaveAs($out, 51)  # 51 = xlOpenXMLWorkbook (.xlsx)
  $wb.Close($false)
  Write-Output "BUILT: $out"
} finally { $excel.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }

# 4) รูปตัวอย่าง (image2.jpeg) เป็นภาพจริงของทรัพย์สินตัวอย่าง (Force Gauge DFG100)
#    ต้องแทนที่ด้วยภาพขาวเปล่าขนาดเท่ากัน (245x404) ก่อนแจกจ่าย template
#    ไม่งั้นใบที่ export โดยไม่แนบรูป จะโชว์รูปเครื่องมือตัวอย่างแทน
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem
$blankPath = Join-Path $env:TEMP "frm-asset-out-blank-image2.jpg"
$bmp = New-Object System.Drawing.Bitmap 245,404
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White); $g.Dispose()
$bmp.Save($blankPath, [System.Drawing.Imaging.ImageFormat]::Jpeg); $bmp.Dispose()

$zip = [System.IO.Compression.ZipFile]::Open($out, 'Update')
try {
  $entry = $zip.GetEntry('xl/media/image2.jpeg')
  if ($entry) { $entry.Delete() }
  $newEntry = $zip.CreateEntry('xl/media/image2.jpeg')
  $es = $newEntry.Open()
  $bytes = [System.IO.File]::ReadAllBytes($blankPath)
  $es.Write($bytes, 0, $bytes.Length)
  $es.Close()
} finally { $zip.Dispose() }
Remove-Item $blankPath -ErrorAction SilentlyContinue
Write-Output "BLANKED: xl/media/image2.jpeg in $out"
