# HOME Five-Column Soft 3D Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับหน้า HOME ให้แสดงการ์ด 5/3/1 คอลัมน์ตามขนาดหน้าจอ และเปลี่ยนภาพประกอบเป็นชุด Soft 3D ใหม่ครบ 10 เมนูโดยคงการทำงานเดิม

**Architecture:** คง `AX_TILES` และกลไก routing/badge ปัจจุบันเป็นแหล่งข้อมูลเดียว เปลี่ยนเฉพาะการอ้างอิงภาพของเมนูที่สิบและ CSS layout/card sizing ภาพ raster พื้นหลังโปร่งใสจะถูกเก็บใน `assets/tiles/` และ precache โดย service worker พร้อม SVG fallback เดิม

**Tech Stack:** HTML/CSS, vanilla JavaScript, PNG RGBA assets, service worker Cache API, Python `unittest`, PowerShell verification scripts

## Global Constraints

- แอปต้องทำงานออฟไลน์และไม่มี runtime network dependency
- ต้องมี 10 การ์ดตามลำดับและ route เดิม
- Banner และ Header ต้องไม่เปลี่ยน
- Desktop/Tablet/Mobile ต้องได้ผลลัพธ์ 5/3/1 คอลัมน์
- ภาพทั้ง 10 ไฟล์ต้องเป็นชุด Soft 3D พื้นหลังโปร่งใส ไม่มีข้อความฝัง และมีสัดส่วนเดียวกัน
- ป้ายแจ้งเตือน, hover, keyboard focus และ SVG fallback ต้องทำงานต่อไป

---

### Task 1: Lock the Card Asset and Responsive Contracts

**Files:**
- Modify: `tests/test_reference_home.py`
- Test: `tests/test_reference_home.py`

**Interfaces:**
- Consumes: `AX_TILES` records from `js/24-home.js`, `.ax-tiles` declarations from `theme-aqua.css`, `APP_SHELL` and `CACHE_NAME` from `sw.js`
- Produces: structural test contract for filenames `01_dashboard.png` through `10_weight_calibration.png`, PNG RGBA dimensions, 5/3/1 grid, route preservation, and offline cache version `calibration-app-v135`

- [ ] **Step 1: Replace the old responsive/cache assertions and add the failing asset contract**

Add this helper below the existing file constants:

```python
TILE_ASSETS = [
    "01_dashboard.png",
    "02_instrument_list.png",
    "03_calibration_tracking.png",
    "04_cert_number.png",
    "05_cert_reference.png",
    "06_calibration_planning.png",
    "07_daily_scale_record.png",
    "08_repair.png",
    "09_offsite_equipment.png",
    "10_weight_calibration.png",
]


def read_png_ihdr(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise AssertionError(f"Not a PNG: {path}")
    return (
        int.from_bytes(data[16:20], "big"),
        int.from_bytes(data[20:24], "big"),
        data[25],
    )
```

Replace `test_responsive_grid_contract` and `test_reference_banner_is_available_offline`, then add the asset test:

```python
def test_responsive_grid_contract(self):
    self.assertRegex(CSS, r"\.ax-tiles\s*\{[^}]*repeat\(5")
    self.assertRegex(
        CSS,
        r"@media \(max-width: 1100px\)[\s\S]*?\.ax-tiles\s*\{[^}]*repeat\(3",
    )
    self.assertRegex(
        CSS,
        r"@media \(max-width: 680px\)[\s\S]*?\.ax-tiles\s*\{[^}]*grid-template-columns:\s*1fr",
    )

def test_soft_3d_tile_assets_are_complete_and_consistent(self):
    metadata = []
    for filename in TILE_ASSETS:
        path = ROOT / "assets" / "tiles" / filename
        self.assertTrue(path.is_file(), filename)
        metadata.append(read_png_ihdr(path))
    self.assertEqual(len(set(metadata)), 1, metadata)
    width, height, color_type = metadata[0]
    self.assertGreaterEqual(width, 512)
    self.assertEqual(width, height)
    self.assertEqual(color_type, 6, "Images must be RGBA PNGs")
    self.assertIn("img:'10_weight_calibration'", HOME_JS)

def test_home_assets_are_available_offline(self):
    self.assertIn("./assets/home-calibration-banner.png", SERVICE_WORKER)
    for filename in TILE_ASSETS:
        self.assertIn(f"./assets/tiles/{filename}", SERVICE_WORKER)
    self.assertIn("calibration-app-v135", SERVICE_WORKER)
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
python -B -m unittest tests.test_reference_home.ReferenceHomeTests.test_responsive_grid_contract tests.test_reference_home.ReferenceHomeTests.test_soft_3d_tile_assets_are_complete_and_consistent tests.test_reference_home.ReferenceHomeTests.test_home_assets_are_available_offline -v
```

Expected: FAIL because CSS still uses 4/2/1 columns, `10_weight_calibration.png` is absent, and cache version is `v134`.

- [ ] **Step 3: Commit the test contract**

```powershell
git add tests/test_reference_home.py
git commit -m "test: define soft 3d home card contract"
```

