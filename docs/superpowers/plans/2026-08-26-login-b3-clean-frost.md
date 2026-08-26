# Login B3 Clean Frost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current login presentation with the approved B3 Clean Frost design while preserving the current credential flow and offline behavior.

**Architecture:** Keep the login page inside the existing single-page `index.html` shell, replace the current login-only style block and markup, and add one focused password-visibility helper to `js/01-core.js`. Lock the approved structure with a browser-readable regression test and add the already-existing local hero asset to the service-worker precache.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, existing browser-based HTML tests, service worker cache.

## Global Constraints

- Preserve the existing `loginUsername`, `loginPassword`, and `loginBtn` IDs and the existing `doLogin()` flow.
- Use only local assets: `assets/calibration-lab-hero.png` and `assets/ilc-logo-full.png`.
- Add no external fonts, icon packages, API calls, storage changes, or authentication services.
- Keep the authenticated application shell and post-login pages unchanged.
- Support desktop, tablet, and widths down to 320 pixels without horizontal scrolling.
- The password-visibility control may change only the input `type`; it must preserve the entered value.
- Preserve the existing invalid-credential message and Enter-key submission behavior.

## File Map

- Create `tests/login-b3-ui.test.html`: static regression contract for markup, CSS hooks, login integration, and offline assets.
- Modify `index.html:844-849`: replace the legacy `#calibrationLoginRefresh` login rules with the approved B3 Clean Frost rules while retaining splash/loading rules.
- Modify `index.html:2701-2722`: replace the login-only markup and preserve existing integration IDs.
- Modify `theme-aqua.css:377-380`: remove the navy gradient override that currently defeats the approved local hero background.
- Modify `js/01-core.js:25-58`: add the password-visibility helper beside `doLogin()` without changing `doLogin()`.
- Modify `sw.js:1-15`: bump the cache version and precache `assets/calibration-lab-hero.png`.
- Modify `tests/reference-home.test.html`: update the existing service-worker assertions so the login/splash hero is treated as an intentional cached asset.

---

### Task 1: Lock and implement the approved B3 login structure

**Files:**
- Create: `tests/login-b3-ui.test.html`
- Modify: `index.html:844-849`
- Modify: `index.html:2701-2722`
- Modify: `theme-aqua.css:377-380`

**Interfaces:**
- Consumes: existing `#loginPage`, `#loginError`, `#loginUsername`, `#loginPassword`, `#loginBtn`, and `doLogin()` integration.
- Produces: `.cal-login-stage`, `.cal-login-brand`, `.cal-login-card`, `.cal-ilc-mark`, and responsive login markup used by later tasks and visual checks.

- [ ] **Step 1: Write the failing login design test**

Create `tests/login-b3-ui.test.html` with this complete contract:

