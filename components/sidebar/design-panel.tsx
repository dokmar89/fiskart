"use client";

import { ArrowLeft, BookmarkPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { renderedPagePreview } from "@/components/templates/template-thumb";
import { Button } from "@/components/ui/button";
import { getEditorInstance } from "@/lib/canvas/instance";
import { applyTemplatePage, fetchTemplate } from "@/lib/canvas/templates";
import type { CanvasData } from "@/lib/page-data";
import { useTemplatesStore } from "@/lib/store/templates";
import type { TemplateDetail, TemplateSummary } from "@/lib/templates";
import type { Unit } from "@/lib/units";
import { PageTimingSection } from "./page-timing";
import { SaveTemplateDialog } from "./save-template-dialog";

function PagePreview({ template, index, page }: { template: TemplateSummary; index: number; page: CanvasData }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    renderedPagePreview(template, index, page)
      .then((url) => live && setSrc(url))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [template, index, page]);
  return (
    <div className="overflow-hidden rounded-md border bg-muted" style={{ aspectRatio: `${template.width} / ${template.height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise */}
      {src && <img src={src} alt="" className="size-full object-cover" />}
    </div>
  );
}

/**
 * Templates for the open page. Picking one replaces the page contents (one undo step); a template
 * with several pages first shows its pages to pick from. Templates of the design's size come first.
 */
export function DesignPanel({ unit }: { unit: Unit }) {
  const { templates, categories, total, page, pageSize, query, category, loading, error, load } = useTemplatesStore();
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    const artboard = getEditorInstance()?.artboard;
    void load({ query: "", category: null, page: 1, preferredWidth: artboard?.width ?? null, preferredHeight: artboard?.height ?? null });
  }, [load]);

  async function apply(template: TemplateDetail, index: number) {
    setMessage(null);
    try {
      await applyTemplatePage(template, index);
    } catch {
      setMessage(`Šablonu „${template.title}“ se nepodařilo použít.`);
    }
  }

  async function pick(template: TemplateSummary) {
    setBusyId(template.id);
    setMessage(null);
    try {
      const full = await fetchTemplate(template.id);
      if (full.pages.length > 1) setDetail(full);
      else await apply(full, 0);
    } catch {
      setMessage(`Šablonu „${template.title}“ se nepodařilo načíst.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-3 p-3">
      <PageTimingSection />
      <h2 className="mt-2 text-xs font-medium text-muted-foreground">Šablony</h2>
      <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
        <BookmarkPlus />
        Uložit jako šablonu
      </Button>
      {message && (
        <p className="text-xs text-destructive" role="alert">
          {message}
        </p>
      )}
      {detail ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7" aria-label="Zpět na šablony" onClick={() => setDetail(null)}>
              <ArrowLeft />
            </Button>
            <h2 className="truncate text-sm font-medium">{detail.title}</h2>
          </div>
          <p className="text-xs text-muted-foreground">Vyberte stránku, která se vloží na aktuální stránku.</p>
          <ul className="grid grid-cols-2 gap-3" aria-label="Stránky šablony">
            {detail.pages.map((page, i) => (
              <li key={i}>
                <button type="button" className="grid w-full gap-1 text-left text-xs" aria-label={`Použít stránku ${i + 1}`} onClick={() => void apply(detail, i)}>
                  <PagePreview template={detail} index={i} page={page} />
                  Stránka {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Výběr šablony nahradí obsah aktuální stránky. Krokem zpět ho vrátíte.</p>
          <TemplateGallery
            templates={templates}
            categories={categories}
            total={total}
            page={page}
            pageSize={pageSize}
            query={query}
            category={category}
            loading={loading}
            error={error}
            onQueryChange={(value) => void load({ query: value, page: 1 })}
            onCategoryChange={(value) => void load({ category: value, page: 1 })}
            onPageChange={(value) => void load({ page: value })}
            onRetry={() => void load({})}
            layout="panel" busyId={busyId} onPick={(t) => void pick(t)}
          />
        </>
      )}
      <SaveTemplateDialog open={saveOpen} onOpenChange={setSaveOpen} unit={unit} categories={categories} />
    </div>
  );
}
