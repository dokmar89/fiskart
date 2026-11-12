"use client";

import { Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { exportDesign, exportProblem } from "@/lib/canvas/export";
import { videoFormatFor } from "@/lib/canvas/video-export";
import { readTiming } from "@/lib/animation";
import { pageSnapshot } from "@/lib/canvas/document";
import type { CanvasData } from "@/lib/page-data";
import { VIDEO_RESOLUTIONS, videoSize, type VideoResolution } from "@/lib/video-options";
import type { Size } from "@/lib/canvas/viewport-math";
import {
  exportScale,
  outputSize,
  PDF_DPIS,
  RASTER_SCALES,
  type ExportFormat,
  type PdfDpi,
  type RasterScale,
} from "@/lib/export-options";
import { parsePageRange } from "@/lib/page-ops";
import { useEditorStore } from "@/lib/store/editor";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

type PageChoice = "all" | "current" | "custom";

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "png", label: "PNG", hint: "Ostrý obrázek, volitelně s průhledností" },
  { value: "jpeg", label: "JPEG", hint: "Menší soubor obrázku" },
  { value: "pdf", label: "PDF", hint: "Jeden dokument se všemi stránkami jako obrázky" },
  { value: "svg", label: "SVG", hint: "Vektorový formát; obrázky a písma jsou vložené" },
  { value: "video", label: "Video", hint: "Animace a klipy stránek při 30 fps, se zvukem klipů" },
  { value: "gif", label: "GIF", hint: "Animace jako opakující se GIF, bez zvuku" },
];

