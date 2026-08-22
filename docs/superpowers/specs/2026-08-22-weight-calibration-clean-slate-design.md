# Weight Calibration Clean-Slate Removal Design

**Date:** 2026-08-22  
**Status:** User-approved design, pending written-spec review

## Goal

Remove the dormant legacy weight-calibration (ABBA) application code so a
future replacement can be designed from a clean slate. The removal must not
damage the separate standard-weight / Cert Reference register that remains in
active use.

## Scope boundary

### Remove

- Legacy ABBA certificate and calculation rendering that remains embedded in
  `cert-print.html`, including its weight-document dispatch paths and helpers.
- Legacy tooling that builds the removed weight-calibration workbook/template.
- Any remaining runtime references to the removed weight-calibration job page,
  route, scripts, Home card image 10, offline cache entries, or old template.
- Stale production comments whose only purpose is to describe the removed
  runtime.

### Preserve

- The Home page remains a nine-card layout; the tenth weight-calibration card
  and `10_weight_calibration.png` remain absent.
- The Cert Reference / standard-weight register (`pageWeights`,
  `js/08-weights.js`) and its current/previous certificate PDF handling.
- Standard-weight master data, comparison-mass instrument records, and any
  database objects required by that reference register.
- Existing balance/instrument certificate printing and all non-weight job
  document types.
- The already-applied database cleanup at commit `5e451c8`; this change does
  not run a second destructive database operation.
- A regression contract that rejects legacy weight-calibration runtime files
  or APP_SHELL entries if they are accidentally reintroduced.

## Implementation approach

1. Add focused regression tests that describe the desired clean state and
   prove they fail while dormant ABBA code/tooling still exists.
2. Remove the legacy ABBA-only sections from `cert-print.html` without editing
   shared balance-certificate helpers.
3. Delete the tracked legacy workbook/template builder and any remaining
   weight-calibration-only artifacts found by the scoped inventory.
4. Keep the explicit negative APP_SHELL regression test, then update it only
   where needed to cover the remaining legacy names.
5. Bump the Service Worker cache only if a cached runtime file or `sw.js`
   content changes; do not bump it for documentation-only changes.

## Data and error handling

- No database writes, schema changes, or storage deletion occur in this task.
- No attempt is made to migrate old ABBA jobs; those data were intentionally
  wiped previously.
- If a supposedly ABBA-only helper is also called by a preserved balance or
  Cert Reference flow, it is treated as shared and retained until callers are
  separated safely.

## Verification

- A source inventory contains no reachable legacy weight-calibration job,
  calculator, renderer, export, route, Home-card, or precache reference.
- The standard-weight / Cert Reference register still loads and its current
  public functions remain available.
- Balance certificate rendering remains unchanged for its existing fixtures.
- All project tests, JavaScript syntax checks, app-load verification, and
  `git diff --check` pass.
- Final review confirms the deletion is scoped and does not remove the
  preserved reference register.

## Out of scope

- Designing or implementing the replacement weight-calibration system.
- Restoring legacy ABBA logic, UI, database jobs, templates, or card artwork.
- Redesigning the Cert Reference / standard-weight register.
