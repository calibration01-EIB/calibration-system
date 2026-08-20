# Instrument Edit Tabbed Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long instrument add/edit form with the approved three-tab modal that shows one category at a time and fits each category into a dense responsive grid at Browser zoom 100%.

**Architecture:** Keep every existing form control ID and the existing Supabase payload contract. Restructure only `#instrumentModal`, add modal-scoped CSS in `theme-aqua.css`, and add a small presentation-state controller in `js/03-instruments.js`; the tab controller never reads or writes the database. Static contract tests lock the structure, accessibility, integration points, responsive layout, and offline cache version before browser QA verifies real interaction.

**Tech Stack:** Existing HTML/CSS, vanilla JavaScript, Python `unittest`, Node syntax checks, service worker app shell, Chrome/in-app-browser QA.

## Global Constraints

- Implement the approved Option B reference at `docs/prototypes/instrument-edit-tabbed-form-v1.png`.
- Tabs are exactly `info`, `spec`, and `calibration`; only the active panel is visible.
- Preserve every existing input/select `id`, value population path, save payload field, duplicate check, unit parser, date calculation, toast, and post-save row highlight.
- Desktop uses 3 columns at `>=1200px`, tablet uses 2 columns at `768–1199px`, and mobile uses 1 column below `768px`.
- Do not change global application scale or styles outside `#instrumentModal`.
- Do not add dependencies, database columns, autosave, a forced wizard sequence, or an unsaved-changes guard.
- Use `#079e91` for the primary tab/focus treatment, no gradients or glassmorphism, and honor `prefers-reduced-motion`.
- Work on the current `main` branch as previously authorized by the user; preserve unrelated worktree changes if any appear.

## File Structure

- Modify `index.html:4350-4646` — semantic modal shell, tab buttons, three panels, field grouping, and sticky footer markup.
- Modify `theme-aqua.css` — all responsive and visual rules, strictly scoped under `#instrumentModal`.
- Modify `js/03-instruments.js:588-656,762-766,902-1008` — active-tab state, keyboard controller, header chip, open/reset behavior, validation focus, and save-button idle label.
- Create `tests/test_instrument_edit_tabs.py` — source-level structural, accessibility, behavior-integration, responsive, and cache contracts.
- Modify `sw.js:1` — bump the app-shell cache from `calibration-app-v135` to `calibration-app-v136` after the HTML/CSS/JS change.

---

### Task 1: Build the semantic tabbed modal shell and responsive layout

**Files:**
- Create: `tests/test_instrument_edit_tabs.py`
- Modify: `index.html:4350-4646`
- Modify: `theme-aqua.css`

**Interfaces:**
- Consumes: Existing form control IDs and existing `.modal-overlay`, `.modal-box`, `.modal-header`, `.modal-body`, `.modal-footer`, `.form-group`, `.btn-primary`, and `.btn-reset` primitives.
- Produces: `#instrumentTabList`, tab buttons with `data-instrument-tab`, `#instrumentPanelInfo`, `#instrumentPanelSpec`, `#instrumentPanelCalibration`, `#instrumentModalCode`, `#instrumentTabProgressLabel`, and `.instrument-modal-content` for Task 2.

- [ ] **Step 1: Write the failing structural and responsive tests**

Create `tests/test_instrument_edit_tabs.py` with:

```python
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "theme-aqua.css").read_text(encoding="utf-8")
JS = (ROOT / "js" / "03-instruments.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def panel_html(panel_id):
    match = re.search(
        rf'<section[^>]+id="{re.escape(panel_id)}"[^>]*>(.*?)</section>',
        INDEX,
        re.S,
    )
    if not match:
        raise AssertionError(f"Missing panel: {panel_id}")
    return match.group(1)


class InstrumentEditTabbedFormTests(unittest.TestCase):
    def test_modal_has_three_accessible_tabs_and_panels(self):
        self.assertIn('id="instrumentTabList" role="tablist"', INDEX)
        expected = [
            ("info", "instrumentTabInfo", "instrumentPanelInfo"),
            ("spec", "instrumentTabSpec", "instrumentPanelSpec"),
            ("calibration", "instrumentTabCalibration", "instrumentPanelCalibration"),
        ]
        for key, tab_id, panel_id in expected:
            self.assertRegex(
                INDEX,
                rf'<button[^>]+id="{tab_id}"[^>]+role="tab"[^>]+'
                rf'data-instrument-tab="{key}"[^>]+aria-controls="{panel_id}"',
            )
            self.assertRegex(
                INDEX,
                rf'<section[^>]+id="{panel_id}"[^>]+role="tabpanel"[^>]+'
                rf'aria-labelledby="{tab_id}"',
            )
        self.assertEqual(INDEX.count('class="instrument-tab-icon"'), 3)

    def test_fields_are_grouped_under_the_correct_panels(self):
        groups = {
            "instrumentPanelInfo": [
                "iCategory", "iProductGroup", "iName", "iMachineName",
                "iIdCode", "iSerial", "iBrand", "iModel", "iDept",
                "iDivision", "iCostCenter", "iAssetNo",
            ],
            "instrumentPanelSpec": [
                "iCapacity", "iCapacityUnit", "iRange", "iRangeUnit",
                "iRes1", "iRes2", "iRes3", "iResUnit",
                "iTol1", "iTol2", "iTol3", "iTolUnit",
                "iUsageMin1", "iUsageMin2", "iUsageMin3", "iUsageMinUnit",
                "iUsageMax1", "iUsageMax2", "iUsageMax3", "iUsageMaxUnit",
                "iUsageFreq", "iUspType", "iBalanceType",
            ],
            "instrumentPanelCalibration": [
                "iCalFrequency", "iCalType", "iLocation", "iCertNo",
                "iCalDate", "iDueDate", "iPrevCertNo", "iPrevCalDate", "iRemark",
            ],
        }
        for panel_id, ids in groups.items():
            markup = panel_html(panel_id)
            for field_id in ids:
                self.assertIn(f'id="{field_id}"', markup, (panel_id, field_id))

    def test_modal_shell_has_identity_progress_scroll_region_and_footer(self):
        for hook in (
            'class="modal-box instrument-modal-box"',
            'id="instrumentModalCode"',
            'id="instrumentModalStatus"',
            'id="instrumentTabProgressLabel"',
            'class="modal-body instrument-modal-content"',
            'class="modal-footer instrument-modal-footer"',
            'id="saveInstrumentBtn"',
        ):
            self.assertIn(hook, INDEX)
        content_end = INDEX.index('</div>\n    <div class="modal-footer instrument-modal-footer"', INDEX.index('id="instrumentModal"'))
        save_pos = INDEX.index('id="saveInstrumentBtn"', INDEX.index('id="instrumentModal"'))
        self.assertGreater(save_pos, content_end)

    def test_modal_css_is_scoped_and_responsive(self):
        self.assertIn("#instrumentModal .instrument-modal-box", CSS)
        self.assertRegex(CSS, r"#instrumentModal\s+\.instrument-form-grid\s*\{[^}]*repeat\(3")
        self.assertRegex(
            CSS,
            r"@media \(max-width: 1199px\)[\s\S]*?#instrumentModal\s+\.instrument-form-grid\s*\{[^}]*repeat\(2",
        )
        self.assertRegex(
            CSS,
            r"@media \(max-width: 767px\)[\s\S]*?#instrumentModal\s+\.instrument-form-grid\s*\{[^}]*1fr",
        )
        self.assertIn("@media (prefers-reduced-motion: reduce)", CSS)
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest tests.test_instrument_edit_tabs -v
```

Expected: 4 failures because the tab list, panel wrappers, shell hooks, and scoped responsive CSS do not exist yet.

- [ ] **Step 3: Restructure the existing modal without changing control IDs or option lists**

