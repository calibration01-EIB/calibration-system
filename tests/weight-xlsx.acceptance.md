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

## Known limitations (non-blocking, follow-up / V2)

1. **Standard nominal unit:** the standards table shows each standard's nominal in its stored unit,
   e.g. `CLASS E2 ( 0.001 g )`, whereas the paper cert prints `( 1 mg )`. Comes from
   `WC_refLines` in `wcBuildCAL` (shared with the HTML cert), not the exporter.
2. **Error display precision:** the results/`F` column renders the error at 4 dp
   (`− 0.0094`) whereas the paper cert matches the error's dp to the uncertainty's (`− 0.009`).
   Comes from `conventional_mass_str` in `wcBuildCAL` (shared with the HTML cert). Values correct.
3. **Table capacity:** template has 10 reference rows (21-30) and 12 result rows (55-66). Jobs with
   more unique standards or points would overflow into boilerplate. 26M001 fits (9 std + 1 comp,
   12 results). Larger jobs need OOXML row insertion or a taller template.
4. **Rec ref cal-date (`F8`)** is not populated (not carried in the model). Pass/fail on the Rec
   sheet is a static label pair; the actual pass/fail is written on the Eval sheet (`I14`).
