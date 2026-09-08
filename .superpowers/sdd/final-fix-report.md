# Final Fix Report: Instrument Category Pill Coverage

## Files

- `tests/instrument-list-ui.test.html`
- `.superpowers/sdd/final-fix-report.md`

## Commit

`test: strengthen instrument category pill coverage`

## Verification

Executed from `C:/Users/8014/Desktop/calibration-system-main/.worktrees/fix-hidden-instrument-filter`:

1. `C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe -NoProfile -File tools\run-tests.ps1`
   - PASS: 9 test pages, 0 with problems.
   - `instrument-list-ui.test.html`: 24 pass, 0 fail.
2. `C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check js\02-dashboard.js`
   - Exit 0.
3. `C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check js\10-router.js`
   - Exit 0.
4. `C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check js\26-list-ui.js`
   - Exit 0.
5. `C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe --check sw.js`
   - Exit 0.
6. `C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe -NoProfile -File tools\verify-app-load.ps1`
   - `LOAD_OK all 25 scripts fetched+parsed`; `HANDLERS_OK`; `PATCH_OK`; `SUMMARY CLEAN`.
7. `git diff --check`
   - Exit 0.

## Self-review

- The selection scenario now uses the canonical `เครื่องชั่ง (Balance)` value and verifies that the matching rendered pill is present.
- It asserts the selected filtered row ID, resets the stale Dashboard category, and checks that exactly the canonical Balance pill is active.
- The clearing scenario asserts the restored matching row IDs and that exactly the `ทั้งหมด` pill is active.
- Test setup clears the search field left by an earlier test, making the row-ID assertions independent of test order.
- No production file was changed; existing checks were strengthened rather than removed.

## Concerns

None blocking. The fixture evaluates application scripts inside an async scope, so inline `onclick` handlers cannot resolve those lexical functions through `element.click()`. The test therefore verifies the rendered canonical handler identity and invokes the same `setListCategory` controller directly, which is the established harness-compatible path.
