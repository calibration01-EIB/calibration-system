# Instrument List Header and Home Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved collapsible instrument-list filter header and install the approved compact, responsive Home hero image without changing data, permissions, exports, filtering, or pagination behavior.

**Architecture:** Keep `filterData()` and the existing form controls as the only filter state. Add presentation-only helpers to `js/26-list-ui.js` that derive disclosure, summary, and reset visibility from those controls; use page-scoped CSS to avoid affecting other filter cards. Replace the Home bitmap with an optimized WebP while retaining selectable HTML copy, and update the offline cache atomically.

**Tech Stack:** Static HTML, CSS, browser JavaScript, browser-hosted HTML regression tests, Pillow for one-time WebP optimization, Service Worker Cache API.

## Global Constraints

- The category/status panel is collapsed on every page load and its open state is not persisted.
- Selecting a category or status does not automatically close the panel.
- The collapsed summary shows category/status selections only; Reset becomes visible for any active search or filter.
- `filterData()` remains the filtering source of truth; do not duplicate filtering state.
- Do not change database, permission, export, pagination, or instrument-data behavior.
- Keep Hero text as HTML; do not embed text, logos, certificates, people, or watermarks in the bitmap.
- Hero heights are exactly 260 px at 1024 px and wider, 220 px at 768–1023 px, and 180 px below 768 px.
- The production Hero asset is `assets/home-hero-calibration-lab-v2.webp` and must be optimized for web delivery.
- Bump the service-worker cache from `calibration-app-v142` to `calibration-app-v143` when the new asset enters `APP_SHELL`.

## File Structure

- Modify `index.html`: add accessible list disclosure/summary hooks and point the Home hero at the new asset.
- Modify `js/26-list-ui.js`: manage disclosure state and derive summary/reset visibility from existing controls.
- Modify `theme-aqua.css`: compact and responsive list header styles plus the 260/220/180 px Hero presentation.
- Modify `tests/instrument-list-ui.test.html`: add source and interaction regression coverage for the collapsible filters.
- Modify `tests/reference-home.test.html`: lock the new Hero asset, HTML copy, dimensions, filesize, and responsive CSS.
- Create `assets/home-hero-calibration-lab-v2.webp`: optimized copy of the approved generated image.
- Modify `sw.js`: precache the new Hero, remove obsolete Hero entries, and bump cache version.

---

### Task 1: Collapsible Instrument List Header

**Files:**
- Modify: `tests/instrument-list-ui.test.html:20-57`
- Modify: `index.html:2979-3029`
- Modify: `js/26-list-ui.js:23-31, 105-177, 307-331`
- Modify: `theme-aqua.css:495-589`

**Interfaces:**
- Consumes: existing `#searchInput`, `#typeFilter`, `#unitFilter`, `#monthFilter`, `#statusFilter`, `filterData()`, `resetFilters()`, `setListCategory(type)`, and `LIST_STATUS_CHIPS`.
- Produces: `listToggleAdvancedFilters(force?: boolean): void`, `listGetActiveFilterLabels(): string[]`, `listHasActiveFilters(): boolean`, and `syncListFilterUi(): void`.

- [ ] **Step 1: Write failing source and behavior tests**

Extend the fixture loader in `tests/instrument-list-ui.test.html` to load `js/26-list-ui.js`:

```javascript
let INDEX, REPORTS_JS, LIST_JS, CSS;
[INDEX, REPORTS_JS, LIST_JS, CSS] = await Promise.all([
  text('../index.html'), text('../js/04-reports.js'),
  text('../js/26-list-ui.js'), text('../theme-aqua.css')
]);
```

Add these tests before the final result rendering:

```javascript
t('โครงสร้างตัวกรองขั้นสูงเข้าถึงได้และปิดไว้ตั้งแต่โหลด', () => {
  ['id="listAdvancedToggle"', 'aria-controls="listAdvancedPanel"',
   'aria-expanded="false"', 'id="listAdvancedPanel"',
   'id="listFilterSummary"', 'id="listResetButton"']
    .forEach(token => has(INDEX, token, 'list filter hook'));
  ok(/id="listAdvancedPanel"[^>]*hidden/.test(INDEX), 'panel ต้องมี hidden ตั้งแต่ HTML แรก');
  ok(/id="listResetButton"[^>]*hidden/.test(INDEX), 'reset ต้องซ่อนเมื่อยังไม่กรอง');
});

t('ตัวควบคุมใช้ filterData เดิมและไม่เก็บสถานะ panel', () => {
  ['function listToggleAdvancedFilters', 'function listGetActiveFilterLabels',
   'function listHasActiveFilters', 'function syncListFilterUi',
   'syncListFilterUi();'].forEach(token => has(LIST_JS, token, 'list ui controller'));
  ok(LIST_JS.indexOf("localStorage.setItem('listAdvanced") === -1,
    'สถานะเปิด panel ต้องไม่บันทึกใน localStorage');
  has(LIST_JS, "if (typeof filterData === 'function') filterData();", 'existing filter flow');
});

t('CSS จำกัดผลเฉพาะ pageList และ panel ขยายลงด้านล่าง', () => {
  has(CSS, '#app #pageList .ax-filter-card--list', 'scoped list filter');
  has(CSS, '#app #pageList .ax-filter-advanced[hidden]', 'hidden panel');
  ok(/@media \(max-width: 767px\)[\s\S]*?#app #pageList \.ax-filter-row/.test(CSS),
    'mobile filter layout');
});
```

Then add an isolated behavior fixture and execute the controller inside the current test page:

```javascript
const fixture = document.createElement('section');
fixture.innerHTML = `
  <input id="searchInput" value="">
  <select id="typeFilter"><option value="">ทุกประเภท</option><option value="Balance">Balance</option></select>
  <select id="unitFilter"><option value="">ทุกหน่วยงาน</option><option value="WRM1">WRM1</option></select>
  <select id="monthFilter"><option value="">ทุกเดือน</option><option value="8">สิงหาคม</option></select>
  <select id="statusFilter"><option value="">ทุกสถานะ</option><option value="warning">ใกล้ครบ</option></select>
  <button id="listAdvancedToggle" aria-expanded="false"><span>เปิดหมวดและสถานะ</span></button>
  <button id="listResetButton" hidden></button>
  <div id="listFilterSummary" hidden></div>
  <div id="listAdvancedPanel" hidden></div>`;
document.body.appendChild(fixture);
eval(LIST_JS);

t('panel เปิดปิดได้และเริ่มต้นปิด', () => {
  syncListFilterUi();
  ok(document.getElementById('listAdvancedPanel').hidden, 'เริ่มต้นต้องปิด');
  eq(document.getElementById('listAdvancedToggle').getAttribute('aria-expanded'), 'false');
  listToggleAdvancedFilters();
  ok(!document.getElementById('listAdvancedPanel').hidden, 'กดแล้วต้องเปิด');
  eq(document.getElementById('listAdvancedToggle').getAttribute('aria-expanded'), 'true');
});

t('summary แสดงหมวดและสถานะเมื่อปิด panel', () => {
  document.getElementById('typeFilter').value = 'Balance';
  document.getElementById('statusFilter').value = 'warning';
  listToggleAdvancedFilters(false);
  const summary = document.getElementById('listFilterSummary');
  ok(!summary.hidden, 'summary ต้องแสดง');
  has(summary.textContent, 'Balance');
  has(summary.textContent, 'ใกล้ครบ');
});

t('reset แสดงเมื่อ filter ใด ๆ ทำงานและซ่อนเมื่อว่าง', () => {
  const reset = document.getElementById('listResetButton');
  ok(!reset.hidden, 'มี type/status แล้ว reset ต้องแสดง');
  ['searchInput','typeFilter','unitFilter','monthFilter','statusFilter']
    .forEach(id => { document.getElementById(id).value = ''; });
  syncListFilterUi();
  ok(reset.hidden, 'ไม่มี filter แล้ว reset ต้องซ่อน');
  document.getElementById('searchInput').value = 'balance';
  syncListFilterUi();
  ok(!reset.hidden, 'มีคำค้นแล้ว reset ต้องแสดง');
});
```

