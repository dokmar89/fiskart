import "server-only";
import { SCHEMA_VERSION, validatePageData, type CanvasData } from "@/lib/page-data";
import { TEMPLATE_CATEGORIES, type TemplateDetail, type TemplateSummary } from "@/lib/templates";
import { isUnit } from "@/lib/units";

type TemplateRow = {
  id: string;
  title: string;
  category: string;
  width: number;
  height: number;
  unit: string;
  tags: string[];
  isBuiltIn: boolean;
  thumbnailPath: string | null;
  updatedAt: Date;
  pages: unknown;
};

export const templateSelect = {
  id: true,
  title: true,
  category: true,
  width: true,
  height: true,
  unit: true,
  tags: true,
  isBuiltIn: true,
  thumbnailPath: true,
  updatedAt: true,
  createdAt: true,
  pages: true,
} as const;

/** Gallery order: saved templates first, newest first; then the built-in ones by category, in seed order. */
export function galleryOrder<T extends { isBuiltIn: boolean; category: string; createdAt: Date }>(rows: T[]): T[] {
  const rank = (category: string) => (TEMPLATE_CATEGORIES as readonly string[]).indexOf(category);
  const saved = rows.filter((t) => !t.isBuiltIn).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const builtIn = rows
    .filter((t) => t.isBuiltIn)
    .sort((a, b) => rank(a.category) - rank(b.category) || a.createdAt.getTime() - b.createdAt.getTime());
  return [...saved, ...builtIn];
}

export function storedPages(pages: unknown): CanvasData[] {
  return Array.isArray(pages) ? (pages as CanvasData[]) : [];
}

export function toSummary(t: TemplateRow): TemplateSummary {
  return {
    id: t.id,
    title: t.title,
    category: t.category,
    width: t.width,
    height: t.height,
    unit: isUnit(t.unit) ? t.unit : "px",
    tags: t.tags,
    isBuiltIn: t.isBuiltIn,
    pageCount: storedPages(t.pages).length,
    version: t.updatedAt.getTime(),
    hasThumbnail: t.thumbnailPath !== null,
  };
}

export function toDetail(t: TemplateRow): TemplateDetail {
  return { ...toSummary(t), pages: storedPages(t.pages) };
}

/** The canvasData of every page, each checked like a page save; null when any is invalid. */
export function parseTemplatePages(value: unknown): CanvasData[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  for (const canvasData of value) {
    if (validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData }) !== null) return null;
  }
  return value as CanvasData[];
}

/** Where a template thumbnail lives, relative to DATA_DIR. */
export function templateThumbnailPath(id: string): string {
  return `thumbnails/templates/${id}.png`;
}
