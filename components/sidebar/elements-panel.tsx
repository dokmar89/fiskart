"use client";

import { ChartColumn, ChartLine, ChartPie, Circle, CornerDownRight, Donut, Minus, MoveRight, Square, Star, Table2, Triangle, type LucideIcon } from "lucide-react";
import { addShape, type ShapeKind } from "@/lib/canvas/elements";
import { addFrame, addPhotoGrid } from "@/lib/canvas/frames";
import { addChart } from "@/lib/canvas/chart-edit";
import { CHART_KINDS } from "@/lib/chart-math";
import { GRID_LAYOUTS, gridPreview } from "@/lib/photo-grid";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addQrCode } from "@/lib/canvas/qr";
import { addTable } from "@/lib/canvas/table-edit";
import { TABLE_PRESETS } from "@/lib/table-styles";
import { FRAME_LABELS, FRAME_SHAPES, framePath } from "@/lib/frames";
import { CHART_KIND_LABELS } from "./chart-panel";

const SHAPES: { kind: ShapeKind; label: string; icon: LucideIcon }[] = [
  { kind: "rectangle", label: "Obdélník", icon: Square },
  { kind: "ellipse", label: "Elipsa", icon: Circle },
  { kind: "triangle", label: "Trojúhelník", icon: Triangle },
  { kind: "star", label: "Hvězda", icon: Star },
  { kind: "line", label: "Čára", icon: Minus },
  { kind: "arrow", label: "Šipka", icon: MoveRight },
  { kind: "elbow", label: "Spojnice", icon: CornerDownRight },
];

const CHART_ICONS: Record<(typeof CHART_KINDS)[number], LucideIcon> = { bar: ChartColumn, stacked: ChartColumn, line: ChartLine, area: ChartLine, pie: ChartPie, donut: Donut, radar: ChartPie, gauge: Donut };

function PhotoGrids() {
  const [spacing, setSpacing] = useState(16);
  const [radius, setRadius] = useState(0);
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-3 gap-2">
        {GRID_LAYOUTS.map((layout) => (
          <button
            key={layout.id}
            type="button"
            aria-label={`Mřížka fotek: ${layout.label}`}
            title={layout.label}
            onClick={() => addPhotoGrid(layout.id, spacing, radius)}
            className="flex aspect-[4/3] items-center justify-center rounded-md border bg-muted/40 p-2 hover:bg-accent"
          >
            <svg viewBox="0 0 40 30" className="size-full" aria-hidden>
              {gridPreview(layout.id, 40, 30, Math.max(1, spacing / 8)).map((c, i) => (
                <rect key={i} x={c.left} y={c.top} width={c.width} height={c.height} rx={Math.min(4, radius / 8)} transform={c.angle ? `rotate(${c.angle} ${c.left + c.width / 2} ${c.top + c.height / 2})` : undefined} className="fill-current opacity-40" />
              ))}
            </svg>
          </button>
        ))}
      </div>
      <div className="grid gap-1.5">
        <span className="text-[11px] text-muted-foreground">Mezery: {spacing} px</span>
        <Slider aria-label="Mezery v mřížce fotek" value={[spacing]} min={0} max={40} step={2} onValueChange={([v]) => setSpacing(v)} />
        <span className="text-[11px] text-muted-foreground">Zaoblení: {radius} px</span>
        <Slider aria-label="Zaoblení buněk mřížky fotek" value={[radius]} min={0} max={32} step={2} onValueChange={([v]) => setRadius(v)} />
      </div>
    </div>
  );
}

function QrCodeAdder() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        try {
          await addQrCode(text.trim());
          setText("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input aria-label="Odkaz nebo text QR kódu" placeholder="https://…" value={text} onChange={(e) => setText(e.target.value)} className="h-8" />
      <Button type="submit" size="sm" disabled={!text.trim() || busy}>
        Přidat
      </Button>
    </form>
  );
}

export function ElementsPanel() {
  return (
    <div className="p-3">
      <h2 className="mb-2 text-xs font-medium text-muted-foreground">Tvary</h2>
      <div className="grid grid-cols-3 gap-2">
        {SHAPES.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => addShape(kind)}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border bg-muted/40 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="size-7" strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>
      <h2 className="mt-4 mb-2 text-xs font-medium text-muted-foreground">Grafy</h2>
      <div className="grid grid-cols-4 gap-2">
        {CHART_KINDS.map((kind) => {
          const Icon = CHART_ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              aria-label={`${CHART_KIND_LABELS[kind]} graf`}
              onClick={() => void addChart(kind)}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border bg-muted/40 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="size-6" strokeWidth={1.5} />
              {CHART_KIND_LABELS[kind]}
            </button>
          );
        })}
      </div>
      <h2 className="mt-4 mb-2 text-xs font-medium text-muted-foreground">Mřížky fotek</h2>
      <PhotoGrids />
      <h2 className="mt-4 mb-2 text-xs font-medium text-muted-foreground">Tabulky</h2>
      <div className="grid grid-cols-2 gap-2">
        {TABLE_PRESETS.map((preset) => (
          <button key={preset.id} type="button" aria-label={`Tabulka: ${preset.label}`} onClick={() => void addTable(3, preset.id === "pricing" ? 4 : 3, preset.id)} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <Table2 className="size-4" strokeWidth={1.5} /> {preset.label}
          </button>
        ))}
      </div>
      <h2 className="mt-4 mb-2 text-xs font-medium text-muted-foreground">QR kód</h2>
      <QrCodeAdder />
      <h2 className="mt-4 mb-1 text-xs font-medium text-muted-foreground">Rámečky</h2>
      <p className="mb-2 text-[11px] text-muted-foreground">Přetáhněte obrázek na rámeček, nebo rámeček vyberte a zvolte nahraný soubor.</p>
      <div className="grid grid-cols-3 gap-2">
        {FRAME_SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            aria-label={`Rámeček: ${FRAME_LABELS[shape]}`}
            onClick={() => addFrame(shape)}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border bg-muted/40 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <svg viewBox="-13 -13 26 26" className="size-7" aria-hidden>
              <path d={framePath(shape, 24, 24)} className="fill-current opacity-40" />
            </svg>
            {FRAME_LABELS[shape]}
          </button>
        ))}
      </div>
    </div>
  );
}
