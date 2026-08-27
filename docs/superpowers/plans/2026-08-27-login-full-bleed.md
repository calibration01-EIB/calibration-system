# Login Full-Bleed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the approved B3 Clean Frost login to a true full-browser hero while keeping the login card compact and preserving all login behavior.

**Architecture:** Keep the existing login markup, local hero asset, authentication JavaScript, and card styling. Change only the page/stage/card layout contract in the inline login CSS, lock it with the existing browser regression harness, then bump the offline cache because `index.html` is in `APP_SHELL`.

**Tech Stack:** Static HTML/CSS, vanilla JavaScript, service worker, PowerShell browser-test harness, Chrome headless, Codex in-app browser.

## Global Constraints

- The stage fills `100vw` and at least `100svh`; it has no maximum width, outer radius, or outer shadow.
- Desktop login card width is exactly `398px`, height is exactly `552px`, and right inset is `clamp(24px,3vw,56px)`.
- At `820px` and below, the stage has a minimum height of `690px`, the card keeps `15px` side gutters, and short screens scroll vertically.
- The page must not scroll horizontally at widths down to `320px`.
- Keep `assets/calibration-lab-hero.png`, the existing gradient, all wording, typography, field arrangement, and card visual styling unchanged.
- Preserve `loginUsername`, `loginPassword`, `loginBtn`, `loginError`, `doLogin()`, Enter submission, `app_login`, password toggle, failed-login button arrow, splash, and reduced-motion behavior.
- Username, password, and submit controls remain at least `50px` high.
- The service-worker cache namespace must be exactly `calibration-app-v146`.
- Do not add assets, packages, fonts, services, authentication changes, API changes, or post-login changes.
- Do not push to a remote until the user explicitly requests it.

## File Structure

- `index.html` — owns the existing B3 login markup and its scoped inline layout CSS; only the full-bleed layout selectors change.
- `tests/login-b3-ui.test.html` — owns static and runtime regression contracts for the login screen.
- `tests/reference-home.test.html` — owns the cross-page app-shell contract that pins the current cache namespace.
- `sw.js` — owns `CACHE_NAME` and the unchanged offline `APP_SHELL`.

---

### Task 1: Full-Bleed Layout Contract and CSS

**Files:**
- Modify: `tests/login-b3-ui.test.html:59-68`
- Modify: `index.html:848-860`

**Interfaces:**
- Consumes: Existing `.cal-login-stage`, `.cal-login-card`, `.cal-login-brand`, `.cal-secure`, and `.cal-company-logo` markup.
- Produces: A full-viewport login stage, a fixed-size centered desktop card, and a scroll-safe mobile composition without changing any JavaScript interface.

- [ ] **Step 1: Replace the framed-stage regression with the full-bleed contract**

Replace the test named `stage sizing is viewport-based rather than cyclic grid percentage sizing` in `tests/login-b3-ui.test.html` with:

```javascript
  t('stage เป็น Full-Bleed และการ์ด Desktop ยังคงกะทัดรัด', () => {
    ok(/#loginPage\s*\{[^}]*min-height:\s*100svh[^}]*display:\s*block!important[^}]*padding:\s*0[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/.test(INDEX),
      'login page ต้องเต็ม viewport และเลื่อนเฉพาะแนวตั้ง');
    ok(/\.cal-login-stage\s*\{[^}]*width:\s*100vw[^}]*max-width:\s*none[^}]*height:\s*100svh[^}]*min-height:\s*604px[^}]*border-radius:\s*0[^}]*box-shadow:\s*none/.test(INDEX),
      'desktop stage ต้องเต็มจอ ไม่มีกรอบโค้งและเงานอก');
    ok(!/\.cal-login-stage\s*\{[^}]*max-width:\s*1180px/.test(INDEX),
      'stage ต้องไม่จำกัดความกว้าง 1180px');
    ok(/\.cal-login-card\s*\{[^}]*right:\s*clamp\(24px,3vw,56px\)[^}]*top:\s*50%[^}]*bottom:\s*auto[^}]*width:\s*398px[^}]*height:\s*552px[^}]*transform:\s*translateY\(-50%\)/.test(INDEX),
      'desktop card ต้องกว้าง 398px สูง 552px และอยู่กึ่งกลางแนวตั้ง');
    ok(/@media\(max-width:820px\)\s*\{[\s\S]*?\.cal-login-stage\s*\{[^}]*width:\s*100vw[^}]*height:\s*max\(690px,100svh\)[^}]*min-height:\s*690px/.test(INDEX),
      'mobile stage ต้องเต็มกว้างและสูงอย่างน้อย 690px');
    ok(/@media\(max-width:820px\)\s*\{[\s\S]*?\.cal-login-card\s*\{[^}]*left:\s*15px[^}]*right:\s*15px[^}]*top:\s*96px[^}]*bottom:\s*auto[^}]*width:\s*auto[^}]*height:\s*579px[^}]*transform:\s*none/.test(INDEX),
      'mobile card ต้องใช้ gutter 15px และไม่ใช้ desktop centering');
  });
```