Change the `#instrumentModal` shell in `index.html` to this exact hierarchy:

```html
<div class="modal-overlay" id="instrumentModal">
  <div class="modal-box instrument-modal-box">
    <div class="modal-header instrument-modal-header">
      <div class="instrument-modal-title-row">
        <h3 id="instrumentModalTitle">เพิ่มเครื่องมือ</h3>
        <span class="instrument-code-chip" id="instrumentModalCode" hidden></span>
      </div>
      <div class="instrument-modal-header-actions">
        <span class="instrument-modal-status" id="instrumentModalStatus">รายการใหม่</span>
        <button class="btn-close" type="button" aria-label="ปิดหน้าต่าง" onclick="closeInstrumentModal()">×</button>
      </div>
    </div>

    <div class="instrument-tabs-shell">
      <div class="instrument-tabs" id="instrumentTabList" role="tablist" aria-label="หมวดข้อมูลเครื่องมือ">
        <button type="button" class="instrument-tab is-active" id="instrumentTabInfo"
          role="tab" data-instrument-tab="info" aria-selected="true"
          aria-controls="instrumentPanelInfo" tabindex="0">
          <span class="instrument-tab-number">1</span><span class="instrument-tab-icon" aria-hidden="true">▤</span><span>ข้อมูลเครื่องมือ</span>
        </button>
        <button type="button" class="instrument-tab" id="instrumentTabSpec"
          role="tab" data-instrument-tab="spec" aria-selected="false"
          aria-controls="instrumentPanelSpec" tabindex="-1">
          <span class="instrument-tab-number">2</span><span class="instrument-tab-icon" aria-hidden="true">↔</span><span>สเปกการวัด</span>
        </button>
        <button type="button" class="instrument-tab" id="instrumentTabCalibration"
          role="tab" data-instrument-tab="calibration" aria-selected="false"
          aria-controls="instrumentPanelCalibration" tabindex="-1">
          <span class="instrument-tab-number">3</span><span class="instrument-tab-icon" aria-hidden="true">◎</span><span>การสอบเทียบ</span>
        </button>
      </div>
      <div class="instrument-tab-progress" aria-hidden="true">
        <span id="instrumentTabProgressLabel">หมวด 1 จาก 3</span>
        <span class="instrument-progress-dots"><i class="is-active"></i><i></i><i></i></span>
      </div>
    </div>

    <div class="modal-body instrument-modal-content">
      <div id="instrumentDuplicateWarning" class="instrument-duplicate-warning" hidden></div>
```

Do not rewrite any existing field control or option list. Replace the current `1) ข้อมูลเครื่องมือ` divider with this opening wrapper, keep the existing form groups from `iCategory` through `iAssetNo` verbatim inside it, then close it immediately before the current `2) สเปกการวัด` divider:

```html
      <section class="instrument-tab-panel is-active" id="instrumentPanelInfo"
        role="tabpanel" aria-labelledby="instrumentTabInfo">
        <div class="instrument-section-heading">
          <h4>1 ข้อมูลเครื่องมือ</h4>
          <p>ข้อมูลพื้นฐานสำหรับระบุและจัดการเครื่องมือ</p>
        </div>
        <div class="instrument-form-grid">
```

```html
        </div>
      </section>
```

Replace the current `2) สเปกการวัด` divider with this opening wrapper, keep the existing form groups from `iCapacity` through `iBalanceType` inside it, add `instrument-form-wide` to the Resolution, Tolerance, Minimum usage, and Maximum usage `.form-group` elements, then close it immediately before the current `3) การสอบเทียบ` divider:

```html
      <section class="instrument-tab-panel" id="instrumentPanelSpec"
        role="tabpanel" aria-labelledby="instrumentTabSpec" hidden>
        <div class="instrument-section-heading">
          <h4>2 สเปกการวัด</h4>
          <p>รายละเอียดคุณลักษณะและขอบเขตการวัดของเครื่องมือ</p>
        </div>
        <div class="instrument-form-grid">
```

