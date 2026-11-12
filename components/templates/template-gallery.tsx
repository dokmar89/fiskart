"use client";

import { Search } from "lucide-react";
import type { TemplateSummary } from "@/lib/templates";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { TemplateThumb } from "./template-thumb";

export type GalleryLayout = "panel" | "page";

/** Search and category controls over one server-provided catalog page. */
export function TemplateGallery({
  templates,
  categories,
  total,
  page,
  pageSize,
  query,
  category,
  loading,
  error,
  onQueryChange,
  onCategoryChange,
  onPageChange,
  onRetry,
  layout,
  onPick,
  busyId,
  renderActions,
}: {
  templates: TemplateSummary[] | null;
  categories: string[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  category: string | null;
  loading: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onPageChange: (value: number) => void;
  onRetry: () => void;
  layout: GalleryLayout;
  onPick: (template: TemplateSummary) => void;
  busyId?: string | null;
  renderActions?: (template: TemplateSummary) => React.ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="grid gap-3">
      <div className={cn("grid gap-2", layout === "page" && "sm:flex sm:items-center sm:justify-between")}>
        <div className={cn("relative", layout === "page" && "sm:order-2 sm:w-64")}>
          <Search className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground" />
          <input
            aria-label="Hledat šablony"
            placeholder="Hledat šablony"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus:border-ring dark:bg-input/30"
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Kategorie šablon">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              aria-pressed={category === c}
              onClick={() => onCategoryChange(c)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent",
                category === c && "border-foreground/30 bg-accent text-accent-foreground",
              )}
            >
              {c ?? "Vše"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="underline underline-offset-2">Zkusit znovu</button>
        </div>
      )}
      {!loading && templates !== null && <p className="text-xs text-muted-foreground">{total} {plural(total, "šablona", "šablony", "šablon")}</p>}
      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground" role="status">Načítám šablony…</p>
      ) : templates === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Šablony nejsou k dispozici.</p>
      ) : templates.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Žádná šablona neodpovídá.</p>
      ) : (
        <ul
          aria-label="Šablony"
          className={cn("grid items-start gap-3", layout === "panel" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5")}
        >
          {templates.map((t) => (
            <li key={t.id} className="group relative" data-testid="template-card" data-template-id={t.id}>
              <button
                type="button"
                onClick={() => onPick(t)}
                disabled={busyId === t.id}
                className="grid w-full gap-1.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                aria-label={`${t.title} (${t.category}${t.pageCount > 1 ? `, ${t.pageCount} ${plural(t.pageCount, "stránka", "stránky", "stránek")}` : ""})`}
              >
                <TemplateThumb key={`${t.id}@${t.version}`} template={t} className="transition-colors group-hover:border-ring" />
                <span className="truncate text-xs font-medium">{t.title}</span>
                <span className="-mt-1.5 truncate text-[11px] text-muted-foreground">
                  {t.category}
                  {t.pageCount > 1 ? ` · ${t.pageCount} ${plural(t.pageCount, "stránka", "stránky", "stránek")}` : ""}
                  {!t.isBuiltIn ? " · Uložená" : ""}
                </span>
              </button>
              {renderActions?.(t)}
            </li>
          ))}
        </ul>
      )}
      {total > pageSize && (
        <nav className="flex items-center justify-center gap-3 text-xs" aria-label="Stránkování šablon">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading} className="rounded border px-2 py-1 disabled:opacity-40">Předchozí</button>
          <span>Strana {page} z {pages}</span>
          <button type="button" data-testid="template-next-page" onClick={() => onPageChange(page + 1)} disabled={page >= pages || loading} className="rounded border px-2 py-1 disabled:opacity-40">Další</button>
        </nav>
      )}
    </div>
  );
}
