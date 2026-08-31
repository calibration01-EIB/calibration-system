# Instrument Spec Catalog Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the instrument list's `spec` table with a responsive, accessible catalog-card grid that lazily loads the current page's existing Storage cover photos while leaving the full registry table and filtering/pagination behavior intact.

**Architecture:** `js/26-list-ui.js` owns card markup, status presentation, viewport-triggered image loading, signed-URL caching/refresh, and per-instrument invalidation. `js/03-instruments.js` calls the invalidation hook after photo mutations, while `theme-aqua.css` owns the 4/2/1-column layout; `renderListPage()` keeps slicing `filteredData` once and sends the same `pageRows` to either view.

**Tech Stack:** Browser JavaScript (ES2020), Supabase Storage `list()` / `createSignedUrl()`, IntersectionObserver, HTML/CSS, existing headless-Chrome HTML tests.

## Global Constraints

- Change only `#listSpecCard`; preserve `#listFullCard` and all registry-table columns/behavior.
- Preserve search, filters, pagination, and page sizes `20 / 50 / 100`.
- Reuse bucket `certificates` and folder `photos_<id>_<id_code>`; add no database column.
- Prefer `overview`, otherwise the first image under the detail view's existing ordering.
- Do not show instrument type/name or any simulated/standard fallback image.
- Show `ยังไม่มีรูปเครื่องมือ` for missing/failed images and preserve the existing empty-result state.
- Convey normal, warning, overdue, and cancelled status with text and readable status color.
- Use exactly 4 desktop, 2 tablet, and 1 mobile columns without horizontal overflow.
- Open existing `openInstrumentDetail(id)` from card and Detail button; support Tab, Enter, and Space.
- Load only near-viewport cards on the current page, cache during the session, refresh expired URLs, and invalidate after photo mutations.

---

### Task 1: Lock the catalog-card contract with tests

**Files:**
- Modify: `tests/instrument-list-ui.test.html`

**Interfaces:**
- Consumes: source text from `index.html`, `js/03-instruments.js`, `js/26-list-ui.js`, and `theme-aqua.css`.
- Produces: regression assertions for DOM hooks, content/accessibility, photo selection/cache/errors, invalidation, and responsive CSS.

- [ ] **Step 1: Load the instrument module in the harness**

Extend the existing `Promise.all` assignment so `INSTRUMENTS_JS` loads from `../js/03-instruments.js` alongside the current sources.

- [ ] **Step 2: Add failing structure and behavior assertions**

Add a brace-depth `functionBody(name)` helper and assertions equivalent to:

```js
has(INDEX, 'id="listSpecGrid"', 'catalog grid host');
has(LIST_JS, 'function listSpecCardHtml', 'catalog renderer');
has(LIST_JS, 'role="button"');
has(LIST_JS, 'tabindex="0"');
has(LIST_JS, 'ยังไม่มีรูปเครื่องมือ');
has(LIST_JS, 'IntersectionObserver');
has(LIST_JS, 'const LIST_PHOTO_CACHE = new Map()');
has(LIST_JS, 'function invalidateListPhotoCache');
has(INSTRUMENTS_JS, 'invalidateListPhotoCache(d.id)');
ok(!/instrument_name/.test(functionBody('listSpecCardHtml')), 'card must omit instrument name');
```

- [ ] **Step 3: Add failing responsive assertions**

Require scoped selectors `.ax-spec-grid`, `.ax-spec-card`, `.ax-spec-media`, `.ax-spec-id`, `.ax-spec-cert`, `.ax-spec-due`, `.ax-spec-detail`, `.is-loading`, and `.is-empty`, plus grid templates for `repeat(4,minmax(0,1fr))`, `repeat(2,minmax(0,1fr))`, and `minmax(0,1fr)`.

- [ ] **Step 4: Run the red test**

Run: `powershell -ExecutionPolicy Bypass -File tools/run-tests.ps1`

Expected: `instrument-list-ui.test.html` fails on missing grid/renderer/loader/invalidation/CSS assertions; unrelated pages pass.

- [ ] **Step 5: Commit**

```powershell
git add -- tests/instrument-list-ui.test.html
git commit -m "test: define instrument catalog card contract"
```