```html
        </div>
      </section>
```

Replace the current `3) การสอบเทียบ` divider with this opening wrapper and keep the existing form groups from `iCalFrequency` through `iRemark` inside it. Replace the old buttons below the grid and the existing closing tags with:

```html
      <section class="instrument-tab-panel" id="instrumentPanelCalibration"
        role="tabpanel" aria-labelledby="instrumentTabCalibration" hidden>
        <div class="instrument-section-heading">
          <h4>3 การสอบเทียบ</h4>
          <p>กำหนดรอบ สถานที่ และข้อมูลใบรับรอง</p>
        </div>
        <div class="instrument-form-grid">
```

```html
        </div>
      </section>
    </div>

    <div class="modal-footer instrument-modal-footer">
      <div class="instrument-footer-hint">ⓘ ตรวจสอบข้อมูลก่อนบันทึก</div>
      <div class="instrument-footer-actions">
        <button type="button" class="btn-reset" onclick="closeInstrumentModal()">ยกเลิก</button>
        <button type="button" class="btn-primary" id="saveInstrumentBtn" onclick="saveInstrument()">บันทึก</button>
      </div>
    </div>
  </div>
</div>
```

Replace the warning's inline `display:none` with the `hidden` attribute while keeping its existing `id`.

- [ ] **Step 4: Add modal-scoped visual and responsive CSS**

Append this focused block to `theme-aqua.css`:

```css
/* Instrument add/edit modal — approved tabbed layout */
#instrumentModal { --instrument-accent: #079e91; }
#instrumentModal .instrument-modal-box {
  width: min(1400px, calc(100vw - 48px)) !important;
  max-width: 1400px !important;
  height: min(900px, calc(100vh - 48px)) !important;
  max-height: calc(100vh - 48px) !important;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden !important;
  border-radius: 12px !important;
}
#instrumentModal .instrument-modal-header { position: static; padding: 18px 24px; }
#instrumentModal .instrument-modal-title-row,
#instrumentModal .instrument-modal-header-actions,
#instrumentModal .instrument-footer-actions { display: flex; align-items: center; gap: 12px; }
#instrumentModal .instrument-code-chip {
  padding: 5px 10px; border: 1px solid #a9dcd7; border-radius: 7px;
  background: #effaf8; color: #087f75; font-family: var(--mono); font-size: 12px;
}
#instrumentModal .instrument-modal-status { color: #087f75; font-size: 12px; }
#instrumentModal .instrument-tabs-shell {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch;
  border-bottom: 1px solid var(--border); background: #fff; padding: 0 24px;
}
#instrumentModal .instrument-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 220px)); }
#instrumentModal .instrument-tab {
  min-height: 64px; display: flex; align-items: center; justify-content: center; gap: 9px;
  border: 0; border-bottom: 3px solid transparent; background: transparent;
  color: var(--text2); font: 600 14px var(--font); cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;
}
#instrumentModal .instrument-tab:hover { background: #f4fbfa; color: #087f75; }
#instrumentModal .instrument-tab.is-active {
  background: #edf9f7; border-bottom-color: var(--instrument-accent); color: #087f75;
}
#instrumentModal .instrument-tab:focus-visible { outline: 3px solid rgba(7, 158, 145, .28); outline-offset: -3px; }
#instrumentModal .instrument-tab-number {
  width: 28px; height: 28px; display: inline-grid; place-items: center;
  border: 1px solid #c9dbe4; border-radius: 50%; background: #fff; color: var(--text2);
}
#instrumentModal .instrument-tab-icon { color: currentColor; font-size: 18px; line-height: 1; }
#instrumentModal .instrument-tab.is-active .instrument-tab-number { background: var(--instrument-accent); border-color: var(--instrument-accent); color: #fff; }
#instrumentModal .instrument-tab-progress { align-self: center; min-width: 112px; color: var(--text3); font-size: 11px; text-align: right; }
#instrumentModal .instrument-progress-dots { display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px; }
#instrumentModal .instrument-progress-dots i { width: 26px; height: 3px; border-radius: 999px; background: #d8e3e9; }
#instrumentModal .instrument-progress-dots i.is-active { background: var(--instrument-accent); }
#instrumentModal .instrument-modal-content { min-height: 0; overflow-y: auto; padding: 24px 28px; }
#instrumentModal .instrument-duplicate-warning:not([hidden]) {
  display: block; margin-bottom: 16px; padding: 12px 14px; border: 1px solid #f3b7b7;
  border-left: 4px solid var(--red); border-radius: 9px; background: #fcebeb;
  color: #8a1f1f; font-size: 13px; line-height: 1.55;
}
#instrumentModal .instrument-tab-panel[hidden] { display: none !important; }
#instrumentModal .instrument-section-heading { margin-bottom: 20px; }
#instrumentModal .instrument-section-heading h4 { color: #087f75; font-size: 18px; line-height: 1.25; }
#instrumentModal .instrument-section-heading p { margin-top: 4px; color: var(--text3); font-size: 12px; }
#instrumentModal .instrument-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 18px; }
#instrumentModal .instrument-form-grid .form-group { min-width: 0; margin: 0; }
#instrumentModal .instrument-form-grid .form-group label { margin-bottom: 6px; font-size: 12px; }
#instrumentModal .instrument-form-grid input,
#instrumentModal .instrument-form-grid select { min-height: 46px; }
#instrumentModal .instrument-form-wide { grid-column: 1 / -1; }
#instrumentModal .instrument-modal-footer { justify-content: space-between; border-radius: 0; padding: 14px 24px; }
#instrumentModal .instrument-footer-hint { color: var(--text3); font-size: 12px; }
#instrumentModal .instrument-footer-actions button { width: auto; min-width: 108px; }
#instrumentModal .instrument-footer-actions .btn-primary { min-width: 168px; }

@media (max-width: 1199px) {
  #instrumentModal .instrument-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  #instrumentModal .instrument-tabs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  #instrumentModal .instrument-modal-box { width: 100vw !important; height: calc(100dvh - 64px) !important; max-height: calc(100dvh - 64px) !important; border-radius: 16px 16px 0 0 !important; }
  #instrumentModal .instrument-tabs-shell { display: block; padding: 0; }
  #instrumentModal .instrument-tab { min-height: 54px; padding: 8px 5px; font-size: 11px; }
  #instrumentModal .instrument-tab-number { width: 23px; height: 23px; }
  #instrumentModal .instrument-tab-progress { display: none; }
  #instrumentModal .instrument-modal-content { padding: 16px 14px; }
  #instrumentModal .instrument-form-grid { grid-template-columns: 1fr; gap: 13px; }
  #instrumentModal .instrument-form-wide { grid-column: auto; }
  #instrumentModal .instrument-modal-footer { display: grid; grid-template-columns: 1fr; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); }
  #instrumentModal .instrument-footer-hint { display: none; }
  #instrumentModal .instrument-footer-actions { display: grid; grid-template-columns: 1fr 1fr; }
  #instrumentModal .instrument-footer-actions button { width: 100%; min-width: 0; }
}
@media (prefers-reduced-motion: reduce) {
  #instrumentModal .instrument-tab { transition: none; }
}
```

- [ ] **Step 5: Run Task 1 tests and verify they pass**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest tests.test_instrument_edit_tabs -v
git diff --check
```

Expected: 4 tests pass; `git diff --check` has no output.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- index.html theme-aqua.css tests/test_instrument_edit_tabs.py
git commit -m "feat: add tabbed instrument form shell"
```

---

### Task 2: Add accessible tab behavior and preserve CRUD integration

**Files:**
- Modify: `tests/test_instrument_edit_tabs.py`
- Modify: `js/03-instruments.js:588-656,762-766,902-1008`

