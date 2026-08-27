# Login Mobile Compact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ลดขนาดองค์ประกอบหน้า Login บน Mobile ประมาณ 20% ให้การ์ดสูงราว 380–400px โดยยังอ่านง่าย กดง่าย และไม่กระทบ Desktop

**Architecture:** ปรับเฉพาะ CSS ภายใน breakpoint `max-width:820px` และ `max-width:420px` ใน `index.html` โดยไม่เปลี่ยน markup หรือ JavaScript ของ Login ใช้ regression test แบบ source contract ใน `tests/login-b3-ui.test.html` และตรวจ layout จริงผ่าน browser หลาย viewport

**Tech Stack:** Static HTML/CSS, vanilla JavaScript, service worker, browser-based HTML regression tests

## Global Constraints

- ใช้กับ viewport กว้างไม่เกิน `820px`; Desktop ตั้งแต่ `821px` ขึ้นไปต้องไม่เปลี่ยน
- ไม่ใช้ `transform: scale()` กับการ์ดหรือฟอร์ม
- Username, Password และปุ่มเข้าสู่ระบบสูง `46px`
- Password toggle ต้องมีพื้นที่กดอย่างน้อย `44px`
- โลโก้กว้างไม่เกิน `224px` บน Mobile และ `190px` ที่ไม่เกิน `420px`
- การ์ด Mobile ต้องสูงประมาณ `380–400px` และไม่มี horizontal overflow ที่ `320px`
- ไม่แก้ API, `doLogin()`, Enter key, password toggle behavior หรือข้อความช่วยเหลือ

---

### Task 1: Mobile compact styling and source contracts

**Files:**
- Modify: `index.html:864-865`
- Modify: `tests/login-b3-ui.test.html`
- Test: `tests/login-b3-ui.test.html`

**Interfaces:**
- Consumes: existing `.cal-login-*`, `.cal-field`, `.cal-control`, `.cal-submit`, and `.cal-support` classes plus CSS text loaded from `../index.html` into `INDEX`
- Produces: Mobile-only size overrides and regression contract named `Mobile Compact ใช้ขนาดจริงและคง touch target`; no new classes or JavaScript interfaces

- [ ] **Step 1: Write the failing test**

Add this test after the existing `stage เกือบเต็ม viewport และ mobile ไม่ล้น` test:

```html
  t('Mobile Compact ใช้ขนาดจริงและคง touch target', () => {
    ok(/@media\(max-width:820px\)\{[\s\S]*?\.cal-login-card\{[^}]*transform:\s*none[^}]*width:\s*min\(calc\(100%\s*-\s*44px\),390px\)[^}]*padding:\s*26px 22px/.test(INDEX), 'mobile card uses real width and padding without scale');
    ok(/@media\(max-width:820px\)\{[\s\S]*?\.cal-login-logo img\{[^}]*width:\s*min\(224px,82%\)/.test(INDEX), 'mobile logo 224px');
    ok(/@media\(max-width:820px\)\{[\s\S]*?\.cal-control\{[^}]*height:\s*46px[^}]*min-height:\s*46px/.test(INDEX), 'mobile control visible height 46px');
    ok(/@media\(max-width:820px\)\{[\s\S]*?\.cal-login-input\{[^}]*min-height:\s*44px/.test(INDEX), 'mobile input fits inside bordered control');
    ok(/@media\(max-width:820px\)\{[\s\S]*?\.cal-password-toggle\{[^}]*width:\s*44px[^}]*height:\s*44px/.test(INDEX), 'password toggle 44px');
    ok(/@media\(max-width:820px\)\{[\s\S]*?\.cal-submit\{[^}]*min-height:\s*46px/.test(INDEX), 'mobile submit 46px');
    ok(/@media\(max-width:420px\)\{[\s\S]*?\.cal-login-card\{[^}]*width:\s*calc\(100%\s*-\s*48px\)[^}]*padding:\s*24px 16px/.test(INDEX), 'small mobile card gutters and padding');
    ok(/@media\(max-width:420px\)\{[\s\S]*?\.cal-login-logo img\{[^}]*width:\s*190px/.test(INDEX), 'small mobile logo 190px');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run a local server:

```powershell
python -m http.server 49447 --bind 127.0.0.1
```

Open `http://127.0.0.1:49447/tests/login-b3-ui.test.html` in the in-app browser.

Expected: page title `FAIL`; output includes `FAIL Mobile Compact ใช้ขนาดจริงและคง touch target` because the current Mobile controls are still `56px` and the current small-Mobile logo is `240px`.

- [ ] **Step 3: Replace the `max-width:820px` block with the compact values**

Use this CSS, keeping it inside `<style id="calibrationLoginRefresh">`:

```css
@media(max-width:820px){
  #loginPage{place-items:start center}
  .cal-login-stage{width:calc(100vw - 16px);min-height:max(calc(100svh - 16px),560px);border-radius:20px}
  .cal-login-stage::before{background:linear-gradient(135deg,rgba(6,34,52,.78),rgba(230,247,248,.18))}
  .cal-login-brand{display:none}
  .cal-login-card{position:relative;right:auto;top:auto;transform:none;width:min(calc(100% - 44px),390px);height:auto;min-height:0;margin:clamp(20px,4vh,36px) auto 20px;padding:26px 22px}
  .cal-login-logo{margin-bottom:24px}
  .cal-login-logo img{width:min(224px,82%)}
  .cal-field{gap:7px;margin-bottom:16px}
  .cal-field label{font-size:12px}
  .cal-control{height:46px;min-height:46px;padding:0 14px}
  .cal-control--password{padding-right:52px}
  .cal-login-input{min-height:44px;font-size:13px}
  .cal-password-toggle{right:4px;width:44px;height:44px}
  .cal-submit{min-height:46px;font-size:13px}
  .cal-support{margin-top:14px;padding:10px 13px;font-size:10px}
  .cal-support b{font-size:11px}
}
```

- [ ] **Step 4: Replace the `max-width:420px` block with the small-Mobile refinements**

```css
@media(max-width:420px){
  .cal-login-stage{min-height:max(calc(100svh - 16px),520px);border-radius:18px}
  .cal-login-card{width:calc(100% - 48px);margin-top:18px;padding:24px 16px}
  .cal-login-logo{margin-bottom:22px}
  .cal-login-logo img{width:190px}
  .cal-field{margin-bottom:14px}
  .cal-support{padding:10px 12px}
}
```

- [ ] **Step 5: Run the focused test to verify it passes**

Reload `http://127.0.0.1:49447/tests/login-b3-ui.test.html` with cache disabled or a timestamp query.

Expected: page title `ALL PASS`; no line beginning with `FAIL`.

- [ ] **Step 6: Check real layout measurements**

Open `http://127.0.0.1:49447/index.html` and inspect these viewports: `320×800`, `360×800`, `390×844`, `430×932`, and `768×900`.

For each viewport verify:

```text
document.documentElement.scrollWidth - innerWidth === 0
46px <= control height <= 47px
46px <= submit height <= 47px
password toggle width and height === 44px
card height is between 370px and 405px
card left >= 8px and card right <= viewport width - 8px
```

At `1280×720`, verify the Desktop card remains approximately `397×560px`, the Editorial Brand is visible, and no horizontal overflow appears.

- [ ] **Step 7: Commit the regression contract and production styling**

```powershell
git add -- index.html tests/login-b3-ui.test.html
git commit -m "style: compact mobile login layout"
```

Expected: commit contains the passing regression contract and Mobile-only CSS change.

---

### Task 2: Refresh offline cache and run the full regression suite

**Files:**
- Modify: `sw.js:1`
- Modify: `tests/login-b3-ui.test.html`
- Modify: `tests/reference-home.test.html`
- Test: all HTML test pages in `tests/`

**Interfaces:**
- Consumes: existing `CACHE_NAME` service-worker namespace
- Produces: cache namespace `calibration-app-v147`

- [ ] **Step 1: Make cache-version tests fail on the new namespace**

Change both cache assertions from `calibration-app-v146` to `calibration-app-v147`:

```javascript
has(SW, "const CACHE_NAME = 'calibration-app-v147';", 'cache v147');
```

Apply it in:

- `tests/login-b3-ui.test.html`
- `tests/reference-home.test.html`

- [ ] **Step 2: Run both cache tests and verify RED**

Open:

```text
http://127.0.0.1:49447/tests/login-b3-ui.test.html
http://127.0.0.1:49447/tests/reference-home.test.html
```

Expected: both titles are `FAIL` because `sw.js` still declares `calibration-app-v146`.

- [ ] **Step 3: Bump the production cache namespace**

Change the first line of `sw.js` to:

```javascript
const CACHE_NAME = 'calibration-app-v147';
```

- [ ] **Step 4: Run the complete browser test suite**

Open each page with a fresh timestamp query:

```text
tests/weight-clean-slate.test.html
tests/repairs.test.html
tests/reference-home.test.html
tests/plan-export.test.html
tests/login-b3-ui.test.html
tests/instrument-list-ui.test.html
tests/instrument-edit-tabs.test.html
tests/frm-cross-month.test.html
```

Expected: all eight page titles are `ALL PASS` or `ALLPASS`, and no rendered output contains a line beginning with `FAIL`.

- [ ] **Step 5: Run static verification**

```powershell
node --check js/01-core.js
node --check js/10-router.js
node --check sw.js
git diff --check
git status --short
```

Expected: all syntax commands exit `0`, `git diff --check` prints nothing, and status lists only the three intended files.

- [ ] **Step 6: Commit cache and regression updates**

```powershell
git add -- sw.js tests/login-b3-ui.test.html tests/reference-home.test.html
git commit -m "fix: refresh cache for compact mobile login"
```

Expected: commit succeeds and the working tree is clean.
