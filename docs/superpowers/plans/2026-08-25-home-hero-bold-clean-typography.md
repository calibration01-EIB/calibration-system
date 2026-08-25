# Home Hero Bold Clean Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Bold Clean text hierarchy and teal accent line to the existing responsive Home Hero without changing its images or compact heights.

**Architecture:** Keep the existing Hero HTML and `<picture>` art direction intact, and implement the full treatment in the existing `.ax-hero-copy` CSS rules. Lock the responsive font sizes, accent-line dimensions, copy spacing, and scrim strength with browser-hosted regression assertions before changing production CSS.

**Tech Stack:** Static HTML/CSS, browser-hosted HTML tests, in-app browser responsive QA.

## Global Constraints

- Keep `Welcome`, `Calibration System`, and the Thai supporting copy as HTML.
- Desktop sizes at 1024 px and wider: Welcome 22 px, heading 60 px, supporting copy 18 px.
- Tablet sizes from 768–1023 px: Welcome 18 px, heading 40 px, supporting copy 16 px.
- Mobile sizes at 767 px and narrower: Welcome 15 px, heading 30 px, supporting copy 13 px.
- Accent line sizes: desktop 72×4 px, tablet 58×3 px, mobile 44×3 px.
- Accent spacing above the line: 15 px desktop, 10 px tablet, 7 px mobile.
- Desktop copy width is `min(54%, 700px)`.
- Mobile copy uses 10 px vertical padding, 18 px horizontal padding, a 4 px flex gap, and 1.3 supporting-copy line height.
- Keep Hero heights at 260/220/180 px for desktop/tablet/mobile.
- Keep `assets/home-hero-calibration-lab-wide.webp`, `assets/home-hero-calibration-lab-v2.webp`, `<picture>` markup, and Service Worker cache v144 unchanged.
- Do not add a glass panel, border, shadow, capsule label, animation, or new HTML element.
- Do not change Home cards, authentication, database, permissions, exports, list filters, or pagination.

## File Structure

- Modify `tests/reference-home.test.html`: lock the approved responsive typography, accent line, copy width, mobile spacing, and scrim treatment.
- Modify `theme-aqua.css`: implement the Bold Clean responsive CSS treatment.

---

### Task 1: Bold Clean Responsive Hero Copy

**Files:**
- Modify: `tests/reference-home.test.html:104-145`
- Modify: `theme-aqua.css:230-273`

**Interfaces:**
- Consumes: the existing `.ax-hero-copy`, `.ax-hero-kicker`, `.ax-hero-copy h1`, `.ax-hero-copy p`, and `.ax-hero-scrim` selectors.
- Produces: responsive computed font sizes of 22/60/18 px, 18/40/16 px, and 15/30/13 px plus a paragraph `::after` teal accent line.

- [ ] **Step 1: Write the failing Bold Clean CSS tests**

Add these synchronous assertions after the existing `ข้อความ hero ต้องเป็น HTML จริง` test in `tests/reference-home.test.html`:

