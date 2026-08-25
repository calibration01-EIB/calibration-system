# Home Hero Panoramic Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-specific 1920×320 Hero image that shows the complete calibration instrument group without increasing the approved Hero height.

**Architecture:** Use HTML `<picture>` art direction: desktop widths receive a new 6:1 WebP while tablet/mobile keep the approved 1921×819 fallback. Generate a source composition whose complete instrument group fits inside a central crop-safe band, then deterministically crop and encode the final asset with Pillow. Keep all text in HTML and update the Service Worker application shell atomically.

**Tech Stack:** Static HTML/CSS, browser-hosted HTML tests, built-in ImageGen, Pillow, Service Worker Cache API, in-app browser responsive QA.

## Global Constraints

- Desktop source filename is `assets/home-hero-calibration-lab-wide.webp`.
- Desktop source dimensions are exactly 1920×320 and filesize is at most 256000 bytes.
- Desktop source applies from 1024 px and wider.
- Tablet/mobile fallback remains `assets/home-hero-calibration-lab-v2.webp` below 1024 px.
- Hero heights remain 260/220/180 px at desktop/tablet/mobile breakpoints.
- Keep Welcome, `Calibration System`, and Thai supporting copy as HTML.
- Keep the left 43–46% calm and bright; keep every instrument edge inside the central 75% of image height.
- No people, embedded text, logos, certificates, brand marks, or watermarks.
- Do not change Home cards, authentication, database, permissions, exports, list filters, or pagination.
- Add both Hero files to `APP_SHELL` and bump cache from `calibration-app-v143` to `calibration-app-v144`.

## File Structure

- Create `assets/home-hero-calibration-lab-wide.webp`: desktop art-directed Hero.
- Modify `index.html`: add the desktop `<source>` and preserve the fallback `<img>`.
- Modify `theme-aqua.css`: size the `<picture>` wrapper and use desktop/tablet/mobile focal positions.
- Modify `tests/reference-home.test.html`: cover art direction, dimensions, filesize, CSS, and offline cache.
- Modify `sw.js`: add the desktop asset and bump the cache version.

---

### Task 1: Desktop Hero Art Direction and Offline Integration

**Files:**
- Create: `assets/home-hero-calibration-lab-wide.webp`
- Modify: `tests/reference-home.test.html:66-180`
- Modify: `index.html:2833-2839`
- Modify: `theme-aqua.css:226-270`
- Modify: `sw.js:1-15`

**Interfaces:**
- Consumes: `assets/home-hero-calibration-lab-v2.webp` as the approved visual reference and tablet/mobile fallback.
- Produces: `<source media="(min-width: 1024px)" srcset="assets/home-hero-calibration-lab-wide.webp">` and a 1920×320 WebP in `APP_SHELL` v144.

- [ ] **Step 1: Write failing art-direction and asset tests**

In `tests/reference-home.test.html`, extend the Home component assertion:

```javascript
t('Home ใช้ picture art direction สำหรับ Hero จอกว้าง', () => {
  has(INDEX, '<picture>');
  has(INDEX, '<source media="(min-width: 1024px)" srcset="assets/home-hero-calibration-lab-wide.webp">');
  has(INDEX, '<img src="assets/home-hero-calibration-lab-v2.webp" alt="">');
  ok(/\.ax-hero-media picture\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/.test(CSS),
    'picture ต้องเต็มกรอบ Hero');
  ok(/@media \(max-width: 1023px\)[\s\S]*?\.ax-hero-media img\s*\{[^}]*object-position:\s*center 58%/.test(CSS),
    'fallback tablet ใช้ focal position เดิม');
});
```

Add an async wide-asset check after the existing fallback Hero check:

```javascript
try {
  const wideBytes = await bytes('../assets/home-hero-calibration-lab-wide.webp');
  const wideMeta = await imageMeta('../assets/home-hero-calibration-lab-wide.webp');
  eq([wideMeta.w, wideMeta.h], [1920, 320], 'ขนาด Hero จอกว้าง');
  ok(wideBytes.length <= 250 * 1024, 'Hero จอกว้างเกิน 250KB: ' + wideBytes.length);
  results.push('PASS Hero จอกว้าง 1920×320 และไม่เกิน 250KB');
} catch (e) {
  results.push('FAIL Hero จอกว้าง 1920×320 และไม่เกิน 250KB — ' + e.message);
}
```

Update the Service Worker assertion:

```javascript
t('Hero ทั้งสองสัดส่วนอยู่ใน APP_SHELL v144', () => {
  has(SW, './assets/home-hero-calibration-lab-wide.webp', 'desktop hero');
  has(SW, './assets/home-hero-calibration-lab-v2.webp', 'tablet/mobile hero');
  has(SW, "const CACHE_NAME = 'calibration-app-v144';", 'cache bump');
});
```

- [ ] **Step 2: Run the Home test and verify RED**

Start a clean local server:

```powershell
$heroPython = 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$heroServer = Start-Process -FilePath $heroPython -ArgumentList '-m','http.server','49451','--bind','127.0.0.1' -WorkingDirectory 'C:\Users\8014\Desktop\calibration-system-main' -WindowStyle Hidden -PassThru
```

Open `http://127.0.0.1:49451/tests/reference-home.test.html?red=wide`.

Expected: document title `FAIL`; failures report missing `<picture>`, missing wide WebP, and missing v144 cache entry.

- [ ] **Step 3: Generate the crop-safe panoramic source**

Use the `imagegen` skill in built-in edit mode. First inspect `assets/home-hero-calibration-lab-v2.webp` with `view_image`, then call ImageGen with that file as the edit target/reference and this exact prompt:

```text
Use case: precise-object-edit
Asset type: responsive desktop website Hero source, prepared for a later 1920×320 center crop
Input images: Image 1 is the approved calibration laboratory Hero and visual reference
Primary request: recompose the same modern calibration laboratory so the complete analytical balance, stainless-steel calibration weights, pressure gauge, and digital micrometer are all fully visible and scaled down into a shallow horizontal group on the middle-right
Scene/backdrop: preserve the clean bright realistic laboratory and tabletop
Style/medium: premium photorealistic commercial laboratory photography; preserve the approved white, pale-blue, navy, and restrained teal look
Composition/framing: keep the left 45% calm and bright for HTML copy; place every instrument edge inside the central 35% of the source image height with generous top and bottom safety; keep the instrument group between 48% and 96% of image width; the central horizontal strip must remain visually complete when cropped to a 6:1 banner
Constraints: show the entire balance including top and base, every weight, the entire gauge, and the entire micrometer; scientifically plausible proportions; no people; no text; no numbers that need to be readable; no logos; no certificates; no watermark
Avoid: cropped instruments, tall composition, oversized balance, floating objects, duplicate instruments, malformed gauge, dark left gradient
```

Inspect the generated source. The acceptance condition before cropping is that all instrument edges fit between 32.5% and 67.5% of source height. If the first output violates the band, issue this single targeted follow-up edit:

```text
Keep the laboratory, palette, left negative space, and all instrument identities unchanged. Scale the complete instrument group down uniformly by 25% and center it vertically so every edge fits between 32.5% and 67.5% of the image height. Do not crop or remove any instrument. No text, logos, people, or watermark.
```

- [ ] **Step 4: Crop and encode the final 1920×320 WebP**

Immediately after approving the ImageGen result, resolve the newest generated PNG from this task's image-output directory and run:

```powershell
$heroGeneratedSource = Get-ChildItem -LiteralPath 'C:\Users\8014\.codex\generated_images\01a01d98-12eb-7190-bac9-cc67f9fb4124' -Recurse -File -Filter '*.png' | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $heroGeneratedSource) { throw 'ImageGen PNG output was not found' }
Write-Output $heroGeneratedSource
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -c "from PIL import Image; src=r'$heroGeneratedSource'; dst=r'C:\Users\8014\Desktop\calibration-system-main\assets\home-hero-calibration-lab-wide.webp'; im=Image.open(src).convert('RGB'); target_ratio=6.0; crop_h=round(im.width/target_ratio); top=max(0,(im.height-crop_h)//2); im=im.crop((0,top,im.width,top+crop_h)).resize((1920,320),Image.Resampling.LANCZOS); im.save(dst,'WEBP',quality=86,method=6)"
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -c "from PIL import Image; import os; p=r'assets\home-hero-calibration-lab-wide.webp'; im=Image.open(p); print(im.size, os.path.getsize(p), im.format); assert im.size==(1920,320); assert os.path.getsize(p)<=250*1024; im.verify()"
```

Expected: `(1920, 320)`, `WEBP`, and filesize at most 256000 bytes.

- [ ] **Step 5: Add `<picture>` art direction**

Replace the current `.ax-hero-media` markup in `index.html` with:

```html
<div class="ax-hero-media">
  <picture>
    <source media="(min-width: 1024px)" srcset="assets/home-hero-calibration-lab-wide.webp">
    <img src="assets/home-hero-calibration-lab-v2.webp" alt="">
  </picture>
</div>
```

- [ ] **Step 6: Size the picture wrapper and preserve fallback focal positions**

Update the Hero media rules in `theme-aqua.css`:

```css
.ax-hero-media { position: absolute; inset: 0; }
.ax-hero-media picture { display: block; width: 100%; height: 100%; }
.ax-hero-media img {
  width: 100%; height: 100%; object-fit: cover; object-position: center; display: block;
}
```

Add the tablet focal position inside the existing `@media (max-width: 1023px)` block:

```css
.ax-hero-media img { object-position: center 58%; }
```

Keep the existing mobile rule unchanged:

```css
.ax-hero-media img { object-position: 63% 58%; }
```

- [ ] **Step 7: Update the offline cache**

Set `sw.js` to:

```javascript
const CACHE_NAME = 'calibration-app-v144';
```

Keep the fallback entry and add the desktop asset immediately before it:

```javascript
'./assets/home-hero-calibration-lab-wide.webp',
'./assets/home-hero-calibration-lab-v2.webp',
```

- [ ] **Step 8: Run focused tests and commit Task 1**

Refresh `http://127.0.0.1:49451/tests/reference-home.test.html?green=wide`.

Expected: document title `ALL PASS`, including the new art-direction, 1920×320, 250KB, and v144 assertions.

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
git diff --check
git add -- index.html theme-aqua.css tests/reference-home.test.html sw.js assets/home-hero-calibration-lab-wide.webp
git commit -m "fix: fit desktop home hero artwork"
```

Expected: syntax exits 0, `git diff --check` is silent, and the commit succeeds.

---

### Task 2: Panoramic Visual and Regression QA

**Files:**
- Verify: `assets/home-hero-calibration-lab-wide.webp`
- Verify: `index.html`
- Verify: `theme-aqua.css`
- Verify: `sw.js`
- Verify: `tests/*.test.html`

**Interfaces:**
- Consumes: the `<picture>` Hero completed in Task 1.
- Produces: verified desktop/tablet/mobile rendering with no changes to application data or behavior.

- [ ] **Step 1: Run every browser regression page**

Open each URL on port 49451 and require a pass title with zero `FAIL` result rows:

```text
/tests/instrument-list-ui.test.html
/tests/reference-home.test.html
/tests/instrument-edit-tabs.test.html
/tests/frm-cross-month.test.html
/tests/plan-export.test.html
/tests/repairs.test.html
/tests/weight-clean-slate.test.html
```

Expected: all seven pages pass; current total is at least 185 assertions plus the new wide-Hero assertions.

- [ ] **Step 2: Verify responsive source selection and crop**

Use the login-safe QA harness with production `theme-aqua.css`, production `<picture>` markup, and production assets. Check 1900×900, 1440×900, 900×800, and 390×844.

At 1900 and 1440 widths, evaluate and require:

```javascript
({
  heroHeight: document.querySelector('.ax-hero--split').getBoundingClientRect().height,
  source: document.querySelector('.ax-hero-media img').currentSrc,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
})
```

Expected: `heroHeight === 260`, `source` ends with `home-hero-calibration-lab-wide.webp`, and `overflow === false`. Visually require the complete balance top/base, weights, gauge, and micrometer.

At 900 and 390 widths, use the same evaluation.

Expected: heights 220 and 180, `source` ends with `home-hero-calibration-lab-v2.webp`, no page overflow, and existing tablet/mobile composition remains intact.

- [ ] **Step 3: Run final repository verification**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\26-list-ui.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -c "from PIL import Image; import os; p=r'assets\home-hero-calibration-lab-wide.webp'; im=Image.open(p); assert im.size==(1920,320); assert os.path.getsize(p)<=250*1024; im.verify(); print('wide-hero-ok',os.path.getsize(p))"
git diff --check
git status --short --untracked-files=all
```

Expected: both JavaScript checks exit 0, Hero verification prints `wide-hero-ok`, `git diff --check` is silent, and the working tree is clean.

- [ ] **Step 4: Stop the local server and reset browser viewport**

```powershell
Stop-Process -Id $heroServer.Id
```

Reset the in-app browser viewport capability to its default size and close only the temporary QA tabs created for this task.