/** A row of mutually exclusive buttons. */
function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 flex-1 rounded px-2 text-xs font-medium text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
            o.value === value && "bg-accent text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function ExportDialog({ artboard }: { artboard: Size }) {
  const ready = useEditorStore((s) => s.loadState === "ready");
  const pageIds = useEditorStore((s) => s.pageIds);
  const currentPageId = useEditorStore((s) => s.currentPageId);

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [pageChoice, setPageChoice] = useState<PageChoice>("all");
  const [range, setRange] = useState("");
  const [transparent, setTransparent] = useState(false);
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState<RasterScale>(1);
  const [dpi, setDpi] = useState<PdfDpi>(150);
  const [resolution, setResolution] = useState<VideoResolution>(1080);
  // What the browser can encode: MP4 where it has H.264, otherwise WebM; null while unknown.
  const [container, setContainer] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const exporting = progress !== null;
  const multiPage = pageIds.length > 1;
  const selectedIds = (() => {
    if (!multiPage || pageChoice === "all") return pageIds;
    if (pageChoice === "current") return currentPageId ? [currentPageId] : [];
    return (parsePageRange(range, pageIds.length) ?? []).map((i) => pageIds[i]);
  })();
  const rangeInvalid = multiPage && pageChoice === "custom" && range.trim() !== "" && selectedIds.length === 0;
  const problem = exportProblem({ format, scale, dpi }, artboard);
  const pixels = outputSize(artboard, exportScale(format, scale, dpi));
  const animated = format === "video" || format === "gif";
  const zipped = selectedIds.length > 1 && format !== "pdf" && !animated;
  const videoPixels = videoSize(artboard, resolution);
  const seconds = animated
    ? selectedIds.reduce((sum, id) => sum + readTiming((JSON.parse(pageSnapshot(id) ?? "{}") as Partial<CanvasData>).timing).duration, 0) / 1000
    : 0;

  useEffect(() => {
    if (!open || format !== "video") return;
    let live = true;
    setContainer(null);
    void videoFormatFor(artboard, resolution).then((f) => live && setContainer(f ? f.container : "none"));
    return () => {
      live = false;
    };
  }, [open, format, resolution, artboard]);

  async function run() {
    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ done: 0, total: selectedIds.length });
    try {
      await exportDesign(
        { format, pageIds: selectedIds, transparent, quality: quality / 100, scale, dpi, resolution },
        (done, total) => setProgress({ done, total }),
        controller.signal,
      );
      setOpen(false);
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Export selhal.");
      }
    } finally {
      abort.current = null;
      setProgress(null);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={!ready}>
        <Download />
        Exportovat
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) abort.current?.abort();
          setOpen(next);
          setError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportovat</DialogTitle>
            <DialogDescription>{FORMATS.find((f) => f.value === format)?.hint}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field label="Formát">
              <Segmented label="Formát" value={format} onChange={setFormat} disabled={exporting} options={FORMATS} />
            </Field>

            {multiPage && (
              <Field label="Stránky">
                <Segmented
                  label="Stránky"
                  value={pageChoice}
                  onChange={setPageChoice}
                  disabled={exporting}
                  options={[
                    { value: "all", label: `Všechny (${pageIds.length})` },
                    { value: "current", label: `Aktuální (${currentPageId ? pageIds.indexOf(currentPageId) + 1 : "–"})` },
                    { value: "custom", label: "Vybrat" },
                  ]}
                />
                {pageChoice === "custom" && (
                  <Input
                    aria-label="Čísla stránek"
                    placeholder={`např. 1-3, ${Math.min(5, pageIds.length)}`}
                    value={range}
                    disabled={exporting}
                    onChange={(e) => setRange(e.target.value)}
                    aria-invalid={rangeInvalid}
                    className="h-8"
                  />
                )}
                {rangeInvalid && <p className="text-xs text-destructive">Zadejte čísla stránek od 1 do {pageIds.length}, např. 1-3, 5.</p>}
              </Field>
            )}

            {(format === "png" || format === "jpeg") && (
              <Field label="Velikost">
                <Segmented
                  label="Velikost"
                  value={scale}
                  onChange={setScale}
                  disabled={exporting}
                  options={RASTER_SCALES.map((s) => ({ value: s, label: `${s}×` }))}
                />
              </Field>
            )}

            {animated && (
              <Field label="Velikost videa">
                <Segmented
                  label="Velikost videa"
                  value={resolution}
                  onChange={setResolution}
                  disabled={exporting}
                  options={VIDEO_RESOLUTIONS.map((r) => ({ value: r, label: `${r}p` }))}
                />
              </Field>
            )}

            {format === "pdf" && (
              <Field label="Rozlišení">
                <Segmented
                  label="Rozlišení"
                  value={dpi}
                  onChange={setDpi}
                  disabled={exporting}
                  options={PDF_DPIS.map((d) => ({ value: d, label: `${d} DPI` }))}
                />
              </Field>
            )}

            {format === "png" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={transparent}
                  disabled={exporting}
                  onChange={(e) => setTransparent(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Průhledné pozadí
              </label>
            )}

            {format === "jpeg" && (
              <Field label={`Kvalita: ${quality}`}>
                <Slider
                  aria-label="Kvalita"
                  min={10}
                  max={100}
                  step={1}
                  value={[quality]}
                  disabled={exporting}
                  onValueChange={([v]) => setQuality(v)}
                />
              </Field>
            )}

            <p className="text-xs text-muted-foreground" data-testid="export-summary">
              {animated
                ? `${videoPixels.width} × ${videoPixels.height} px · ${Math.round(seconds * 10) / 10} s při 30 fps`
                : format === "svg"
                  ? `${artboard.width} × ${artboard.height} px`
                  : `${pixels.width} × ${pixels.height} px`}
              {format === "pdf" ? " na stránku" : ""}
              {selectedIds.length > 1 ? ` · ${selectedIds.length} ${plural(selectedIds.length, "stránka", "stránky", "stránek")}` : ""}
              {zipped ? " · stáhne se jako zip" : ""}
              {format === "video" && container === "mp4" ? " · MP4 (H.264)" : ""}
              {format === "video" && container === "webm" ? " · WebM (tento prohlížeč neumí kódovat H.264)" : ""}
            </p>
            {format === "video" && container === "none" && <p className="text-xs text-destructive">Tento prohlížeč neumí kódovat video. Chrome, Edge a Safari to umí.</p>}
            {exporting && animated && (
              <div
                role="progressbar"
                aria-label="Průběh exportu"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((progress.done / Math.max(1, progress.total)) * 100)}
                className="h-1.5 overflow-hidden rounded bg-muted"
              >
                <div className="h-full bg-primary transition-[width]" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
              </div>
            )}
            {problem && <p className="text-xs text-destructive">{problem}</p>}
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => (exporting ? abort.current?.abort() : setOpen(false))}>
              Zrušit
            </Button>
            <Button onClick={() => void run()} disabled={exporting || selectedIds.length === 0 || problem !== null || (format === "video" && container === "none")}>
              {exporting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {animated
                    ? `Vykresluji ${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%…`
                    : progress.total > 1
                      ? `Stránka ${Math.min(progress.done + 1, progress.total)} z ${progress.total}…`
                      : "Exportuji…"}
                </>
              ) : (
                "Stáhnout"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