- [ ] **Step 2: Run the test and verify the new expectations fail**

Start the local server:

```powershell
$calibrationPython = 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$calibrationServer = Start-Process -FilePath $calibrationPython -ArgumentList '-m','http.server','49447','--bind','127.0.0.1' -WorkingDirectory 'C:\Users\8014\Desktop\calibration-system-main' -WindowStyle Hidden -PassThru
```

Open `http://127.0.0.1:49447/tests/instrument-list-ui.test.html` in the in-app browser.

Expected: document title `FAIL`; output reports missing `listAdvancedToggle`/controller hooks.

- [ ] **Step 3: Add the accessible compact markup**

Replace the list filter card in `index.html` with:

```html
<div class="ax-filter-card ax-filter-card--list">
  <div class="ax-filter-row">
    <label class="ax-search">
      <span aria-hidden="true">🔍</span>
      <input type="text" id="searchInput" placeholder="ค้นหาชื่อเครื่องมือ, ยี่ห้อ, ID.No. หรือเลข CERT." oninput="filterData()">
    </label>
    <select id="typeFilter" onchange="filterData()"><option value="">ทุกประเภท</option></select>
    <select id="unitFilter" onchange="filterData()"><option value="">ทุกหน่วยงาน</option></select>
    <select id="monthFilter" onchange="filterData()">
      <option value="">ทุกเดือน (ครบกำหนด)</option>
      <option value="1">มกราคม</option><option value="2">กุมภาพันธ์</option>
      <option value="3">มีนาคม</option><option value="4">เมษายน</option>
      <option value="5">พฤษภาคม</option><option value="6">มิถุนายน</option>
      <option value="7">กรกฎาคม</option><option value="8">สิงหาคม</option>
      <option value="9">กันยายน</option><option value="10">ตุลาคม</option>
      <option value="11">พฤศจิกายน</option><option value="12">ธันวาคม</option>
    </select>
    <select id="statusFilter" onchange="filterData()" class="ax-hidden-field" tabindex="-1" aria-hidden="true">
      <option value="">ทุกสถานะ</option>
      <option value="overdue">เลยกำหนด</option>
      <option value="warning">ใกล้ครบ</option>
      <option value="ok">ปกติ</option>
      <option value="cancelled">ยกเลิกสอบเทียบ</option>
    </select>
  </div>
  <div class="ax-filter-meta">
    <div id="listFilterSummary" class="ax-filter-summary" aria-live="polite" hidden></div>
    <div class="ax-filter-meta-actions">
      <button type="button" id="listResetButton" class="ax-filter-reset" onclick="resetFilters()" hidden>ล้างตัวกรอง</button>
      <button type="button" id="listAdvancedToggle" class="ax-filter-toggle"
              aria-expanded="false" aria-controls="listAdvancedPanel"
              onclick="listToggleAdvancedFilters()">
        <span>เปิดหมวดและสถานะ</span><span aria-hidden="true">⌄</span>
      </button>
    </div>
  </div>
  <div id="listAdvancedPanel" class="ax-filter-advanced" hidden>
    <nav id="listCategoryStrip" class="reg-pills ax-catpills" aria-label="หมวดเครื่องมือ"></nav>
    <div class="ax-chips" id="listStatusChips"></div>
  </div>
</div>
```

Keep `#listViewTabs` directly after this card and before `#listSpecCard`.

- [ ] **Step 4: Implement presentation-only state helpers**

Add after `LIST_STATUS_CHIPS` in `js/26-list-ui.js`:

```javascript
let listAdvancedFiltersOpen = false;

function listControlValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function listGetActiveFilterLabels() {
  const labels = [];
  const type = listControlValue('typeFilter');
  const status = listControlValue('statusFilter');
  if (type) labels.push(type.split(' (')[0]);
  if (status) {
    const chip = LIST_STATUS_CHIPS.find(item => item.v === status);
    if (chip) labels.push(chip.label);
  }
  return labels;
}

function listHasActiveFilters() {
  return ['searchInput', 'typeFilter', 'unitFilter', 'monthFilter', 'statusFilter']
    .some(id => listControlValue(id) !== '');
}

function syncListFilterUi() {
  const panel = document.getElementById('listAdvancedPanel');
  const toggle = document.getElementById('listAdvancedToggle');
  const summary = document.getElementById('listFilterSummary');
  const reset = document.getElementById('listResetButton');
  const labels = listGetActiveFilterLabels();

  if (panel) panel.hidden = !listAdvancedFiltersOpen;
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(listAdvancedFiltersOpen));
    const label = toggle.querySelector('span');
    if (label) label.textContent = listAdvancedFiltersOpen ? 'ซ่อนหมวดและสถานะ' : 'เปิดหมวดและสถานะ';
  }
  if (summary) {
    summary.textContent = labels.length ? `กำลังกรอง: ${labels.join(' · ')}` : '';
    summary.hidden = listAdvancedFiltersOpen || labels.length === 0;
  }
  if (reset) reset.hidden = !listHasActiveFilters();
}

function listToggleAdvancedFilters(force) {
  listAdvancedFiltersOpen = typeof force === 'boolean' ? force : !listAdvancedFiltersOpen;
  syncListFilterUi();
}
```

In `renderListPage()`, call `syncListFilterUi()` immediately after `renderListStatusChips()`. Initialize the closed state in the existing `DOMContentLoaded` listener:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  listAdvancedFiltersOpen = false;
  renderListViewTabs();
  renderListStatusChips();
  syncListFilterUi();
});
```

- [ ] **Step 5: Add page-scoped compact/responsive styles**

Add these rules to the list section of `theme-aqua.css`:

```css
#app #pageList > .ax-page-head { margin-bottom: 14px; }
#app #pageList .ax-filter-card--list {
  gap: 12px; padding: 16px 18px; margin-bottom: 12px;
}
#app #pageList .ax-filter-row {
  display: grid; grid-template-columns: minmax(300px, 1.45fr) repeat(3, minmax(170px, .75fr));
  gap: 12px;
}
#app #pageList .ax-filter-row > .ax-search,
#app #pageList .ax-filter-row > select { min-width: 0; width: 100%; }
#app #pageList .ax-filter-meta {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
#app #pageList .ax-filter-summary {
  min-width: 0; color: var(--accent-h); font-size: 14px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#app #pageList .ax-filter-meta-actions { display: flex; gap: 8px; margin-left: auto; }
#app #pageList .ax-filter-toggle,
#app #pageList .ax-filter-reset {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  min-height: 38px; padding: 8px 13px; border: 1px solid var(--line);
  border-radius: var(--r-ctl); background: var(--surface); color: var(--ink2);
  font: 600 14px/1.2 inherit; cursor: pointer;
}
#app #pageList .ax-filter-toggle:hover,
#app #pageList .ax-filter-reset:hover { border-color: var(--accent-br); color: var(--accent-h); background: var(--accent-light); }
#app #pageList .ax-filter-toggle[aria-expanded="true"] { border-color: var(--accent-br); color: var(--accent-h); }
#app #pageList .ax-filter-summary[hidden],
#app #pageList .ax-filter-reset[hidden],
#app #pageList .ax-filter-advanced[hidden] { display: none !important; }
#app #pageList .ax-filter-advanced {
  display: flex; flex-direction: column; gap: 14px;
  padding-top: 14px; border-top: 1px solid #e8f0f5;
}
#app #pageList .ax-filter-advanced .ax-catpills { padding-bottom: 14px; }
#app #pageList .ax-view-tabs { margin-bottom: 12px; }

@media (max-width: 1100px) {
  #app #pageList .ax-filter-row { grid-template-columns: minmax(260px, 1fr) minmax(180px, 1fr); }
}
@media (max-width: 767px) {
  #app #pageList > .ax-page-head { align-items: flex-start; }
  #app #pageList .ax-head-actions { width: 100%; }
  #app #pageList .ax-filter-card--list { padding: 14px; }
  #app #pageList .ax-filter-row { grid-template-columns: minmax(0, 1fr); }
  #app #pageList .ax-filter-meta { align-items: stretch; flex-direction: column; }
  #app #pageList .ax-filter-summary { white-space: normal; }
  #app #pageList .ax-filter-meta-actions { width: 100%; margin-left: 0; }
  #app #pageList .ax-filter-toggle { flex: 1; }
}
```

- [ ] **Step 6: Run focused checks and commit Task 1**

Refresh `http://127.0.0.1:49447/tests/instrument-list-ui.test.html`.

