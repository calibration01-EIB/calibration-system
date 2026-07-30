# Build assets/weight-cert-template.xlsx — form-exact template for the weight-calibration
# certificate exporter, derived from real ILC example files.
#
# Sheets produced (canonical names the exporter expects):
#   Cover  <- master "FRM-CAL54-00-1265" (cert cover page 1)
#   CertP2 <- master "25M002 P2"          (cert pages 2 AND 3 STACKED in one sheet — see note below)
#   Rec    <- WI      "5040101-03"        (ABBA calibration record)
#   Unc    <- WI      "uncer"             (uncertainty budget worksheet)
#   Eval   <- WI      "ใบประเมินผลการสอบเทียบ " (evaluation sheet; note trailing space in source name)
#
# NOTE on CertP2/CertP3: the example master sheet "25M002 P2" contains BOTH cert page 2
# (calibration conditions / reference standards, rows ~1-38) AND cert page 3 (results table,
# rows ~39-82) stacked in a single physical worksheet. We keep this as ONE sheet named
# "CertP2" rather than splitting it — that is what the example itself does, and splitting
# would require re-deriving page break / print-area layout that isn't ours to invent.
# The exporter must treat "CertP3" as the lower region of the CertP2 sheet (results table
# starts around row 49/55, see anchors below) — there is no separate CertP3 sheet in the
# generated workbook.
#
# Values-only: after copying, every sheet's UsedRange is flattened (Value2 = Value2) to kill
# formulas / cross-workbook references, then well-identified stale sample-data cells (this
# job's actual customer/instrument/reading values) are cleared with Value2 = "" so unwritten
# regions render empty. ClearContents() throws on merged cells in this Excel COM build, so
# Value2 = "" is used uniformly (same net effect: clears value, keeps formatting/merge).

$ErrorActionPreference = 'Stop'
$root   = "c:\Users\8014\Desktop\calibration-system-main"
$master = "$root\ตัวอย่าง\26M001-0 1-500 mg(CLCLSB06-WI01-12 (ILC).xlsx"
$wi     = "$root\ตัวอย่าง\26M001\26M001-0 CLCLSB06-WI01 1mg.xlsx"
$out    = "$root\assets\weight-cert-template.xlsx"

function Clear-Cells($sheet, [string[]]$addrs) {
  foreach ($a in $addrs) {
    $sheet.Range($a).Value2 = ""
  }
}

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.AskToUpdateLinks = $false
try {
  $dst = $xl.Workbooks.Add()
  while ($dst.Sheets.Count -gt 1) { $dst.Sheets.Item($dst.Sheets.Count).Delete() }

  function CopySheet($srcWbPath, $srcName, $newName) {
    $src = $xl.Workbooks.Open($srcWbPath, [Type]::Missing, $true) # ReadOnly
    $sh = $src.Sheets.Item($srcName)
    $sh.Copy([Type]::Missing, $dst.Sheets.Item($dst.Sheets.Count))  # append at end
    $moved = $dst.Sheets.Item($dst.Sheets.Count)
    $moved.Name = $newName
    # values-only: kill cross-sheet/external formulas, keep formatting/merges/images
    $ur = $moved.UsedRange
    $ur.Value2 = $ur.Value2
    $src.Close($false)
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($src) | Out-Null
    return $moved
  }

  $cover  = CopySheet $master "FRM-CAL54-00-1265"              "Cover"
  $certp2 = CopySheet $master "25M002 P2"                      "CertP2"
  $rec    = CopySheet $wi     "5040101-03"                      "Rec"
  $unc    = CopySheet $wi     "uncer"                           "Unc"
  $eval   = CopySheet $wi     "ใบประเมินผลการสอบเทียบ "        "Eval"

  # delete the default blank first sheet
  $dst.Sheets.Item(1).Delete()

  # ---- Blank stale sample data (this specific job's real values), keep labels/formatting ----

  # Cover: customer/instrument identity + dates + signers (job-specific)
  Clear-Cells $cover @(
    "K3","I10",
    "D13","N13","D14","N14","D15","N15",
    "D17","D18",
    "F19","F20","F21","F22","F23","F24",
    "D25","D26","D27",
    "D32","H34"
  )

  # CertP2 (holds cert page 2 header + page 3 results table): identity/date fields + results rows
  Clear-Cells $certp2 @(
    "K1","F4","F5","F6","F7","F8","C9",
    "F43","F44","F45","F46","F47","F48","C48"
  )
  # results table (page 3 portion): nominal / marking / conventional mass / uncertainty per weight
  Clear-Cells $certp2 @("B55:I66")

  # Rec: ABBA record — job identity + unknown-weight identity + raw ABBA readings + calc results
  Clear-Cells $rec @(
    "M2",
    "B11","D11","I11","L11","M11",
    "B12","F12","B13","F13","D15",
    "B28:N30",
    "N31","N32","L33","M35","N35","K38"
  )

  # Unc: uncertainty budget — job/instrument identity + per-point budget values
  Clear-Cells $unc @(
    "B2","C2","E2","H2","C3","F3",
    "E9:J16","K12"
  )

  # Eval: evaluation sheet — header identity fields + point-1 stale results row
  Clear-Cells $eval @(
    "H7","H8","B9","C9","E9","H9",
    "A14:I14"
  )

  $dst.SaveAs($out, 51)  # 51 = xlOpenXMLWorkbook
  $dst.Close($true)
  Write-Output "wrote $out"
} finally {
  $xl.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