- [ ] **Step 2: Run the browser suite and confirm the new contract is red**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-tests.ps1
```

Expected: `login-b3-ui.test.html` reports `FAIL` for the full-bleed stage/card contract; the other seven test pages remain `PASS`.

- [ ] **Step 3: Replace only the page, stage, desktop-card, and mobile layout rules**

In `index.html`, replace the existing `#loginPage`, `.cal-login-stage`, `.cal-login-card`, and `@media(max-width:820px)` rules with the following exact rules. Leave all intervening component styles and the `@media(max-width:420px)` rule unchanged.

```css
#loginPage{min-height:100svh;display:block!important;padding:0;overflow-x:hidden;overflow-y:auto;background:#eaf2f5;font-family:'Bai Jamjuree','IBM Plex Sans Thai',sans-serif;color:#102f43}
.cal-login-stage{position:relative;isolation:isolate;overflow:hidden;width:100vw;max-width:none;height:100svh;min-height:604px;border-radius:0;background:url("assets/calibration-lab-hero.png") center/cover no-repeat;box-shadow:none}
.cal-login-card{position:absolute;right:clamp(24px,3vw,56px);top:50%;bottom:auto;width:398px;height:552px;transform:translateY(-50%);padding:24px 27px 20px;border:1px solid rgba(255,255,255,.98);border-radius:24px;background:rgba(255,255,255,.965);box-shadow:0 24px 64px rgba(12,58,78,.19);backdrop-filter:blur(18px);display:flex;flex-direction:column}
@media(max-width:820px){#loginPage{padding:0}.cal-login-stage{width:100vw;height:max(690px,100svh);min-height:690px}.cal-login-topline{left:18px;right:18px}.cal-secure,.cal-login-brand{display:none}.cal-company-logo img{width:180px}.cal-login-card{left:15px;right:15px;top:96px;bottom:auto;width:auto;height:579px;transform:none}}
```

Keep `.cal-login-card::before` attached immediately after the updated desktop card rule, and keep `.cal-login-stage::before` unchanged so the approved readability gradient remains.

- [ ] **Step 4: Run the focused and full browser tests**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-tests.ps1
```

Expected: all eight test pages report `PASS`, `login-b3-ui.test.html` has no full-bleed failure, and the summary is `8 test pages, 0 with problems`.

- [ ] **Step 5: Review the exact CSS diff and commit the layout**

Run:

```powershell
git diff --check
git diff -- index.html tests/login-b3-ui.test.html
git add -- index.html tests/login-b3-ui.test.html
git commit -m "feat: make login full bleed"
```

Expected: `git diff --check` is silent; the diff contains only the regression contract and the four scoped layout rules; commit succeeds.

---

### Task 2: Offline Cache v146 Contract

**Files:**
- Modify: `tests/login-b3-ui.test.html:73-76`
- Modify: `tests/reference-home.test.html:218-224`
- Modify: `sw.js:1`

**Interfaces:**
- Consumes: Existing `CACHE_NAME` string and unchanged `APP_SHELL` entries.
- Produces: Exact cache namespace `calibration-app-v146` while retaining both Home hero assets and the Login hero asset offline.

- [ ] **Step 1: Pin v146 in both cache regression pages**

Replace the offline cache test in `tests/login-b3-ui.test.html` with:

```javascript
  t('offline cache มี Login Hero และใช้ namespace v146', () => {
    has(SW, "'./assets/calibration-lab-hero.png'", 'login hero cache');
    has(SW, "const CACHE_NAME = 'calibration-app-v146';", 'cache v146');
  });
