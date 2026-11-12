/** Import a validated local JSON pack without removing any other templates. */
import "dotenv/config";
import { readFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";
import { importTemplatePack, parseTemplatePack, type PackTemplate, type StoredPackTemplate } from "../lib/template-pack";
import type { CanvasData } from "../lib/page-data";

async function removeOldThumbnail(relativePath: string | null | undefined) {
  if (!relativePath?.startsWith("thumbnails/templates/")) return;
  const root = resolve(process.env.DATA_DIR ?? "./data");
  const full = resolve(root, relativePath);
  if (full.startsWith(root + sep)) await rm(full, { force: true });
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Použití: pnpm templates:import cesta/k/baliku.json");
  // Parse the entire file before opening the database or writing any row.
  const pack = parseTemplatePack(JSON.parse(await readFile(resolve(path), "utf8")) as unknown);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL není nastaveno");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const counts = await importTemplatePack(pack, {
      findBySlug: async (slug): Promise<StoredPackTemplate | null> => {
        const row = await db.template.findUnique({ where: { slug } });
        if (!row) return null;
        return {
          id: row.id, slug, title: row.title, category: row.category, width: row.width, height: row.height,
          unit: row.unit, tags: row.tags, pages: row.pages as unknown as CanvasData[], isBuiltIn: row.isBuiltIn,
        };
      },
      create: async (template: PackTemplate) => {
        await db.template.create({ data: { ...template, pages: template.pages as unknown as Prisma.InputJsonValue, isBuiltIn: true } });
      },
      update: async (id, template) => {
        const old = await db.template.findUnique({ where: { id }, select: { thumbnailPath: true } });
        await db.template.update({ where: { id }, data: { ...template, pages: template.pages as unknown as Prisma.InputJsonValue, thumbnailPath: null, isBuiltIn: true } });
        await removeOldThumbnail(old?.thumbnailPath);
      },
    });
    console.log(`Balík ${pack.packId}: ${counts.added} přidáno, ${counts.updated} aktualizováno, ${counts.unchanged} beze změny.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
