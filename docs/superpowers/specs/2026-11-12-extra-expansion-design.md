# EXTRA.md expansion design

The user's `EXTRA.md` is the feature brief. Extend the current single-user OpenCanva editor rather than replacing its editor or document model. Its examples and old paths describe desired behavior, not the current architecture: panels live in `components/sidebar/`, toolbars in `components/toolbar/`, and canvas operations in `lib/canvas/`.

## Product behavior

- Graphics: keep the existing local library, add useful Iconify category chips, responsive search and paginated discovery. Placing an icon creates a local editable SVG asset; failed or unlicensed responses should be explained, not inserted as broken objects.
- Motion: expand entrance and loop presets with speed, direction and delay controls. The same deterministic timeline must drive hover preview, page preview, presentation and video export. Static exports show the designed final state.
- Text: provide at least 25 distinct designed combinations with bundled fonts and editable layers. Expand effects with lift, splice, glitch and background while preserving color, serialization, undo, reload and export.
- Layout: provide at least 24 working photo layouts and 35 usable frames. All cells accept the existing image drop flow; gap and corner controls remain editable where supported. Geometry should be pure and unit tested.
- Photos: extend image adjustments with meaningful grades and controls; sticker outline must follow transparency rather than a rectangular bounding box. Changes remain reversible and survive reload/export.
- Drawing: add marker, glow and calligraphy plus width/opacity/color controls and Shift line assist. Strokes remain editable canvas objects or at least persist and export correctly.
- Data: add stacked/area/radar/gauge chart types, keep the editable data table, and add table styles and row/column controls. Existing charts/documents must migrate without visual change.

## Shared constraints

- Preserve old page JSON and existing projects. Optional fields and defaults are preferred; schema changes need migrations/tests.
- Every new panel option must have a real canvas effect, persistence, undo/redo, reload and export where applicable; no decorative placeholders.
- Use locally bundled fonts and existing Fabric/Next/Prisma stack. Network content is fetched through server routes and saved as local assets when placed.
- Keep Czech UI copy and keyboard access. Validate SVG inputs and do not introduce secrets into the client or repository.
- No user data or existing projects are deleted or reset. The deployed app stays on its current Docker volumes.

## Acceptance

Pure geometry/timeline/effect functions have unit coverage. Browser scenarios exercise a representative item in every major new panel, plus save/reload/undo/export for the hardest new data types. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and targeted Playwright tests pass before integration. Existing data loads after database migrations and the running Docker app answers HTTP 200 after deployment.
