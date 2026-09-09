# Calibration Results Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รวมหน้าติดตามผลสอบเทียบเดิมเป็นแท็บ “ผลและใบรับรอง” ภายในหน้าแผนสอบเทียบ พร้อมคงข้อมูล สิทธิ์ และลิงก์เก่าไว้ครบถ้วน

**Architecture:** ย้าย markup เดิมเข้า container ของ `pagePlan` และให้ state `results` ใน calibration-work controller สลับระหว่างพื้นผิวชุดงานกับพื้นผิวผลสอบเทียบ Router จะ normalize route เก่า `calrecs` เป็น `plan/results`; badge เมนูแผนใช้ renderer กลางรวมจำนวนงานเปิดกับใบรับรองรอแนบสแกนเพื่อกำจัด async overwrite

**Tech Stack:** HTML5, CSS, JavaScript แบบ global modules, Supabase JS client, browser-based contract tests, PowerShell test runner

## Global Constraints

- ใช้ชื่อแท็บภาษาไทยว่า “ผลและใบรับรอง”
- ห้ามลบหรือ migrate ตาราง `calibration_records` ประวัติ หรือไฟล์ PDF/ไฟล์สแกนใน Storage
- การแนบไฟล์สแกนยังอนุญาตเฉพาะ `admin` และ `editor`
- ลิงก์เก่า `showPage('calrecs')` ต้องเปิดหน้าแผนสอบเทียบที่แท็บ `results`
- กระดิ่งรอแนบสแกนต้องเปิดแท็บ `results` พร้อมตัวกรอง `scan`
- badge `navPlanBadge` ต้องเท่ากับจำนวนชุดงานเปิดบวกจำนวนใบรับรองสถานะ `issued`
- ห้ามเปลี่ยน workflow ชุดงาน รูปแบบ PDF สองช่วง หรือกฎ RLS

---

### Task 1: รวมโครงสร้างหน้าจอและทางเข้าที่ซ้ำซ้อน

**Files:**
- Modify: `index.html:2584-2589,3035-3268,3800-3810`
- Modify: `js/24-home.js:1-30`
- Modify: `js/25-dashboard-ui.js:1-20`
- Delete: `assets/tiles/03_calibration_tracking.png`
- Test: `tests/calibration-work-batch.test.html`
- Test: `tests/reference-home.test.html`

**Interfaces:**
- Consumes: element ids เดิม `calrecTiles`, `calrecStatus`, `calrecBody`, `calrecEmpty` จาก `23-cal-records.js`
- Produces: `button[data-cw-primary="results"]`, `#cwWorkSurface`, `#cwResultsSurface`; ไม่มี `#pageCalrecs`, `#nav-calrecs`, `#navCalrecsBadge`

- [ ] **Step 1: แก้ contract tests ให้กำหนดโครงสร้างใหม่**

ใน `tests/calibration-work-batch.test.html` เปลี่ยน assertion สี่แท็บเป็นห้าแท็บ และเพิ่ม contract ของสอง surfaces:

```javascript
t('defines five primary plan sections including results', () => {
  const parsed = new DOMParser().parseFromString(indexSource, 'text/html');
  const tabs = [...parsed.querySelectorAll('#cwPrimaryTabs button[data-cw-primary]')];
  eq(tabs.length, 5, 'primary plan tab count');
  eq(JSON.stringify(tabs.map(tab => [tab.dataset.cwPrimary, tab.textContent.trim()])), JSON.stringify([
    ['select', 'เลือกเครื่อง'], ['batches', 'ชุดงาน'], ['waiting', 'รอดำเนินการ'],
    ['history', 'ประวัติ'], ['results', 'ผลและใบรับรอง']
  ]), 'primary plan tab keys and labels');
  ok(parsed.getElementById('cwWorkSurface'), 'work surface exists');
  ok(parsed.getElementById('cwResultsSurface'), 'results surface exists');
  ok(!parsed.getElementById('pageCalrecs'), 'standalone results page removed');
});
```

ใน `tests/reference-home.test.html` ปรับ expected card order ให้ไม่มี `calrecs` และยืนยันทางเข้ามือถือไม่ซ้ำ:

```javascript
const expected = [['dashboard','Dashboard'],['list','รายการเครื่องมือ'],
  ['cert','ลำดับเลข Cert'],['weights','ใบ Cert Reference'],['plan','แผนสอบเทียบ'],
  ['soon','ใบบันทึกประจำวันเครื่องชั่ง'],['repairs','งานซ่อม'],['gate','นำของออกนอกสถานที่']];
lacks(HOME_JS, "k:'calrecs'", 'standalone home tile');
lacks(INDEX, 'id="nav-calrecs"', 'standalone desktop nav');
lacks(INDEX, 'data-page="calrecs"', 'standalone mobile nav');
```

- [ ] **Step 2: รัน tests เพื่อยืนยันว่า fail ก่อนแก้**

Run: `powershell -File tools/run-tests.ps1`

Expected: FAIL ที่จำนวน/รายชื่อ primary tabs, `cwWorkSurface`, `cwResultsSurface` และทางเข้า `calrecs` เดิม

- [ ] **Step 3: ย้าย markup เดิมเข้าแท็บใหม่และลบทางเข้าซ้ำ**

ใน `index.html` เพิ่มปุ่ม:

```html
<button type="button" data-cw-primary="results" onclick="cwSetPrimaryTab('results')" onkeydown="cwHandlePrimaryTabKey(event)">ผลและใบรับรอง</button>
```

ครอบ `cwNotifications`, `cwTabs`, `cwMetrics`, `cwBatchList`, `cwBatchDetail`, `cwActionError` ด้วย `<div id="cwWorkSurface">...</div>` และย้ายเนื้อหาภายใน `pageCalrecs` เดิมมาไว้ใน:

```html
<section id="cwResultsSurface" hidden aria-labelledby="cwResultsTitle">
  <div class="ax-page-head">
    <div><h2 id="cwResultsTitle">ผลและใบรับรอง</h2><p id="calrecCount">–</p></div>
    <div class="ax-head-actions">
      <button type="button" class="ax-ghost-btn" onclick="loadCalrecsPage()"><span>↻</span><span>รีเฟรช</span></button>
    </div>
  </div>
  <!-- ย้าย calrecTiles, filters, table และ empty state เดิมมาที่นี่โดยคง id เดิม -->
</section>
```

ลบ `nav-calrecs`, `pageCalrecs` wrapper และ mobile nav `data-page="calrecs"` โดยไม่ลบ `calHistoryModal` ใน `index.html` ลบ module `calrecs` จาก `HOME_MODULES` และ `HOME_TILE_ART` ใน `js/24-home.js` และลบ `assets/tiles/03_calibration_tracking.png` ซึ่งไม่มีผู้ใช้งานเหลือ จากนั้นเปลี่ยน dashboard action ใน `js/25-dashboard-ui.js` เป็น:

```javascript
go:"openCalibrationResults()"
```

- [ ] **Step 4: รัน tests และ commit โครงสร้าง**

Run: `powershell -File tools/run-tests.ps1`

Expected: contract ใหม่ผ่าน; test behavior ของ controller อาจยัง fail จน Task 2

```bash
git add index.html js/24-home.js js/25-dashboard-ui.js assets/tiles/03_calibration_tracking.png tests/calibration-work-batch.test.html tests/reference-home.test.html
git commit -m "feat: place calibration results inside plan"
```

### Task 2: เพิ่ม state ของแท็บผลสอบเทียบและ legacy route alias

**Files:**
- Modify: `js/29-calibration-work.js:131,266-337,408-449,748-782,2570-2590`
- Modify: `js/10-router.js:1-70`
- Modify: `js/23-cal-records.js:1-35`
- Test: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: `#cwWorkSurface`, `#cwResultsSurface`, `loadCalrecsPage()`
- Produces: `cwSetPrimaryTab('results'): boolean`, `openCalibrationResults(filter?: string): boolean`, route normalization `calrecs -> plan/results`

- [ ] **Step 1: เพิ่ม failing behavior tests สำหรับการสลับ surface และ route เก่า**

เพิ่ม fixture DOM และ assertions ใน `tests/calibration-work-batch.test.html`:

```javascript
t('results primary tab switches surfaces and keeps batch state', () => {
  document.body.insertAdjacentHTML('beforeend', '<div id="cwPrimaryTabs">' +
    '<button data-cw-primary="batches"></button><button data-cw-primary="results"></button></div>' +
    '<div id="cwWorkSurface"></div><section id="cwResultsSurface" hidden></section>');
  window.loadCalrecsPage = () => { window.__resultsLoads = (window.__resultsLoads || 0) + 1; };
  ok(cwSetPrimaryTab('results'), 'results selected');
  ok(document.getElementById('cwWorkSurface').hidden, 'work hidden');
  ok(!document.getElementById('cwResultsSurface').hidden, 'results shown');
  eq(window.__resultsLoads, 1, 'results loaded');
  ok(cwSetPrimaryTab('batches'), 'batches restored');
  ok(!document.getElementById('cwWorkSurface').hidden, 'work shown again');
  document.getElementById('cwPrimaryTabs').remove();
  document.getElementById('cwWorkSurface').remove();
  document.getElementById('cwResultsSurface').remove();
});

t('legacy calrecs route is normalized to plan results', () => {
  has(routerSource, "if (page === 'calrecs')", 'legacy alias guard');
  has(routerSource, "cwSetPrimaryTab('results')", 'legacy alias target');
  lacks(routerSource, "calrecs: ['📋 ติดตามผลสอบเทียบ'", 'standalone route title');
});
```

- [ ] **Step 2: รันเฉพาะหน้า contract เพื่อยืนยัน fail**

Run: `powershell -File tools/run-tests.ps1`

Expected: FAIL เพราะ `results` ยังไม่อยู่ใน `CW_PRIMARY_TABS` และ router ยังเปิด standalone page

- [ ] **Step 3: เพิ่ม controller สำหรับสอง surfaces**

ใน `js/29-calibration-work.js` เปลี่ยน constant และเพิ่มฟังก์ชัน:

```javascript
const CW_PRIMARY_TABS = Object.freeze(['select', 'batches', 'waiting', 'history', 'results']);

function cwShowPrimarySurface(tab) {
  const results = tab === 'results';
  const work = document.getElementById('cwWorkSurface');
  const resultSurface = document.getElementById('cwResultsSurface');
  if (work) work.hidden = results;
  if (resultSurface) resultSurface.hidden = !results;
  return results;
}

function cwLoadResultsWhenReady(filter) {
  if (filter) {
    const status = document.getElementById('calrecStatus');
    if (status) status.value = filter;
  }
  const run = attempt => {
    if ((global.allData && global.allData.length) || attempt > 20) {
      if (typeof global.loadCalrecsPage === 'function') void global.loadCalrecsPage();
      return;
    }
    setTimeout(() => run(attempt + 1), 200);
  };
  run(0);
}

function openCalibrationResults(filter) {
  cwSyncPrimaryState('results');
  if (typeof global.showPage === 'function') global.showPage('plan');
  cwShowPrimarySurface('results');
  cwLoadResultsWhenReady(filter);
  return true;
}
```

ให้ `cwSetPrimaryTab()` เรียก `cwShowPrimarySurface(tab)`; กรณี `results` ให้เรียก `cwLoadResultsWhenReady()` แล้ว return โดยไม่เปลี่ยน `cwUiState.tab` ส่วนแท็บอื่นแสดง work surface และ render state เดิม เพิ่ม `global.openCalibrationResults = openCalibrationResults`

ใน `loadCalibrationWorkPage()` เก็บ `requestedPrimaryTab` เป็น `results` ได้ และหลัง snapshot โหลดเสร็จให้คืน surface ตาม `requestedPrimaryTab` โดยไม่สลับกลับ `batches`

- [ ] **Step 4: normalize legacy route ก่อน render**

ต้น `showPage(page)` ใน `js/10-router.js` ใช้ logic:

```javascript
const requestedResults = page === 'calrecs';
if (requestedResults) page = 'plan';
```

ลบ `calrecs` จาก `pages`, `titles` และ standalone loader ท้ายฟังก์ชัน หลังเปิดหน้า plan และเริ่มโหลด work page ให้เรียก:

```javascript
if (requestedResults && typeof cwSetPrimaryTab === 'function') cwSetPrimaryTab('results');
```

ใน `calRecComplete()` เปลี่ยน visibility check จาก `pageCalrecs` เป็น `cwResultsSurface`:

```javascript
const surface = document.getElementById('cwResultsSurface');
if (surface && !surface.hidden && typeof loadCalrecsPage === 'function') loadCalrecsPage();
```

- [ ] **Step 5: รัน tests และ commit behavior**

Run: `powershell -File tools/run-tests.ps1`

