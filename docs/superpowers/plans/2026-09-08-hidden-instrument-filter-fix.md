# Hidden Instrument Filter Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the instrument list obey its visible type filter even when a conflicting Dashboard category remains in memory, while keeping category-pill state synchronized.

**Architecture:** Keep the existing client-side filtering pipeline and correct precedence at both implementations of the list filter: the base implementation in `02-dashboard.js` and the production wrapper in `10-router.js`. The visible type selector takes precedence; list category actions clear the hidden Dashboard category; the existing list UI renderer remains the single source of truth for selected-pill appearance.

**Tech Stack:** Vanilla JavaScript, HTML browser test harness, GitHub Pages service worker cache.

## Global Constraints

- Do not alter, insert, or delete Supabase instrument rows.
- Do not change Supabase schema, grants, or RLS policies.
- A non-empty visible instrument type is authoritative and must not be intersected with `activeCategory`.
- Dashboard category navigation must continue to filter by `activeCategory` when no explicit list type is selected.
- Selecting any list category pill, including “ทั้งหมด”, must reset `activeCategory` to `all` before filtering.
- “ล้างตัวกรอง” must continue to reset visible filters and `activeCategory`.
- Category pills must be rerendered after filter changes so their selected state matches `typeFilter`.

---

## File Structure

- `tests/instrument-list-ui.test.html`: browser regression coverage for filter precedence, category reset, and selected-pill synchronization.
- `js/02-dashboard.js`: base list filter and list category selection behavior.
- `js/10-router.js`: production integrity wrapper that replaces `filterData()` after load.
- `index.html`: asset generation query used by GitHub Pages clients.
- `sw.js`: service-worker cache generation and matching precache URLs.
- `tests/calibration-work-batch.test.html`, `tests/login-b3-ui.test.html`, `tests/reference-home.test.html`: release-generation assertions.

### Task 1: Add Failing Regression Coverage

**Files:**
- Modify: `tests/instrument-list-ui.test.html`

**Interfaces:**
- Consumes: global `filterData()`, `setListCategory(type: string)`, `allData`, `filteredData`, `activeCategory`, and `renderListCategoryPills()`.
- Produces: regression tests that fail against the current hidden-category behavior and pass only when visible-filter precedence and UI synchronization are correct.

- [ ] **Step 1: Extend the test fixture and source loader**

Load `../js/10-router.js` as `ROUTER_JS`, add `#listCategoryStrip`, `#pageSizeSelect`, and the minimal table/stat elements required by the production filter wrapper. Before evaluating the router, stub boot-only dependencies (`getSession`, `requestAnimationFrame`, `window.scrollTo`) and define `activeCategory`, `allData`, `filteredData`, `currentPage`, `pageSize`, `renderTable`, `updateStats`, `renderCategoryCards`, `getInstrumentCategory`, and `getDisplayInstrumentType`.

```js
let INDEX, REPORTS_JS, INSTRUMENTS_JS, LIST_JS, DASHBOARD_JS, ROUTER_JS, CSS;
// Include text('../js/10-router.js') in Promise.all.

window.getSession = () => null;
window.requestAnimationFrame = callback => callback();
window.scrollTo = () => {};
activeCategory = 'all';
allData = [];
filteredData = [];
currentPage = 1;
pageSize = 20;
renderTable = () => {};
updateStats = () => {};
renderCategoryCards = () => {};
getDisplayInstrumentType = row => row.instrument_type || '';
getInstrumentCategory = row => row.category || row.instrument_type || '';
eval(ROUTER_JS);
```

- [ ] **Step 2: Write the stale-category precedence test**

Create one Balance row whose category conflicts with the retained Dashboard category, select the visible Balance type, call the production-installed `filterData()`, and assert that the row remains visible.