---

### Task 2: Create the Ten Soft 3D Menu Illustrations

**Files:**
- Replace: `assets/tiles/01_dashboard.png`
- Replace: `assets/tiles/02_instrument_list.png`
- Replace: `assets/tiles/03_calibration_tracking.png`
- Replace: `assets/tiles/04_cert_number.png`
- Replace: `assets/tiles/05_cert_reference.png`
- Replace: `assets/tiles/06_calibration_planning.png`
- Replace: `assets/tiles/07_daily_scale_record.png`
- Replace: `assets/tiles/08_repair.png`
- Replace: `assets/tiles/09_offsite_equipment.png`
- Create: `assets/tiles/10_weight_calibration.png`
- Test: `tests/test_reference_home.py`

**Interfaces:**
- Consumes: semantic meanings and palette from the approved design spec
- Produces: ten `1024×1024` RGBA PNG files with transparent backgrounds and consistent camera, lighting, shadow, padding, and Soft 3D style

- [ ] **Step 1: Read the image-generation skill and generate ten separate transparent assets**

Use the image generation tool with this art direction:

```text
Create ten separate isolated Soft 3D icons for an offline calibration-management web app, using one built-in image-generation call per icon. Every call must repeat the same shared art direction: transparent background; no text, letters, numbers, logos, UI labels, borders, or watermarks; consistent isometric front-three-quarter camera; rounded forms; soft studio lighting from upper left; subtle ambient shadow; generous equal padding; Aqua/navy base palette with controlled green, purple, and orange category accents; same visual volume; recognizable at 120 px. Subjects in filename order are: (1) analytics dashboard with bar chart and gauge, (2) precision measuring instrument with checklist, (3) measuring instrument with status check mark, (4) certificate document with serial-number tokens but no readable characters, (5) reference certificate folder, (6) calendar with measuring instrument, (7) bench scale with logbook, (8) wrench with measuring instrument, (9) instrument case moving through an exit arrow, (10) standard calibration weight with balance/check symbol.
```

Expected: ten coherent source images with no embedded text that clearly match the menu semantics.

- [ ] **Step 2: Normalize the ten generated images into project assets**

Copy each selected built-in output into the workspace and export as `1024×1024` RGBA PNG with transparent corners. Save in the exact filenames listed in this task. Do not resize by stretching; preserve equal padding and center each object on the canvas.

- [ ] **Step 3: Run the asset metadata test**

Run:

```powershell
python -B -m unittest tests.test_reference_home.ReferenceHomeTests.test_soft_3d_tile_assets_are_complete_and_consistent -v
```

Expected: FAIL only on `img:'10_weight_calibration'` because the JavaScript mapping changes in Task 3; all ten file, dimension, square, and RGBA assertions pass.

- [ ] **Step 4: Visually inspect the ten files**

Open the ten assets as a contact sheet and verify: no text, no clipped object, transparent background, equal object scale, consistent light direction, and distinct semantics. Regenerate only nonconforming cells before continuing.

- [ ] **Step 5: Commit the image set**

```powershell
git add assets/tiles/01_dashboard.png assets/tiles/02_instrument_list.png assets/tiles/03_calibration_tracking.png assets/tiles/04_cert_number.png assets/tiles/05_cert_reference.png assets/tiles/06_calibration_planning.png assets/tiles/07_daily_scale_record.png assets/tiles/08_repair.png assets/tiles/09_offsite_equipment.png assets/tiles/10_weight_calibration.png
git commit -m "feat: add soft 3d home card artwork"
```

---

### Task 3: Wire the Tenth Image and Implement the 5/3/1 Card Layout

**Files:**
- Modify: `js/24-home.js:21-32`
- Modify: `theme-aqua.css:272-296`
- Modify: `theme-aqua.css:1226-1245`
- Test: `tests/test_reference_home.py`

**Interfaces:**
- Consumes: the ten exact asset basenames created in Task 2
- Produces: `AX_TILES` with an image for every card and responsive `.ax-tiles` declarations producing 5/3/1 columns

- [ ] **Step 1: Wire the tenth image in `AX_TILES`**

Replace the `weightjobs` record with:

```javascript
{ k:'weightjobs',img:'10_weight_calibration', page:'weightjobs',t:'สอบเทียบตุ้มน้ำหนัก', d:'บันทึกและออกผลสอบเทียบตุ้มน้ำหนักมาตรฐาน (ABBA)' }
```

Keep the `AX_ART.weightjobs` entry so `onerror` still has a fallback.

- [ ] **Step 2: Implement the compact five-column card system**

Change the base declarations to:

```css
.ax-tiles { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 20px; }

.ax-tile {
  position: relative; text-align: left; font-family: inherit;
  display: flex; flex-direction: column; gap: 16px; min-width: 0;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-tile);
  padding: 22px 20px 18px; cursor: pointer; box-shadow: var(--shadow);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.ax-tile-art { height: 108px; display: flex; align-items: center; justify-content: center; }
.ax-tile-art img { width: 108px; height: 108px; display: block; object-fit: contain; }
.ax-tile-art svg { width: 108px; height: 108px; display: block; }
.ax-tile h3 { margin: 0; font-family: var(--ff-num); font-weight: 700; font-size: 19px; line-height: 1.3; color: var(--text); }
.ax-tile p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--text2); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.ax-tile-txt { display: flex; flex-direction: column; gap: 7px; }
.ax-tile-go { display: flex; justify-content: flex-end; margin-top: auto; padding-top: 6px; }
```

Change the tablet breakpoint to:

```css
@media (max-width: 1100px) { .ax-tiles { grid-template-columns: repeat(3,minmax(0,1fr)); } }
```

Keep the existing `@media (max-width: 680px)` one-column declaration, and set its image rule to:

```css
.ax-tile-art, .ax-tile-art img, .ax-tile-art svg { width: 76px; height: 76px; }
```

- [ ] **Step 3: Run focused tests and verify layout/image mapping GREEN**

Run:

```powershell
python -B -m unittest tests.test_reference_home.ReferenceHomeTests.test_tile_order_and_destinations_match_current_system tests.test_reference_home.ReferenceHomeTests.test_existing_dynamic_integrations_remain tests.test_reference_home.ReferenceHomeTests.test_responsive_grid_contract tests.test_reference_home.ReferenceHomeTests.test_soft_3d_tile_assets_are_complete_and_consistent -v
node --check js/24-home.js
```

Expected: 4 tests PASS and Node syntax check exits with code 0.

- [ ] **Step 4: Commit the card mapping and layout**

```powershell
git add js/24-home.js theme-aqua.css
git commit -m "feat: show five soft 3d cards per home row"
```

---

### Task 4: Precache the Complete Artwork Set

**Files:**
- Modify: `sw.js:1-25`
- Test: `tests/test_reference_home.py`

**Interfaces:**
- Consumes: ten asset paths from Task 2
- Produces: cache `calibration-app-v135` containing the HOME banner and all ten card images

- [ ] **Step 1: Update the cache version and add the tenth asset**

Change:

```javascript
const CACHE_NAME = 'calibration-app-v135';
```

Add after the ninth tile asset:

```javascript
'./assets/tiles/10_weight_calibration.png',
```

- [ ] **Step 2: Run the offline contract and syntax check**

Run:

```powershell
python -B -m unittest tests.test_reference_home.ReferenceHomeTests.test_home_assets_are_available_offline -v
node --check sw.js
```

Expected: test PASS and Node syntax check exits with code 0.

- [ ] **Step 3: Commit the offline cache update**

```powershell
git add sw.js
git commit -m "feat: precache soft 3d home artwork"
```

---

### Task 5: Full Regression and Visual Verification

**Files:**
- Modify only if verification exposes a defect: `theme-aqua.css`, `js/24-home.js`, `sw.js`, `tests/test_reference_home.py`, or a nonconforming file under `assets/tiles/`
- Test: `tests/test_reference_home.py`

**Interfaces:**
- Consumes: completed HOME feature from Tasks 1–4
- Produces: evidence that the app loads cleanly, preserves behavior, has no overflow, and meets the approved visual design at three viewport classes

- [ ] **Step 1: Run the full automated suite**

Run:

```powershell
python -B -m unittest discover -s tests -p 'test_*.py' -v
node --check js/24-home.js
node --check sw.js
git diff --check
```

Expected: all tests PASS, both syntax checks exit 0, and `git diff --check` prints no errors.

- [ ] **Step 2: Run the application load verifier**

Run:

```powershell
pwsh -File tools/verify-app-load.ps1
```

Expected: verifier reports `CLEAN` with zero load or handler errors.

- [ ] **Step 3: Verify the HOME page visually at three viewport classes**

Serve the project locally and inspect HOME at:

- Desktop `1440×1000`: exactly 5 cards in the first row and 5 in the second
- Tablet `900×1100`: 3 columns with no clipped text or image
- Mobile `390×844`: 1 column and no horizontal overflow

At each viewport verify the banner/header are unchanged, all ten images are sharp and equally scaled, descriptions remain readable, badges do not overlap content, keyboard focus is visible, hover works on desktop, and clicking every card routes to its original destination.

- [ ] **Step 4: Verify the image fallback**

Temporarily block one tile PNG in browser developer tools and reload HOME. Expected: the matching `AX_ART` SVG appears and the other cards remain unchanged. Remove the block before final verification.

- [ ] **Step 5: Commit any verification-only corrections**

If verification required corrections:

```powershell
git add theme-aqua.css js/24-home.js sw.js tests/test_reference_home.py assets/tiles/
git commit -m "fix: polish responsive soft 3d home cards"
```

If no correction was needed, do not create an empty commit.

- [ ] **Step 6: Confirm the final worktree state**

Run:

```powershell
git status --short --untracked-files=all
git log -5 --oneline
```

Expected: no unexpected files or unstaged changes; recent commits correspond to the test contract, artwork, layout, cache, and any verification correction.
