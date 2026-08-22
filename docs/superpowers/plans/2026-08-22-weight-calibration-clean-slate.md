# Weight Calibration Clean-Slate Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all dormant legacy ABBA weight-calibration runtime and tooling while preserving the standard-weight / Cert Reference register and all balance-certificate behavior.

**Architecture:** Treat the legacy system as two independent remnants: document-generation code embedded in `cert-print.html`, and offline-shell/tooling references outside it. Establish a source-level clean-slate contract before each deletion, then remove only weight-job symbols and retain the shared balance and standard-weight interfaces.

**Tech Stack:** Static HTML/CSS/JavaScript, PowerShell test harnesses, headless Chrome, Service Worker cache.

## Global Constraints

- Do not restore the legacy ABBA UI, job data, calculator, exports, templates, Home card 10, or `10_weight_calibration.png`.
- Do not run database writes, schema changes, storage deletion, or the existing wipe SQL.
- Preserve `pageWeights`, `js/08-weights.js`, standard-weight master data, comparison-mass instrument records, and certificate PDF handling.
- Preserve all balance/instrument certificate output and every non-weight document type.
- The Home page remains nine cards.
- Keep a regression contract that rejects legacy weight-calibration runtime files and APP_SHELL entries.
- Use test-first RED → GREEN cycles and review each task before proceeding.

---

### Task 1: Remove the dormant ABBA certificate renderer and workbook builder

**Files:**
- Create: `tests/weight-clean-slate.test.html`
- Modify: `cert-print.html:156-162,295,332-559,1036-1048`
- Delete: `tools/build-weight-cert-template.ps1`

**Interfaces:**
- Consumes: `cert-print.html` balance builders `resolutionTextFor(CAL)`, `pageCover(CAL, certTotal)`, `pageEIB55(CAL, rows, rangeTxt, pageNo, total)`, `rangePages(CAL, opt)`, and `assemblePages()`.
- Produces: a balance-only `cert-print.html`; the public standard-weight functions `swCertPath()` and `loadStandardWeights()` remain untouched in `js/08-weights.js`.

- [ ] **Step 1: Create the failing clean-slate source contract**

Create `tests/weight-clean-slate.test.html` with this complete harness:

```html
<!doctype html><html><head><meta charset="utf-8"><title>weight clean slate test</title></head><body>
<pre id="out"></pre>
<script>
const results = [];
function t(name, fn) { try { fn(); results.push('PASS ' + name); } catch (e) { results.push('FAIL ' + name + ' — ' + e.message); } }
function ok(cond, msg) { if (!cond) throw new Error(msg); }
function text(url) { return new Promise((resolve, reject) => { const x = new XMLHttpRequest(); x.open('GET', url); x.onload = () => resolve(x.responseText); x.onerror = () => reject(new Error('อ่านไม่ได้ ' + url)); x.send(); }); }
function missing(url) { return new Promise(resolve => { const x = new XMLHttpRequest(); x.open('GET', url); x.onload = () => resolve(x.status === 404 || !x.responseText); x.onerror = () => resolve(true); x.send(); }); }
(async () => {
  const [CERT_PRINT, INDEX, ROUTER, HOME, WEIGHTS, SW] = await Promise.all([
    text('../cert-print.html'), text('../index.html'), text('../js/10-router.js'),
    text('../js/24-home.js'), text('../js/08-weights.js'), text('../sw.js')
  ]);
  t('ไม่มีตัวสร้างเอกสารสอบเทียบตุ้มน้ำหนักเดิม', () => {
    ['WEIGHT_CERT_TOTAL','pageWeightCertBody','pageWeightResults','WC_REC_PER_PAGE',
     'wcRecordBlock','pageWeightRecord','WC_UNC_PER_PAGE','wcUncBlock','pageWeightUnc',
     "CAL.doc_type === 'weight'",'wtDoc'].forEach(token =>
       ok(!CERT_PRINT.includes(token), 'ยังพบ ' + token));
  });
  t('ไม่มี UI route card และ cache ของระบบเดิม', () => {
    ['weightjobs','10_weight_calibration','weight-cal.html','js/weight-cal.js',
     'js/19-weight-jobs.js','js/20-weight-cert-xlsx.js','weight-cert-template.xlsx']
      .forEach(token => ok(![INDEX, ROUTER, HOME, SW].some(src => src.includes(token)), 'ยังพบ ' + token));
  });
  t('ทะเบียน Cert Reference ยังอยู่', () => {
    ['id="pageWeights"','id="nav-weights"'].forEach(token => ok(INDEX.includes(token), 'หาย ' + token));
    ['function swCertPath','async function loadStandardWeights'].forEach(token => ok(WEIGHTS.includes(token), 'หาย ' + token));
    ok(SW.includes('./js/08-weights.js'), 'js/08-weights.js ต้องอยู่ใน APP_SHELL');
  });
  const builderMissing = await missing('../tools/build-weight-cert-template.ps1');
  t('เครื่องมือสร้าง template เก่าถูกลบ', () =>
    ok(builderMissing, 'ยังมี build-weight-cert-template.ps1'));
  document.getElementById('out').textContent = results.join('\n');
  document.title = results.some(r => r.startsWith('FAIL')) ? 'FAIL' : 'ALL PASS';
})();
</script></body></html>
```