```js
t('visible type wins over a stale Dashboard category', () => {
  allData = [
    { id: 1, id_code: 'BAL-1', instrument_type: 'Balance', category: 'เครื่องชั่ง', department: 'WRM1', due_date: '2027-08-24', days_left: 350 },
    { id: 2, id_code: 'TEMP-1', instrument_type: 'Temperature', category: 'อุณหภูมิ/ความชื้น', department: 'WRM1', due_date: '2027-08-24', days_left: 350 }
  ];
  activeCategory = 'อุณหภูมิ/ความชื้น';
  document.getElementById('typeFilter').value = 'Balance';
  filterData();
  eq(filteredData.map(row => row.id_code), ['BAL-1'], 'visible Balance filter must not intersect the stale category');
});
```

- [ ] **Step 3: Write category-reset and pill-sync tests**

Spy on `renderListCategoryPills()`, invoke `setListCategory('Balance')` and `setListCategory('')`, then assert the hidden category is reset, the dropdown reflects the action, and the pill renderer runs through the filtering flow.

```js
t('list category selection clears hidden category and synchronizes pills', () => {
  let renders = 0;
  const originalRender = renderListCategoryPills;
  renderListCategoryPills = window.renderListCategoryPills = (...args) => {
    renders += 1;
    return originalRender(...args);
  };
  activeCategory = 'อุณหภูมิ/ความชื้น';
  setListCategory('Balance');
  eq(activeCategory, 'all', 'named list pill clears Dashboard category');
  eq(document.getElementById('typeFilter').value, 'Balance', 'named pill owns visible type');
  setListCategory('');
  eq(activeCategory, 'all', 'all pill clears Dashboard category');
  eq(document.getElementById('typeFilter').value, '', 'all pill clears visible type');
  ok(renders >= 2, 'pill strip rerenders after both filter changes');
});
```

- [ ] **Step 4: Run the focused test and confirm RED**

Run the repository browser-test runner against `tests/instrument-list-ui.test.html` (or open it through the existing local HTTP test server if the runner accepts only the full suite).

Expected: the new precedence test fails because `activeCategory` removes `BAL-1`, and/or the category-reset test fails because `setListCategory()` leaves `activeCategory` unchanged.

- [ ] **Step 5: Commit the failing regression test**

```powershell
git add -- tests/instrument-list-ui.test.html
git commit -m "test: reproduce hidden instrument filter conflict"
```

### Task 2: Correct Filter Precedence and Synchronize State

**Files:**
- Modify: `js/02-dashboard.js:567-570`
- Modify: `js/02-dashboard.js:727-758`
- Modify: `js/10-router.js:220-253`
- Test: `tests/instrument-list-ui.test.html`

**Interfaces:**
- Consumes: the regression harness from Task 1 and the existing global list state.
- Produces: `setListCategory(type)` that clears hidden category state and filtering functions that apply `activeCategory` only when `typeFilter` is empty.

- [ ] **Step 1: Reset the hidden Dashboard category for list-pill actions**

Change `setListCategory(type)` in `js/02-dashboard.js` to:

```js
function setListCategory(type) {
  const sel = document.getElementById('typeFilter');
  if (sel) sel.value = type;
  if (typeof activeCategory !== 'undefined') activeCategory = 'all';
  filterData();
}
```

- [ ] **Step 2: Make the visible type authoritative in the base filter**

Guard the legacy category predicate in `js/02-dashboard.js` with `!type`:

```js
if (!type && activeCategory && activeCategory !== 'all') {
  const category = typeof getInstrumentCategory === 'function' ? getInstrumentCategory(d) : d.instrument_type;
  if (category !== activeCategory) return false;
}
```

- [ ] **Step 3: Apply the same precedence in the production wrapper**

Guard the category predicate in `js/10-router.js` with `!type` and rerender the category strip after the wrapper finishes updating the table:

```js
if (!type && typeof activeCategory !== 'undefined' && activeCategory && activeCategory !== 'all') {
  const category = typeof getInstrumentCategory === 'function' ? getInstrumentCategory(row) : row.instrument_type;
  if (category !== activeCategory) return false;
}
```

