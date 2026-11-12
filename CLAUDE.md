\# FiskART



A self-hosted, single-user design editor in the style of Canva, for the owner's private use. It runs on the owner's own server via Docker Compose. There is one user and no public access, so there is no auth, no multi-tenancy, and no billing in the app; access control is handled outside it (VPN or reverse proxy).



The work is organised in phases in `PLAN.md`. That file is the source of truth for what is done and what comes next.



\## How to work in this repo



At the start of a session, read `PLAN.md` and continue with the first phase that has unchecked items. Work on one phase at a time. Create and edit files yourself; do not walk the owner through doing it by hand.



A phase is finished when all of the following hold:



1\. Every acceptance criterion of the phase in `PLAN.md` is met and you have checked it yourself (by test, or by running the app and trying it).

2\. `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.

3\. The items are ticked in `PLAN.md`, and anything you decided or deferred is written under the phase's "Notes".

4\. The work is committed with a message naming the phase.



Then stop and report in a few sentences: what works, what you verified and how, and anything the owner should try or decide. Do not start the next phase until asked. The owner reviews each phase, and a small working editor is worth more than a wide one full of stubs: do not add buttons, tabs or menu items for features from later phases.



If something in the plan turns out to be wrong or much harder than it looks, say so and propose a change to `PLAN.md` instead of quietly building a weaker version.



\## Stack (decided, do not swap)



\- Next.js 15, App Router, React 19, TypeScript strict

\- Fabric.js v6 as the canvas engine

\- Tailwind CSS v4, shadcn/ui, Lucide icons

\- Zustand for UI state

\- Prisma with PostgreSQL 16 (in Docker Compose)

\- Files on local disk under `DATA\_DIR` (a Docker volume), served through a route handler

\- pnpm, Vitest for unit tests, Playwright for end-to-end tests



\## Commands



Keep this list accurate; update it when scripts change.



```

docker compose up -d db     # Postgres for development

pnpm dev                    # app on http://localhost:3000

pnpm typecheck              # tsc --noEmit

pnpm lint

pnpm test                   # Vitest

pnpm e2e                    # Playwright; own server on :3100, own <db>_test database and ./data-e2e

pnpm exec playwright install chromium  # once, before the first e2e run

pnpm db:migrate             # prisma migrate dev

pnpm db:seed                # templates

pnpm stress-doc [url]          # adds a 200-object design to a running app, for checking drag speed

pnpm fonts:generate            # rewrites the font catalog and face imports after editing scripts/generate-fonts.ts

pnpm bg-removal:fetch          # downloads the background removal model into public/bg-removal (once; needed before using it)

pnpm graphics:generate         # redraws the bundled graphics library (public/graphics, lib/graphics-catalog.json)

docker compose up -d --build  # full production stack

```



\## Architecture rules



\*\*Where state lives.\*\* The Fabric canvas owns the objects on the current page. Zustand holds UI state only (active tool, zoom, open panel, current page id, save status) plus a small read-only snapshot of the current selection's properties, refreshed from Fabric events, which the toolbar renders from. Toolbar actions call functions in `lib/canvas/` that change Fabric objects; they never edit a copy of the objects in the store. Two copies of the object tree drift apart, which is why there is only one.



\*\*Serialization.\*\* A page is stored as Fabric JSON plus a `schemaVersion` number. Custom properties every object carries (`id`, `name`, `locked`, `role`) are listed once in `lib/canvas/serialize.ts` and passed to every `toObject` / `toJSON` call, because Fabric drops unknown properties otherwise. This also applies to `selectable`, `evented` and the lock flags. All saving, loading, history and template code goes through that one module.



\*\*Images are references.\*\* An image object stores the URL of an uploaded asset, never a data URL. Base64 in page JSON makes saves, history snapshots and templates enormous.



\*\*Undo/redo.\*\* A per-page stack of serialized snapshots, capped at 50, pushed after a change settles (debounced, and once at the end of a drag rather than on every move event). Loading a snapshot must not push a new one.



\*\*Saving.\*\* Autosave about two seconds after the last change, and on page switch and tab close. The status indicator shows saving, saved, or failed with a retry. Saves and uploads go through route handlers (`app/api/...`), not Server Actions, because Server Actions cap the request body at 1 MB by default.



\*\*Units.\*\* All geometry is stored in pixels at 96 DPI. A project's `unit` (px, mm, in) only affects how sizes are displayed and entered. Export scales by `targetDpi / 96`.



\*\*Editor is client-only.\*\* Fabric needs the DOM. The editor is loaded with `next/dynamic` and `ssr: false`; nothing under `lib/canvas/` may be imported from a server component.



\*\*Layout of the code.\*\*



```

app/                  routes, api route handlers

components/editor/    canvas viewport, page strip, status bar

components/toolbar/   contextual toolbar views

components/sidebar/   rail and panels

lib/canvas/           all Fabric code: setup, serialize, history, snapping, export, resize

lib/store/            Zustand stores

lib/server/           Prisma client, file storage

prisma/               schema, migrations, seed

```



Pure logic (resize maths, snapping maths, unit conversion, history stack) lives in plain functions without Fabric or React imports so it can be unit tested.



\## Known traps



\- \*\*Fabric v6 is not v5.\*\* Most examples online are v5. v6 uses named imports (`import { Canvas, Rect } from 'fabric'`), promises instead of callbacks (`await canvas.loadFromJSON(json)`), and renamed or moved APIs. Check the installed version's types and docs before using an API from memory.

\- \*\*Fonts must be loaded before text is drawn.\*\* Fabric measures text with whatever font is available at that moment. Await `document.fonts.load(...)` for every family used on a page before loading its JSON, and before export.

\- \*\*Background removal assets.\*\* `@imgly/background-removal` downloads its model and WASM files from a CDN unless told otherwise. Copy them into `public/` and point the library there (see its README for the option name), so the feature works without internet. The library is AGPL, which is fine for private use and is the reason this project is not to be published as a hosted service.

\- \*\*Export size.\*\* A 300 DPI A4 page is about 2480 × 3508 px. Export one page at a time and release the data between pages, or the tab runs out of memory on long documents.

\- \*\*PDF is raster.\*\* PDF export places a rendered image of each page into the PDF. There is no CMYK and no live text. This is a deliberate limit, not a bug to fix.



\## Out of scope



Do not build these unless `PLAN.md` is changed: audio other than the sound of video clips, real-time collaboration, comments, CMYK or vector PDF, user accounts, a phone-sized editor (the editor targets screens 1024 px wide and up; the project dashboard should work on any size).



\## Style



\- UI follows shadcn defaults with a zinc palette, light and dark mode. Quiet and dense, like a tool.

\- Keyboard shortcuts work with both Cmd (macOS) and Ctrl (others).

\- No `any`. No commented-out code. Comments explain why, where the reason is not obvious.

\- User-facing text is in Czech (the owner asked for it; there is no language switch). Use the terms already in the UI, and `plural()` from `lib/plural.ts` for counts. Code, comments and prompts sent to AI models stay in English.

