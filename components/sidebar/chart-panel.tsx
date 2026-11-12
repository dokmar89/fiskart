"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ColorPicker } from "@/components/toolbar/color-picker";
import { FontPicker } from "@/components/toolbar/font-picker";
import { NumberField } from "@/components/toolbar/controls";
import { Button } from "@/components/ui/button";
import { changeChart } from "@/lib/canvas/chart-edit";
import { changeSelection } from "@/lib/canvas/props";
import { CHART_KINDS, DEFAULT_COLORS, MAX_CATEGORIES, MAX_SERIES, type ChartModel } from "@/lib/chart-math";
import { useEditorStore } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

export const CHART_KIND_LABELS: Record<ChartModel["kind"], string> = { bar: "Sloupcový", stacked: "Skládaný", line: "Spojnicový", area: "Plošný", pie: "Koláčový", donut: "Prstencový", radar: "Radarový", gauge: "Ukazatel" };

/** A cell of the data table: typed freely, applied on Enter or when leaving it (one undo step). */
function Cell({ value, label, numeric, onCommit }: { value: string; label: string; numeric?: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label={label}
      value={draft}
      inputMode={numeric ? "decimal" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => (draft !== value ? onCommit(draft) : undefined)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(value);
      }}
      className={cn("h-7 w-full min-w-0 border-0 bg-transparent px-1.5 text-xs outline-none focus:bg-accent", numeric && "text-right tabular-nums")}
    />
  );
}

const number = (s: string) => {
  const v = Number(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

/** The selected chart's data and options. Opened from the chart's toolbar or when a chart is added. */
export function ChartPanel() {
  const chart = useEditorStore((s) => s.selection?.chart ?? null);
  if (!chart) return <p className="p-3 text-xs text-muted-foreground">Vyberte graf, jehož data chcete upravit.</p>;
  const pie = chart.kind === "pie" || chart.kind === "donut" || chart.kind === "gauge";
  const series = pie ? chart.series.slice(0, 1) : chart.series;
  const set = (update: (m: ChartModel) => ChartModel) => void changeChart(update);
  // Colour drags preview live and become one undo step when released, like other colours.
  const paint = (update: (m: ChartModel) => ChartModel, mode: "live" | "commit") => void changeSelection({ chartModel: update(chart) }, mode);

  return (
    <div className="grid gap-4 p-3">
      <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-0.5 text-[11px]" role="group" aria-label="Typ grafu">
        {CHART_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={chart.kind === kind}
            onClick={() => set((m) => ({ ...m, kind }))}
            className={cn("rounded px-1 py-1", chart.kind === kind && "bg-background shadow-xs")}
          >
            {CHART_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-xs" aria-label="Data grafu">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-24 px-1.5 py-1 text-left font-medium">Popisek</th>
              {series.map((s, si) => (
                <th key={si} className="border-l p-0">
                  <div className="flex items-center">
                    {!pie && <ColorPicker label={`Barva: ${s.name}`} value={s.color} onChange={(c, mode) => typeof c === "string" && paint((m) => ({ ...m, series: m.series.map((x, i) => (i === si ? { ...x, color: c } : x)) }), mode)} />}
                    <Cell value={s.name} label={`Název řady ${si + 1}`} onCommit={(name) => set((m) => ({ ...m, series: m.series.map((x, i) => (i === si ? { ...x, name } : x)) }))} />
                  </div>
                </th>
              ))}
              <th className="w-6 border-l" />
            </tr>
          </thead>
          <tbody>
            {chart.labels.map((label, li) => (
              <tr key={li} className="border-b last:border-b-0">
                <td className="p-0">
                  <div className="flex items-center">
                    {pie && (
                      <ColorPicker
                        label={`Barva: ${label}`}
                        value={chart.sliceColors[li % chart.sliceColors.length]}
                        onChange={(c, mode) => typeof c === "string" && paint((m) => {
                          const colors = m.labels.map((_, i) => m.sliceColors[i % m.sliceColors.length] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
                          colors[li] = c;
                          return { ...m, sliceColors: colors };
                        }, mode)}
                      />
                    )}
                    <Cell value={label} label={`Popisek ${li + 1}`} onCommit={(text) => set((m) => ({ ...m, labels: m.labels.map((l, i) => (i === li ? text : l)) }))} />
                  </div>
                </td>
                {series.map((s, si) => (
                  <td key={si} className="border-l p-0">
                    <Cell
                      value={String(s.values[li] ?? 0)}
                      label={`${s.name}, ${label}`}
                      numeric
                      onCommit={(v) => set((m) => ({ ...m, series: m.series.map((x, i) => (i === si ? { ...x, values: x.values.map((old, j) => (j === li ? number(v) : old)) } : x)) }))}
                    />
                  </td>
                ))}
                <td className="border-l p-0 text-center">
                  <button
                    type="button"
                    aria-label={`Odebrat ${label}`}
                    disabled={chart.labels.length <= 1}
                    onClick={() => set((m) => ({ ...m, labels: m.labels.filter((_, i) => i !== li), series: m.series.map((x) => ({ ...x, values: x.values.filter((_, i) => i !== li) })) }))}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={chart.labels.length >= MAX_CATEGORIES}
          onClick={() => set((m) => ({ ...m, labels: [...m.labels, `Položka ${m.labels.length + 1}`], series: m.series.map((x) => ({ ...x, values: [...x.values, 0] })) }))}
        >
          <Plus /> Řádek
        </Button>
        {!pie && (
          <Button
            variant="outline"
            size="sm"
            disabled={chart.series.length >= MAX_SERIES}
            onClick={() => set((m) => ({ ...m, series: [...m.series, { name: `Řada ${m.series.length + 1}`, values: m.labels.map(() => 0), color: DEFAULT_COLORS[m.series.length % DEFAULT_COLORS.length] }] }))}
          >
            <Plus /> Řada
          </Button>
        )}
        {!pie && chart.series.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => set((m) => ({ ...m, series: m.series.slice(0, -1) }))}>
            <Trash2 /> Poslední řada
          </Button>
        )}
      </div>

      <div className="grid gap-2 text-xs">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={chart.showLabels} onChange={(e) => set((m) => ({ ...m, showLabels: e.target.checked }))} />
          Zobrazit hodnoty
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={chart.showLegend} onChange={(e) => set((m) => ({ ...m, showLegend: e.target.checked }))} />
          Zobrazit legendu
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <FontPicker value={chart.fontFamily} onChange={(fontFamily) => set((m) => ({ ...m, fontFamily }))} />
        <NumberField label="Velikost textu grafu" value={chart.fontSize} min={6} max={200} onCommit={(fontSize) => set((m) => ({ ...m, fontSize }))} />
        <ColorPicker label="Barva textu grafu" value={chart.textColor} onChange={(c, mode) => typeof c === "string" && paint((m) => ({ ...m, textColor: c }), mode)} />
      </div>
      <p className="text-[11px] text-muted-foreground">Vzorník barev nabízí i barvy vaší značky. Každou změnu lze vrátit jedním krokem zpět.</p>
    </div>
  );
}