After `updateStats()` and `renderTable()`, add:

```js
if (typeof renderListCategoryPills === 'function') renderListCategoryPills();
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run the focused browser test again.

Expected: `ALL PASS`, including the stale-category precedence and pill synchronization cases.

- [ ] **Step 5: Commit the behavior fix**

```powershell
git add -- js/02-dashboard.js js/10-router.js tests/instrument-list-ui.test.html
git commit -m "fix: prevent hidden category from masking instruments"
```

### Task 3: Publish a Fresh GitHub Pages Asset Generation

**Files:**
- Modify: `index.html`
- Modify: `sw.js`
- Modify: `tests/calibration-work-batch.test.html`
- Modify: `tests/login-b3-ui.test.html`
- Modify: `tests/reference-home.test.html`

**Interfaces:**
- Consumes: corrected JavaScript from Task 2.
- Produces: asset query generation `20260908-filter1` and cache name `calibration-app-v163`, ensuring deployed clients do not retain the broken scripts.

- [ ] **Step 1: Update release-generation assertions first**

Replace every asserted current asset query `20260905-date1` with `20260908-filter1` and every asserted cache name `calibration-app-v162` with `calibration-app-v163` in the three release-related browser tests.

- [ ] **Step 2: Run release tests and confirm RED**

Run `tests/calibration-work-batch.test.html`, `tests/login-b3-ui.test.html`, and `tests/reference-home.test.html`.

Expected: failures identify the old generation in `index.html` and `sw.js`.

- [ ] **Step 3: Update the deployable app shell**

Replace every active asset query `20260905-date1` with `20260908-filter1` in `index.html` and `sw.js`. Change the first line of `sw.js` to:

```js
const CACHE_NAME = 'calibration-app-v163';
```

- [ ] **Step 4: Run release tests and confirm GREEN**

Run the same three browser tests.

Expected: all report `ALL PASS` and service-worker precache/install/activation assertions use `v163`.

- [ ] **Step 5: Commit the cache generation**

```powershell
git add -- index.html sw.js tests/calibration-work-batch.test.html tests/login-b3-ui.test.html tests/reference-home.test.html
git commit -m "chore: refresh app cache for filter fix"
```

### Task 4: Full Verification and Delivery

**Files:**
- Verify: all modified files from Tasks 1-3

**Interfaces:**
- Consumes: all implementation and release commits.
- Produces: evidence that the fix is safe to push and merge.

- [ ] **Step 1: Run every browser test page**

Use the repository's existing browser-test runner to execute every `tests/*.test.html` file.

Expected: every page reports `ALL PASS`; the total page, script-load, and handler checks have zero failures.

- [ ] **Step 2: Run JavaScript syntax checks**

```powershell
node --check js/02-dashboard.js
node --check js/10-router.js
node --check js/26-list-ui.js
node --check sw.js
```

Expected: exit code `0` for every file and no syntax errors.

- [ ] **Step 3: Check diff hygiene and repository state**

```powershell
git diff --check
git status --short
git log --oneline --decorate -5
```

Expected: `git diff --check` has no output; only intended commits/files appear; no generated test debris is tracked.

- [ ] **Step 4: Review against the approved design**

Confirm all five behavior bullets in `docs/superpowers/specs/2026-09-08-hidden-instrument-filter-design.md` are covered, and confirm no Supabase file, migration, row, grant, or policy changed.

- [ ] **Step 5: Commit any verification-only test adjustment if required**

If no adjustment is required, do not create an empty commit. If an assertion needed alignment without changing product scope:

```powershell
git add -- tests
git commit -m "test: align instrument filter verification"
```

- [ ] **Step 6: Present integration choices**

Use `superpowers:finishing-a-development-branch` after all verification is green. Offer push/PR/merge or local integration without deleting this worktree until the user chooses.
