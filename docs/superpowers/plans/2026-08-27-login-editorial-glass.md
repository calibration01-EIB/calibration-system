# Login Editorial Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved near-full-browser laboratory login with editorial left typography and a frosted ILC form card while preserving all existing authentication behavior.

**Architecture:** Keep the login inside the existing static `index.html` application shell. Replace only the login markup and login-specific CSS, leave `js/01-core.js` authentication functions unchanged, update the browser-readable regression contract, and bump the service-worker cache so offline clients receive the new HTML.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, existing browser-readable HTML tests, service worker cache.

## Global Constraints

- Use only `assets/calibration-lab-hero.png` and `assets/ilc-logo-full.png`; add no external assets, packages, fonts, APIs, or services.
- Preserve `loginUsername`, `loginPassword`, `loginBtn`, `loginError`, `doLogin()`, `toggleLoginPassword()`, Enter-key submission, `app_login`, session storage, and post-login reload behavior.
- The left desktop block contains only `WELCOME`, `CALIBRATION`, and `MANAGEMENT SYSTEM`.
- The card contains only the full ILC logo, Username/Password controls, conditional login error, submit button, and support contact.
- Remove the B3 status row, cropped mark, login heading/subtitle, submit arrow, footer metadata, and promotional tagline.
- Keep username, password, password toggle, and submit touch targets at least 50 pixels high.
- Support 1920 × 1080, 1280 × 720, 768 × 900, 360 × 800, and 320 × 800 with no horizontal overflow or clipped controls.
- Keep splash and `prefers-reduced-motion` behavior unchanged and nonblocking.
- Bump the service-worker namespace from `calibration-app-v145` to `calibration-app-v146`.

## File Map

- Modify `tests/login-b3-ui.test.html`: replace B3 visual contracts with editorial-glass structure, removals, responsive rules, cache version, and simple submit-label runtime assertions.
- Modify `index.html:844-860`: replace only the login CSS inside `#calibrationLoginRefresh`; preserve loading, splash, animation, and later application theme rules.
- Modify `index.html:2715-2742`: replace only `#loginPage` markup; preserve all integration IDs and event hooks.
- Modify `sw.js:1`: bump the offline cache namespace to `calibration-app-v146`; keep the existing app shell unchanged.
- Modify `tests/reference-home.test.html:211-217`: update the fixed cache version assertion from v145 to v146.
- Verify `js/01-core.js`: no implementation change; its existing public functions remain the login behavior interface.

---

### Task 1: Lock the approved semantic structure and preserve login behavior

**Files:**
- Modify: `tests/login-b3-ui.test.html:25-41,82-111`
- Modify: `index.html:2715-2742`

**Interfaces:**
- Consumes: `doLogin(): Promise<void>`, `toggleLoginPassword(button: HTMLButtonElement): void`, and `setLoginButtonLabel(button: HTMLButtonElement, text: string): void` from `js/01-core.js`.
- Produces: `.cal-login-stage`, `.cal-login-brand`, `.cal-brand-welcome`, `.cal-brand-calibration`, `.cal-brand-system`, `.cal-login-card`, `.cal-login-logo`, `.cal-field`, `.cal-control`, `.cal-submit`, and `.cal-support` for Task 2 styling.

- [ ] **Step 1: Replace the old B3 structure test with a failing editorial-glass contract**

Replace the first two B3 visual tests with these exact tests:

```javascript
t('โครงสร้าง Editorial Glass ครบ', () => {
  ['class="cal-login-stage"','class="cal-login-brand"','class="cal-login-card"',
   'class="cal-login-logo"','class="cal-support"']
    .forEach(token => has(INDEX, token, 'login markup'));
  has(INDEX, '<span class="cal-brand-welcome">WELCOME</span>', 'welcome line');
  has(INDEX, '<strong class="cal-brand-calibration">CALIBRATION</strong>', 'calibration line');
  has(INDEX, '<span class="cal-brand-system">MANAGEMENT SYSTEM</span>', 'system line');
  has(INDEX, '<label for="loginUsername">Username</label>', 'Username label');
  has(INDEX, '<label for="loginPassword">Password</label>', 'Password label');
});
t('ใช้ asset ภายในเครื่องและตัดองค์ประกอบ B3 ที่ไม่อนุมัติ', () => {
  has(INDEX, 'src="assets/ilc-logo-full.png"', 'full ILC logo');
  has(INDEX, 'assets/calibration-lab-hero.png', 'hero');
  ['cal-login-status','cal-ilc-mark','cal-login-heading','cal-submit-arrow',
   'cal-login-meta','Precision you can trust.','ILC DIGITAL LABORATORY','ILC · INTERNAL']
    .forEach(token => ok(INDEX.indexOf(token) === -1, 'ยังพบองค์ประกอบเก่า ' + token));
});
t('integration Login เดิมยังครบ', () => {
  ['id="loginError"','id="loginUsername"','id="loginPassword"','id="loginBtn"',
   "if(event.key==='Enter') doLogin()",'onclick="doLogin()"',
   'onclick="toggleLoginPassword(this)"']
    .forEach(token => has(INDEX, token, 'login integration'));
  has(CORE, 'async function doLogin()', 'doLogin');
  has(CORE, 'function toggleLoginPassword(button)', 'password toggle');
});
```

