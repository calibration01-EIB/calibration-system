# Instrument List Pagination and Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้หน้าบัญชีรายการแสดง 20 เครื่องเป็นค่าเริ่มต้น เลือกได้ 20/50/100 และมี hover แถวที่ชัดขึ้นโดยไม่กระทบตารางหน้าอื่น

**Architecture:** คงกลไก pagination และ renderer เดิม เปลี่ยนเฉพาะค่าเริ่มต้นกับตัวเลือกใน DOM และเพิ่ม CSS override ที่ scope ใต้ `#pageList .ax-table` ชุดทดสอบแบบ structural จะล็อกสัญญา HTML/JavaScript/CSS และ verification จะตรวจโหลดแอปกับหน้าจริง

**Tech Stack:** HTML, vanilla JavaScript, CSS, Python `unittest`, PowerShell verification scripts

## Global Constraints

- ปรับเฉพาะตารางรายการเครื่องมือใน `pageList`
- ค่าเริ่มต้นเป็น 20 เครื่อง และตัวเลือกมี 20/50/100 เท่านั้น
- การเปลี่ยนจำนวนแถวยังคงตั้ง `currentPage = 1` และเรียก `renderTable()`
- Hover ใช้พื้น `#dcefed`, แถบซ้าย `4px` สี `var(--accent)` และ transition `120ms ease`
- Zebra stripe, สีข้อความ, status badge, คอลัมน์, filter, search, sort และการเปิดรายละเอียดเดิมต้องคงอยู่
- ห้ามปรับสเกล 75%/80% ของระบบ และห้ามเปลี่ยนตารางหน้าอื่น

---

### Task 1: Implement the 20-Row Contract and Scoped Hover

**Files:**
- Create: `tests/test_instrument_list_ui.py`
- Modify: `index.html:3092-3096`
- Modify: `js/04-reports.js:425-432`
- Modify: `theme-aqua.css:625-632`
- Test: `tests/test_instrument_list_ui.py`

**Interfaces:**
- Consumes: global `pageSize`, `currentPage`, `changePageSize()`, `renderTable()` and `#pageSizeSelect`
- Produces: default `pageSize = 20`, exact select values `20/50/100`, and scoped `#pageList .ax-table` hover styling

- [ ] **Step 1: Write the failing structural tests**

Create `tests/test_instrument_list_ui.py`:

```python
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
REPORTS_JS = (ROOT / "js" / "04-reports.js").read_text(encoding="utf-8")
CSS = (ROOT / "theme-aqua.css").read_text(encoding="utf-8")


class InstrumentListUITests(unittest.TestCase):
    def test_page_size_defaults_to_twenty_with_exact_options(self):
        self.assertRegex(REPORTS_JS, r"let\s+pageSize\s*=\s*20\s*;")
        select = re.search(
            r'<select\s+id="pageSizeSelect"[^>]*>(.*?)</select>',
            INDEX,
            re.S,
        )
        self.assertIsNotNone(select)
        options = re.findall(
            r'<option\s+value="(\d+)"([^>]*)>',
            select.group(1),
        )
        self.assertEqual([value for value, _ in options], ["20", "50", "100"])
        self.assertEqual(
            [value for value, attrs in options if "selected" in attrs],
            ["20"],
        )

    def test_page_size_change_resets_page_and_rerenders(self):
        body = re.search(
            r"function\s+changePageSize\(\)\s*\{(.*?)\}",
            REPORTS_JS,
            re.S,
        )
        self.assertIsNotNone(body)
        self.assertIn("pageSize = parseInt(document.getElementById('pageSizeSelect').value)", body.group(1))
        self.assertIn("currentPage = 1", body.group(1))
        self.assertIn("renderTable()", body.group(1))

    def test_hover_is_dark_clear_and_scoped_to_instrument_list(self):
        self.assertIn(
            "#app #pageList .ax-table td { transition: background-color 120ms ease; }",
            CSS,
        )
        self.assertIn(
            "#app #pageList .ax-table tbody tr:hover td { background: #dcefed !important; }",
            CSS,
        )
        self.assertIn(
            "#app #pageList .ax-table tbody tr:hover td:first-child { box-shadow: inset 4px 0 0 var(--accent); }",
            CSS,
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
python -B -m unittest tests.test_instrument_list_ui -v
```

Expected: 2 tests FAIL because the current default/options are 100 and 50/100/200, and the scoped hover contract is absent; the existing page-reset behavior test passes.

- [ ] **Step 3: Change the pagination controls**

Replace the select options in `index.html` with:

```html
<option value="20" selected>20 แถว</option>
<option value="50">50 แถว</option>
<option value="100">100 แถว</option>
```

Change the JavaScript default in `js/04-reports.js` to:

```javascript
let currentPage = 1;
let pageSize = 20;
```

Keep `changePageSize()` unchanged.

- [ ] **Step 4: Add the scoped hover styling**

Add directly after the existing `.ax-table` row hover declaration in `theme-aqua.css`:

```css
#app #pageList .ax-table td { transition: background-color 120ms ease; }
#app #pageList .ax-table tbody tr:hover td { background: #dcefed !important; }
#app #pageList .ax-table tbody tr:hover td:first-child { box-shadow: inset 4px 0 0 var(--accent); }
```

- [ ] **Step 5: Run focused tests and syntax checks to verify GREEN**

Run:

```powershell
python -B -m unittest tests.test_instrument_list_ui -v
node --check js/04-reports.js
git diff --check
```

Expected: 3 tests PASS; Node and diff checks exit 0.

- [ ] **Step 6: Commit Task 1**

```powershell
git add tests/test_instrument_list_ui.py index.html js/04-reports.js theme-aqua.css
git commit -m "feat: simplify instrument list scanning"
```

---

### Task 2: Regression and Visual Verification

**Files:**
- Modify only if verification exposes a feature defect: `tests/test_instrument_list_ui.py`, `index.html`, `js/04-reports.js`, `theme-aqua.css`
- Test: `tests/test_instrument_list_ui.py`

**Interfaces:**
- Consumes: pagination and hover implementation from Task 1
- Produces: verification evidence that pagination, hover, row actions and unrelated tables remain correct

- [ ] **Step 1: Run the complete automated checks**

Run:

```powershell
python -B -m unittest discover -s tests -p 'test_*.py' -v
node --check js/04-reports.js
pwsh -File tools/verify-app-load.ps1
git diff --check
```

Expected: all tests PASS, syntax exits 0, and the verifier reports `SUMMARY CLEAN`.

- [ ] **Step 2: Verify the List page visually**

Open `index.html`, enter the app, and navigate to “บัญชีรายการ”. Verify:

- the first page displays at most 20 instrument rows
- the select displays 20 by default and offers only 20/50/100
- selecting 50 or 100 resets to page 1 and updates the displayed range
- zebra stripes remain visible without hover
- hovering any row applies `#dcefed` across the full row and a 4px Teal left marker
- clicking a row still opens the original instrument detail
- the “น่าสนใจ” / “บัญชีรายการ” view switch remains functional
- an unrelated table retains its previous hover appearance

- [ ] **Step 3: Commit verification corrections only if required**

If a defect requires a correction:

```powershell
git add tests/test_instrument_list_ui.py index.html js/04-reports.js theme-aqua.css
git commit -m "fix: polish instrument list pagination and hover"
```

If no correction is required, do not create an empty commit.

- [ ] **Step 4: Confirm final repository state**

Run:

```powershell
git status --short --untracked-files=all
git log -5 --oneline
```

Expected: no unexpected or unstaged files and the Task 1 commit is present.