```

Replace the `Home Hero และ Login Hero อยู่ใน APP_SHELL v145 ครบ` test in `tests/reference-home.test.html` with:

```javascript
  t('Home Hero และ Login Hero อยู่ใน APP_SHELL v146 ครบ', () => {
    has(SW, './assets/home-hero-calibration-lab-wide.webp', 'desktop home hero');
    has(SW, './assets/home-hero-calibration-lab-v2.webp', 'home hero');
    has(SW, './assets/calibration-lab-hero.png', 'login and splash hero');
    ok(SW.indexOf('./assets/hero-lab.jpg') === -1, 'hero-lab.jpg ไม่ควรอยู่ใน APP_SHELL');
    has(SW, "const CACHE_NAME = 'calibration-app-v146';", 'cache bump');
  });
```

- [ ] **Step 2: Run the suite and confirm the cache contract is red**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-tests.ps1
```

Expected: only `login-b3-ui.test.html` and `reference-home.test.html` report the missing `calibration-app-v146` contract; the remaining six pages report `PASS`.

- [ ] **Step 3: Bump the service-worker namespace without changing APP_SHELL**

Change the first line of `sw.js` to:

```javascript
const CACHE_NAME = 'calibration-app-v146';
```

Do not reorder, add, or remove any `APP_SHELL` entry.

- [ ] **Step 4: Run browser and syntax regression checks**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\syntax-check-js.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-app-load.ps1
```

Expected: eight browser pages pass with zero problems; every JavaScript file including `sw.js` reports `OK`; app-load verification ends with `SUMMARY CLEAN`.

- [ ] **Step 5: Verify and commit the offline release**

Run:

```powershell
git diff --check
git diff -- sw.js tests/login-b3-ui.test.html tests/reference-home.test.html
git add -- sw.js tests/login-b3-ui.test.html tests/reference-home.test.html
git commit -m "chore: bump full-bleed login cache"
```

Expected: the source diff changes only `CACHE_NAME` from `v145` to `v146`, and the two tests now pin `v146`; commit succeeds.

---

### Task 3: Responsive Visual and Interaction Acceptance

**Files:**
- Verify: `index.html`
- Verify: `js/01-core.js`
- Verify: `sw.js`

**Interfaces:**
- Consumes: The full-bleed CSS from Task 1 and cache namespace from Task 2.
- Produces: Visual and behavioral evidence that the approved design works from 320px mobile through 1920px desktop without regressions.

- [ ] **Step 1: Start a local static server for browser QA**

Run from the repository root:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 8765 --bind 127.0.0.1
```

Expected: the server listens at `http://127.0.0.1:8765/`. Keep this terminal session running only during QA.

- [ ] **Step 2: Inspect the five required viewports in the in-app browser**

Use the `browser:control-in-app-browser` skill to open `http://127.0.0.1:8765/` and capture the login screen at:

```text
1920 × 1080
1280 × 720
768 × 900
360 × 800
320 × 800
```

At `1920 × 1080` and `1280 × 720`, verify all of the following:

```text
- The hero reaches all four viewport edges with no gray border.
- The outer stage has square corners and no outer shadow.
- The full company logo is visible at upper-left.
- The brand block is visible at lower-left.
- The login card is 398 × 552 CSS pixels, centered vertically, and separated from the right edge by 24–56 CSS pixels.
```

At `768 × 900`, `360 × 800`, and `320 × 800`, verify all of the following:

```text
- The large brand block and secure label are hidden.
- The full company logo remains visible.
- The card stays 15 CSS pixels from both sides.
- No input, support strip, footer, or button is clipped.
- `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- Vertical scrolling appears only when the viewport is shorter than the 690px minimum composition.
```

- [ ] **Step 3: Verify login interactions and motion preferences**

In the in-app browser:

```text
1. Type a username and password, toggle password visibility twice, and confirm the value is unchanged.
2. Submit invalid credentials and confirm the error appears, the button re-enables, and its arrow remains visible.
3. Press Enter from the password field and confirm the same login path runs.
4. Reload with normal motion and confirm the splash clears without blocking the form.
5. Emulate reduced motion, reload, and confirm the splash is hidden immediately and the form remains interactive.
```

Expected: all five checks pass with no browser-console error caused by the login page.

- [ ] **Step 4: Run the final automated gate and inspect repository state**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\run-tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\syntax-check-js.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-app-load.ps1
git diff --check
git status --short
git log -3 --oneline
```

Expected: all automated checks pass, `git diff --check` is silent, the working tree has no uncommitted implementation changes, and the two implementation commits appear above the design/plan documentation commits. Stop the local server after collecting this evidence. Do not push.