Expected: 9 test pages ผ่านทั้งหมดและไม่มี assertion fail

```bash
git add js/29-calibration-work.js js/10-router.js js/23-cal-records.js tests/calibration-work-batch.test.html
git commit -m "feat: route calibration results through plan tabs"
```

### Task 3: รวม badge และปรับการแจ้งเตือนรอแนบสแกน

**Files:**
- Modify: `js/29-calibration-work.js:627-653,2570-2590`
- Modify: `js/23-cal-records.js:43-62`
- Modify: `js/07-notifications.js:68-85`
- Modify: `js/25-dashboard-ui.js:13-20`
- Test: `tests/calibration-work-batch.test.html`

**Interfaces:**
- Consumes: counts จาก `cwPublishPlanBadge(model)` และ `renderPendingCertWidget()`
- Produces: `updatePlanNavBadge(component: 'work'|'scan', count: number): number`; `scanNotifGo()` เปิด `openCalibrationResults('scan')`

- [ ] **Step 1: เพิ่ม failing tests ของ renderer กลางและ notification destination**

```javascript
t('plan badge combines work and pending scan counts without overwrite', () => {
  document.body.insertAdjacentHTML('beforeend', '<span id="navPlanBadge" style="display:none"></span>');
  eq(updatePlanNavBadge('work', 3), 3, 'work component');
  eq(updatePlanNavBadge('scan', 2), 5, 'combined count');
  eq(document.getElementById('navPlanBadge').textContent, '5', 'combined badge text');
  eq(updatePlanNavBadge('work', 0), 2, 'scan component remains');
  document.getElementById('navPlanBadge').remove();
});

t('scan notification opens result tab with scan filter', () => {
  has(notificationSource, "openCalibrationResults('scan')", 'scan notification destination');
  lacks(notificationSource, "showPage('calrecs')", 'legacy notification destination');
  lacks(recordsSource, 'navCalrecsBadge', 'retired standalone badge');
});
```

เพิ่ม `notificationSource = text('../js/07-notifications.js')` ใน source fixture ของ test

- [ ] **Step 2: รัน contract test เพื่อยืนยัน fail**

Run: `powershell -File tools/run-tests.ps1`

Expected: FAIL เพราะ `updatePlanNavBadge` ยังไม่มีและ notification ยังใช้ `calrecs`

- [ ] **Step 3: สร้าง badge component state กลาง**

ใน `js/29-calibration-work.js` เพิ่ม:

```javascript
const cwPlanBadgeCounts = { work: 0, scan: 0 };
function updatePlanNavBadge(component, count) {
  if (!Object.prototype.hasOwnProperty.call(cwPlanBadgeCounts, component)) return cwPlanBadgeCounts.work + cwPlanBadgeCounts.scan;
  cwPlanBadgeCounts[component] = Math.max(0, Number(count) || 0);
  const total = cwPlanBadgeCounts.work + cwPlanBadgeCounts.scan;
  const badge = document.getElementById('navPlanBadge');
  if (badge) {
    badge.textContent = String(total);
    badge.style.display = total > 0 ? '' : 'none';
  }
  if (typeof global.renderDashTodo === 'function') global.renderDashTodo();
  return total;
}
```

เปลี่ยน `cwPublishPlanBadge(model)` ให้คำนวณ work count แล้ว `return updatePlanNavBadge('work', count)` และ export `global.updatePlanNavBadge`

ใน `renderPendingCertWidget()` ลบการเขียน `navCalrecsBadge` แล้วใช้:

```javascript
if (typeof updatePlanNavBadge === 'function') updatePlanNavBadge('scan', recs.length);
```

คง `scanNotifBadge`, `scanNotifCount`, dropdown และ `window._scanNotifRecs` ตามเดิม

- [ ] **Step 4: เปลี่ยนปลายทาง notification**

ใน `js/07-notifications.js` เปลี่ยนข้อความท้าย dropdown เป็น “ไปที่ผลและใบรับรอง…” และใช้:

```javascript
function scanNotifGo() {
  closeScanNotif();
  if (typeof openCalibrationResults === 'function') openCalibrationResults('scan');
}
```

เนื่องจาก `navPlanBadge` เปลี่ยนเป็นผลรวม ให้แก้ข้อความการ์ด dashboard ที่อ่าน badge นี้ให้ตรงความหมาย:

```javascript
title:'งานแผนและใบรับรองรอดำเนินการ', desc:'ติดตามชุดงาน ผลสอบเทียบ และใบรับรองที่รอแนบสแกน'
```

- [ ] **Step 5: รัน tests และ commit**

Run: `powershell -File tools/run-tests.ps1`

Expected: 9 test pages ผ่านทั้งหมด; combined badge test ได้ค่า 5 แล้วเหลือ 2 เมื่อ work component เป็นศูนย์

```bash
git add js/29-calibration-work.js js/23-cal-records.js js/07-notifications.js js/25-dashboard-ui.js tests/calibration-work-batch.test.html
git commit -m "fix: combine plan and certificate badges"
```

### Task 4: ตรวจความเข้ากันได้ ออฟไลน์ และการใช้งานจริง

**Files:**
- Modify: `sw.js:1`
- Modify: `tests/reference-home.test.html`
- Test: `tests/calibration-work-batch.test.html`
- Test: `tests/reference-home.test.html`

**Interfaces:**
- Consumes: implementation จาก Tasks 1-3
- Produces: release candidate ที่ cache รุ่นใหม่และผ่าน automated/manual verification

- [ ] **Step 1: เพิ่ม release assertions และ bump service-worker cache**

ใน `tests/reference-home.test.html` เปลี่ยน cache assertion เป็น:

```javascript
has(SW, "const CACHE_NAME = 'calibration-app-v164';", 'cache bump');
```

นำ `03_calibration_tracking.png` ออกจาก `TILE_ASSETS` ใน test และนำ `./assets/tiles/03_calibration_tracking.png` ออกจาก `APP_SHELL` เพื่อไม่ให้ service worker พยายาม cache ไฟล์ที่เลิกใช้

ใน `sw.js` เปลี่ยน:

```javascript
const CACHE_NAME = 'calibration-app-v164';
```

- [ ] **Step 2: ตรวจ source ว่าไม่มีทางเข้า standalone เหลืออยู่**

Run:

```powershell
rg -n "navCalrecsBadge|nav-calrecs|pageCalrecs|data-page=\"calrecs\"|showPage\('calrecs'\)|k:'calrecs'" index.html js tests
```

Expected: พบ `showPage('calrecs')` เฉพาะ test ของ legacy alias (ถ้าใช้ literal); ไม่พบ production entry, standalone page หรือ standalone badge

- [ ] **Step 3: รัน verification suite สดทั้งหมด**

Run:

```powershell
powershell -File tools/run-tests.ps1
node --check js/07-notifications.js
node --check js/10-router.js
node --check js/23-cal-records.js
node --check js/24-home.js
node --check js/25-dashboard-ui.js
node --check js/29-calibration-work.js
node --check sw.js
git diff --check
```

Expected: 9 test pages ผ่าน, JavaScript syntax checks exit 0, `git diff --check` ไม่มี output

- [ ] **Step 4: ทดสอบ manual บน desktop และ mobile viewport**

ตรวจตามลำดับ:

1. เปิด “แผนสอบเทียบ” เห็นห้าแท็บและไม่มีเมนูติดตามแยก
2. เข้า “ผลและใบรับรอง” แล้วรายการ/ค้นหา/ชิปกรองทำงาน
3. สลับกลับ “ชุดงาน” แล้วรายการและสถานะแท็บเดิมยังอยู่
4. เปิดจากกระดิ่งรอแนบสแกนแล้วได้แท็บ results + ตัวกรอง scan
5. เรียก `showPage('calrecs')` จาก console แล้วเมนู plan active
6. viewer ไม่มีปุ่มแนบไฟล์; admin/editor ยังแนบ PDF และเปิดไฟล์ได้
7. viewport มือถือไม่มีปุ่มติดตามแยกและเมนู plan active ถูกต้อง

Expected: ทุกข้อผ่านโดยไม่มี console error หรือ permission regression

- [ ] **Step 5: commit release verification**

```bash
git add sw.js tests/reference-home.test.html
git commit -m "chore: refresh calibration results release cache"
```

- [ ] **Step 6: ตรวจสถานะ branch ก่อนส่ง review**

Run: `git status --short; git log --oneline -5`

Expected: working tree สะอาด และเห็น commits ของ Tasks 1-4 ต่อจาก design/plan commits