```html
<!DOCTYPE html><html><head><meta charset="utf-8"><title>login B3 ui test</title></head><body>
<pre id="out"></pre>
<script>
const results = [];
function t(name, fn) { try { fn(); results.push('PASS ' + name); } catch (e) { results.push('FAIL ' + name + ' — ' + e.message); } }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected true'); }
function has(hay, needle, label) { if (hay.indexOf(needle) === -1) throw new Error('ไม่พบ ' + (label || '') + ' ' + JSON.stringify(needle)); }
function text(url) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open('GET', url + '?test=' + Date.now());
    x.onload = () => res(x.responseText); x.onerror = () => rej(new Error('อ่านไม่ได้ ' + url)); x.send();
  });
}
(async () => {
  let INDEX, CORE, CSS, SW;
  try {
    [INDEX, CORE, CSS, SW] = await Promise.all([
      text('../index.html'), text('../js/01-core.js'), text('../theme-aqua.css'), text('../sw.js')
    ]);
  } catch (e) {
    document.getElementById('out').textContent = 'FAIL โหลดไฟล์ต้นทางไม่ได้ — ' + e.message;
    document.title = 'FAIL'; return;
  }
  t('โครงสร้าง B3 Clean Frost ครบ', () => {
    ['class="cal-login-stage"','class="cal-login-brand"','class="cal-login-card"',
     'class="cal-login-status"','class="cal-ilc-mark"','class="cal-support"']
      .forEach(token => has(INDEX, token, 'login markup'));
    has(INDEX, 'Calibration<span>Management System</span>', 'system title');
    has(INDEX, 'Precision you can trust.', 'tagline');
  });
  t('ใช้ asset ภายในเครื่องและตรา ILC ที่อนุมัติ', () => {
    has(INDEX, 'src="assets/ilc-logo-full.png"', 'ILC logo');
    has(INDEX, 'assets/calibration-lab-hero.png', 'hero');
    has(INDEX, 'data-login-ilc-crop', 'ILC crop hook');
    ok(/\.cal-ilc-mark img\s*\{[^}]*left:\s*6px[^}]*top:\s*5px/.test(INDEX), 'ตำแหน่ง ILC ต้องเป็น 6px / 5px');
  });
  t('integration Login เดิมยังครบ', () => {
    ['id="loginError"','id="loginUsername"','id="loginPassword"','id="loginBtn"',
     "if(event.key==='Enter') doLogin()",'onclick="doLogin()"']
      .forEach(token => has(INDEX, token, 'login integration'));
    has(CORE, 'async function doLogin()', 'doLogin');
  });
  t('responsive และ touch target ครบ', () => {
    ok(/@media\(max-width:820px\)/.test(INDEX), 'ต้องมี mobile breakpoint 820px');
    ok(/\.cal-login-input\s*\{[^}]*min-height:\s*50px/.test(INDEX), 'input 50px');
    ok(/\.cal-submit\s*\{[^}]*min-height:\s*50px/.test(INDEX), 'button 50px');
    ok(/\.cal-login-stage\s*\{[^}]*overflow:\s*hidden/.test(INDEX), 'stage ต้องกัน overflow');
  });
  t('theme ภายนอกไม่ทับ Hero ใหม่', () => {
    ok(!/#loginPage\s*\{[^}]*background:\s*linear-gradient\(145deg,var\(--navy-1\)/.test(CSS), 'theme-aqua ยังทับพื้นหลัง login');
  });
  t('offline cache มี Hero ของ Login', () => {
    has(SW, "'./assets/calibration-lab-hero.png'", 'login hero cache');
    ok(/const CACHE_NAME = 'calibration-app-v\d+';/.test(SW), 'cache version');
  });
  document.getElementById('out').textContent = results.join('\n');
  document.title = results.some(r => r.startsWith('FAIL')) ? 'FAIL' : 'ALL PASS';
})();
</script></body></html>
```

- [ ] **Step 2: Run the new test and confirm the expected failures**

Run a local server from the repository root:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 49447
```

Open `http://localhost:49447/tests/login-b3-ui.test.html`.

Expected: document title `FAIL`, with failures for B3 markup, ILC crop, responsive hooks, theme override, and login hero cache.

- [ ] **Step 3: Replace the login-only markup with the approved structure**

Replace the contents of `#loginPage` with this structure. Keep the exact IDs and event hooks:

```html
<div id="loginPage">
  <section class="cal-login-stage" aria-label="ระบบบริหารจัดการงานสอบเทียบ">
    <div class="cal-login-topline">
      <span class="cal-company-logo"><img src="assets/ilc-logo-full.png" alt="International Laboratories Corp., Ltd."></span>
      <span class="cal-secure"><i aria-hidden="true"></i> SECURE CALIBRATION PORTAL</span>
    </div>
    <div class="cal-login-brand">
      <p class="cal-brand-eyebrow">ILC DIGITAL LABORATORY</p>
      <h1>Calibration<span>Management System</span></h1>
      <div class="cal-brand-rule" aria-hidden="true"></div>
      <p class="cal-brand-tagline">Precision you can trust.</p>
      <p class="cal-brand-thai">ระบบบริหารจัดการงานสอบเทียบที่แม่นยำ เป็นระบบ และตรวจสอบย้อนหลังได้</p>
    </div>
    <div class="cal-login-card">
      <div class="cal-login-status"><span><i aria-hidden="true"></i> ระบบพร้อมใช้งาน</span><b>ILC · INTERNAL</b></div>
      <div class="cal-login-heading">
        <span class="cal-ilc-mark" data-login-ilc-crop aria-hidden="true"><img src="assets/ilc-logo-full.png" alt=""></span>
        <div><h2>เข้าสู่ระบบ</h2><p>Calibration Management Portal</p></div>
      </div>
      <div class="alert alert-error" id="loginError">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</div>
      <div class="cal-field"><label for="loginUsername">ชื่อผู้ใช้</label><div class="cal-control"><span class="cal-input-icon" aria-hidden="true">U</span><input class="cal-login-input" type="text" id="loginUsername" placeholder="รหัสพนักงานหรือชื่อผู้ใช้" autocomplete="username"></div></div>
      <div class="cal-field"><label for="loginPassword">รหัสผ่าน</label><div class="cal-control cal-control--password"><span class="cal-input-icon" aria-hidden="true">•</span><input class="cal-login-input" type="password" id="loginPassword" placeholder="กรอกรหัสผ่าน" autocomplete="current-password" onkeydown="if(event.key==='Enter') doLogin()"><button type="button" class="cal-password-toggle" aria-label="แสดงรหัสผ่าน" aria-pressed="false" onclick="toggleLoginPassword(this)">◉</button></div></div>
      <button class="cal-submit" id="loginBtn" onclick="doLogin()"><span>เข้าสู่ระบบ</span><span class="cal-submit-arrow" aria-hidden="true">→</span></button>
      <div class="cal-support"><span aria-hidden="true">?</span><p>พบปัญหาในการเข้าสู่ระบบ<br><b>ติดต่อผู้ดูแลระบบ 7401, 7402</b></p></div>
      <div class="cal-login-meta"><span>AUTHORIZED EMPLOYEE ACCESS</span><span>v2.0</span></div>
    </div>
  </section>
</div>
```

- [ ] **Step 4: Replace legacy login rules with B3 Clean Frost CSS**

Inside `#calibrationLoginRefresh`, retain the existing loading and splash rules, then replace the old login selectors with the following approved rule set:

```css
#loginPage{min-height:100vh;display:grid!important;place-items:center;padding:16px;overflow:hidden;background:#eaf2f5;font-family:'Bai Jamjuree','IBM Plex Sans Thai',sans-serif;color:#102f43}
.cal-login-stage{position:relative;isolation:isolate;overflow:hidden;width:min(1180px,100%);height:min(604px,calc(100vh - 32px));min-height:520px;border-radius:24px;background:url("assets/calibration-lab-hero.png") center/cover no-repeat;box-shadow:0 28px 70px rgba(9,48,68,.21)}
.cal-login-stage::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(248,253,254,.98) 0%,rgba(246,252,253,.90) 36%,rgba(245,252,253,.34) 59%,rgba(241,250,251,.06) 74%)}
.cal-login-topline{position:absolute;left:32px;right:32px;top:26px;display:flex;align-items:center;justify-content:space-between;gap:18px}.cal-company-logo{display:inline-flex;padding:9px 13px;border-radius:12px;background:rgba(255,255,255,.95);box-shadow:0 10px 24px rgba(4,35,53,.12)}.cal-company-logo img{display:block;width:218px;height:auto}.cal-secure{display:flex;align-items:center;gap:7px;color:#315e70;font-size:10px;font-weight:800;letter-spacing:.04em}.cal-secure i{width:8px;height:8px;border-radius:50%;background:#20b78b;box-shadow:0 0 0 5px rgba(32,183,139,.12)}
.cal-login-brand{position:absolute;left:42px;bottom:44px;width:48%;color:#12364c}.cal-brand-eyebrow{margin:0 0 10px;color:#008f85;font-size:11px;font-weight:900;letter-spacing:.15em}.cal-login-brand h1{margin:0;max-width:570px;font-size:clamp(36px,4.05vw,54px);line-height:1.02;letter-spacing:-.038em}.cal-login-brand h1 span{display:block;color:#087e78;font-size:.78em;margin-top:3px}.cal-brand-rule{width:68px;height:4px;margin:18px 0 15px;border-radius:4px;background:linear-gradient(90deg,#00988d,#51d4c5)}.cal-brand-tagline{margin:0;color:#315c6f;font-size:19px;font-weight:750}.cal-brand-thai{margin:9px 0 0;max-width:470px;color:#547280;font-size:13px;line-height:1.55}
.cal-login-card{position:absolute;right:32px;top:26px;bottom:26px;width:398px;padding:24px 27px 20px;border:1px solid rgba(255,255,255,.98);border-radius:24px;background:rgba(255,255,255,.965);box-shadow:0 24px 64px rgba(12,58,78,.19);backdrop-filter:blur(18px);display:flex;flex-direction:column}.cal-login-card::before{content:"";position:absolute;top:0;left:58px;right:58px;height:3px;background:linear-gradient(90deg,#00978d,#4ed4c4)}
.cal-login-status{display:flex;align-items:center;justify-content:space-between;color:#6f8793;font-size:10px}.cal-login-status span{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border-radius:999px;background:#eaf8f5;color:#117f76;font-weight:800}.cal-login-status i{width:7px;height:7px;border-radius:50%;background:#20b78b;box-shadow:0 0 0 3px rgba(32,183,139,.13)}.cal-login-status b{font-weight:500;letter-spacing:.04em}
.cal-login-heading{display:flex;align-items:center;gap:13px;margin:22px 0 19px}.cal-ilc-mark{position:relative;width:52px;height:48px;flex:0 0 52px;overflow:hidden;border-radius:14px;background:linear-gradient(145deg,#eef9f7,#fff);box-shadow:inset 0 0 0 1px #c6e9e4,0 8px 18px rgba(8,143,133,.10)}.cal-ilc-mark img{position:absolute;left:6px;top:5px;width:210px;height:auto;max-width:none}.cal-login-heading h2{margin:0;font-size:27px;letter-spacing:-.025em}.cal-login-heading p{margin:3px 0 0;color:#6b818d;font-size:11px}
.cal-field{display:grid;gap:6px;margin-bottom:13px}.cal-field label{color:#2c4e60;font-size:12px;font-weight:850}.cal-control{position:relative;display:flex;align-items:center;min-height:50px;padding:0 42px 0 46px;border:1.5px solid #d1e1e6;border-radius:12px;background:#fff;box-shadow:0 5px 14px rgba(22,68,88,.035)}.cal-control:focus-within{border-color:#21ada3;box-shadow:0 0 0 4px rgba(33,173,163,.10)}.cal-input-icon{position:absolute;left:13px;width:23px;height:23px;display:grid;place-items:center;border-radius:7px;background:#e9f7f5;color:#078e84;font-size:12px;font-weight:900}.cal-login-input{width:100%;min-height:50px;border:0!important;outline:0!important;background:transparent!important;padding:0!important;color:#17384a!important}.cal-password-toggle{position:absolute;right:9px;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#68818e;cursor:pointer}
.cal-login-card .alert-error{display:none;margin:0 0 13px;padding:9px 11px;border-radius:10px;background:#fdecea;color:#bf4e37;border:1px solid #f5c6c4;font-size:12px}.cal-submit{width:100%;min-height:50px;margin-top:6px;display:flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:12px;background:linear-gradient(135deg,#008e83,#1bb9ad);color:#fff;box-shadow:0 13px 27px rgba(0,142,131,.24);font-size:13px;font-weight:900;cursor:pointer}.cal-submit-arrow{width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.16)}
.cal-support{margin-top:15px;padding:10px 11px;display:flex;align-items:center;gap:9px;border-radius:11px;background:#f1f8f8;color:#607985;font-size:10px}.cal-support>span{width:26px;height:26px;display:grid;place-items:center;border-radius:8px;background:#fff;color:#078e84}.cal-support p{margin:0}.cal-support b{color:#087f77}.cal-login-meta{display:flex;justify-content:space-between;margin-top:auto;padding-top:11px;color:#8aa0aa;font-size:9px;letter-spacing:.04em}
@media(max-width:820px){#loginPage{padding:10px;place-items:start center}.cal-login-stage{height:690px;min-height:650px}.cal-login-topline{left:18px;right:18px}.cal-secure,.cal-login-brand{display:none}.cal-company-logo img{width:180px}.cal-login-card{left:15px;right:15px;top:96px;bottom:15px;width:auto}}
@media(max-width:420px){.cal-login-card{padding:20px 18px 17px}.cal-login-heading h2{font-size:24px}.cal-company-logo img{width:160px}}
```