Expected: document title `ALL PASS`, including default-collapsed, toggle, summary, reset, page-size, and hover tests.

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\26-list-ui.js
git diff --check
git add -- index.html js/26-list-ui.js theme-aqua.css tests/instrument-list-ui.test.html
git commit -m "feat: compact instrument list filters"
```

Expected: JavaScript syntax exits 0, `git diff --check` produces no output, and the commit succeeds.

---

### Task 2: Compact Responsive Home Hero and Offline Asset

**Files:**
- Modify: `tests/reference-home.test.html:50-140`
- Create: `assets/home-hero-calibration-lab-v2.webp`
- Modify: `index.html:2832-2847`
- Modify: `theme-aqua.css:212-264`
- Modify: `sw.js:1, 12-14`

**Interfaces:**
- Consumes: approved source image at `C:\Users\8014\.codex\generated_images\01a01d98-12eb-7190-bac9-cc67f9fb4124\exec-22a9c6fc-f976-4c81-8bea-8e087238ffa2.png`.
- Produces: `assets/home-hero-calibration-lab-v2.webp`, referenced by Home markup and `APP_SHELL`.

- [ ] **Step 1: Write failing Hero asset and responsive-layout tests**

Update the Home component assertion in `tests/reference-home.test.html` to expect:

```javascript
['id="pageHome"','class="ax-home"','class="ax-hero ax-hero--split"',
 'src="assets/home-hero-calibration-lab-v2.webp"','id="axTiles"']
  .forEach(h => has(INDEX, h, 'home'));
```

Add the image metadata helper:

```javascript
function imageMeta(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => rej(new Error('โหลดรูปไม่ได้ ' + url));
    img.src = url;
  });
}
```

Replace the old Hero asset cache assertion and add responsive checks:

```javascript
t('Hero ใช้ความสูง compact ตาม breakpoint ที่อนุมัติ', () => {
  ok(/\.ax-hero--split\s*\{[^}]*height:\s*260px/.test(CSS), 'desktop 260px');
  ok(/@media \(max-width: 1023px\)[\s\S]*?\.ax-hero--split\s*\{[^}]*height:\s*220px/.test(CSS), 'tablet 220px');
  ok(/@media \(max-width: 767px\)[\s\S]*?\.ax-hero--split\s*\{[^}]*height:\s*180px/.test(CSS), 'mobile 180px');
  ok(/\.ax-hero-media img\s*\{[^}]*object-fit:\s*cover/.test(CSS), 'image cover');
});

try {
  const heroBytes = await bytes('../assets/home-hero-calibration-lab-v2.webp');
  const heroMeta = await imageMeta('../assets/home-hero-calibration-lab-v2.webp');
  ok(heroBytes.length <= 350 * 1024, 'Hero ใหญ่เกิน 350KB: ' + heroBytes.length);
  ok(heroMeta.w >= 1600, 'Hero กว้างต่ำกว่า 1600px: ' + heroMeta.w);
  ok(heroMeta.w / heroMeta.h >= 2.2, 'Hero ไม่ใช่ภาพแนวนอนกว้าง');
  results.push('PASS Hero WebP คมชัดและไม่เกิน 350KB');
} catch (e) {
  results.push('FAIL Hero WebP คมชัดและไม่เกิน 350KB — ' + e.message);
}

t('รูป Hero ใหม่อยู่ใน APP_SHELL โดยไม่มีรูป Hero เก่าค้าง', () => {
  has(SW, './assets/home-hero-calibration-lab-v2.webp', 'sw');
  ok(SW.indexOf('./assets/hero-lab.jpg') === -1, 'hero-lab.jpg ไม่ควรอยู่ใน APP_SHELL');
  ok(SW.indexOf('./assets/calibration-lab-hero.png') === -1, 'fallback เก่าไม่ควรอยู่ใน APP_SHELL');
  has(SW, "const CACHE_NAME = 'calibration-app-v143';", 'cache bump');
});
```

- [ ] **Step 2: Run the Home test and verify it fails**

Open `http://127.0.0.1:49447/tests/reference-home.test.html`.