- [ ] **Step 2: Update the runtime fixture for the approved arrow-free submit button**

Rename the runtime test to `runtime login keeps editorial submit label after invalid credentials` and replace its fixture/button assertions with:

```javascript
fixture.innerHTML = '<input id="loginUsername" value="tester"><input id="loginPassword" type="password" value="sample-secret"><div id="loginError" style="display:none"></div><button class="cal-submit" id="loginBtn"><span>เข้าสู่ระบบ</span></button><button class="cal-password-toggle" aria-label="แสดงรหัสผ่าน" aria-pressed="false"></button>';
```

After `const button = fixture.querySelector('#loginBtn');`, use these assertions after `await runtime.doLogin()`:

```javascript
ok(fixture.querySelector('#loginError').style.display === 'block', 'invalid login ต้องแสดงข้อความผิดพลาด');
ok(button.disabled === false, 'invalid login ต้องเปิดปุ่มอีกครั้ง');
ok(button.querySelector('span').textContent === 'เข้าสู่ระบบ', 'label ต้องกลับเป็นข้อความเดิม');
ok(button.querySelector('.cal-submit-arrow') === null, 'ปุ่มใหม่ต้องไม่มีลูกศร B3');
ok(calls.length === 1 && calls[0].name === 'app_login', 'ต้องเรียก app_login หนึ่งครั้ง');
ok(calls[0].payload.p_username === 'tester' && /^[a-f0-9]{64}$/.test(calls[0].payload.p_password_hash), 'RPC payload ต้องมี username และ password hash');
```

Keep the existing password-toggle assertions before this block unchanged.

- [ ] **Step 3: Run the test and verify the new structure fails**

Start a local server from the repository root:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 49447
```

Open `http://localhost:49447/tests/login-b3-ui.test.html`.

Expected: document title `FAIL`; failures mention the missing welcome/calibration/system markup, English labels, and still-present B3 elements. Existing authentication runtime assertions continue to pass.

- [ ] **Step 4: Replace only the login markup with the approved structure**

Replace `#loginPage` in `index.html` with:

```html
<div id="loginPage">
  <section class="cal-login-stage" aria-label="ระบบบริหารจัดการงานสอบเทียบ">
    <div class="cal-login-brand" aria-label="Welcome to Calibration Management System">
      <span class="cal-brand-welcome">WELCOME</span>
      <strong class="cal-brand-calibration">CALIBRATION</strong>
      <span class="cal-brand-system">MANAGEMENT SYSTEM</span>
    </div>
    <div class="cal-login-card" aria-label="เข้าสู่ระบบ">
      <div class="cal-login-logo"><img src="assets/ilc-logo-full.png" alt="International Laboratories Corp., Ltd."></div>
      <div class="cal-field"><label for="loginUsername">Username</label><div class="cal-control"><input class="cal-login-input" type="text" id="loginUsername" placeholder="รหัสพนักงานหรือชื่อผู้ใช้" autocomplete="username"></div></div>
      <div class="cal-field"><label for="loginPassword">Password</label><div class="cal-control cal-control--password"><input class="cal-login-input" type="password" id="loginPassword" placeholder="กรอกรหัสผ่าน" autocomplete="current-password" onkeydown="if(event.key==='Enter') doLogin()"><button type="button" class="cal-password-toggle" aria-label="แสดงรหัสผ่าน" aria-pressed="false" onclick="toggleLoginPassword(this)">◉</button></div></div>
      <div class="alert alert-error" id="loginError">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</div>
      <button class="cal-submit" id="loginBtn" onclick="doLogin()"><span>เข้าสู่ระบบ</span></button>
      <div class="cal-support"><p>พบปัญหาในการเข้าสู่ระบบ<br><b>ติดต่อผู้ดูแลระบบ 7401, 7402</b></p></div>
    </div>
  </section>
</div>
```