### Task 2: Render the spec catalog grid and preserve the full table

**Files:**
- Modify: `index.html:3056`
- Modify: `js/26-list-ui.js:230`

**Interfaces:**
- Consumes: `listStatusPill(d)`, `formatDate(value)`, `escapeHtmlText(value)`, `openInstrumentDetail(id)`, current-page rows.
- Produces: `listSpecCardHtml(d) -> string`, `listSpecCardKeydown(event, id) -> void`, `renderListSpec(rows) -> void`.

- [ ] **Step 1: Replace only the spec table host**

Use:

```html
<div class="ax-spec-grid" id="listSpecGrid" aria-label="มุมมองสเปกเครื่องมือ"></div>
```

Do not alter `#listFullCard`, headers, or `#dataTableFull`.

- [ ] **Step 2: Add keyboard activation**

```js
function listSpecCardKeydown(event, id) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openInstrumentDetail(id);
}
```

- [ ] **Step 3: Add semantic card markup**

Implement `listSpecCardHtml(d)` with an outer `role="button"`, `tabindex="0"`, Thai `aria-label`, click/keydown handlers, and `data-instrument-id`. Render only media, textual badge, prominent ID Code, one-line `Cert: …`, status-colored `Due: …`, and a full-width `ดูรายละเอียด` button. The button calls `event.stopPropagation();openInstrumentDetail(id)`. Never reference `instrument_name` or display type inside this function.

- [ ] **Step 4: Retarget the renderer**

```js
function renderListSpec(rows) {
  const grid = document.getElementById('listSpecGrid');
  if (!grid) return;
  grid.innerHTML = rows.map(listSpecCardHtml).join('');
  observeListSpecPhotos(grid);
}
```

Keep `renderListFull(pageRows, start)` unchanged and retain the existing `pageRows` slice.

- [ ] **Step 5: Update empty reset**

Clear `#listSpecGrid` on empty results while continuing to show `#listEmpty` and leaving the full-table empty row intact.

- [ ] **Step 6: Run tests**

Run: `powershell -ExecutionPolicy Bypass -File tools/run-tests.ps1`

Expected: markup tests pass; photo/CSS tests remain red.

- [ ] **Step 7: Commit**

```powershell
git add -- index.html js/26-list-ui.js
git commit -m "feat: render instrument spec catalog cards"
```

### Task 3: Add lazy covers, cache, expiry recovery, and invalidation

**Files:**
- Modify: `js/26-list-ui.js:230`
- Modify: `js/03-instruments.js:195`
- Modify: `js/03-instruments.js:234`
- Modify: `js/03-instruments.js:346`

**Interfaces:**
- Consumes: `sb`, `instPhotoFolder(d)`, `instPhotoArrange(items)`, bucket `certificates`, and `[data-list-photo-id]`.
- Produces: `LIST_PHOTO_CACHE`, `loadListSpecPhoto(d, forceRefresh = false)`, `observeListSpecPhotos(root)`, `renderListSpecPhoto(id, result)`, and window-exposed `invalidateListPhotoCache(id)`.

- [ ] **Step 1: Add cache and invalidation**

Create `const LIST_PHOTO_CACHE = new Map();`, a 600-second lifetime, and 60-second refresh margin. `invalidateListPhotoCache(id)` deletes the numeric key, resets a visible matching media node to loading, and re-observes it; expose it on `window`.

- [ ] **Step 2: Discover the cover using existing ordering**

In `loadListSpecPhoto`, return a still-valid cached result first. Otherwise list only `instPhotoFolder(d)`, filter the same extensions/placeholder as `loadDetailPhotos`, arrange `{name}` entries with `instPhotoArrange`, choose `bySlot.overview || imgs[0]`, and cache/return `{state:'empty'}` if none exists.

- [ ] **Step 3: Sign and cache the chosen image**

Call `createSignedUrl(path, 600)` only for the cover and cache `{state:'ready',name,url,expiresAt:Date.now()+600000}`. Catch list/sign failures per card and return `{state:'empty'}` so siblings remain usable.

- [ ] **Step 4: Load only near-viewport cards**