Expected: document title `FAIL`; output reports the missing new WebP, old Hero source, responsive heights, or cache version.

- [ ] **Step 3: Optimize the approved image into the workspace**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -c "from PIL import Image; src=r'C:\Users\8014\.codex\generated_images\01a01d98-12eb-7190-bac9-cc67f9fb4124\exec-22a9c6fc-f976-4c81-8bea-8e087238ffa2.png'; dst=r'C:\Users\8014\Desktop\calibration-system-main\assets\home-hero-calibration-lab-v2.webp'; im=Image.open(src).convert('RGB'); im.save(dst, 'WEBP', quality=84, method=6)"
Get-Item assets\home-hero-calibration-lab-v2.webp | Select-Object Name,Length
```

Expected: `home-hero-calibration-lab-v2.webp` exists and is no larger than 358400 bytes while retaining the 1921×819 source dimensions.

- [ ] **Step 4: Point Home markup at the new asset**

Replace the Hero media block in `index.html` with:

```html
<section class="ax-hero ax-hero--split">
  <div class="ax-hero-media">
    <img src="assets/home-hero-calibration-lab-v2.webp" alt="">
  </div>
  <div class="ax-hero-scrim"></div>
  <div class="ax-hero-copy">
    <span class="ax-hero-kicker">Welcome</span>
    <h1>Calibration System</h1>
    <p>ระบบบริหารจัดการกระบวนการสอบเทียบเครื่องมือวัด<br>ครบถ้วน แม่นยำ เชื่อถือได้</p>
  </div>
</section>
```

Keep the copy in HTML and remove the obsolete fallback source.

- [ ] **Step 5: Implement the approved 260/220/180 px presentation**

Replace the current `.ax-hero--split` block and its Hero media queries in `theme-aqua.css` with:

```css
.ax-hero--split {
  position: relative; height: 260px; min-height: 0;
  background: #eef5f8; display: flex; align-items: stretch;
}
.ax-hero-media { position: absolute; inset: 0; }
.ax-hero-media img {
  width: 100%; height: 100%; object-fit: cover; object-position: center 58%; display: block;
}
.ax-hero-scrim {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(90deg,
    rgba(247,250,252,.99) 0%, rgba(247,250,252,.96) 32%,
    rgba(247,250,252,.72) 44%, rgba(247,250,252,.18) 63%, transparent 78%);
}
.ax-hero-copy {
  position: relative; z-index: 1; width: min(48%, 650px); pointer-events: none;
  padding: 30px 48px; display: flex; flex-direction: column;
  justify-content: center; gap: 8px;
}
.ax-hero-kicker { font-family: var(--ff-num); font-weight: 700; font-size: 20px; color: var(--accent); }
.ax-hero-copy h1 {
  margin: 0; font-family: var(--ff-num); font-weight: 800;
  font-size: 48px; line-height: 1.05; letter-spacing: -.015em; color: var(--text);
}
.ax-hero-copy p {
  margin: 4px 0 0; font-size: 17px; line-height: 1.45;
  color: var(--text2); max-width: 520px; text-wrap: pretty;
}

@media (max-width: 1023px) {
  .ax-hero--split { height: 220px; }
  .ax-hero-copy { width: 58%; padding: 24px 30px; }
  .ax-hero-copy h1 { font-size: 36px; }
  .ax-hero-copy p { font-size: 15px; }
  .ax-hero-scrim {
    background: linear-gradient(90deg, rgba(247,250,252,.99) 0%, rgba(247,250,252,.94) 45%, rgba(247,250,252,.30) 72%, transparent 88%);
  }
}

