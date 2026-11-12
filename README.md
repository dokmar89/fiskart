# FiskART

A self-hosted, single-user design editor in the style of Canva: multi-page designs, templates,
brand kit, uploads, stock photos and icons, text effects, frames, background removal, resize and
export to PNG, JPEG, PDF and SVG. It runs on your own server with Docker Compose.

The dashboard includes 65 ready-made sizes, a direct image-upload flow and a categorized format
catalog. The editor ships with 1,255 editable built-in templates across 10 categories (the original
55 plus 1,200 generated compositions), 70 locally bundled font families with Czech glyph coverage
and 130 local graphics. It also offers Iconify search, 25 photo grids, 39 frames,
eight chart types, four table styles and four vector drawing brushes. See [the plan review](docs/PLAN_RESUME.md) for what is
implemented and what remains before a shared or public deployment.

There is no login. Anyone who can reach the app can see and change everything, so keep it on a
private network: a VPN, or a reverse proxy that asks for a password. By default it only listens on
the server itself (`127.0.0.1:3000`).

## Running it

Requirements: Docker with Compose v2, and internet access while building (packages, fonts and the
background removal model are downloaded then; the running app needs none, except for the stock
Photos and Graphics tabs).

```sh
git clone https://github.com/dokmar89/fiskart.git
cd fiskart
cp .env.example .env        # optional: set a database password, the Pexels key, the port
docker compose up -d --build
```

Open http://localhost:3000 (or the address you chose). The first start applies the database
migrations and adds the built-in templates; this happens again, harmlessly, on every start.

Stop with `docker compose down`. Designs, uploads and fonts are kept in two Docker volumes and
come back with the next `docker compose up -d`. `docker compose down -v` deletes them.

## Settings

Set these in `.env` next to `docker-compose.yml` (Compose reads it), then `docker compose up -d`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_BIND` | `127.0.0.1:3000` | Address and port the app is published on. `0.0.0.0:3000` makes it reachable from other machines; only do that behind a VPN or an authenticating proxy. |
| `POSTGRES_PASSWORD` | `opencanva` | Database password. Set it before the first start; changing it later needs the same change inside Postgres. |
| `PEXELS_API_KEY` | empty | Free key from https://www.pexels.com/api/ for the Photos tab. Without it the tab explains what to set. The key stays on the server. |
| `ANTHROPIC_API_KEY` | empty | Key for the AI tab's writing and rewriting (Claude). `ANTHROPIC_MODEL` picks the model (default `claude-opus-5-5`). |
| `OPENAI_API_KEY` | empty | Key for generating and editing pictures in the AI tab, with an OpenAI-compatible image API; `OPENAI_BASE_URL` and `OPENAI_IMAGE_MODEL` (default `gpt-image-1`) point it elsewhere. |
| `DB_BIND` | `127.0.0.1:5432` | Where Postgres is published on the host (for development and backups). |

Inside the container the app uses `DATABASE_URL` (set by Compose) and `DATA_DIR=/data`, the
`appdata` volume holding uploaded images, fonts and thumbnails.

Data leaves the server only when you use the Photos tab (searches go to Pexels), the Graphics
tab (searches go to Iconify) or the AI tab (prompts, the texts you rewrite and the pictures you
edit go to the providers you set up). Pages, uploads and exports stay on the server and in your
browser.

## Backup

A backup is the database plus the data volume, taken together.

```sh
# Database (a plain SQL dump)
docker compose exec -T db pg_dump -U opencanva -d opencanva --clean --if-exists > fiskart-db.sql

# Uploaded files
docker run --rm -v opencanva_appdata:/data -v "$PWD":/backup alpine \
  tar czf /backup/fiskart-data.tgz -C /data .
```

Restore into a fresh install (after `docker compose up -d --build` once):

```sh
docker compose stop app
docker compose exec -T db psql -U opencanva -d opencanva < fiskart-db.sql
docker run --rm -v opencanva_appdata:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/fiskart-data.tgz -C /data"
docker compose start app
```

The Compose project, database account and volume names still use the internal identifier
`opencanva` so existing FiskART installations keep their designs, uploads and thumbnails after
the product rename. `docker volume ls` lists the volumes.

## Upgrading

```sh
git pull
docker compose up -d --build
```

Migrations run when the new container starts. Take a backup first if the update is large. To go
back, check out the previous version, rebuild, and restore the backup taken before the upgrade
(migrations are not undone automatically).

## Development

```sh
pnpm install
cp .env.example .env
docker compose up -d db          # Postgres only
pnpm db:migrate && pnpm db:seed
pnpm bg-removal:fetch            # once: the background removal model, into public/bg-removal
pnpm dev                         # http://localhost:3000
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest) and `pnpm e2e` (Playwright; run
`pnpm exec playwright install chromium` once). A running install can be smoke-tested with
`SMOKE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c e2e-docker/playwright.config.ts`
(it adds a design called "Smoke"). `CLAUDE.md` describes the architecture and
`PLAN.md` the phases.

The preset catalog is in `constants/presets.ts`. To validate the generated catalogs, run
`pnpm fonts:generate`, `pnpm graphics:generate` and `pnpm templates:validate`.

### Importing editable template packs

Create a UTF-8 JSON manifest with `version: 1`, a lowercase hyphenated `packId`, and a nonempty
`templates` array. Each template needs a lowercase hyphenated `slug`, `title`, `category`, pixel
`width` and `height`, `unit` (`px`, `mm`, `cm` or `in`), string `tags`, and one or more `pages` in
the same editable `canvasData` format returned by the template API. A pack slug becomes
`pack-<packId>-<slug>` in the database.

```sh
pnpm templates:import ./my-template-pack.json
```

The command validates the complete manifest before writing. Reimporting unchanged content keeps
existing IDs and thumbnails; changed content updates the same template and invalidates its
thumbnail. Built-in seeding leaves imported packs and templates saved in the editor alone. Run
the import where `DATABASE_URL` points to the intended database, and back up that database first.

After seeding or importing, start the application and run `pnpm templates:previews` to persist
missing PNG thumbnails through the same Fabric renderer as the gallery. Set `TEMPLATE_BASE_URL`
if the app is not on `http://127.0.0.1:3000`. The command is safe to repeat after interruption;
`TEMPLATE_PREVIEW_MAX_PAGES=1` limits a trial run to the first catalog page.

## Licences

Background removal uses `@imgly/background-removal`, which is AGPL-licensed: fine for private use,
and the reason this project is not offered as a hosted service. Stock photos come from Pexels under
the Pexels licence; Iconify icon sets each have their own licence, shown when you hover an icon.
