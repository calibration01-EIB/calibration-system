# Instrument List Header and Home Hero Design

Date: 2026-08-25

## Goal

Reduce visual clutter above the instrument table while preserving all existing filtering and export capabilities, and replace the Home hero with a lighter, more compact calibration-laboratory image that remains readable across screen sizes.

## Scope

This change covers two presentation areas:

1. The command and filter area above the instrument list.
2. The Home-page hero image, overlay, and responsive height.

It does not change instrument data, database behavior, permissions, export content, pagination rules, or the existing filtering source of truth.

## Instrument List Header

### Layout

The selected direction is **B: collapsible filters**.

- The first row contains the page title, live total count, and the existing Refresh, PDF, Excel, Import Excel, and Add Instrument actions.
- The next row contains the primary controls: search, instrument type, unit, and calibration month.
- Category and calibration-status choices move into a collapsible panel that is closed on every page load.
- A compact button labelled `เปิดหมวดและสถานะ` opens the panel. The same control closes it when expanded.
- The current table-view tabs sit immediately above the table so their relationship to the table is clear.
- The reset control is hidden when no search or filter is active and becomes visible once the result set is constrained.

### Collapsed Summary

When the category/status panel is closed, a single-line summary remains visible only when category or status filters are active. It lists the selected filter labels and allows the user to understand why the displayed result count changed without reopening the panel.

The summary is derived from the current control state. It does not maintain a second filter model.

### Interaction

- Opening or closing the panel only changes presentation state.
- Selecting a category or status does not automatically close the panel.
- Existing live counts continue to update through the current filtering flow.
- Reset clears the existing search/filter controls using the current reset behavior, then hides the reset control and active summary.
- The panel starts collapsed after every page load. Its open state is not stored in local storage.
- Any optional summary or disclosure element must be null-safe so the list still operates if the enhancement markup is unavailable.

### Responsive Behavior

- On desktop, title/actions and primary filters use compact horizontal rows.
- On tablet and mobile, actions and primary filters wrap cleanly without horizontal page overflow.
- The expanded category/status panel grows downward and does not overlap the table.
- Existing table horizontal scrolling is preserved where needed.

## Home Hero

### Image Direction

Use the approved generated photorealistic image of a clean modern calibration laboratory. The visual focal group is on the right and includes an analytical balance, stainless-steel calibration weights, a pressure gauge, and a digital micrometer. The left side remains calm negative space.

The production asset will be copied into the project as `assets/home-hero-calibration-lab-v2.webp` rather than overwriting the existing source asset. It will be optimized for web delivery before use.

### Text and Overlay

- Keep the Welcome label, `Calibration System` heading, and Thai supporting copy as HTML; do not bake text or the company logo into the image.
- Place the text on the left over the image's negative space.
- Use a light, restrained overlay behind the copy only as needed for contrast. Avoid the current heavy dark treatment.
- Preserve accessible, selectable text and the existing content hierarchy.

### Size and Cropping

- Desktop (1024 px and wider) hero height: 260 px.
- Tablet (768–1023 px) hero height: 220 px.
- Mobile (below 768 px) hero height: 180 px.
- Use responsive `object-position`/background positioning so the equipment remains visible on the right while the text stays readable on the left.
- The hero must not introduce horizontal overflow or dominate the first screen.
- The important instruments must remain inside the responsive safe area; mobile may show a tighter subset rather than shrinking the full panorama.

### Asset Constraints

- No embedded text, logo, brand mark, certificate, people, or watermark.
- Maintain a white, pale-blue, navy, and restrained teal palette consistent with the application.
- Optimize the final asset so the new hero does not materially degrade Home-page loading or scrolling performance.

## Technical Boundaries

Expected implementation files are limited to the existing page markup, list-page behavior script, shared theme stylesheet, the new hero asset, relevant tests, and the service-worker cache version when required:

- `index.html`
- `theme-aqua.css`
- `js/26-list-ui.js`
- a new file under `assets/`
- focused tests under `tests/`
- `sw.js` cache revision

The existing `filterData()` flow remains the filtering source of truth. New JavaScript only controls collapse state, derives the active-filter summary, and synchronizes conditional visibility. No database, export, permission, or pagination logic changes are included.

## Verification

Automated checks should cover:

- category/status panel is collapsed by default;
- disclosure control opens and closes it;
- active category/status selections produce the correct collapsed summary;
- reset control is visible only when filtering/search is active;
- Hero markup uses HTML text and the new image asset;
- responsive Hero heights and crop rules are present;
- JavaScript syntax and service-worker syntax remain valid.

Browser verification should cover desktop, tablet, and mobile widths and confirm:

- no unintended horizontal page overflow;
- actions and filters wrap correctly;
- panel expansion does not overlap the table;
- search, category, status, reset, view switching, and pagination still work;
- Hero copy remains readable and the equipment crop remains balanced;
- scrolling and hover behavior remain smooth.

## Approved Decisions

- Instrument list direction: collapsible filter design B.
- Category/status panel: collapsed on each load, manually toggled, no auto-close.
- Reset: conditional visibility.
- Hero: newly generated photorealistic calibration-laboratory image.
- Hero text: HTML overlay, not embedded in the bitmap.
- Hero size: responsive heights of 260/220/180 px at the defined desktop/tablet/mobile breakpoints.
