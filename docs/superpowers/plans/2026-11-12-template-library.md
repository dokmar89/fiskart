# Template Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Přidat nejméně 1 200 editovatelných šablon a udržet katalog rychlý při tisících položek.

**Architecture:** Deterministický generátor vrátí šablony ve stávajícím formátu `BuiltInTemplate`. Nový katalogový dotaz vrací stránky metadat bez načtení všech `pages` do klienta; dashboard a editor používají stejnou stránkovanou galerii. Import a předvýroba náhledů jsou samostatné opakovatelné příkazy.

**Tech Stack:** Next.js 15, React 19, Prisma 7/PostgreSQL, Fabric 6, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-template-library.md`

## Global Constraints

- Zachovat dosavadních 55 vestavěných šablon a všechny uživatelské návrhy.
- Nová sada používá lokální písma, editovatelné objekty a vlastní tvary.
- Uživatel vidí nejvýše 24 karet na stránce katalogu.
- Vstup importu se validuje celý před zápisem.

## Review Focus

- Hledání „životopis“ a „zivotopis“ vrací stejné relevantní výsledky.
- Při změně kategorie na pozdější stránce se stránkování vrátí na začátek.
- Při chybě načtení galerie zůstane viditelná srozumitelná zpráva a opakování.
- Seed/import nesmaže uživatelské šablony a opakování nevytvoří duplicity.
- Náhled po změně obsahu šablony ukazuje novou verzi; přerušená předvýroba pokračuje.

---

### Task 1: Editovatelná knihovna

**Files:** Create `prisma/templates/library.ts`, tests `prisma/templates/library.test.ts`; modify `prisma/templates/catalog.ts`, `scripts/generate-templates.ts`.

**Interfaces:** `generateLibraryTemplates(): BuiltInTemplate[]` vrací nejméně 1 200 stabilně seřazených šablon. Používá `PageBuilder` a žádné síťové obrázky.

- [ ] Napsat test počtu, jedinečných slugů, 10 kategorií, 40 odlišných kompozic v každé kategorii, tří variant a platných editovatelných stránek.
- [ ] Ověřit selhání testu bez nové knihovny.
- [ ] Implementovat kompozice, kategoriální obsah a varianty; připojit ke katalogu.
- [ ] Spustit test a `pnpm templates:validate`; opravit nalezené kolize nebo neplatné stránky.
- [ ] Commitnout oddělený obsahový krok.

### Task 2: Stránkovaný katalog

**Files:** Create `app/api/templates/catalog/route.ts`, `lib/server/template-catalog.ts`, tests; modify `app/page.tsx`, `components/dashboard/dashboard-templates.tsx`, `components/sidebar/design-panel.tsx`, `components/templates/template-gallery.tsx`, `lib/store/templates.ts`.

**Interfaces:** `GET /api/templates/catalog?query=&category=&page=` → `{items: TemplateSummary[], total: number, page: number, pageSize: 24, categories: string[]}`. Metadatový dotaz nevytahuje JSON `pages` pro celý katalog.

- [ ] Napsat test stránkování, hledání s diakritikou, pořadí a prázdných výsledků.
- [ ] Ověřit selhání testu proti původnímu kódu.
- [ ] Implementovat serverový dotaz a sdílenou galerii s ovládáním dalších stránek.
- [ ] Zachovat vytvoření návrhu, vložení šablony do editoru a smazání vlastní šablony; ověřit v prohlížeči.
- [ ] Spustit relevantní testy, lint a typovou kontrolu; commitnout krok.

### Task 3: Import dalších balíků

**Files:** Create `scripts/import-template-pack.ts`, parser `lib/template-pack.ts` a test; modify `package.json`, podle potřeby `prisma/seed.ts`.

**Interfaces:** CLI čte manifest s `slug`, `title`, `category`, `tags`, `width`, `height`, `unit`, `pages`, validuje vše před zápisem a dělá opakovatelný upsert pro vyhrazený prefix.

- [ ] Napsat test chybného manifestu, duplicit a platného balíku; ověřit selhání.
- [ ] Implementovat parser a dávkový import bez mazání ostatních položek.
- [ ] Ověřit dvojí spuštění na izolovaných testovacích datech, včetně zachování uložených šablon.
- [ ] Dopsat krátký návod a commitnout.

### Task 4: Předvýroba náhledů a integrace

**Files:** Create `scripts/precompute-template-thumbnails.ts` a podpůrný test; případně upravit `components/templates/template-thumb.tsx` pro bezchybný fallback.

**Interfaces:** Dávkový příkaz projde vestavěné šablony bez hotového náhledu, využije stávající vykreslení Fabric v Chromiu a uloží PNG přes existující API; lze ho bezpečně spustit opakovaně.

- [ ] Napsat test výběru jen chybějících náhledů a pokračování po přerušení.
- [ ] Implementovat dávkový postup s omezenou velikostí dávky a hlášením průběhu.
- [ ] Naplnit lokální databázi, předvytvořit náhledy a ověřit vzorek každé kategorie v prohlížeči.
- [ ] Spustit testy, lint, typovou kontrolu, build a cílené E2E; commitnout a začlenit do místního `master`.
