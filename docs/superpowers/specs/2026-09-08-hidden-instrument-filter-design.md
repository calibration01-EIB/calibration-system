# Hidden Instrument Filter Fix Design

## Goal

Prevent the instrument list from incorrectly showing zero results when a legacy Dashboard category remains active and the user selects a different visible instrument type.

## Root Cause

The list applies both the visible `typeFilter` and the global `activeCategory`. Dashboard navigation can leave `activeCategory` set to one category while the list dropdown is later changed to another type. The two predicates conflict, although the visible controls do not reveal the retained Dashboard category.

## Behavior

- A non-empty visible instrument type is authoritative and must not be intersected with `activeCategory`.
- Selecting any list category pill, including “ทั้งหมด”, resets `activeCategory` to `all` before filtering.
- “ล้างตัวกรอง” continues to reset both visible filters and `activeCategory`.
- Category pills are rerendered after filter changes so their selected state always matches the visible type dropdown.
- Dashboard category navigation remains supported when no explicit list type is selected.

## Data and Security

This is a client-side filter-state correction. It does not alter, insert, or delete instrument rows and requires no Supabase schema or policy change.

## Testing

Add a browser regression test with a stale `activeCategory`, then select a conflicting visible type and verify matching rows remain visible. Also verify “ทั้งหมด” clears both category states and the rendered pill selection matches the dropdown. Run all browser, app-load, handler, and JavaScript syntax checks before release.
