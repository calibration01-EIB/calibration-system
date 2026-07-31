# Weight Cert XLSX Export — Acceptance (golden job 26M001)

Reproduces the real ILC job `ตัวอย่าง/26M001` (12-point weight-set, 1 mg – 500 mg) end to end
through the **real** engine + exporter: `wcComputePoint` → `wcBuildCAL` → `wxBuildZip`
(no hand-mocked values), then opens the result in Excel COM and checks cells.

Harness: `scratchpad/gen2.html` (loads `js/weight-cal.js` + `js/20-weight-cert-xlsx.js` + JSZip,
builds the 12 golden points from `tests/weight-cal.acceptance.test.html`, emits base64) →
decoded to `golden.xlsx` → verified with Excel COM.

## Verified (all PASS)

- **Structure:** 38 sheets = `Cover, CertP2, Rec_1..12, Unc_1..12, Eval_1..12`. Opens with **no
  repair prompt**. `xl/media` = 5 images (shared once, **not** duplicated ×12). File ≈ 6.8 MB.
- **Cover:** `K3`=cert, `D13`=client, `D19`=equipment, `F19`=range, `F20`=mfr, `F21`=model,
  `F22`=serial, `F23`=id, `D32`=calibrated-by, `H34`=tech-mgr. 19 pictures/logos preserved.
- **CertP2 identity:** `K1`=cert, `C4`=equipment, `F5`=mfr; page-3 restated block filled.
- **CertP2 results table (rows 55-66):** all 12 rows match the golden errors/U from the cert —
  1 mg −0.002/0.006 … 500 mg −0.006/0.025. (Error values correct; see note 2 on display dp.)
- **CertP2 standards/comparator table (rows 21-30):** filled from `procedure_refs` + `comparators`,
  numbered, stale template sample rows cleared.
- **Rec_1 (WI01):** `M2`=cert, `B3`=`AT21`, `C20`=air density, `N32`=conventional mass
  0.000997966 g, `L33`=error −0.00203 mg, ABBA `D28`=1e-6.
- **Unc_1:** `B2`=nominal, `E9`=ref U, `I15`=u 0.002930, `I16`=**raw** U 0.005859 (the unrounded
  combined U, matching the source sheet — the reported 0.006 lives on the cert only).
- **Eval_1:** `H7`=cert, `A14`=0.001 g, `B14`=error (g), `I14`=`PASS`.

## V2 fixes applied (2026-07-31)

1. **Standard nominal unit — FIXED.** `WC_refLines` now formats the standard nominal via
   `wcReadableMass` (<1 g → mg, <1 kg → g, else kg), so the standards table prints
   `CLASS E2 ( 1 mg )` … `( 500 mg )` matching the paper cert (also improves the HTML cert).
2. **Error/uncertainty display precision — FIXED.** `wcBuildCAL` now renders the error and the
   reported U at the uncertainty's 2-sig-fig decimal count (`wcDp2sf`), e.g. U `0.0060` → error
   `− 0.0020`; U `0.010` → error `− 0.009`. Matches the paper cert for 11/12 golden rows.
   *Boundary note:* WI08 (50 mg) shows `− 0.003` where the paper shows `− 0.004`. The computed
   error is −0.00347 mg (rounds to −0.003 at 3 dp); the paper's −0.004 implies its stored raw was
   ≥ 0.0035. The two agree within the validated ±0.0005 mg tolerance — an input-precision boundary,
   not a formatting defect (the value was always −0.00347, previously masked by fixed-4dp display).
3. **Table capacity — GUARDED.** Standards/comparator fill is capped at 10 rows (21-30) and results
   at 12 rows (55-66) so oversized jobs no longer overwrite boilerplate; `wcExportXlsx` shows a
   warning toast when a job exceeds either (per-point Rec/Unc/Eval sheets are still emitted for
   every point). Full support for larger tables needs OOXML row insertion or a taller template.

## Known limitations (still open, non-blocking)

- **Rec ref cal-date (`F8`)** is not populated (not carried in the model). Pass/fail on the Rec
  sheet is a static label pair; the actual pass/fail is written on the Eval sheet (`I14`).