- [ ] **Step 2: Run the suite and verify the new contract fails for the intended remnants**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoProfile -File tools\run-tests.ps1
```

Expected: `weight-clean-slate.test.html` reports FAIL for weight document symbols and `build-weight-cert-template.ps1`; existing test pages remain PASS.

- [ ] **Step 3: Make shared certificate helpers balance-only**

In `cert-print.html`, change the cover resolution cell to:

```js
<div class="cv-row it"><span class="cv-sub">RESOLUTION :</span><span class="fill">${resolutionTextFor(CAL)}</span></div>
```

Change the `pageEIB55` heading comment to say it renders balance rows, then replace its weight-dependent preamble with:

```js
const eUnit = 'g';
const eErrDp = 3;
const eUncDp = 4;
const rowsHtml = rows.map(r => {
  const dp = Number.isFinite(r.dp) ? r.dp : eErrDp;
  return `<tr>
    <td>${r.label}</td>
    <td>${f(r.errG,dp)}</td><td>${f(r.Ug,eUncDp)}</td>
    <td>${f(r.sumEU,eUncDp)}</td><td>${f(r.diffEU,eUncDp)}</td>
    <td>${r.tol != null ? f(r.tol,dp) : '-'}</td>
    <td class="${r.result === 'FAIL' ? 'eib-fail' : ''}">${r.result}</td>
  </tr>`;
}).join('');
```

Remove only weight-specific CSS selectors (`.wt-std`, `.wt-res`, `.wt-abba`, `.wt-budget`, `.wt-note`, `.wt-end`, `.wt-h`, `.wt-recblk`, `.wt-rechd`, `.wt-recres`, `.wt-uncblk`, `.wt-unchd`, `.wt-uncres`) while retaining shared `.ct`, `.eib`, `.ws`, and `.un` styles.

- [ ] **Step 4: Delete the ABBA-only document builders and dispatch branch**

Delete the contiguous block beginning with the exact line:

```js
const WEIGHT_CERT_TOTAL = 3;
```

and ending immediately before this exact line:

```js
function rangePages(CAL, opt) {
```

This removes `wtCtHead`, `pageWeightCertBody`, `pageWeightResults`, `wcRecordBlock`, `pageWeightRecord`, `wcUncBlock`, and `pageWeightUnc`. Do not delete `rangePages` or the balance uncertainty functions below it.

In `assemblePages()`, delete the exact current branch from
`if (CAL.doc_type === 'weight') {` through its matching closing brace after
`return;`. The resulting function must begin directly with the preserved
balance range list:

```js
const list = (CAL.multi_range && Array.isArray(CAL.ranges) && CAL.ranges.length)
  ? CAL.ranges.map(r => Object.assign({}, CAL, rangeOverride(r)))
  : [CAL];
```

- [ ] **Step 5: Delete the tracked legacy workbook builder**

Delete only `tools/build-weight-cert-template.ps1`. Preserve `tools/build-frm-eib04-template.ps1`, `tools/build-frm-asset-out-template.ps1`, and `tools/sql/wipe-weight-cal-system.sql` (the SQL remains historical evidence and must not be executed).

- [ ] **Step 6: Run RED-to-GREEN verification**

Run `tools\run-tests.ps1` again with the bundled PowerShell command from Step 2.

Expected: every test page PASS, including four assertions in `weight-clean-slate.test.html`; no existing page reports FAIL or NO-RESULT.

- [ ] **Step 7: Run syntax and app-load checks**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoProfile -File tools\syntax-check-js.ps1
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoProfile -File tools\verify-app-load.ps1
git diff --check
```

Expected: all JavaScript files report `OK`, app-load ends `SUMMARY CLEAN`, and `git diff --check` has no errors.

- [ ] **Step 8: Browser-smoke the preserved certificate and Cert Reference flows**

Using the in-app Browser against a temporary same-origin local server:

1. Load `cert-print.html` with its default balance `CAL_DEFAULT` and verify at least one `.sheet`, the text `CERTIFICATE OF CALIBRATION`, and no console error.
2. Load the main app with a disposable in-memory data fixture, navigate to `weights`, and verify `pageWeights` is visible and `loadStandardWeights` resolves.
3. Confirm no `weightjobs` page/menu/card is present.
4. Stop the server and remove only the disposable harness.

- [ ] **Step 9: Commit Task 1**

```powershell
git add -- cert-print.html tests/weight-clean-slate.test.html tools/build-weight-cert-template.ps1
git commit -m "refactor: remove legacy weight calibration renderer"
```

---

### Task 2: Finish the offline-shell clean-slate contract

**Files:**
- Modify: `tests/reference-home.test.html:144-155`
- Modify: `sw.js:1,49-54`

**Interfaces:**
- Consumes: Task 1's absence contract and the existing `CACHE_NAME = 'calibration-app-vN'` convention.
- Produces: `calibration-app-v142`; APP_SHELL continues to include `./js/08-weights.js` and excludes every legacy weight-calibration runtime path.

- [ ] **Step 1: Add a failing stale-comment and preserved-register test**

Extend the existing test named `SW เก็บ cache หลังโหลดครั้งแรกได้ และไม่มีซากระบบสอบเทียบตุ้มน้ำหนัก` with:

```js
ok(SW.indexOf('weight-cal.html ที่เพิ่งถอดออก') === -1,
  'ยังมีคอมเมนต์ runtime เก่าของ weight-cal ใน Service Worker');
has(SW, './js/08-weights.js', 'ทะเบียน Cert Reference ต้องใช้งานออฟไลน์');
const cacheVersion = Number((/calibration-app-v(\d+)/.exec(SW) || [])[1]);
ok(cacheVersion >= 142, 'การเปลี่ยน sw.js ต้อง bump cache เป็น v142 หรือสูงกว่า');
```

- [ ] **Step 2: Run the test and verify RED**

Run `tools\run-tests.ps1` with bundled PowerShell.

Expected: `reference-home.test.html` fails because the stale comment is present and cache version is 141.

- [ ] **Step 3: Remove the stale comment and bump the cache**

In `sw.js`, change:

```js
const CACHE_NAME = 'calibration-app-v141';
```

to:

```js
const CACHE_NAME = 'calibration-app-v142';
```

Replace the three-line comment above `./balance-cal.html` with:

```js
// หน้าสอบเทียบเครื่องชั่งเป็นงานหลักและต้องเปิดได้เมื่อออกหน้างานแบบออฟไลน์
```

Do not add any removed weight-calibration file to APP_SHELL.

- [ ] **Step 4: Run GREEN and full verification**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoProfile -File tools\run-tests.ps1
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoProfile -File tools\syntax-check-js.ps1
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoProfile -File tools\verify-app-load.ps1
git diff --check
git status --short --untracked-files=all
```

Expected: all test pages PASS, syntax check reports zero problems, app-load ends `SUMMARY CLEAN`, diff check is clean, and status contains only the Task 2 files before commit.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- sw.js tests/reference-home.test.html
git commit -m "chore: finalize weight calibration clean slate"
```

---

## Final review and handoff

- Generate a review package from the implementation base commit to the final HEAD.
- Request an independent whole-range review against `docs/superpowers/specs/2026-08-22-weight-calibration-clean-slate-design.md`.
- Fix every Critical or Important finding with a fresh RED → GREEN cycle and re-review.
- Run the full test, syntax, app-load, browser, `git diff --check`, and clean-worktree verification again before claiming completion.
- Do not push; leave the verified commits on local `main` for the user to push.
