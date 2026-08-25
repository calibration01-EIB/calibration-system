# Home Hero Panoramic Fit Design

Date: 2026-08-25

## Problem

The approved Hero source is 1921×819 (2.35:1), while the desktop Hero in the supplied screenshot is approximately 1750×260 (6.73:1). `object-fit: cover` must remove most of the source image's vertical area to fill that frame, so the analytical balance and other instruments appear incomplete even though the image itself loads correctly.

## Approved Direction

Use responsive art direction rather than one bitmap for every viewport:

- Create `assets/home-hero-calibration-lab-wide.webp` at exactly 1920×320 for desktop widths of 1024 px and above.
- Keep `assets/home-hero-calibration-lab-v2.webp` as the fallback for tablet and mobile widths below 1024 px, where its taller aspect ratio already works well.
- Use a `<picture>` element in the existing `.ax-hero-media` container to choose the desktop source without JavaScript.
- Keep the existing HTML Welcome label, heading, and Thai subtitle. Do not embed text in either image.
- Keep Hero heights at 260/220/180 px for desktop/tablet/mobile.

## Desktop Image Composition

- Preserve the clean, realistic modern calibration-laboratory style.
- Keep the left 43–46% calm and bright for HTML copy.
- Place the complete analytical balance, calibration weights, pressure gauge, and digital micrometer in the middle-right safe area.
- Keep all instrument edges inside the central 75% of the image height so a small `cover` crop cannot remove the top or bottom of an instrument.
- Use the existing white, pale-blue, navy, and restrained teal palette.
- No people, embedded text, logos, certificates, brand marks, or watermarks.

## Rendering and Performance

- Desktop source: 1920×320 WebP, maximum 250 KB.
- Tablet/mobile fallback: existing 1921×819 WebP, 54,380 bytes.
- Desktop uses `object-position: center`; the current tablet/mobile positioning remains unchanged.
- Both assets are added to the Service Worker application shell; cache version increases from `calibration-app-v143` to `calibration-app-v144`.

## Files and Boundaries

Expected changes are limited to:

- `assets/home-hero-calibration-lab-wide.webp`
- `index.html`
- `theme-aqua.css`
- `tests/reference-home.test.html`
- `sw.js`

No list-page behavior, Home-card behavior, authentication, database, permissions, export, or pagination logic changes are included.

## Verification

- Test that the desktop `<source>` uses `media="(min-width: 1024px)"` and the wide asset.
- Test that the fallback `<img>` still uses `home-hero-calibration-lab-v2.webp`.
- Test that the desktop asset is 1920×320, WebP, and no larger than 250 KB.
- Test that both Hero assets are in `APP_SHELL` and cache version is `v144`.
- Browser-check Home at 1900×900, 1440×900, 900×800, and 390×844.
- At desktop widths, verify that the complete instrument group is visible and the Hero remains 260 px high.
- At all widths, verify readable HTML copy and no page-level horizontal overflow.
