# Login B3 Clean Frost Redesign

## Goal

Replace the current login presentation with the approved B3 Clean Frost design while preserving the existing offline authentication flow and all current login element IDs and JavaScript behavior.

## Approved Direction

The login page uses a full-bleed calibration laboratory photograph with a bright frost gradient on the left and a high-contrast white login card on the right. The overall appearance should feel precise, clean, professional, and recognizably connected to International Laboratories Corp., Ltd.

The approved visual reference is the final Visual Companion screen `login-b3-ilc-logo-right-v8.html`.

## Page Composition

### Background and shell

- Use `assets/calibration-lab-hero.png` as the full background image.
- Crop the image with `background-size: cover` and preserve the measuring instruments around the middle and right side.
- Apply a light left-to-right frost gradient so dark text remains readable without hiding the instruments.
- Keep the desktop composition within a softly rounded frame with a restrained shadow.
- Avoid external fonts, icons, or network-loaded assets so the page continues to work offline.

### Company identity

- Show `assets/ilc-logo-full.png` in a white translucent logo container at the upper-left of the hero.
- Keep the logo large enough to read but subordinate to the system title.
- Retain the small secure-portal indicator at the upper-right of the hero on desktop.

### System title

- Use `ILC DIGITAL LABORATORY` as the small eyebrow label.
- Make `Calibration` the first headline line.
- Make `Management System` the second headline line in the ILC teal color.
- Keep the title materially smaller than the earlier oversized `Precision` treatment.
- Place a short teal accent rule below the title.
- Render `Precision you can trust.` as a smaller supporting tagline.
- Add the Thai supporting sentence: `ระบบบริหารจัดการงานสอบเทียบที่แม่นยำ เป็นระบบ และตรวจสอบย้อนหลังได้`.

## Login Card

### Surface

- Use an almost-opaque white frosted surface with subtle blur, a thin white border, a soft shadow, and a narrow teal accent along the top.
- Keep the card visually lighter than the hero but sufficiently opaque for strong text and input contrast.
- Balance vertical spacing so the form does not feel empty or crowded.

### Status row

- Show a soft green `ระบบพร้อมใช้งาน` status pill at the upper-left of the card.
- Show `ILC · INTERNAL` at the upper-right.
- Status is presentation-only and does not introduce network availability checks.

### Login identity block

- Place a compact ILC symbol before the `เข้าสู่ระบบ` heading.
- Derive the symbol from `assets/ilc-logo-full.png` by cropping the left ILC mark inside a 52 × 48 pixel rounded container.
- Position the cropped logo 6 pixels from the container's left edge and 5 pixels from its top edge, matching the approved v8 alignment.
- Keep `Calibration Management Portal` as the subtitle.

### Fields and action

- Preserve the current `loginUsername`, `loginPassword`, and `loginBtn` IDs so existing JavaScript continues to work.
- Give both fields a 50-pixel minimum height, visible labels, soft borders, and a teal focus ring.
- Use compact leading visual markers consistent with the design.
- Add one accessible password-visibility control in the trailing position. It changes only the password input's `type` between `password` and `text` and never modifies the value.
- Use one full-width teal gradient login button with a small circular arrow treatment.
- Preserve the existing `doLogin()` submission path and keyboard submission behavior.

### Help and metadata

- Present support information in a soft tinted strip: `ติดต่อผู้ดูแลระบบ 7401, 7402`.
- Show `AUTHORIZED EMPLOYEE ACCESS` and `v2.0` as low-emphasis footer metadata.
- Do not add password recovery, account creation, or new authentication options.

## Responsive Behavior

- Desktop and wide tablet: retain the two-part hero with title content on the left and the login card on the right.
- Narrow tablet and mobile: hide the large left title block, keep the company logo visible, and let the login card fill the available width below it.
- Maintain readable text and controls without horizontal scrolling at 320 pixels and above.
- Inputs and the login action must remain at least 44 pixels high for touch use.

## Existing Behavior and Data Flow

1. The page loads entirely from local project assets.
2. The user enters credentials into the existing username and password inputs.
3. Submitting the form continues to call the existing `doLogin()` function.
4. Existing success and failure behavior remains authoritative.
5. This redesign adds no API calls, storage changes, credential handling, or new authentication logic.

## Implementation Boundaries

- Limit production changes to the login markup and styles needed for this design.
- Preserve `js/01-core.js` login logic unless a compatibility defect is proven during testing.
- Replace or neutralize legacy login-specific overrides that conflict with the approved layout instead of stacking another broad override on top.
- Do not change the authenticated application shell, Home page, datasets, calibration workflows, or service worker behavior except when an asset cache entry is required for offline login rendering.

## Error Handling

- Existing invalid-credential messaging and behavior must remain unchanged.
- Inputs must retain visible focus treatment and must not be obscured by decorative layers.
- If the hero image cannot load, the page must still present a readable light background and a usable login card.

## Verification

- Confirm the login form loads without console errors from a local server and from the offline entry path.
- Confirm existing valid and invalid login flows still behave as before.
- Confirm pressing Enter submits through the existing login path.
- Confirm the password-visibility control changes only the input type and preserves the entered value.
- Confirm the ILC logo crop is centered vertically and uses the approved slight right offset.
- Visually check desktop at approximately 1280 × 720 and 1920 × 1080.
- Visually check narrow layouts at 768 pixels and 360 pixels wide.
- Confirm there is no horizontal overflow, clipped text, or overlap between the title, instruments, and login card.
- Confirm all referenced assets are local and available to the offline build.

## Out of Scope

- Authentication redesign or credential policy changes
- Password reset and account registration
- New backend or network services
- Changes to post-login pages
- Replacing the approved hero photograph