**Interfaces:**
- Consumes: Task 1's `[data-instrument-tab]` buttons, `.instrument-tab-panel` sections, `#instrumentModalCode`, `#instrumentTabProgressLabel`, `.instrument-progress-dots`, and `.instrument-modal-content`.
- Produces: `INSTRUMENT_MODAL_TABS`, `setInstrumentModalTab(tabKey, options)`, `handleInstrumentTabKeydown(event)`, and `initInstrumentModalTabs()`; existing `openInstrumentModal()`, `closeInstrumentModal()`, and `saveInstrument()` remain public entry points.

- [ ] **Step 1: Add failing behavior-integration tests**

Append these methods inside `InstrumentEditTabbedFormTests`:

```python
    def test_tab_controller_updates_accessibility_visibility_and_progress(self):
        for token in (
            "const INSTRUMENT_MODAL_TABS = ['info', 'spec', 'calibration']",
            "function setInstrumentModalTab(tabKey, options = {})",
            "function handleInstrumentTabKeydown(event)",
            "function initInstrumentModalTabs()",
            "button.setAttribute('aria-selected', String(isActive))",
            "panel.hidden = !isActive",
            "instrumentTabProgressLabel",
        ):
            self.assertIn(token, JS)

    def test_open_resets_first_tab_and_updates_identity_chip(self):
        body = re.search(r"function openInstrumentModal\(instrumentId\)\s*\{(.*?)\n\}", JS, re.S)
        self.assertIsNotNone(body)
        self.assertIn("initInstrumentModalTabs()", body.group(1))
        self.assertIn("setInstrumentModalTab('info')", body.group(1))
        self.assertIn("instrumentModalCode", body.group(1))
        self.assertIn("saveInstrumentBtn", body.group(1))

    def test_missing_id_code_reveals_and_focuses_info_field(self):
        guard = re.search(r"if \(!payload\.id_code\)\s*\{(.*?)\}", JS, re.S)
        self.assertIsNotNone(guard)
        self.assertIn("setInstrumentModalTab('info')", guard.group(1))
        self.assertIn("document.getElementById('iIdCode').focus()", guard.group(1))

    def test_close_resets_presentation_state_without_resetting_fields(self):
        body = re.search(r"function closeInstrumentModal\(\)\s*\{(.*?)\n\}", JS, re.S)
        self.assertIsNotNone(body)
        self.assertIn("setInstrumentModalTab('info')", body.group(1))
        self.assertNotIn(".value = ''", body.group(1))
```

- [ ] **Step 2: Run the tests and verify the 4 new tests fail**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest tests.test_instrument_edit_tabs -v
```

Expected: Task 1's 4 tests pass and the 4 new controller/integration tests fail.

- [ ] **Step 3: Add the tab controller above `openInstrumentModal()`**

Add:

```javascript
const INSTRUMENT_MODAL_TABS = ['info', 'spec', 'calibration'];
let activeInstrumentModalTab = 'info';