Do not change `js/01-core.js`; `setLoginButtonLabel()` continues to target the single non-arrow `<span>`.

- [ ] **Step 5: Run the semantic and runtime test**

Refresh `http://localhost:49447/tests/login-b3-ui.test.html`.

Expected: the editorial structure, local-asset, removals, integration, password-toggle, and runtime-login tests pass. Responsive styling and fixed cache version may still fail until Tasks 2 and 3.

- [ ] **Step 6: Commit the semantic redesign**

```powershell
git add -- index.html tests/login-b3-ui.test.html
git commit -m "feat: simplify login into editorial glass structure"
```

---

### Task 2: Implement the desktop and mobile editorial-glass presentation

**Files:**
- Modify: `tests/login-b3-ui.test.html:43-49,61-67`
- Modify: `index.html:844-860`

**Interfaces:**
- Consumes: the markup classes produced by Task 1 and local hero/logo assets.
- Produces: a near-full-browser stage, desktop left/right composition, accessible focus states, and a mobile card layout with no horizontal overflow.

- [ ] **Step 1: Replace the old responsive contract with failing layout assertions**

Replace the current `responsive และ touch target ครบ` and `stage sizing...` tests with:

```javascript
t('Editorial Glass responsive และ touch target ครบ', () => {
  ok(/@media\(max-width:820px\)/.test(INDEX), 'ต้องมี mobile breakpoint 820px');
  ok(/\.cal-login-input\s*\{[^}]*min-height:\s*56px/.test(INDEX), 'input 56px');
  ok(/\.cal-password-toggle\s*\{[^}]*width:\s*40px[^}]*height:\s*40px/.test(INDEX), 'password toggle 40px inside 56px control');
  ok(/\.cal-submit\s*\{[^}]*min-height:\s*56px/.test(INDEX), 'button 56px');
  ok(/\.cal-login-stage\s*\{[^}]*overflow:\s*hidden/.test(INDEX), 'stage ต้องกัน overflow');
  ok(/\.cal-brand-welcome\s*\{[^}]*letter-spacing:\s*\.38em/.test(INDEX), 'WELCOME tracking');
  ok(/\.cal-brand-system\s*\{[^}]*color:\s*#46d2c4/.test(INDEX), 'ILC teal system title');
});
t('stage เกือบเต็ม viewport และ mobile ไม่ล้น', () => {
  ok(/#loginPage\s*\{[^}]*padding:\s*8px/.test(INDEX), 'outer safe spacing 8px');
  ok(/\.cal-login-stage\s*\{[^}]*width:\s*calc\(100vw\s*-\s*16px\)[^}]*min-height:\s*calc\(100svh\s*-\s*16px\)/.test(INDEX), 'near-full viewport stage');
  ok(/\.cal-login-stage\s*\{[^}]*border-radius:\s*24px/.test(INDEX), 'stage radius 24px');
  ok(/\.cal-login-card\s*\{[^}]*top:\s*50%[^}]*transform:\s*translateY\(-50%\)/.test(INDEX), 'desktop card vertical center');
  ok(/\.cal-login-card\s*\{[^}]*height:\s*clamp\(560px,65svh,670px\)[^}]*min-height:\s*560px/.test(INDEX), 'desktop card capped responsive height');
  ok(/@media\(max-width:820px\)\s*\{[\s\S]*?\.cal-login-brand\s*\{[^}]*display:\s*none/.test(INDEX), 'mobile hides editorial brand');
  ok(/@media\(max-width:420px\)\s*\{[\s\S]*?\.cal-login-card\s*\{[^}]*width:\s*calc\(100%\s*-\s*20px\)/.test(INDEX), '320px card gutters');
});
```

- [ ] **Step 2: Run the test and verify the CSS contract fails**

Refresh `http://localhost:49447/tests/login-b3-ui.test.html`.

Expected: `FAIL` for the 56-pixel controls, editorial typography, near-full viewport stage, centered card, and mobile rules.

- [ ] **Step 3: Replace the login-only CSS with the approved implementation**

Inside `<style id="calibrationLoginRefresh">`, keep `:root`, loading-overlay, splash, loader, animation, and reduced-motion rules unchanged. Replace the selectors from `#loginPage` through the mobile login media queries with:

```css
#loginPage{min-height:100svh;display:grid!important;place-items:center;padding:8px;overflow-x:hidden;overflow-y:auto;background:#082839;font-family:'Bai Jamjuree','IBM Plex Sans Thai',sans-serif;color:#102f43}
.cal-login-stage{position:relative;isolation:isolate;overflow:hidden;width:calc(100vw - 16px);min-height:calc(100svh - 16px);border:1px solid rgba(70,210,196,.72);border-radius:24px;background:url("assets/calibration-lab-hero.png") center/cover no-repeat;box-shadow:0 22px 62px rgba(3,29,43,.28)}
.cal-login-stage::before{content:"";position:absolute;inset:0;z-index:0;background:linear-gradient(90deg,rgba(6,34,52,.94) 0%,rgba(7,43,61,.79) 24%,rgba(9,48,62,.34) 55%,rgba(226,245,247,.08) 100%)}
.cal-login-stage::after{content:"";position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(2,28,43,.10));pointer-events:none}
.cal-login-brand{position:absolute;z-index:1;left:clamp(52px,4.8vw,90px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:flex-start;max-width:58vw;text-shadow:0 5px 24px rgba(3,25,38,.34)}
.cal-brand-welcome{color:#fff;font-size:clamp(13px,1.05vw,18px);line-height:1;letter-spacing:.38em;font-weight:700}
.cal-brand-calibration{display:block;margin-top:30px;color:#fff;font-size:clamp(52px,5.25vw,94px);line-height:.92;letter-spacing:-.045em;font-weight:900}
.cal-brand-system{display:block;margin-top:24px;color:#46d2c4;font-size:clamp(18px,1.8vw,32px);line-height:1;letter-spacing:.20em;font-weight:800}
.cal-login-card{position:absolute;z-index:2;right:clamp(28px,4vw,64px);top:50%;transform:translateY(-50%);width:clamp(380px,31vw,520px);height:clamp(560px,65svh,670px);min-height:560px;padding:clamp(34px,3.2vw,52px) clamp(30px,3vw,48px);display:flex;flex-direction:column;justify-content:center;border:1px solid rgba(255,255,255,.88);border-radius:24px;background:linear-gradient(155deg,rgba(255,255,255,.91),rgba(238,249,249,.78));box-shadow:0 26px 66px rgba(4,38,54,.24);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
.cal-login-logo{display:flex;justify-content:center;margin-bottom:clamp(30px,3vw,42px)}.cal-login-logo img{display:block;width:min(280px,82%);height:auto}
.cal-field{display:grid;gap:9px;margin-bottom:21px}.cal-field label{color:#17384a;font-size:13px;font-weight:850}.cal-control{position:relative;display:flex;align-items:center;min-height:56px;padding:0 18px;border:1.5px solid rgba(137,183,194,.72);border-radius:14px;background:rgba(255,255,255,.78);box-shadow:inset 0 1px 0 rgba(255,255,255,.92)}.cal-control--password{padding-right:54px}.cal-control:focus-within{border-color:#159f94;box-shadow:0 0 0 4px rgba(21,159,148,.13)}
.cal-login-input{width:100%;min-height:56px;border:0!important;outline:0!important;background:transparent!important;padding:0!important;color:#17384a!important;font:inherit}.cal-login-input::placeholder{color:#879ba4;opacity:1}.cal-password-toggle{position:absolute;right:8px;width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:#607c88;cursor:pointer}.cal-password-toggle:hover{background:rgba(15,143,125,.08)}.cal-password-toggle:focus-visible{outline:3px solid rgba(15,143,125,.28);outline-offset:1px}
.cal-login-card .alert-error{display:none;margin:-5px 0 15px;padding:10px 12px;border:1px solid #f3c3c0;border-radius:11px;background:rgba(253,236,234,.94);color:#b94d3a;font-size:12px}
.cal-submit{width:100%;min-height:56px;display:flex;align-items:center;justify-content:center;border:0;border-radius:14px;background:linear-gradient(135deg,#008f84,#1bb9ad);color:#fff;box-shadow:0 14px 28px rgba(0,143,132,.24);font-size:15px;font-weight:900;cursor:pointer}.cal-submit:hover{filter:brightness(1.03)}.cal-submit:focus-visible{outline:3px solid rgba(7,127,119,.30);outline-offset:3px}.cal-submit:disabled{cursor:wait;opacity:.72}
.cal-support{margin-top:18px;padding:13px 16px;border-radius:14px;background:rgba(241,248,248,.82);color:#607985;font-size:11px;line-height:1.45}.cal-support p{margin:0}.cal-support b{color:#087f77;font-size:12px}
@media(max-width:1050px) and (min-width:821px){.cal-login-card{right:24px;width:390px;padding:34px 32px}.cal-login-brand{left:46px;max-width:52vw}.cal-brand-calibration{font-size:clamp(48px,5vw,64px)}.cal-brand-system{font-size:clamp(17px,1.65vw,22px)}}
@media(max-width:820px){#loginPage{place-items:start center}.cal-login-stage{width:calc(100vw - 16px);min-height:max(calc(100svh - 16px),660px);border-radius:20px}.cal-login-stage::before{background:linear-gradient(135deg,rgba(6,34,52,.78),rgba(230,247,248,.18))}.cal-login-brand{display:none}.cal-login-card{position:relative;right:auto;top:auto;transform:none;width:min(calc(100% - 28px),470px);height:auto;min-height:0;margin:clamp(34px,7vh,68px) auto 24px;padding:34px 28px}.cal-login-logo{margin-bottom:30px}}
@media(max-width:420px){.cal-login-stage{min-height:max(calc(100svh - 16px),640px);border-radius:18px}.cal-login-card{width:calc(100% - 20px);margin-top:22px;padding:30px 18px}.cal-login-logo{margin-bottom:26px}.cal-login-logo img{width:min(240px,86%)}.cal-field{margin-bottom:17px}.cal-support{padding:12px 13px}}
```

