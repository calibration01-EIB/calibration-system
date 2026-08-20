# Task 1 Report — Instrument list pagination/hover

## Files

- `tests/test_instrument_list_ui.py` — structural contract tests for page size and scoped hover.
- `index.html` — exact page-size options `20/50/100`, with `20` selected.
- `js/04-reports.js` — default `pageSize = 20`; existing reset/rerender behavior preserved.
- `theme-aqua.css` — scoped instrument-list hover transition, clear dark hover, and accent indicator.

## TDD verification

RED command (bundled Python runtime; system `python` alias was unavailable):

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest tests.test_instrument_list_ui -v
```

Result: 3 tests ran; 2 failed as expected for missing page-size contract and scoped hover, while the existing reset/rerender test passed.

GREEN/syntax/diff command:

```powershell
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -B -m unittest tests.test_instrument_list_ui -v
& 'C:\Users\8014\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check js\04-reports.js
git diff --check
```

Result: 3 tests passed; Node syntax check and diff check exited 0. Git reported only normal LF/CRLF conversion warnings.

## Commit

`dba76170f6e59a993eaf63681c7af827ef92d2f9` (`feat: simplify instrument list scanning`).

## Concerns

None. The global hover rule remains for other tables; the new darker hover is scoped to `#pageList` as required.
