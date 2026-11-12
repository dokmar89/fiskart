# EXTRA.md Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the working graphics, motion, typography, layout, image, drawing and data extensions requested in `EXTRA.md`.

**Architecture:** Extend existing sidebar and toolbar modules. Use pure libraries for geometry, timeline and pixel transforms; adapt current canvas operations for placement. Keep document serialization backward compatible and make page preview/export use the same render data.

**Tech Stack:** Next.js 15, React 19, Fabric.js, Prisma, Vitest, Playwright, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-12-extra-expansion-design.md`

## Global Constraints

- Czech labels; all options functional, no placeholder entries.
- Old project documents load without visual change.
- All locally created objects work with save, reload, undo and export.
- Do not commit `.env`, generated user data or local database assets.

## Review Focus

- Invalid or rate-limited Iconify responses: show an error and preserve editor state.
- Existing saved pages: optional new fields default to current behavior.
- Slow browser/large artboard: animations and filters avoid unbounded per-frame allocations.
- Mixed objects and empty text: effects are reversible and do not corrupt existing styles.
- Nonsquare and tiny grids/frames: geometry stays finite, visible and clipped.

---

### Task 1: Iconify discovery and local SVG placement

**Files:** `components/sidebar/graphics-panel.tsx`, `lib/server/stock.ts`, `app/api/stock/icons/route.ts`, `lib/canvas/stock.ts`, focused tests.

- [ ] Write failing tests for category query, pagination, bad API data and recolorable local placement.
- [ ] Implement the server request/response contract and UI chips with load-more or infinite scroll.
- [ ] Prove click/drag placement, save/reload and color edit in browser.

### Task 2: Motion presets and continuous loops

**Files:** `lib/animation.ts`, `lib/canvas/player.ts`, `components/toolbar/animate-tools.tsx`, `components/sidebar/page-timing.tsx`, `components/editor/presentation.tsx`, focused tests.

- [ ] Write failing timeline tests for new entrances, loops, delays and edge times.
- [ ] Add controls and preview using one deterministic timeline for page and element.
- [ ] Verify persistence, undo, presentation and video export on a representative loop and entrance.

### Task 3: Typography combinations and effects

**Files:** `lib/canvas/text-combos.ts`, `lib/text-effects.ts`, `lib/canvas/effects.ts`, `components/sidebar/text-panel.tsx`, `components/toolbar/text-effects.tsx`, focused tests.

- [ ] Write failing tests for 25 distinct combinations and every new text effect.
- [ ] Implement real editable compositions and effect rendering with bundled fonts.
- [ ] Verify selection, undo, save/reload and export in browser.

### Task 4: Photo grids and frames

**Files:** `lib/photo-grid.ts`, `lib/frames.ts`, `components/sidebar/elements-panel.tsx`, `lib/canvas/frames.ts`, focused tests.

- [ ] Write failing geometry tests for at least 24 layouts and 35 frame paths.
- [ ] Implement layout cards, gap/corner settings and functional image placement.
- [ ] Verify drag/drop, clipping, save/reload and export.

### Task 5: Image grades and sticker outline

**Files:** `lib/image-adjust.ts`, `lib/canvas/*image*`, `components/toolbar/image-tools.tsx`, focused tests.

- [ ] Write failing tests for all new grading controls/presets and transparent-boundary outline.
- [ ] Implement renderer and controls with reversible data changes.
- [ ] Verify transparent PNG, reload, undo and export.

### Task 6: Drawing tools

**Files:** `lib/canvas/draw.ts`, `components/sidebar/draw-panel.tsx`, focused tests.

- [ ] Write failing tests for marker, glow, calligraphy, opacity and Shift line assist.
- [ ] Implement controls and strokes using existing Fabric canvas.
- [ ] Verify save/reload, undo and export.

### Task 7: Charts and tables

**Files:** `lib/chart-math.ts`, `lib/canvas/chart*`, `components/sidebar/chart-panel.tsx`, table modules, focused tests.

- [ ] Write failing tests for new chart kinds and table styles/row-column edits.
- [ ] Implement SVG rendering and UI data editing without breaking old charts.
- [ ] Verify save/reload, undo and export.

### Task 8: Integration and deployment

- [ ] Reconcile shared types/serialization and remove duplicate logic.
- [ ] Run typecheck, lint, unit tests, build and targeted browser tests; fix failures.
- [ ] Inspect representative screenshots and correct visible issues.
- [ ] Commit feature branch, integrate into the original checkout and rebuild the Docker app on its existing volumes.