Delete the `#loginPage` navy-gradient override in `theme-aqua.css` so the inline B3 hero rule is authoritative.

- [ ] **Step 5: Run the login design test**

Refresh `http://localhost:49447/tests/login-b3-ui.test.html`.

Expected at this stage: B3 markup, local assets, integration IDs, responsive hooks, and theme checks pass; only the offline cache check remains failing until Task 3.

- [ ] **Step 6: Commit the approved layout**

```bash
git add index.html theme-aqua.css tests/login-b3-ui.test.html
git commit -m "feat: redesign login with B3 clean frost"
```

---

### Task 2: Add the accessible password-visibility control

**Files:**
- Modify: `tests/login-b3-ui.test.html`
- Modify: `js/01-core.js:25-58`

**Interfaces:**
- Consumes: `#loginPassword` from Task 1 and the button passed by `onclick="toggleLoginPassword(this)"`.
- Produces: `toggleLoginPassword(button: HTMLButtonElement): void`.

- [ ] **Step 1: Add a failing behavioral contract to the test**

Insert this test before the final result rendering in `tests/login-b3-ui.test.html`:

```javascript
t('ปุ่มแสดงรหัสผ่านเปลี่ยนเฉพาะ type และ aria', () => {
  has(CORE, 'function toggleLoginPassword(button)', 'toggle helper');
  has(CORE, "input.type = reveal ? 'text' : 'password'", 'type toggle');
  has(CORE, "button.setAttribute('aria-pressed', String(reveal))", 'aria pressed');
  has(CORE, "button.setAttribute('aria-label', reveal ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน')", 'aria label');
  ok(CORE.indexOf("input.value =") === -1, 'toggle ห้ามแก้ค่ารหัสผ่าน');
});
```

- [ ] **Step 2: Run the test and confirm the helper check fails**

Refresh `http://localhost:49447/tests/login-b3-ui.test.html`.

Expected: `FAIL ปุ่มแสดงรหัสผ่านเปลี่ยนเฉพาะ type และ aria — ไม่พบ toggle helper`.

- [ ] **Step 3: Add the minimal helper immediately before `doLogin()`**

Add this exact function to `js/01-core.js`:

```javascript
function toggleLoginPassword(button) {
  const input = document.getElementById('loginPassword');
  if (!input || !button) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(reveal));
  button.setAttribute('aria-label', reveal ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
}
```

Do not alter `doLogin()`.

- [ ] **Step 4: Run the test and JavaScript syntax check**

Refresh `http://localhost:49447/tests/login-b3-ui.test.html`.

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\01-core.js
```

Expected: password helper test passes and Node exits with code 0.

- [ ] **Step 5: Manually verify the interaction**

On the login page, enter `sample-secret`, click the visibility control twice, and verify:

- first click: type is `text`, value remains `sample-secret`, `aria-pressed="true"`;
- second click: type is `password`, value remains `sample-secret`, `aria-pressed="false"`.

- [ ] **Step 6: Commit the focused interaction**

```bash
git add js/01-core.js tests/login-b3-ui.test.html
git commit -m "feat: add accessible login password visibility"
```

---

### Task 3: Make the approved login hero available offline

**Files:**
- Modify: `sw.js:1-15`
- Test: `tests/login-b3-ui.test.html`
- Modify: `tests/reference-home.test.html`

**Interfaces:**
- Consumes: local asset `./assets/calibration-lab-hero.png` referenced by the splash and login stage.
- Produces: cache namespace `calibration-app-v145` containing the login hero.

- [ ] **Step 1: Confirm the existing offline assertion fails**

Refresh `http://localhost:49447/tests/login-b3-ui.test.html` before changing `sw.js`.

