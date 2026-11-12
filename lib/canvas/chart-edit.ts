import { defaultChart, type ChartKind, type ChartModel } from "@/lib/chart-math";
import { DEFAULT_FONT_FAMILY, loadFonts } from "@/lib/fonts";
import { useEditorStore } from "@/lib/store/editor";
import { Chart } from "./chart";
import { recordStep } from "./document";
import { artboardScale, placeObject } from "./elements";
import { getEditorInstance } from "./instance";
import { refreshSelection } from "./selection";

/** Every character a chart draws, so its font is loaded for all of them. */
export function chartText(model: ChartModel): string {
  return [...model.labels, ...model.series.map((s) => s.name), "0123456789.,-%"].join(" ");
}

const CHART_NAMES: Record<ChartKind, string> = { bar: "Sloupcový graf", stacked: "Skládaný graf", line: "Spojnicový graf", area: "Plošný graf", pie: "Koláčový graf", donut: "Prstencový graf", radar: "Radarový graf", gauge: "Ukazatel" };

export async function addChart(kind: ChartKind) {
  const editor = getEditorInstance();
  if (!editor) return;
  const scale = artboardScale(editor.artboard);
  const model = defaultChart(kind, DEFAULT_FONT_FAMILY, Math.round(22 * scale));
  await loadFonts([{ family: model.fontFamily, weight: "400", style: "normal", text: chartText(model) }]);
  const chart = new Chart({ chart: model, width: 680 * scale, height: 460 * scale });
  placeObject(chart, CHART_NAMES[kind]);
  useEditorStore.setState({ activePanel: "chart" });
}

export function selectedChart(): Chart | null {
  const active = getEditorInstance()?.canvas.getActiveObject();
  return active instanceof Chart && !active.locked ? active : null;
}

/** Changes the selected chart's model as one undo step; the chart redraws from it. */
export async function changeChart(update: (model: ChartModel) => ChartModel) {
  const editor = getEditorInstance();
  const chart = selectedChart();
  if (!editor || !chart) return;
  const next = update(chart.chart);
  await loadFonts([{ family: next.fontFamily, weight: "400", style: "normal", text: chartText(next) }]);
  recordStep(() => {
    chart.chart = next;
    chart.set({ dirty: true });
    editor.canvas.fire("object:modified", { target: chart });
  });
  editor.canvas.requestRenderAll();
  refreshSelection();
}
