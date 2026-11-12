import "dotenv/config";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";
import { BUILT_IN_TEMPLATES } from "./templates/catalog";

/** JSON with object keys sorted, so stored JSONB (which reorders keys) compares equal to fresh data. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function removeDataFile(path: string | null) {
  if (!path) return;
  const root = resolve(process.env.DATA_DIR ?? "./data");
  const full = resolve(join(root, path));
  if (full.startsWith(root)) await rm(full, { force: true });
}

/**
 * Adds or updates the built-in templates. Idempotent: an unchanged template is left alone, a
 * changed one is updated in place (and its thumbnail dropped, so the gallery renders a new one), and
 * built-in templates no longer in the list are removed. Saved templates are never touched.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const counts = { added: 0, updated: 0, unchanged: 0, removed: 0 };
  try {
    const slugs = BUILT_IN_TEMPLATES.map((template) => template.slug);
    const existingRows = await db.template.findMany({ where: { slug: { in: slugs } } });
    const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));
    const toCreate: Prisma.TemplateCreateManyInput[] = [];
    for (const t of BUILT_IN_TEMPLATES) {
      const data = { title: t.title, category: t.category, width: t.width, height: t.height, unit: t.unit, tags: t.tags, pages: t.pages as unknown as Prisma.InputJsonValue, isBuiltIn: true };
      const existing = existingBySlug.get(t.slug);
      if (!existing) {
        toCreate.push({ slug: t.slug, ...data });
        continue;
      }
      const { pages: storedPages, ...stored } = existing;
      const same =
        canonical(storedPages) === canonical(t.pages) &&
        canonical({ title: stored.title, category: stored.category, width: stored.width, height: stored.height, unit: stored.unit, tags: stored.tags, isBuiltIn: stored.isBuiltIn }) ===
          canonical({ title: t.title, category: t.category, width: t.width, height: t.height, unit: t.unit, tags: t.tags, isBuiltIn: true });
      if (same) {
        counts.unchanged++;
        continue;
      }
      await db.template.update({ where: { id: existing.id }, data: { ...data, thumbnailPath: null } });
      await removeDataFile(existing.thumbnailPath);
      counts.updated++;
    }
    // PostgreSQL can insert many independent built-ins in one round trip. Keep batches bounded
    // because each row contains the full editable page JSON.
    for (let i = 0; i < toCreate.length; i += 100) {
      const result = await db.template.createMany({ data: toCreate.slice(i, i + 100), skipDuplicates: true });
      counts.added += result.count;
    }
    const stale = await db.template.findMany({
      where: { isBuiltIn: true, OR: [{ slug: null }, { slug: { notIn: BUILT_IN_TEMPLATES.map((t) => t.slug) } }] },
      select: { id: true, slug: true, thumbnailPath: true },
    });
    for (const t of stale) {
      // Imported packs have their own stable namespace and are managed by templates:import.
      if (t.slug?.startsWith("pack-")) continue;
      await db.template.delete({ where: { id: t.id } });
      await removeDataFile(t.thumbnailPath);
      counts.removed++;
    }
    console.log(`Seed: templates ${counts.added} added, ${counts.updated} updated, ${counts.unchanged} unchanged, ${counts.removed} removed.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