Expected: `FAIL offline cache มี Hero ของ Login`.

- [ ] **Step 2: Bump the cache and add the hero**

Change the beginning of `sw.js` to:

```javascript
const CACHE_NAME = 'calibration-app-v145';
const IMPORT_TEMPLATE_SELECTION_SCRIPT = './js/11-import-template-selection.js';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './theme-aqua.css',
  './assets/ilc-logo-full.png',
  './assets/ilc-logo-symbol.png',
  './assets/nac-thailand.png',
  './assets/calibration-lab-hero.png',
```

Keep the remainder of `APP_SHELL` unchanged.

- [ ] **Step 3: Update the existing Home service-worker assertions**

In `tests/reference-home.test.html`, replace the old assertion that forbids `calibration-lab-hero.png` and the fixed v144 check with:

```javascript
t('Home Hero และ Login Hero อยู่ใน APP_SHELL v145 ครบ', () => {
  has(SW, './assets/home-hero-calibration-lab-wide.webp', 'desktop home hero');
  has(SW, './assets/home-hero-calibration-lab-v2.webp', 'home hero');
  has(SW, './assets/calibration-lab-hero.png', 'login and splash hero');
  ok(SW.indexOf('./assets/hero-lab.jpg') === -1, 'hero-lab.jpg ไม่ควรอยู่ใน APP_SHELL');
  has(SW, "const CACHE_NAME = 'calibration-app-v145';", 'cache bump');
});
```

This change removes only the obsolete expectation that the login hero is an unused fallback; the file is now a required offline asset.

- [ ] **Step 4: Run the complete login and Home tests plus syntax check**

Refresh `http://localhost:49447/tests/login-b3-ui.test.html`.

Refresh `http://localhost:49447/tests/reference-home.test.html`.

Run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
git diff --check
```

Expected: both test titles are `ALL PASS`; both commands exit with code 0.

- [ ] **Step 5: Commit offline support**

```bash
git add sw.js tests/login-b3-ui.test.html tests/reference-home.test.html
git commit -m "fix: precache B3 login hero"
```

---

### Task 4: Visual and regression verification before push

**Files:**
- Verify: `index.html`
- Verify: `theme-aqua.css`
- Verify: `js/01-core.js`
- Verify: `sw.js`
- Verify: `tests/login-b3-ui.test.html`

**Interfaces:**
- Consumes: the complete implementation from Tasks 1-3.
- Produces: verified login redesign ready for push to `origin/main`.

- [ ] **Step 1: Run all browser-readable HTML tests**

With the local server running, open each `tests/*.test.html` page and confirm its document title is `ALL PASS`.

Expected: every test page ends in `ALL PASS`; no regression page reports `FAIL`.

- [ ] **Step 2: Run static verification**

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\01-core.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
git diff --check
git status --short
```

Expected: both syntax checks and `git diff --check` exit 0; status contains only intentional plan/implementation files before their commits.

- [ ] **Step 3: Verify desktop layout**

At 1280 × 720 and 1920 × 1080, confirm:

- the full ILC logo is readable at upper-left;
- `Calibration Management System` is the primary left title;
- `Precision you can trust.` is visibly smaller;
- the measuring instruments remain visible;
- the login card fits without clipping;
- the cropped ILC mark sits 6 pixels from the left and 5 pixels from the top of its frame;
- no horizontal scrollbar appears.

- [ ] **Step 4: Verify narrow layout**

At 768 and 360 pixels wide, confirm:

- the large left title block and secure label are hidden;
- the company logo remains visible;
- the login card fills the available width;
- every field and action remains at least 44 pixels high;
- no label, support text, or footer metadata overlaps or clips.

- [ ] **Step 5: Verify existing login behavior without changing data**

Confirm Enter in `#loginPassword` calls `doLogin()`, the empty-form guard remains, `#loginError` remains available for invalid credentials, and the existing `app_login` RPC payload is unchanged.

- [ ] **Step 6: Review the final branch and push**

```bash
git log --oneline --decorate -6
git status --short
git push origin main
```

Expected: working tree is clean before push, and the push reports `main -> main`.