Delete the old `.cal-login-topline`, `.cal-company-logo`, `.cal-secure`, `.cal-brand-eyebrow`, `.cal-brand-rule`, `.cal-brand-tagline`, `.cal-brand-thai`, `.cal-login-status`, `.cal-login-heading`, `.cal-ilc-mark`, `.cal-input-icon`, `.cal-submit-arrow`, and `.cal-login-meta` rules rather than leaving dead selectors.

- [ ] **Step 4: Run the responsive contract and syntax-neutral checks**

Refresh `http://localhost:49447/tests/login-b3-ui.test.html`.

Run:

```powershell
git diff --check
```

Expected: editorial structure, responsive, touch-target, removal, integration, password-toggle, and runtime tests pass. Only fixed cache-version assertions may fail before Task 3. `git diff --check` exits 0.

- [ ] **Step 5: Verify the two primary desktop viewports**

Open the login page at 1920 × 1080 and 1280 × 720 and confirm:

- the stage keeps 8-pixel outer spacing, rounded teal outline, and no gray border area;
- `WELCOME`, `CALIBRATION`, and `MANAGEMENT SYSTEM` match the approved hierarchy;
- the measuring instruments remain visible in the center;
- the frosted card is vertically centered, does not stretch, and stays fully inside the stage;
- logo, fields, password control, button, and support strip remain readable;
- no horizontal scrollbar appears.

- [ ] **Step 6: Commit the visual implementation**

```powershell
git add -- index.html tests/login-b3-ui.test.html
git commit -m "style: implement editorial glass login layout"
```

---

### Task 3: Deliver the redesigned login through the offline cache

**Files:**
- Modify: `tests/login-b3-ui.test.html:71-74`
- Modify: `tests/reference-home.test.html:211-217`
- Modify: `sw.js:1`

**Interfaces:**
- Consumes: existing `APP_SHELL` entries for `./assets/calibration-lab-hero.png` and `./assets/ilc-logo-full.png`.
- Produces: cache namespace `calibration-app-v146` containing the changed `index.html` and existing local login assets.

- [ ] **Step 1: Tighten the login cache assertion to require v146**

Replace the login offline-cache test with:

```javascript
t('offline cache มี asset Login และ version ใหม่', () => {
  has(SW, "'./assets/calibration-lab-hero.png'", 'login hero cache');
  has(SW, "'./assets/ilc-logo-full.png'", 'ILC logo cache');
  has(SW, "const CACHE_NAME = 'calibration-app-v146';", 'cache v146');
});
```

- [ ] **Step 2: Update the Home cache regression to expect v146**

In `tests/reference-home.test.html`, replace the existing cache test with:

```javascript
t('Home Hero และ Login Hero อยู่ใน APP_SHELL v146 ครบ', () => {
  has(SW, './assets/home-hero-calibration-lab-wide.webp', 'desktop home hero');
  has(SW, './assets/home-hero-calibration-lab-v2.webp', 'home hero');
  has(SW, './assets/calibration-lab-hero.png', 'login and splash hero');
  ok(SW.indexOf('./assets/hero-lab.jpg') === -1, 'hero-lab.jpg ไม่ควรอยู่ใน APP_SHELL');
  has(SW, "const CACHE_NAME = 'calibration-app-v146';", 'cache bump');
});
```

- [ ] **Step 3: Run both tests and verify only the cache version fails**

Open:

- `http://localhost:49447/tests/login-b3-ui.test.html`
- `http://localhost:49447/tests/reference-home.test.html`

Expected: both titles are `FAIL`, and the failure messages require `calibration-app-v146` while the hero/logo cache entries already pass.

- [ ] **Step 4: Bump the service-worker cache namespace**

Change only the first line of `sw.js`:

```javascript
const CACHE_NAME = 'calibration-app-v146';
```

Do not reorder or otherwise change `APP_SHELL`.

- [ ] **Step 5: Run cache tests and JavaScript syntax checks**

Refresh both test pages, then run:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\01-core.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
git diff --check
```

Expected: both browser test titles are `ALL PASS`; both Node commands and `git diff --check` exit 0.

- [ ] **Step 6: Commit offline delivery**

```powershell
git add -- sw.js tests/login-b3-ui.test.html tests/reference-home.test.html
git commit -m "fix: refresh offline cache for editorial login"
```

---

### Task 4: Complete responsive, interaction, and regression verification

**Files:**
- Verify: `index.html`
- Verify: `js/01-core.js`
- Verify: `sw.js`
- Verify: `tests/login-b3-ui.test.html`
- Verify: every `tests/*.test.html`

**Interfaces:**
- Consumes: the complete implementation from Tasks 1–3.
- Produces: an evidence-backed, clean working tree ready for the user-requested integration/push step.

- [ ] **Step 1: Run every browser-readable HTML regression page**

With the local server running, enumerate `tests/*.test.html`, open each page from `http://localhost:49447/tests/`, and confirm its document title becomes `ALL PASS`.

Expected: no page title is `FAIL`, and no page body contains a line beginning with `FAIL`.

- [ ] **Step 2: Run static verification**

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\01-core.js
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check sw.js
git diff --check
git status --short --untracked-files=all
```

Expected: both syntax checks and `git diff --check` exit 0; Git status contains no unexpected files.

- [ ] **Step 3: Verify desktop visual acceptance**

At 1920 × 1080 and 1280 × 720, confirm every desktop requirement:

- near-full-browser hero with 8-pixel safe spacing, teal outline, and rounded corners;
- dark left overlay with readable `WELCOME`, `CALIBRATION`, and `MANAGEMENT SYSTEM`;
- centered full ILC logo in the right card;
- English Username/Password labels with Thai placeholders;
- visible password control, error position, submit button, and support contact;
- no B3 status, cropped logo, heading/subtitle, arrow, footer metadata, or tagline;
- no horizontal overflow or clipped card content.

- [ ] **Step 4: Verify tablet and mobile visual acceptance**

At 768 × 900, 360 × 800, and 320 × 800, confirm:

- the large left typography is hidden;
- the card remains centered with visible stage background;
- logo, fields, password toggle, submit button, error space, and support strip fit inside the viewport;
- all controls are reachable by vertical scrolling when required;
- no horizontal scrollbar, overlap, or clipping appears.

- [ ] **Step 5: Verify interactions without changing production data**

Use the browser DOM and the existing test fixture to confirm:

- typing `sample-secret` and toggling visibility twice preserves the exact value;
- `aria-pressed` changes `false → true → false` and the label changes `แสดงรหัสผ่าน → ซ่อนรหัสผ่าน → แสดงรหัสผ่าน`;
- pressing Enter in `#loginPassword` calls the existing `doLogin()` path;
- invalid credentials display `#loginError`, re-enable `#loginBtn`, and restore `เข้าสู่ระบบ`;
- the RPC remains `app_login` with trimmed username and SHA-256 password hash.

- [ ] **Step 6: Review commit history and working tree**

```powershell
git log --oneline --decorate -8
git status --short --untracked-files=all
```

Expected: the plan/spec and three focused implementation commits are present, and the working tree is clean before any user-requested push.