@media (max-width: 767px) {
  .ax-hero--split { height: 180px; }
  .ax-hero-media img { object-position: 63% 58%; }
  .ax-hero-copy { width: 68%; padding: 18px 20px; gap: 5px; }
  .ax-hero-kicker { font-size: 14px; }
  .ax-hero-copy h1 { font-size: 28px; }
  .ax-hero-copy p { margin-top: 2px; font-size: 13px; line-height: 1.35; }
  .ax-hero-scrim {
    background: linear-gradient(90deg, rgba(247,250,252,.99) 0%, rgba(247,250,252,.96) 55%, rgba(247,250,252,.48) 82%, rgba(247,250,252,.12) 100%);
  }
}
```

- [ ] **Step 6: Update the offline cache atomically**

In `sw.js`, set:

```javascript
const CACHE_NAME = 'calibration-app-v143';
```

Replace these old entries:

```javascript
'./assets/calibration-lab-hero.png',
'./assets/hero-lab.jpg',
```

with:

```javascript
'./assets/home-hero-calibration-lab-v2.webp',
```

- [ ] **Step 7: Run focused checks and commit Task 2**

Refresh `http://127.0.0.1:49447/tests/reference-home.test.html`.

Expected: document title `ALL PASS`, including Hero HTML-copy, WebP size/dimensions, responsive-height, orphan-cache, and cache-version assertions.

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
git diff --check
git add -- index.html theme-aqua.css tests/reference-home.test.html sw.js assets/home-hero-calibration-lab-v2.webp
git commit -m "feat: refresh compact home hero"
```

Expected: syntax exits 0, `git diff --check` produces no output, and the commit succeeds.

---

### Task 3: Full Regression and Responsive Browser QA

**Files:**
- Verify: `index.html`
- Verify: `theme-aqua.css`
- Verify: `js/26-list-ui.js`
- Verify: `sw.js`
- Verify: `tests/*.test.html`

**Interfaces:**
- Consumes: the completed list disclosure and Hero asset from Tasks 1–2.
- Produces: verified release-ready static application with no additional API or persistence changes.

- [ ] **Step 1: Run every browser regression page**

Open each URL and require document title `ALL PASS`:

```text
http://127.0.0.1:49447/tests/instrument-list-ui.test.html
http://127.0.0.1:49447/tests/reference-home.test.html
http://127.0.0.1:49447/tests/instrument-edit-tabs.test.html
http://127.0.0.1:49447/tests/frm-cross-month.test.html
http://127.0.0.1:49447/tests/plan-export.test.html
http://127.0.0.1:49447/tests/repairs.test.html
http://127.0.0.1:49447/tests/weight-clean-slate.test.html
```

Expected: all seven pages report `ALL PASS` and contain no `FAIL` result row.

- [ ] **Step 2: Verify the Home hero at three widths**

Open `http://127.0.0.1:49447/`, sign in only if the local application requires it, and navigate to Home. Check viewports 1440×900, 900×800, and 390×844.

Expected at each width:

- no horizontal page overflow;
- Hero heights are 260, 220, and 180 px respectively;
- HTML heading/subtitle remain readable and selectable;
- no Hero text or instrument is awkwardly clipped;
- first-row Home cards begin soon after the compact Hero;
- scrolling remains smooth.

- [ ] **Step 3: Verify the instrument list interactions at three widths**

Navigate to `รายการเครื่องมือ` at 1440×900, 900×800, and 390×844.

Expected:

- panel is collapsed on first page load;
- disclosure opens downward without overlapping the table;
- category and status selection leaves the panel open;
- after closing the panel, selected category/status labels appear in the summary;
- typing search or choosing type/unit/month/status reveals Reset;
- Reset clears all controls and hides both Reset and the summary;
- actions/filters wrap without page-level horizontal overflow;
- table-only horizontal scrolling remains available;
- search, category, status, Spec/Full view, 20/50/100 page size, and pagination still produce the expected rows/counts.

- [ ] **Step 4: Run final repository verification**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\26-list-ui.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
git diff --check
git status --short --untracked-files=all
```

Expected: both syntax checks exit 0; `git diff --check` is silent; no uncommitted implementation files remain.

- [ ] **Step 5: Stop the local server**

Run:

```powershell
Stop-Process -Id $calibrationServer.Id
```

Expected: the server process exits and no project files change.