Maintain one observer, disconnect before each render, observe current media nodes with positive `rootMargin`, unobserve on intersection, locate the instrument in current `filteredData`, then load/render it. If IntersectionObserver is unavailable, load only those current-page nodes directly.

- [ ] **Step 5: Render ready, empty, and broken states**

For `ready`, render `<img loading="lazy" decoding="async">`. Its error handler removes the broken image, shows `ยังไม่มีรูปเครื่องมือ`, deletes the cache entry, and leaves other cards unchanged. Empty/error results use the same neutral placeholder.

- [ ] **Step 6: Invalidate after mutations**

After successful `saveInstrumentPhoto` and successful `deleteInstrumentPhoto`, call:

```js
if (typeof window.invalidateListPhotoCache === 'function') window.invalidateListPhotoCache(d.id);
```

Editing is covered because it calls `saveInstrumentPhoto(d, name, out, false)`.

- [ ] **Step 7: Run tests**

Run: `powershell -ExecutionPolicy Bypass -File tools/run-tests.ps1`

Expected: JavaScript contract tests pass; only remaining CSS assertions may fail.

- [ ] **Step 8: Commit**

```powershell
git add -- js/26-list-ui.js js/03-instruments.js
git commit -m "feat: lazy load instrument catalog covers"
```

### Task 4: Style, remove mobile conflicts, and verify

**Files:**
- Modify: `theme-aqua.css:650`
- Modify: `index.html:1316`
- Modify: `index.html:1952`
- Modify: `index.html:3056`
- Modify: `sw.js:1`

**Interfaces:**
- Consumes: `.ax-spec-*` markup and `.is-loading` / `.is-empty` media states.
- Produces: stable 4/2/1 layout, aligned buttons, visible focus, and consistent mobile visibility.

- [ ] **Step 1: Add scoped desktop styles**

Implement these layout invariants plus presentation styles:

```css
.ax-spec-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:18px; width:100%; min-width:0; }
.ax-spec-card { min-width:0; overflow:hidden; display:flex; flex-direction:column; }
.ax-spec-media { aspect-ratio:16/10; position:relative; overflow:hidden; }
.ax-spec-media img { width:100%; height:100%; display:block; object-fit:cover; }
.ax-spec-body { display:flex; flex:1; min-width:0; flex-direction:column; }
.ax-spec-id,.ax-spec-cert,.ax-spec-due { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ax-spec-detail { width:100%; margin-top:auto; }
```

Use border/outline/shadow (no translation) for hover/focus. Give loading a non-flashing neutral skeleton and empty media readable placeholder text.

- [ ] **Step 2: Add exact breakpoints**

At `max-width:1100px`, use `repeat(2,minmax(0,1fr))`; at `max-width:767px`, use `minmax(0,1fr)`, safe gaps, `min-width:0`, and `max-width:100%`.

- [ ] **Step 3: Remove legacy mobile substitution conflicts**

Adjust rules that hide every `.ax-tablecard` and show `#mobileCardList`: the selected `#listSpecCard` must remain visible, `#listFullCard` remains controlled by `renderListPage()`, and `#mobileCardList` stays hidden on this page. Do not rewrite the legacy renderer.

- [ ] **Step 4: Refresh deployed cache keys**

Bump query versions for `theme-aqua.css` and `js/26-list-ui.js` in `index.html`, and bump `CACHE_NAME` in `sw.js`.

- [ ] **Step 5: Run automated verification**

```powershell
powershell -ExecutionPolicy Bypass -File tools/run-tests.ps1
powershell -ExecutionPolicy Bypass -File tools/verify-app-load.ps1
git diff --check
```

Expected: every HTML test page passes, app-load verification exits 0, and `git diff --check` reports no errors.

- [ ] **Step 6: Perform responsive browser QA**

At widths `1440`, `900`, and `390`, verify 4/2/1 columns, no overflow, aligned buttons, focus visibility, four statuses, overview/fallback/missing/broken covers, correct detail IDs, preserved filters/pager/page sizes, and unchanged full table.

- [ ] **Step 7: Commit**

```powershell
git add -- index.html theme-aqua.css sw.js tests/instrument-list-ui.test.html
git commit -m "style: finish responsive instrument catalog cards"
```