```javascript
t('Hero แบบ Bold Clean ใช้ลำดับขนาดตัวอักษรที่อนุมัติ', () => {
  ok(/\.ax-hero-kicker\s*\{[^}]*font-size:\s*22px/.test(CSS), 'desktop Welcome 22px');
  ok(/\.ax-hero-copy h1\s*\{[^}]*font-size:\s*60px/.test(CSS), 'desktop heading 60px');
  ok(/\.ax-hero-copy p\s*\{[^}]*font-size:\s*18px/.test(CSS), 'desktop supporting copy 18px');
  ok(/@media \(max-width: 1023px\)[\s\S]*?\.ax-hero-kicker\s*\{[^}]*font-size:\s*18px/.test(CSS), 'tablet Welcome 18px');
  ok(/@media \(max-width: 1023px\)[\s\S]*?\.ax-hero-copy h1\s*\{[^}]*font-size:\s*40px/.test(CSS), 'tablet heading 40px');
  ok(/@media \(max-width: 1023px\)[\s\S]*?\.ax-hero-copy p\s*\{[^}]*font-size:\s*16px/.test(CSS), 'tablet supporting copy 16px');
  ok(/@media \(max-width: 767px\)[\s\S]*?\.ax-hero-kicker\s*\{[^}]*font-size:\s*15px/.test(CSS), 'mobile Welcome 15px');
  ok(/@media \(max-width: 767px\)[\s\S]*?\.ax-hero-copy h1\s*\{[^}]*font-size:\s*30px/.test(CSS), 'mobile heading 30px');
  ok(/@media \(max-width: 767px\)[\s\S]*?\.ax-hero-copy p\s*\{[^}]*font-size:\s*13px[^}]*line-height:\s*1\.3/.test(CSS), 'mobile supporting copy 13px / 1.3');
});

t('Hero แบบ Bold Clean มีเส้น Teal และระยะ Responsive ที่อนุมัติ', () => {
  ok(/\.ax-hero-copy p::after\s*\{[^}]*content:\s*""[^}]*width:\s*72px[^}]*height:\s*4px[^}]*margin-top:\s*15px/.test(CSS), 'desktop accent 72x4 / 15px');
  ok(/@media \(max-width: 1023px\)[\s\S]*?\.ax-hero-copy p::after\s*\{[^}]*width:\s*58px[^}]*height:\s*3px[^}]*margin-top:\s*10px/.test(CSS), 'tablet accent 58x3 / 10px');
  ok(/@media \(max-width: 767px\)[\s\S]*?\.ax-hero-copy p::after\s*\{[^}]*width:\s*44px[^}]*height:\s*3px[^}]*margin-top:\s*7px/.test(CSS), 'mobile accent 44x3 / 7px');
  ok(/\.ax-hero-copy\s*\{[^}]*width:\s*min\(54%,\s*700px\)/.test(CSS), 'desktop copy width');
  ok(/@media \(max-width: 767px\)[\s\S]*?\.ax-hero-copy\s*\{[^}]*padding:\s*10px 18px[^}]*gap:\s*4px/.test(CSS), 'mobile compact spacing');
  has(CSS, 'rgba(247,250,252,.80) 46%', 'desktop stronger scrim');
});
```

- [ ] **Step 2: Run the Home test and verify RED**

Start a clean local server:

```powershell
$heroTypePython = 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$heroTypeServer = Start-Process -FilePath $heroTypePython -ArgumentList '-m','http.server','49453','--bind','127.0.0.1' -WorkingDirectory 'C:\Users\8014\Desktop\calibration-system-main' -WindowStyle Hidden -PassThru
```

Open `http://127.0.0.1:49453/tests/reference-home.test.html?red=bold-clean`.

Expected: document title `FAIL`; the two new Bold Clean tests fail because the current desktop heading is 48 px, the responsive values are smaller, and the paragraph has no `::after` accent.

- [ ] **Step 3: Implement the approved desktop treatment**

Replace the desktop copy, typography, and scrim rules in `theme-aqua.css` with:

```css
.ax-hero-scrim {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(90deg,
    rgba(247,250,252,.99) 0%, rgba(247,250,252,.98) 34%,
    rgba(247,250,252,.80) 46%, rgba(247,250,252,.25) 64%, transparent 80%);
}
.ax-hero-copy {
  position: relative; z-index: 1; width: min(54%, 700px); pointer-events: none;
  padding: 30px 48px; display: flex; flex-direction: column;
  justify-content: center; gap: 8px;
}
.ax-hero-kicker { font-family: var(--ff-num); font-weight: 700; font-size: 22px; color: var(--accent); }
.ax-hero-copy h1 {
  margin: 0; font-family: var(--ff-num); font-weight: 800;
  font-size: 60px; line-height: 1.05; letter-spacing: -.02em; color: var(--text);
}
.ax-hero-copy p {
  margin: 4px 0 0; font-size: 18px; line-height: 1.45;
  color: var(--text2); max-width: 520px; text-wrap: pretty;
}
.ax-hero-copy p::after {
  content: ""; display: block; width: 72px; height: 4px; margin-top: 15px;
  border-radius: 999px; background: linear-gradient(90deg, #009b90, #38c3bb);
}
```

- [ ] **Step 4: Implement the approved tablet treatment**

Inside the existing `@media (max-width: 1023px)` block, use:

```css
.ax-hero-copy { width: 58%; padding: 24px 30px; }
.ax-hero-kicker { font-size: 18px; }
.ax-hero-copy h1 { font-size: 40px; }
.ax-hero-copy p { font-size: 16px; }
.ax-hero-copy p::after { width: 58px; height: 3px; margin-top: 10px; }
.ax-hero-scrim {
  background: linear-gradient(90deg, rgba(247,250,252,.99) 0%, rgba(247,250,252,.97) 45%, rgba(247,250,252,.40) 72%, transparent 88%);
}
```

- [ ] **Step 5: Implement the approved mobile treatment**

Inside the existing `@media (max-width: 767px)` block, use:

```css
.ax-hero-copy { width: 68%; padding: 10px 18px; gap: 4px; }
.ax-hero-kicker { font-size: 15px; }
.ax-hero-copy h1 { font-size: 30px; line-height: 1; }
.ax-hero-copy p { margin-top: 2px; font-size: 13px; line-height: 1.3; }
.ax-hero-copy p::after { width: 44px; height: 3px; margin-top: 7px; }
.ax-hero-scrim {
  background: linear-gradient(90deg, rgba(247,250,252,.99) 0%, rgba(247,250,252,.98) 55%, rgba(247,250,252,.55) 82%, rgba(247,250,252,.15) 100%);
}
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Refresh `http://127.0.0.1:49453/tests/reference-home.test.html?green=bold-clean`.

Expected: document title `ALL PASS`, including the two Bold Clean tests and all existing Hero image, compact-height, art-direction, and Service Worker assertions.

- [ ] **Step 7: Check the focused diff and commit Task 1**

Run:

```powershell
git diff --check
git diff -- theme-aqua.css tests/reference-home.test.html
git add -- theme-aqua.css tests/reference-home.test.html
git commit -m "feat: strengthen home hero typography"
```

Expected: `git diff --check` is silent, the diff contains only the approved CSS and tests, and the commit succeeds.

---

### Task 2: Responsive Visual and Regression QA

**Files:**
- Verify: `theme-aqua.css`
- Verify: `tests/reference-home.test.html`
- Verify: `tests/*.test.html`

**Interfaces:**
- Consumes: the Bold Clean CSS completed in Task 1.
- Produces: verified responsive copy hierarchy with no Hero overflow or regression elsewhere in the application.

- [ ] **Step 1: Run all browser regression pages**

Open each URL on port 49453 and require zero `FAIL` rows:

```text
/tests/instrument-list-ui.test.html
/tests/reference-home.test.html
/tests/instrument-edit-tabs.test.html
/tests/frm-cross-month.test.html
/tests/plan-export.test.html
/tests/repairs.test.html
/tests/weight-clean-slate.test.html
```

Expected: all seven pages pass; the previous baseline is 187 assertions and the two new test groups increase that total to at least 189.

- [ ] **Step 2: Verify responsive computed styles and overflow**

Use the login-safe Home QA harness with production `theme-aqua.css`, production Hero markup, and production assets. Check 1900×900, 1440×900, 900×800, and 390×844.

At each viewport evaluate:

```javascript
(() => {
  const hero = document.querySelector('.ax-hero--split');
  const kicker = document.querySelector('.ax-hero-kicker');
  const heading = document.querySelector('.ax-hero-copy h1');
  const copy = document.querySelector('.ax-hero-copy p');
  const accent = getComputedStyle(copy, '::after');
  const heroBox = hero.getBoundingClientRect();
  return {
    heroHeight: heroBox.height,
    kickerSize: getComputedStyle(kicker).fontSize,
    headingSize: getComputedStyle(heading).fontSize,
    copySize: getComputedStyle(copy).fontSize,
    accent: [accent.width, accent.height, accent.marginTop],
    accentInsideHero: copy.getBoundingClientRect().bottom <= heroBox.bottom,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
})()
```

Expected results:

| Viewport | Hero | Welcome | Heading | Copy | Accent |
| --- | ---: | ---: | ---: | ---: | --- |
| 1900×900 | 260 px | 22 px | 60 px | 18 px | 72 px / 4 px / 15 px |
| 1440×900 | 260 px | 22 px | 60 px | 18 px | 72 px / 4 px / 15 px |
| 900×800 | 220 px | 18 px | 40 px | 16 px | 58 px / 3 px / 10 px |
| 390×844 | 180 px | 15 px | 30 px | 13 px | 44 px / 3 px / 7 px |

At all sizes require `accentInsideHero === true` and `overflow === false`. Visually require readable text, no collision with the calibration instrument group, no clipped accent line, and the complete desktop instrument group.

- [ ] **Step 3: Run final repository verification**

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\26-list-ui.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -c "from PIL import Image; import os; p=r'assets\home-hero-calibration-lab-wide.webp'; im=Image.open(p); assert im.size==(1920,320); assert os.path.getsize(p)<=250*1024; im.verify(); print('wide-hero-ok',os.path.getsize(p))"
git diff --check
git status --short --untracked-files=all
```

Expected: both JavaScript checks exit 0, the Hero check prints `wide-hero-ok`, `git diff --check` is silent, and the working tree is clean.

- [ ] **Step 4: Stop the local server and reset browser state**

```powershell
Stop-Process -Id $heroTypeServer.Id
```

Reset the temporary responsive viewport override and close only the QA tabs created for this task.
