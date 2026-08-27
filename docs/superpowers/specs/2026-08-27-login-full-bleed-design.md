# Login Full-Bleed Design

**Date:** 2026-08-27  
**Status:** Approved design  
**Selected direction:** A — Full Bleed

## Goal

Expand the approved B3 Clean Frost login from a centered 1180 × 604 framed stage into a true full-browser presentation. The laboratory hero must fill the viewport with no gray outer area, rounded outer frame, or outer stage shadow, while the login card remains compact and readable on the right.

## Current Problem

The current login stage is capped at 1180 pixels wide and 604 pixels high, centered inside a padded gray `#loginPage`. On large displays this leaves a large unused border around the design. Simply stretching every element would make the login card excessively tall and would weaken the existing visual hierarchy.

## Approved Layout

### Full-bleed stage

- `#loginPage` has no outer padding and allows vertical scrolling only when a short screen cannot contain the minimum login composition.
- `.cal-login-stage` fills the browser width and at least the browser's small viewport height (`100svh`).
- The stage has no maximum width, outer border radius, or outer box shadow.
- `assets/calibration-lab-hero.png` remains the background with `cover`; the existing left-to-right readability gradient remains.
- The document must never gain horizontal scrolling.

### Desktop composition

- At widths above 820 pixels, the full ILC logo remains at the upper-left and the B3 brand block remains in the lower-left safe area.
- The login card remains 398 pixels wide and approximately 552 pixels high instead of stretching with the viewport.
- The card is vertically centered and inset from the right edge with responsive safe spacing between 24 and 56 pixels.
- The card keeps its existing rounded corners, frosted white surface, top teal accent, fields, support strip, and footer metadata.
- The approved cropped ILC mark remains at `left: 6px` and `top: 5px` inside its frame.

### Tablet and mobile composition

- At 820 pixels and below, the large left brand block and secure label remain hidden.
- The company logo remains visible at the top.
- The stage remains full width and is at least `100svh` tall.
- The mobile composition keeps a minimum height of 690 pixels so short screens scroll vertically rather than clipping the card.
- The login card uses the available width with 15-pixel internal stage gutters, does not use desktop vertical centering, and keeps the current compact mobile padding.
- At 320 pixels wide, the stage, card, support strip, footer, and every control must remain within the viewport without horizontal scrolling.

## Behavior and Accessibility

- Preserve `loginUsername`, `loginPassword`, `loginBtn`, `loginError`, `doLogin()`, Enter-key submission, and the existing `app_login` RPC payload.
- Preserve the password visibility control, password value, ARIA state updates, and the nested submit-button arrow through failed login attempts.
- Normal-motion splash behavior and reduced-motion immediate hiding must remain unchanged and nonblocking.
- Username, password, and submit controls remain at least 50 pixels high.

## Offline Delivery

The previously deployed login used cache namespace `calibration-app-v145`. Because `index.html` is part of the app shell, this full-bleed release must bump the service-worker cache to `calibration-app-v146`. The existing local hero and the remainder of `APP_SHELL` stay unchanged.

## Testing and Visual Verification

- Update `tests/login-b3-ui.test.html` before production CSS so the old framed-stage contract fails.
- The regression contract must require full-width/full-height stage rules, no stage radius/shadow, compact desktop card positioning, mobile minimum height, and cache `v146`.
- Preserve the existing runtime tests for password toggling and invalid-login button structure.
- Run every `tests/*.test.html` browser page and JavaScript syntax checks for `js/01-core.js` and `sw.js`.
- Verify rendered layouts at 1920 × 1080, 1280 × 720, 768 × 900, 360 × 800, and 320 × 800.
- At each viewport, confirm no horizontal overflow, the splash is nonblocking, and the login card is visible and unclipped.
- At desktop widths, confirm the stage exactly fills the viewport and the card remains compact rather than stretching vertically.
- At tablet/mobile widths, confirm the brand and secure label are hidden, the company logo remains visible, and vertical scrolling is available only when required by screen height.

## Non-Goals

- Do not change the hero image, login wording, typography, field arrangement, card styling, authentication, storage, APIs, or post-login application pages.
- Do not add external assets, packages, fonts, or services.
- Do not redesign the login as a split-screen panel.

## Acceptance Criteria

1. No gray outer area is visible around the login design at any tested desktop viewport.
2. The hero stage covers the full viewport with square outer corners and no outer shadow.
3. The desktop login card remains approximately 398 × 552 pixels, is vertically centered, and does not stretch with tall screens.
4. Mobile layouts remain readable at 320 pixels with no horizontal overflow or clipped controls.
5. Existing login, password-toggle, invalid-credential, splash, reduced-motion, and offline behaviors continue to pass.
6. Service-worker cache namespace is `calibration-app-v146`.
