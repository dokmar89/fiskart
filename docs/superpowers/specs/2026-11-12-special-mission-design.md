# OpenCanva content expansion design

## Intent

Make the private, self-hosted OpenCanva useful from its first screen: a person should find a format, create the correctly sized design, choose a polished starting template, and add fonts or graphics without hunting through a sparse catalog. This implements `SPECIAL_MISSION.md` as the next phase of the existing editor.

## Current system and constraints

- The dashboard is a server component in `app/page.tsx`; project creation is `POST /api/projects` followed by `/design/[id]`. The editor and its template sidebar already work.
- `lib/presets.ts` has five formats. `lib/fonts.ts` has 60 locally bundled Google Fonts families, loaded on demand by CSS and `document.fonts`; the monospace group has four. `lib/graphics.ts` exposes 113 locally bundled vector graphics. There are 15 deterministic built-in templates, seeded idempotently.
- Project geometry is stored in pixels at 96 DPI. A4 is stored as 210 × 297 mm converted to those pixels, and exporting at 300 DPI produces about 2480 × 3508 pixels. Print presets must keep this rule.
- Designs and bundled templates must work offline after installation. `source.unsplash.com` was sunset by Unsplash in 2024; its category URLs cannot be reliable template sources. Built-in image placeholders will therefore be editable local frames. A user may insert a Pexels or uploaded photo into them.
- The user supplied a composite screenshot, kept as `dashboard-reference.png` beside this document. It shows a near-black page, a dark horizontal navigation bar of compact colorful icons, a slim slate sidebar with a purple active capsule, charcoal format cards with bright icon previews, and outlined social-platform pills with the selected pill filled purple. The image stacks separate views, so the pieces are composed into one usable responsive screen rather than reproducing its large blank regions.

## Approaches

1. **Extend existing catalogs and routes (chosen).** Keep project creation, Fabric serialization, local font loading, graphics generation and template seeding. Add a dashboard client layer and new catalog data. This preserves offline behavior and the existing export tests.
2. Replace the dashboard and template system with a parallel `/editor?preset=` flow and remote image/font URLs. That would duplicate project creation, make templates depend on network services and create two sources of truth.

The user explicitly asked to start detailed work after the disk cleanup. I am proceeding with the first approach and documenting implementation decisions here.

## Product behavior

### Dashboard and formats

- A horizontal, scrollable category bar and a vertical sidebar share one active category. Both have the Czech labels in the mission. The active sidebar item uses an indigo capsule and visible focus state. A horizontal pill row filters social formats by platform.
- The main area shows format cards with a vivid graphic preview, name and exact displayed size. Clicking one posts its internal pixel dimensions and unit to the existing project API, then opens `/design/[id]`. This is the existing working editor route; no separate editor is introduced.
- The data source is `constants/presets.ts` with at least 40 entries and stable IDs. It includes social, video, print, presentation, education, document, web, email, photo, code and planning formats. A print entry stores physical mm dimensions at 96 DPI, while the UI indicates its 300 DPI export size where useful. Unsupported concepts such as an actually infinite canvas are labeled as large finite boards rather than promised as an infinite feature.
- Custom size accepts px, mm, cm and in. `cm` is a real project unit, added to the shared conversion code and Prisma enum. Existing projects keep their units unchanged.
- Upload accepts PNG, JPEG, WebP and SVG from a picker or dashboard drop zone, creates a design fitted to the image and places the asset on its first page. Unsupported files get a clear error.
- Existing designs and the template gallery remain visible on the dashboard. Both light and dark themes work, with the mission's dark surfaces in dark mode.

### Templates

- Extend the existing `PageBuilder` with a serialized empty frame, which the editor can fill using its current image drop behavior. No remote URL is stored in built-in template JSON.
- Add at least 40 generated templates to the existing 15, giving 55 or more total. The generator uses explicit concepts and several distinct layouts and palettes, with backgrounds, headline/subtitle/CTA, decorative details and replaceable image frames. It includes the mission's sale, podcast, quote, property, fitness, gaming, code, finance, webinar, hiring, education and pitch topics.
- Keep stable slugs and IDs. The current seed updates changed built-ins, leaves unchanged ones alone and never touches saved user templates. The existing dashboard and editor galleries show the expanded catalog with search and categories.

### Fonts and vector elements

- Keep bundled, on-demand Fontsource loading, which already satisfies the 45-family target while keeping editing offline. Add the explicitly requested missing families and at least four monospace families, so every category has at least eight. The generator verifies that each package exposes `latin-ext`; Czech diacritics are checked in the browser.
- Extend the existing deterministic vector generator and frame shapes. Add local social icons, four more blobs, badges and mockup-style frames/masks where missing. Present them through the current graphics and elements panels rather than a duplicate catalog. `constants/elements.ts` holds the curated grouping/ID manifest for the new dashboard and panel organization.

## Quality and review focus

- Stable IDs and no duplicate preset dimensions accidentally assigned to the wrong platform.
- Unit conversion for A4 and cm, including export dimensions.
- Upload validation, failure cleanup and image scaling for very large or very small inputs.
- Template loading, thumbnail rendering, frame replacement and undo after applying a generated template.
- Font glyph coverage and local loading with no runtime Google request.
- Dashboard navigation by mouse and keyboard, both themes and narrow dashboard widths.

Use test-first development for new behavior. Run typecheck, lint, unit tests, a production build and targeted browser tests. Review representative templates and the dashboard visually before integration.
