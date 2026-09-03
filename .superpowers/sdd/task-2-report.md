# Task 2 report — unified calibration plan page

## Status

Task 2 is complete. The original implementation is committed as `eda2f3b feat: make work batches the calibration plan page`; reviewer follow-up fixes are committed as `3ef46df fix: synchronize unified calibration plan tabs`.

## Partial-edit audit

The starting worktree was at `bd0513f` with uncommitted edits in `index.html`, `js/10-router.js`, `tests/calibration-work-batch.test.html`, `tests/login-b3-ui.test.html`, and `tests/reference-home.test.html`. The partial edits had already removed the separate `pageCalwork` shell and changed several labels/cache assertions, but they were incomplete:

- `js/29-calibration-work.js` still navigated to `showPage('calwork')` and had no public primary-tab selector.
- `theme-aqua.css` still scoped all work-batch styles to `#pageCalwork`.
- `sw.js` still used cache v158 and stale query keys.
- The calibration-work test still looked for the old work-script query and expected pre-consolidation inner-tab counts.
- The partial markup left legacy-plan wording in unrelated visible text and the create trigger bypassed the expected `cwOpenCreate()` contract.

I preserved the intended cache-version assertion updates in the login and reference-home tests, corrected the calibration-work test, and completed the production changes rather than assuming the partial edits were correct.

## Changes

- Consolidated the work-batch dashboard, dialogs, and notifications under the single `pagePlan` shell.
- Removed the `nav-calwork` route and changed desktop/mobile plan labels to `แผนสอบเทียบ`.
- Routed `showPage('plan')` to `loadCalibrationWorkPage()` and changed work-engine navigation helpers to return to `plan`.
- Added four persistent primary controls (`select`, `batches`, `waiting`, `history`) with ARIA selection state, deterministic focus/keyboard handling, create-dialog opening, and state mapping.
- Expanded the waiting state to acknowledgement, calibration, partial-completion, and closure queues; history now contains completed and cancelled batches.
- Renamed inner filters so they do not duplicate the four primary labels.
- Re-scoped work styles to `#pagePlan`, added responsive primary-tab styles, and updated cache v159 plus exact query-qualified shell URLs.
- Added regression coverage for primary mapping and keyboard focus behavior.

## Verification

TDD RED checks observed before implementation:

- Focused calibration-work browser contract failed for legacy `calwork` navigation, missing `cwSetPrimaryTab`, stale cache v158, and `#pageCalwork` styles.
- The new primary-tab keyboard test failed before its handler was added (`ArrowRight moves primary focus`).

Final commands:

- `pwsh -File tools/run-tests.ps1`: all Task 2 checks pass. Remaining failures are the intentional Task 3 retirement contracts only: legacy `frm_plans`/FRM runtime/template checks in `calibration-work-batch.test.html`, `frm-cross-month.test.html`, `plan-export.test.html`, and `reference-home.test.html`.
- `pwsh -File tools/verify-app-load.ps1`: `scripts declared in index.html: 28`; `LOAD_OK all 28 scripts fetched+parsed`; `HANDLERS_OK`; `PATCH_OK`; `load-time errors: 0`; `SUMMARY CLEAN`.
- `pwsh -File tools/syntax-check-js.ps1`: all listed JavaScript files reported `OK`.
- `git diff --check`: clean.
- Post-commit `git status --short`: clean.

## Files and commit

Changed files: `index.html`, `js/10-router.js`, `js/29-calibration-work.js`, `theme-aqua.css`, `sw.js`, `tests/calibration-work-batch.test.html`, `tests/login-b3-ui.test.html`, and `tests/reference-home.test.html`.

Commits: `eda2f3b feat: make work batches the calibration plan page`; follow-up `3ef46df fix: synchronize unified calibration plan tabs`.

Report: `C:\Users\8014\Desktop\calibration-system-main\.worktrees\replace-legacy-calibration-plan\.superpowers\sdd\task-2-report.md`

## Concerns

The full suite is not entirely green only because Task 3 is intentionally pending; no Task 2-specific failures remain. The service worker retains the legacy FRM entries and `js/06-plan.js` retains legacy tables until Task 3, as required by task ownership.

## Reviewer follow-up (3ef46df)

Root-cause audit found two state-boundary defects. `cwRenderDashboard()` reset `cwUiState.tab` to `active` while retaining `cwPrimaryTab`, and notification navigation assigned only the inner tab. Separately, `cwSetPrimaryTab('select')` selected the tab before `cwOpenCreate()` could fail, leaving a read-only user on an unselected, unfocusable control.

TDD evidence:

- RED focused run after adding reviewer contracts: refresh showed `waiting inner state survives refresh: expected "waiting", got "active"`; denied select showed `denied select restores primary selection: expected "batches", got "select"`; keyboard select/close and notification selection also failed.
- GREEN focused run after implementation: only the intentional `frm_plans` Task 3 contract remains; all reviewer refresh, notification, denied-select, and keyboard close assertions pass.

The follow-up introduces `cwSyncPrimaryState()` as the single primary/inner state synchronizer, preserves the requested primary section through authoritative refresh, synchronizes notification routing, commits `select` only after dialog open succeeds, and restores the prior primary/inner state and focus on close.

Follow-up verification:

- `pwsh -File tools/run-tests.ps1`: 9 pages; only the four expected Task 3 retirement contracts fail (`calibration-work-batch`, `frm-cross-month`, `plan-export`, `reference-home`). No reviewer or Task 2 failures.
- `pwsh -File tools/verify-app-load.ps1`: 28/28 scripts fetched and parsed, 109 inline handlers resolved, 11 wrappers installed, 0 load-time errors (`SUMMARY CLEAN`).
- `git diff --check`: clean; implementation commit `3ef46df` has the requested production/test changes.