function setInstrumentModalTab(tabKey, options = {}) {
  const nextKey = INSTRUMENT_MODAL_TABS.includes(tabKey) ? tabKey : 'info';
  const activeIndex = INSTRUMENT_MODAL_TABS.indexOf(nextKey);
  const buttons = document.querySelectorAll('#instrumentTabList [data-instrument-tab]');
  const panels = document.querySelectorAll('#instrumentModal .instrument-tab-panel');

  buttons.forEach(button => {
    const isActive = button.dataset.instrumentTab === nextKey;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
  panels.forEach(panel => {
    const isActive = panel.id === `instrumentPanel${nextKey === 'info' ? 'Info' : nextKey === 'spec' ? 'Spec' : 'Calibration'}`;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  const progressLabel = document.getElementById('instrumentTabProgressLabel');
  if (progressLabel) progressLabel.textContent = `หมวด ${activeIndex + 1} จาก 3`;
  document.querySelectorAll('#instrumentModal .instrument-progress-dots i').forEach((dot, index) => {
    dot.classList.toggle('is-active', index === activeIndex);
  });
  const content = document.querySelector('#instrumentModal .instrument-modal-content');
  if (content) content.scrollTop = 0;
  activeInstrumentModalTab = nextKey;

  if (options.focus) {
    const activeButton = document.querySelector(`#instrumentTabList [data-instrument-tab="${nextKey}"]`);
    if (activeButton) activeButton.focus();
  }
}

function handleInstrumentTabKeydown(event) {
  const current = event.currentTarget.dataset.instrumentTab;
  let index = INSTRUMENT_MODAL_TABS.indexOf(current);
  if (event.key === 'ArrowRight') index = (index + 1) % INSTRUMENT_MODAL_TABS.length;
  else if (event.key === 'ArrowLeft') index = (index - 1 + INSTRUMENT_MODAL_TABS.length) % INSTRUMENT_MODAL_TABS.length;
  else if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = INSTRUMENT_MODAL_TABS.length - 1;
  else return;
  event.preventDefault();
  setInstrumentModalTab(INSTRUMENT_MODAL_TABS[index], { focus: true });
}

function initInstrumentModalTabs() {
  document.querySelectorAll('#instrumentTabList [data-instrument-tab]').forEach(button => {
    if (button.dataset.instrumentTabReady) return;
    button.addEventListener('click', () => setInstrumentModalTab(button.dataset.instrumentTab));
    button.addEventListener('keydown', handleInstrumentTabKeydown);
    button.dataset.instrumentTabReady = 'true';
  });
}
```

- [ ] **Step 4: Integrate the controller into open, validation, close, and save states**

At the beginning of `openInstrumentModal(instrumentId)`, after assigning `editingInstrumentId`, add:

```javascript
  initInstrumentModalTabs();
  setInstrumentModalTab('info');
  const codeChip = document.getElementById('instrumentModalCode');
  const saveButton = document.getElementById('saveInstrumentBtn');
  const source = instrumentId ? allData.find(x => x.id === instrumentId) : null;
  const code = source?.id_code || '';
  codeChip.textContent = code;
  codeChip.hidden = !code;
  document.getElementById('instrumentModalStatus').textContent = instrumentId ? 'ข้อมูลพร้อมแก้ไข' : 'รายการใหม่';
  saveButton.dataset.idleLabel = instrumentId ? 'บันทึกการแก้ไข' : 'บันทึก';
  saveButton.textContent = saveButton.dataset.idleLabel;
```

Reuse `source` as the existing loaded record instead of performing a second `allData.find`: change `const d = allData.find(...)` to `const d = source`.

Replace the missing-ID guard in `saveInstrument()` with:

```javascript
  if (!payload.id_code) {
    setInstrumentModalTab('info');
    document.getElementById('iIdCode').focus();
    showToast('กรุณากรอก ID Code', 'error');
    return;
  }
```

At the end of `closeInstrumentModal()`, after clearing the duplicate warning, add:

```javascript
  setInstrumentModalTab('info');
```

Replace the current save-button state lines with:

```javascript
  const btn = document.getElementById('saveInstrumentBtn');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';
```

and replace the `finally` statement with:

```javascript
  finally {
    btn.disabled = false;
    btn.textContent = btn.dataset.idleLabel || 'บันทึก';
  }
```

Update `clearInstrumentDuplicateWarning()` and `renderInstrumentDuplicateWarning()` to use the `hidden` property rather than inline display:

```javascript
function clearInstrumentDuplicateWarning() {
  const box = document.getElementById('instrumentDuplicateWarning');
  if (box) {
    box.hidden = true;
    box.innerHTML = '';
  }
  lastInstrumentDuplicateToastKey = '';
}
```

In `renderInstrumentDuplicateWarning()`, use `box.hidden = true` in the empty branch and `box.hidden = false` in the matches branch; keep the warning HTML unchanged.

- [ ] **Step 5: Run Task 2 tests and syntax checks**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest tests.test_instrument_edit_tabs -v
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\03-instruments.js
git diff --check
```

Expected: 8 tests pass; Node exits 0 with no output; `git diff --check` has no output.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- js/03-instruments.js tests/test_instrument_edit_tabs.py
git commit -m "feat: add accessible instrument form tabs"
```

---

### Task 3: Refresh the offline shell and verify the complete workflow

**Files:**
- Modify: `tests/test_instrument_edit_tabs.py`
- Modify: `sw.js:1`

**Interfaces:**
- Consumes: The final HTML/CSS/JS from Tasks 1–2 and the existing service-worker `APP_SHELL` entries for `index.html`, `theme-aqua.css`, and `js/03-instruments.js`.
- Produces: `calibration-app-v136` so installed offline clients receive the redesigned modal.

- [ ] **Step 1: Add the failing offline cache contract**

Append inside `InstrumentEditTabbedFormTests`:

```python
    def test_offline_shell_version_refreshes_tabbed_modal_files(self):
        self.assertIn("calibration-app-v136", SW)
        for asset in ("./index.html", "./theme-aqua.css", "./js/03-instruments.js"):
            self.assertIn(asset, SW)
```

- [ ] **Step 2: Run the focused test and verify the cache assertion fails**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest tests.test_instrument_edit_tabs.InstrumentEditTabbedFormTests.test_offline_shell_version_refreshes_tabbed_modal_files -v
```

Expected: FAIL because `sw.js` still contains `calibration-app-v135`.

- [ ] **Step 3: Bump the service-worker cache exactly once**

Change the first line of `sw.js` to:

```javascript
const CACHE_NAME = 'calibration-app-v136';
```

Do not change the `APP_SHELL` order or add the mockup PNG to the offline application cache; it is design documentation, not a runtime asset.

- [ ] **Step 4: Run the complete automated verification**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest discover -s tests -p 'test_*.py' -v
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\03-instruments.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe' -NoProfile -File tools\verify-app-load.ps1
git diff --check
```

Expected: all Python tests pass; both Node syntax checks exit 0; app-load output ends with `SUMMARY CLEAN`; `git diff --check` has no output.

- [ ] **Step 5: Perform real browser QA at Browser zoom 100%**

Use the local same-origin QA server/harness already established for this project and verify:

1. Open an existing instrument and confirm the header chip matches its ID Code.
2. At a 1920×1080 desktop viewport, confirm all 12 Tab 1 fields are visible without panel scrolling and form controls visually match the approved mockup.
3. Click each tab and confirm only its panel is visible; type a temporary value, switch away, and confirm it remains when returning.
4. Use `ArrowLeft`, `ArrowRight`, `Home`, and `End`; confirm focus and `aria-selected` follow the active panel.
5. Confirm duplicate ID and duplicate CERT warnings remain visible irrespective of the active tab.
6. Clear ID Code, press Save, and confirm Tab 1 opens and ID Code receives focus.
7. Confirm due-date calculation, previous-cert autofill, unit selectors, and multi-band fields still work.
8. Confirm add and edit flows still create/update the unchanged payload; use a disposable QA record or stubbed same-origin harness, never alter production data for testing.
9. At 1024px confirm a 2-column grid with no horizontal overflow; below 768px confirm 1 column and the existing app-mode bottom-sheet/full-screen behavior.
10. Confirm unrelated modals and the instrument list hover/pagination are visually unchanged.

Capture computed styles or screenshots for 3/2/1-column states and record any browser-console errors. If a defect appears, first add a focused failing test, then make the smallest scoped correction and rerun Steps 4–5.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- sw.js tests/test_instrument_edit_tabs.py
git commit -m "feat: refresh offline tabbed instrument form"
```

- [ ] **Step 7: Final review gate**

Request a read-only review against `docs/superpowers/specs/2026-08-20-instrument-edit-tabbed-form-design.md`. The reviewer must report Critical, Important, and Minor findings; implementation is ready only when Critical and Important are empty and the worktree contains no unintended files.
