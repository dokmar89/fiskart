# OpenCanva Special Mission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the dashboard navigation and content library described in `SPECIAL_MISSION.md`, integrated with the current offline-capable editor.

**Architecture:** Keep `/design/[id]`, project APIs, Fabric serialization and idempotent seeding. Add one preset source and a dashboard client shell; expand the existing font, graphics, frame and template generators. Store print geometry at 96 DPI and use editable local frames as image placeholders.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4, Fabric 6, Prisma/PostgreSQL, Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-special-mission-design.md` and its `dashboard-reference.png`.

## Global Constraints

- User-facing text is Czech, with correct diacritics.
- Keep existing `POST /api/projects` and `/design/[id]` for card creation.
- All geometry is stored in pixels at 96 DPI; project units may be px, mm, cm or in after the unit migration.
- Built-in template content and fonts must render offline; no `source.unsplash.com` dependency.
- Preserve saved user templates and existing projects when reseeding.
- Dashboard follows the supplied dark reference and remains usable in light mode and on narrow screens.

## Review Focus

- A4 and A2 presets should export at the expected physical size at 300 DPI, without storing 300 DPI pixels as 96 DPI geometry (Task 1 test).
- A preset with an ID not in the catalog must never create a design (Task 2 test).
- A corrupt, oversized or unsupported upload must not leave a blank project or orphaned asset (Task 3 test).
- A generated template's empty frame must accept an image and survive save, reload and undo (Task 6 test).
- A font picker preview must display Czech accented characters without a runtime third-party request (Task 4 browser test).

---

### Task 1: Units and preset catalog

**Files:** Create `constants/presets.ts`, `constants/presets.test.ts`; modify `lib/presets.ts`, `lib/units.ts`, `lib/units.test.ts`, `prisma/schema.prisma`; add a Prisma migration.

**Interfaces:** `DesignPreset` has `id`, `name`, `category`, optional `subCategory`, `width`, `height`, `unit: "px" | "mm"`, `icon`, optional `badge`; `DESIGN_PRESETS` contains at least 40 unique IDs. `findDesignPreset(id)` returns the matching entry or undefined. `lib/presets.ts` reexports the shared data and size limits.

- [ ] Write failing tests for the specified social/print/education dimensions, at least 40 entries, unique IDs, A4 96 DPI conversion and cm round-trip.
- [ ] Run the focused tests and confirm expected failures.
- [ ] Implement the catalog, cm conversion and migration; preserve the five existing IDs.
- [ ] Run focused tests and full unit suite; commit `feat: expand design presets and units`.

### Task 2: Dashboard navigation and format creation

**Files:** Create `components/dashboard/CategoryNavbar.tsx`, `DashboardSidebar.tsx`, `SubcategoryPills.tsx`, `FormatGrid.tsx`, `DashboardExplore.tsx`; modify `app/page.tsx`, `components/dashboard/new-design-dialog.tsx`; create `e2e/dashboard.spec.ts`.

**Interfaces:** `DashboardExplore` consumes `DesignPreset[]` and owns the shared selected category/platform state. `FormatGrid` receives filtered presets and an `onPick(preset)` callback. Picking validates a catalog ID, posts `{width,height,unit}` and opens `/design/[id]`.

- [ ] Write a browser test for category/sidebar synchronization, social pills, card dimensions, custom cm size and keyboard focus.
- [ ] Run it and confirm the dashboard behavior is missing.
- [ ] Implement the four reference surfaces and project creation, keeping existing projects and template gallery visible.
- [ ] Verify dark/light, desktop/narrow layout and browser test; commit `feat: add category dashboard`.

### Task 3: Create a design from an upload

**Files:** Create `app/api/projects/from-upload/route.ts`, `components/dashboard/DashboardUpload.tsx`; modify `components/dashboard/DashboardExplore.tsx`; extend `e2e/dashboard.spec.ts`.

**Interfaces:** `POST /api/projects/from-upload` accepts one multipart image, validates it by bytes, stores it as an Asset and creates a project whose first page contains one Fabric Image referencing the local asset URL. The dashboard supports picker and drop.

- [ ] Write a failing browser test for an uploaded PNG opening as a placed image, and a rejected unsupported file leaving project count unchanged.
- [ ] Run the focused test to see the missing behavior.
- [ ] Implement the route and UI with rollback on failure, size fitting and a visible error.
- [ ] Run focused and full unit tests; commit `feat: create designs from uploads`.

### Task 4: Font catalog and Czech previews

**Files:** Create `constants/fonts.ts`, `constants/fonts.test.ts`; modify `scripts/generate-fonts.ts`, `components/toolbar/font-picker.tsx`, generated `lib/font-catalog.json`, `components/editor/font-faces.ts`, `package.json`, `pnpm-lock.yaml`; extend `e2e/text.spec.ts`.

**Interfaces:** `FONT_FAMILIES` is the curated package ID list grouped in five categories. The generator rejects packages missing `latin-ext` and writes the current catalog and on-demand face imports.

- [ ] Write failing catalog tests for the named missing families, eight or more in every category and `latin-ext` metadata.
- [ ] Run the focused test to confirm the missing families.
- [ ] Add packages, regenerate faces and show a Czech sample in the font picker while keeping current search and custom fonts.
- [ ] Check browser glyphs and no Google request; run unit/type/lint checks; commit `feat: expand font catalog`.

### Task 5: Vector elements and frames

**Files:** Create `constants/elements.ts`, `constants/elements.test.ts`; modify `scripts/generate-graphics.ts`, `lib/frames.ts`, `lib/frames.test.ts`, `components/sidebar/elements-panel.tsx`, generated `public/graphics/*.svg` and `lib/graphics-catalog.json`; extend `e2e/graphics.spec.ts`.

**Interfaces:** Curated element groups reference generated SVG IDs; `framePath` supports the new phone, laptop, torn and postage masks. The existing graphics panel places all new graphics through `placeStock`.

- [ ] Write failing tests for ten blobs, social icons, badge IDs and valid frame outlines.
- [ ] Run focused tests to confirm what is missing.
- [ ] Add deterministic original SVGs and frame geometry, regenerate the catalog and expose them in panels.
- [ ] Verify placing, recoloring and filling a new frame in the browser; commit `feat: expand vector elements`.

### Task 6: Generated template library

**Files:** Modify `prisma/templates/build.ts`, `prisma/templates/catalog.ts`, `prisma/seed.ts`, `lib/templates.ts`; create `prisma/templates/generated.ts`, `prisma/templates/generated.test.ts`, `scripts/generate-templates.ts`; extend `e2e/templates.spec.ts`.

**Interfaces:** `PageBuilder.frame(name, {x,y,w,h,shape})` emits an editable empty frame. `generateTemplates()` returns 40 deterministic templates: 20 named concepts, two distinct treatments each, with unique slugs, layered backgrounds, decorative elements, Czech text and at least one frame. `BUILT_IN_TEMPLATES` contains at least 55 total, and the existing seed remains idempotent.

- [ ] Write failing tests for counts, unique stable slugs, required themes, backgrounds, text roles and replaceable frame JSON.
- [ ] Run focused tests to confirm the missing generator.
- [ ] Implement the frame builder and 20 concept descriptions with two varied layout treatments; include categories in gallery ordering and a validation CLI.
- [ ] Run seed against the isolated test database twice and verify the second run is unchanged. Verify template application, frame fill, undo, save and reload in the browser; commit `feat: generate rich templates`.

### Task 7: Integration and visual review

**Files:** Modify `PLAN.md`, `README.md` and any implementation files needed to resolve discovered defects.

- [ ] Review dashboard against `dashboard-reference.png`, including focus, contrast, card grid and social filters; inspect representative template thumbnails.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and targeted Playwright tests; fix failures and rerun their exact checks.
- [ ] Check Git diff for accidental generated files, secrets and unrelated edits. Record outcomes and remaining limits in Phase 20 of `PLAN.md`.
- [ ] Commit `docs: record special mission verification`, integrate the tested branch into the original checkout and confirm its clean status.
