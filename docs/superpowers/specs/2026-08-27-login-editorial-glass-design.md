# Login Editorial Glass Design

**Date:** 2026-08-27  
**Status:** Proposed for final review  
**Selected direction:** User-approved GPT concept — editorial hero typography with a frosted login card

## Goal

Replace the current B3 login presentation with the approved full-browser laboratory composition while preserving the existing authentication behavior. The finished page must match the approved concept: a darkened laboratory hero with three-level English typography on the left and a compact frosted ILC login card on the right.

## Scope and Non-Goals

### In scope

- Redesign only the unauthenticated login view in `index.html`.
- Reuse `assets/calibration-lab-hero.png` and `assets/ilc-logo-full.png`.
- Preserve the existing username, password, password visibility, submit, invalid-credential, session, and reload behavior.
- Update the login UI regression contract and offline cache version.

### Out of scope

- No authentication, Supabase RPC, session, role, navigation, or post-login page changes.
- No new external images, fonts, packages, APIs, or network dependencies.
- No new login fields, remember-me option, registration, password reset, status badge, version label, security label, or extra promotional copy.
- Do not edit the home hero or any other application page.

## Architecture

The login remains a single HTML/CSS composition inside `#loginPage`. The page consists of one viewport-filling `.cal-login-stage`, a left editorial brand block, and one right frosted form card. Existing JavaScript in `js/01-core.js` remains the behavioral owner; the redesign changes its markup presentation without changing the authentication data flow.

No additional runtime component, build step, or dependency is introduced. The existing local assets remain part of the service-worker app shell.

## Visual Composition

### Viewport stage

- The laboratory hero fills a near-full-browser stage with approximately 8 pixels of safe outer spacing, a 22–24 pixel radius, and a thin ILC-teal outline.
- The stage has no desktop maximum width. It uses `assets/calibration-lab-hero.png` with `cover`, centered so the measuring instruments remain visible between the typography and card.
- A strong navy gradient darkens the left 45–50% and fades toward the middle; the right side remains bright enough for the frosted card.
- The page must not introduce horizontal scrolling. Short screens may scroll vertically rather than clip the form.

### Left typography

The desktop brand block is vertically centered in the left safe area and contains only these three lines:

1. `WELCOME` — small white uppercase text with wide tracking.
2. `CALIBRATION` — the dominant white uppercase headline.
3. `MANAGEMENT SYSTEM` — smaller uppercase text in ILC teal with moderate tracking.

The composition uses clean type hierarchy rather than decorative lines, shadows, slogans, or extra labels. A restrained shadow may be used only to protect legibility against the hero image.

### Right frosted card

- The card is vertically centered and inset from the right edge with responsive safe spacing.
- Desktop width is responsive between approximately 380 and 520 pixels; it must not stretch to fill tall screens.
- Surface: translucent white, 22–24 pixel radius, subtle white border, 18–22 pixel backdrop blur, and a soft navy shadow.
- The full ILC logo is centered at the top and is the only heading/brand element inside the card.
- The card contains, in order:
  1. full ILC logo;
  2. `Username` label and the existing Thai placeholder;
  3. `Password` label, existing Thai placeholder, and password visibility control;
  4. invalid-credential message when required;
  5. teal gradient `เข้าสู่ระบบ` button;
  6. support strip with `พบปัญหาในการเข้าสู่ระบบ` and bold teal `ติดต่อผู้ดูแลระบบ 7401, 7402`.
- Remove the current status row, cropped ILC mark, `เข้าสู่ระบบ` heading, portal subtitle, arrow decoration, and footer metadata.

## Responsive Layout

### Desktop: above 820 pixels

- Show the full left typography and right frosted card simultaneously.
- Preserve clear space between `MANAGEMENT SYSTEM`, the central instruments, and the card.
- Keep the card vertically centered and fully visible at 1280 × 720 and larger viewports.

### Tablet and mobile: 820 pixels and below

- Hide the large left typography to prioritize authentication controls.
- Keep the hero as the full-stage background with a balanced dark-to-light overlay.
- Center the card with 14–18 pixel stage gutters and compact padding.
- Maintain a minimum 50-pixel touch target for username, password, password toggle, and submit controls.
- At 320 pixels wide, the logo, fields, support strip, and error state must stay inside the viewport with no horizontal scrolling.
- When viewport height is insufficient, allow vertical scrolling and keep the submit and support content reachable.

## Behavior and Data Flow

1. `loginUsername` and `loginPassword` collect the existing credentials.
2. Clicking `loginBtn` or pressing Enter in the password field calls `doLogin()`.
3. `doLogin()` trims the username, hashes the password with SHA-256, and calls the existing `app_login` Supabase RPC.
4. A valid user is stored through the existing session helper and the page reloads into the authenticated application.
5. An invalid result displays `loginError` inside the card without changing the field values or layout structure.
6. The submit label changes to `กำลังตรวจสอบ...` while pending and returns to `เข้าสู่ระบบ` afterward.
7. `toggleLoginPassword()` changes only the password input type and its ARIA state; it must never alter the password value.

The DOM IDs and public function names used by this flow remain unchanged.

## Error Handling and Accessibility

- Preserve `loginError` and ensure its red error styling is readable on the frosted surface.
- Empty username or password retains the existing no-request behavior.
- Network or unexpected errors continue through the existing toast path.
- Keep `autocomplete="username"` and `autocomplete="current-password"`.
- Every field has an explicit label. The password toggle retains `aria-label` and `aria-pressed` updates.
- Focus states use a visible ILC-teal outline/ring with sufficient contrast.
- The logo has meaningful alt text; purely visual hero content remains CSS background imagery.
- The existing splash and `prefers-reduced-motion` behavior remain nonblocking.

## Offline Delivery

- `assets/calibration-lab-hero.png` and `assets/ilc-logo-full.png` remain in `APP_SHELL`.
- Because `index.html` changes, bump `CACHE_NAME` from `calibration-app-v145` to `calibration-app-v146` so offline installations receive the redesigned login.

## Testing and Verification

- Update `tests/login-b3-ui.test.html` before production CSS/markup so the old B3 structure fails and the new editorial-glass contract is required.
- Preserve runtime coverage for password visibility, invalid credentials, pending button text, button re-enable, RPC name, and hashed payload.
- Add structural checks for the three exact hero lines, full ILC logo, English field labels, support content, required IDs, local hero asset, viewport stage, desktop card positioning, mobile breakpoint, and cache `v146`.
- Confirm removed B3 elements are absent: status row, cropped mark, login heading/subtitle, submit arrow, footer metadata, and promotional tagline.
- Run all `tests/*.test.html` pages, JavaScript syntax checks, and `git diff --check`.
- Perform browser visual verification at 1920 × 1080, 1280 × 720, 768 × 900, 360 × 800, and 320 × 800.
- At each size verify no horizontal overflow, readable contrast, unclipped logo/fields/support, usable focus states, and reachable controls.

## Acceptance Criteria

1. Desktop visually matches the approved concept: dark laboratory hero, editorial typography left, frosted ILC form card right.
2. The left block contains only `WELCOME`, `CALIBRATION`, and `MANAGEMENT SYSTEM` with the approved hierarchy and colors.
3. The card contains only the full ILC logo, Username/Password controls, login error when needed, submit button, and support contact.
4. Existing login, password-toggle, Enter-key, invalid-credential, session, splash, and reduced-motion behavior continues to work.
5. Desktop and mobile layouts have no horizontal overflow or clipped controls at the required viewports.
6. Offline reload receives the new login through cache namespace `calibration-app-v146`.
