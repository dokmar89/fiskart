import "server-only";
import { db } from "@/lib/server/db";
import { templateSelect, toSummary } from "@/lib/server/templates";
import { searchTemplates, templateCategories, TEMPLATE_CATEGORIES, type TemplateSummary } from "@/lib/templates";

export const TEMPLATE_CATALOG_PAGE_SIZE = 24;

export type TemplateCatalogPage = {
  items: TemplateSummary[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
};

export type CatalogMetadata = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  width: number;
  height: number;
  isBuiltIn: boolean;
  createdAt: Date;
};

export type CatalogQuery = {
  query?: string;
  category?: string | null;
  page?: number;
  preferredWidth?: number | null;
  preferredHeight?: number | null;
};

const metadataSelect = {
  id: true,
  title: true,
  category: true,
  tags: true,
  width: true,
  height: true,
  isBuiltIn: true,
  createdAt: true,
} as const;

function categoryRank(category: string): number {
  const rank = (TEMPLATE_CATEGORIES as readonly string[]).indexOf(category);
  return rank < 0 ? TEMPLATE_CATEGORIES.length : rank;
}

/** Pure selection step: only metadata is sorted and searched; page JSON is fetched afterwards. */
export function catalogSlice(rows: readonly CatalogMetadata[], options: CatalogQuery): {
  ids: string[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
} {
  const page = Number.isSafeInteger(options.page) && (options.page ?? 0) > 0 ? options.page! : 1;
  const categories = templateCategories([...rows]);
  const category = options.category?.trim() || null;
  const filtered = searchTemplates([...rows], (options.query ?? "").trim(), category);
  const preferred = Number.isFinite(options.preferredWidth) && Number.isFinite(options.preferredHeight) &&
    (options.preferredWidth ?? 0) > 0 && (options.preferredHeight ?? 0) > 0
    ? { width: options.preferredWidth!, height: options.preferredHeight! }
    : null;
  const matchesPreferred = (row: CatalogMetadata) => preferred !== null &&
    Math.abs(row.width - preferred.width) < 0.5 && Math.abs(row.height - preferred.height) < 0.5;
  const sorted = [...filtered].sort((a, b) => {
    if (preferred && matchesPreferred(a) !== matchesPreferred(b)) return matchesPreferred(a) ? -1 : 1;
    if (a.isBuiltIn !== b.isBuiltIn) return a.isBuiltIn ? 1 : -1;
    if (!a.isBuiltIn) return b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id);
    return categoryRank(a.category) - categoryRank(b.category) ||
      a.category.localeCompare(b.category, "cs") ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id);
  });
  const start = (page - 1) * TEMPLATE_CATALOG_PAGE_SIZE;
  return {
    ids: sorted.slice(start, start + TEMPLATE_CATALOG_PAGE_SIZE).map((row) => row.id),
    total: sorted.length,
    page,
    pageSize: TEMPLATE_CATALOG_PAGE_SIZE,
    categories,
  };
}

export async function getTemplateCatalog(options: CatalogQuery = {}): Promise<TemplateCatalogPage> {
  const metadata = await db.template.findMany({ select: metadataSelect });
  const result = catalogSlice(metadata, options);
  if (result.ids.length === 0) return { ...result, items: [] };
  const rows = await db.template.findMany({ where: { id: { in: result.ids } }, select: templateSelect });
  const byId = new Map(rows.map((row) => [row.id, toSummary(row)]));
  return { ...result, items: result.ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  }) };
}
