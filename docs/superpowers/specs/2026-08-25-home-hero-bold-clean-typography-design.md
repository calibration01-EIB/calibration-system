# Home Hero Bold Clean Typography Design

Date: 2026-08-25

## Problem

The Home Hero image now fits the approved compact frame and shows the complete calibration instrument group, but the text hierarchy is too quiet relative to the image. The heading needs stronger visual presence without making the Hero taller, obscuring the instruments, or embedding text into the bitmap.

## Approved Direction

Apply the selected **A — Bold Clean** treatment to the existing HTML copy:

- Keep `Welcome`, `Calibration System`, and the Thai supporting copy as real HTML text.
- Increase the heading and supporting type sizes responsively.
- Add one restrained teal accent line below the supporting copy.
- Strengthen the left-to-right white scrim slightly so the larger copy remains readable while the photograph still feels continuous.
- Keep the current Hero image sources and responsive art direction unchanged.

## Responsive Typography

| Breakpoint | Welcome | Heading | Thai supporting copy |
| --- | ---: | ---: | ---: |
| Desktop, 1024 px and wider | 22 px | 60 px | 18 px |
| Tablet, 768–1023 px | 18 px | 40 px | 16 px |
| Mobile, 767 px and narrower | 15 px | 30 px | 13 px |

The heading remains navy and extra-bold. `Welcome` remains teal and bold. The Thai supporting copy remains the secondary navy-gray color. Line height must keep the current two-line Thai copy readable without exceeding the Hero boundary.

## Accent Line

- Render the accent as a CSS pseudo-element after the supporting paragraph.
- Desktop size: 72 px wide and 4 px high.
- Tablet size: 58 px wide and 3 px high.
- Mobile size: 44 px wide and 3 px high.
- Use a restrained left-to-right teal gradient, rounded ends, and no animation.
- Keep at least 10 px of space above the line on desktop and tablet, and 7 px on mobile.

## Layout and Scrim

- Desktop copy width becomes `min(54%, 700px)` to prevent the 60 px heading from wrapping.
- Desktop copy padding remains visually compact at 30 px vertically and 48 px horizontally.
- Tablet copy width remains 58%; mobile copy width remains 68%.
- Mobile copy padding becomes 10 px vertically and 18 px horizontally, with a 4 px flex gap and 1.3 supporting-copy line height. These compact spacing values keep a two-line heading, wrapped Thai copy, and the new accent line inside the 180 px Hero.
- Keep the approved Hero heights at 260 px desktop, 220 px tablet, and 180 px mobile.
- Keep the current `home-hero-calibration-lab-wide.webp` desktop source and `home-hero-calibration-lab-v2.webp` tablet/mobile fallback.
- Adjust only the scrim opacity stops required for readable larger text. Do not add a glass card, border, shadow, capsule label, or additional decoration.

## Files and Boundaries

Expected production changes are limited to:

- `theme-aqua.css`
- `tests/reference-home.test.html`

No HTML structure, Hero bitmap, Service Worker, Home cards, authentication, database, permissions, exports, list filters, or pagination behavior changes are included.

## Verification

- Add test assertions for the approved desktop, tablet, and mobile font sizes.
- Add test assertions for the accent-line dimensions at each breakpoint.
- Keep existing assertions for Hero heights, `<picture>` art direction, asset dimensions, and Service Worker cache entries passing.
- Run all seven browser regression pages.
- Browser-check the Home Hero at 1900×900, 1440×900, 900×800, and 390×844.
- At every viewport, verify that `Calibration System` remains readable, no text overlaps the instrument group, the accent line remains inside the Hero, and there is no page-level horizontal overflow.
