/**
 * Charts: the stored model, value scales and axis ticks, and the layout of a chart into simple
 * drawing primitives. The canvas and the SVG export both draw the same primitives, so a chart looks
 * the same in both. Pure: text is measured by a function passed in. Unit tested.
 */

export const CHART_KINDS = ["bar", "stacked", "line", "area", "pie", "donut", "radar", "gauge"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

export type ChartSeries = { name: string; values: number[]; color: string };

export type ChartModel = {
  kind: ChartKind;
  /** Category labels: the x axis of bar and line charts, the slices of pie and donut charts. */
  labels: string[];
  series: ChartSeries[];
  /** Pie and donut slices take these colours in turn (series colours are for bar and line). */
  sliceColors: string[];
  showLabels: boolean;
  showLegend: boolean;
  fontFamily: string;
  fontSize: number;
  textColor: string;
};

export const DEFAULT_COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];
export const MAX_CATEGORIES = 24;
export const MAX_SERIES = 6;

export function defaultChart(kind: ChartKind, fontFamily: string, fontSize: number): ChartModel {
  return {
    kind,
    labels: ["Q1", "Q2", "Q3", "Q4"],
    series: [
      { name: "2025", values: [12, 19, 15, 24], color: DEFAULT_COLORS[0] },
      ...(["bar", "stacked", "line", "area", "radar"].includes(kind) ? [{ name: "2026", values: [16, 22, 20, 30], color: DEFAULT_COLORS[1] }] : []),
    ],
    sliceColors: [...DEFAULT_COLORS],
    showLabels: true,
    showLegend: kind !== "line" && kind !== "gauge",
    fontFamily,
    fontSize,
    textColor: "#3f3f46",
  };
}

export type Ticks = { min: number; max: number; step: number; values: number[] };

/** A round step: 1, 2 or 5 times a power of ten, at least `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * power >= raw - 1e-12) return f * power;
  return 10 * power;
}

/**
 * Axis ticks covering `min`..`max` on round numbers, about `count` of them. The axis always includes
 * zero, so bars start from it.
 */
export function niceTicks(min: number, max: number, count = 5): Ticks {
  let lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (hi - lo < 1e-12) hi = lo + 1;
  const step = niceStep((hi - lo) / Math.max(1, count));
  lo = Math.floor(lo / step + 1e-9) * step;
  hi = Math.ceil(hi / step - 1e-9) * step;
  const values: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) values.push(Math.round(v / step) * step);
  return { min: lo, max: hi, step, values: values.map((v) => Number(v.toPrecision(12))) };
}

/** A tick label: as many decimals as the step needs, no more. */
export function formatTick(value: number, step: number): string {
  const fraction = String(Number(step.toPrecision(12))).split(".")[1] ?? "";
  return value.toFixed(Math.min(fraction.length, 6));
}

/** Where a value falls between `a` (at the axis minimum) and `b` (at its maximum). */
export function scale(value: number, ticks: Ticks, a: number, b: number): number {
  return a + ((value - ticks.min) / (ticks.max - ticks.min)) * (b - a);
}

// Drawing primitives, in the chart's own coordinates (0, 0 at its top-left corner).
export type Prim =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string }
  | { t: "line"; points: { x: number; y: number }[]; stroke: string; width: number }
  | { t: "polygon"; points: { x: number; y: number }[]; fill: string; opacity?: number; stroke?: string; width?: number }
  | { t: "dot"; x: number; y: number; r: number; fill: string }
  | { t: "wedge"; cx: number; cy: number; r: number; inner: number; start: number; end: number; fill: string }
  | { t: "text"; x: number; y: number; text: string; align: "left" | "center" | "right"; size: number; fill: string };

export type Measure = (text: string, size: number) => number;

const GRID = "#e4e4e7";

/** The legend along the bottom: a swatch and a name per entry, centred, wrapping into rows. */
function legend(entries: { name: string; color: string }[], width: number, bottom: number, model: ChartModel, measure: Measure): { prims: Prim[]; height: number } {
  if (!model.showLegend || entries.length === 0) return { prims: [], height: 0 };
  const size = model.fontSize;
  const gap = size;
  const items = entries.map((e) => ({ ...e, w: size * 0.8 + size * 0.4 + measure(e.name, size) }));
  const rows: (typeof items)[] = [[]];
  let rowWidth = 0;
  for (const item of items) {
    if (rows[rows.length - 1].length > 0 && rowWidth + gap + item.w > width) {
      rows.push([]);
      rowWidth = 0;
    }
    rowWidth += (rows[rows.length - 1].length > 0 ? gap : 0) + item.w;
    rows[rows.length - 1].push(item);
  }
  const lineHeight = size * 1.5;
  const height = rows.length * lineHeight + size * 0.5;
  const prims: Prim[] = [];
  rows.forEach((row, r) => {
    const total = row.reduce((s, it, i) => s + it.w + (i > 0 ? gap : 0), 0);
    let x = (width - total) / 2;
    const y = bottom - height + size * 0.5 + r * lineHeight + lineHeight / 2;
    for (const item of row) {
      prims.push({ t: "rect", x, y: y - size * 0.4, w: size * 0.8, h: size * 0.8, fill: item.color });
      prims.push({ t: "text", x: x + size * 1.2, y: y + size * 0.35, text: item.name, align: "left", size, fill: model.textColor });
      x += item.w + gap;
    }
  });
  return { prims, height };
}

function axisChart(model: ChartModel, width: number, height: number, measure: Measure): Prim[] {
  const size = model.fontSize;
  const values = model.series.flatMap((s) => s.values.slice(0, model.labels.length));
  const totals = model.labels.map((_, i) => model.series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0));
  const negatives = model.labels.map((_, i) => model.series.reduce((a, s) => a + Math.min(0, s.values[i] ?? 0), 0));
  const ticks = niceTicks(model.kind === "stacked" ? Math.min(0, ...negatives) : Math.min(0, ...values), model.kind === "stacked" ? Math.max(0, ...totals) : Math.max(0, ...values), Math.max(2, Math.round(height / (size * 4))));
  const leg = legend(model.series.map((s) => ({ name: s.name, color: s.color })), width, height, model, measure);
  const tickWidth = Math.max(...ticks.values.map((v) => measure(formatTick(v, ticks.step), size)));
  const plot = { left: tickWidth + size * 0.6, top: size * 0.6, right: width - size * 0.3, bottom: height - leg.height - size * 1.6 };
  const prims: Prim[] = [];
  const y = (v: number) => scale(v, ticks, plot.bottom, plot.top);
  for (const v of ticks.values) {
    prims.push({ t: "line", points: [{ x: plot.left, y: y(v) }, { x: plot.right, y: y(v) }], stroke: GRID, width: Math.max(1, size / 16) });
    prims.push({ t: "text", x: plot.left - size * 0.4, y: y(v) + size * 0.35, text: formatTick(v, ticks.step), align: "right", size, fill: model.textColor });
  }
  const n = Math.max(1, model.labels.length);
  const band = (plot.right - plot.left) / n;
  model.labels.forEach((label, i) => {
    prims.push({ t: "text", x: plot.left + band * (i + 0.5), y: plot.bottom + size * 1.2, text: label, align: "center", size, fill: model.textColor });
  });
  if (model.kind === "bar") {
    const groupWidth = band * 0.7;
    const barWidth = groupWidth / Math.max(1, model.series.length);
    model.series.forEach((s, si) => {
      s.values.slice(0, n).forEach((v, i) => {
        const x = plot.left + band * i + (band - groupWidth) / 2 + barWidth * si;
        const top = Math.min(y(v), y(0));
        prims.push({ t: "rect", x, y: top, w: barWidth * 0.92, h: Math.abs(y(v) - y(0)), fill: s.color });
        if (model.showLabels) prims.push({ t: "text", x: x + barWidth * 0.46, y: top - size * 0.3, text: String(v), align: "center", size: size * 0.85, fill: model.textColor });
      });
    });
  } else if (model.kind === "stacked") {
    const barWidth = band * 0.68;
    model.labels.forEach((_, i) => {
      let positive = 0;
      let negative = 0;
      model.series.forEach((s) => {
        const value = s.values[i] ?? 0;
        const start = value >= 0 ? positive : negative;
        const end = start + value;
        if (value >= 0) positive = end;
        else negative = end;
        prims.push({ t: "rect", x: plot.left + band * i + (band - barWidth) / 2, y: Math.min(y(start), y(end)), w: barWidth, h: Math.abs(y(start) - y(end)), fill: s.color });
      });
      if (model.showLabels) prims.push({ t: "text", x: plot.left + band * (i + 0.5), y: y(positive) - size * 0.3, text: String(positive), align: "center", size: size * 0.85, fill: model.textColor });
    });
  } else {
    model.series.forEach((s) => {
      const points = s.values.slice(0, n).map((v, i) => ({ x: plot.left + band * (i + 0.5), y: y(v) }));
      if (model.kind === "area" && points.length > 0) {
        prims.push({ t: "polygon", points: [{ x: points[0].x, y: y(0) }, ...points, { x: points[points.length - 1].x, y: y(0) }], fill: s.color, opacity: 0.22 });
      }
      prims.push({ t: "line", points, stroke: s.color, width: Math.max(2, size / 6) });
      points.forEach((p, i) => {
        prims.push({ t: "dot", x: p.x, y: p.y, r: Math.max(3, size / 4), fill: s.color });
        if (model.showLabels) prims.push({ t: "text", x: p.x, y: p.y - size * 0.6, text: String(s.values[i]), align: "center", size: size * 0.85, fill: model.textColor });
      });
    });
  }
  return [...prims, ...leg.prims];
}

function radarChart(model: ChartModel, width: number, height: number, measure: Measure): Prim[] {
  const size = model.fontSize;
  const leg = legend(model.series.map((s) => ({ name: s.name, color: s.color })), width, height, model, measure);
  const cx = width / 2;
  const cy = (height - leg.height) / 2;
  const r = Math.max(1, Math.min(width / 2, (height - leg.height) / 2) - size * 2);
  const count = Math.max(3, model.labels.length);
  const max = niceTicks(0, Math.max(1, ...model.series.flatMap((s) => s.values)), 4).max;
  const point = (i: number, fraction: number) => ({ x: cx + Math.cos(-Math.PI / 2 + i * Math.PI * 2 / count) * r * fraction, y: cy + Math.sin(-Math.PI / 2 + i * Math.PI * 2 / count) * r * fraction });
  const prims: Prim[] = [];
  for (const fraction of [0.25, 0.5, 0.75, 1]) prims.push({ t: "polygon", points: Array.from({ length: count }, (_, i) => point(i, fraction)), fill: "none", stroke: GRID, width: 1 });
  model.labels.forEach((label, i) => {
    const end = point(i, 1);
    const text = point(i, 1.18);
    prims.push({ t: "line", points: [{ x: cx, y: cy }, end], stroke: GRID, width: 1 });
    prims.push({ t: "text", x: text.x, y: text.y + size * 0.3, text: label, align: "center", size, fill: model.textColor });
  });
  model.series.forEach((s) => {
    const points = Array.from({ length: count }, (_, i) => point(i, Math.max(0, Math.min(1, (s.values[i] ?? 0) / max))));
    prims.push({ t: "polygon", points, fill: s.color, opacity: 0.25, stroke: s.color, width: 2 });
    points.forEach((p) => prims.push({ t: "dot", x: p.x, y: p.y, r: Math.max(2, size / 5), fill: s.color }));
  });
  return [...prims, ...leg.prims];
}

function gaugeChart(model: ChartModel, width: number, height: number): Prim[] {
  const value = Math.max(0, Math.min(100, model.series[0]?.values[0] ?? 0));
  const r = Math.max(1, Math.min(width / 2 - model.fontSize, height - model.fontSize * 3));
  const cx = width / 2;
  const cy = Math.min(height - model.fontSize * 1.7, r + model.fontSize * 1.3);
  const split = Math.PI + Math.PI * value / 100;
  const prims: Prim[] = [
    { t: "wedge", cx, cy, r, inner: r * 0.72, start: Math.PI, end: split, fill: model.series[0]?.color ?? DEFAULT_COLORS[0] },
    { t: "wedge", cx, cy, r, inner: r * 0.72, start: split, end: Math.PI * 2, fill: GRID },
  ];
  if (model.showLabels) prims.push({ t: "text", x: cx, y: cy - r * 0.15, text: `${Math.round(value)}%`, align: "center", size: model.fontSize * 2, fill: model.textColor });
  return prims;
}

/** Slice angles, clockwise from twelve o'clock, for the (non-negative) values. */
export function slices(values: number[]): { start: number; end: number; share: number }[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  let angle = -Math.PI / 2;
  return clean.map((v) => {
    const share = total > 0 ? v / total : 0;
    const start = angle;
    angle += share * Math.PI * 2;
    return { start, end: angle, share };
  });
}

function pieChart(model: ChartModel, width: number, height: number, measure: Measure): Prim[] {
  const size = model.fontSize;
  const values = model.series[0]?.values.slice(0, model.labels.length) ?? [];
  const color = (i: number) => model.sliceColors[i % Math.max(1, model.sliceColors.length)] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
  const leg = legend(model.labels.map((name, i) => ({ name, color: color(i) })), width, height, model, measure);
  const r = Math.max(1, Math.min(width, height - leg.height) / 2 - size * 0.5);
  const cx = width / 2;
  const cy = (height - leg.height) / 2;
  const inner = model.kind === "donut" ? r * 0.55 : 0;
  const prims: Prim[] = [];
  slices(values).forEach((s, i) => {
    if (s.share <= 0) return;
    prims.push({ t: "wedge", cx, cy, r, inner, start: s.start, end: s.end, fill: color(i) });
    if (model.showLabels && s.share >= 0.04) {
      const mid = (s.start + s.end) / 2;
      const at = inner > 0 ? (r + inner) / 2 : r * 0.62;
      prims.push({ t: "text", x: cx + Math.cos(mid) * at, y: cy + Math.sin(mid) * at + size * 0.35, text: `${Math.round(s.share * 100)}%`, align: "center", size: size * 0.9, fill: "#ffffff" });
    }
  });
  return [...prims, ...leg.prims];
}

export function layoutChart(model: ChartModel, width: number, height: number, measure: Measure): Prim[] {
  if (model.kind === "pie" || model.kind === "donut") return pieChart(model, width, height, measure);
  if (model.kind === "radar") return radarChart(model, width, height, measure);
  if (model.kind === "gauge") return gaugeChart(model, width, height);
  return axisChart(model, width, height, measure);
}

/** Reads a stored chart, filling in what is missing; null when it is not a chart. */
export function readChart(value: unknown): ChartModel | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!CHART_KINDS.includes(v.kind as ChartKind)) return null;
  const labels = Array.isArray(v.labels) ? v.labels.map((l) => String(l ?? "")).slice(0, MAX_CATEGORIES) : [];
  const series = (Array.isArray(v.series) ? v.series : []).slice(0, MAX_SERIES).map((raw, i) => {
    const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const values = Array.isArray(s.values) ? s.values.map((n) => (typeof n === "number" && Number.isFinite(n) ? n : 0)) : [];
    return { name: typeof s.name === "string" ? s.name : `Řada ${i + 1}`, values: labels.map((_, j) => values[j] ?? 0), color: typeof s.color === "string" ? s.color : DEFAULT_COLORS[i % DEFAULT_COLORS.length] };
  });
  return {
    kind: v.kind as ChartKind,
    labels,
    series: series.length > 0 ? series : [{ name: "Řada 1", values: labels.map(() => 0), color: DEFAULT_COLORS[0] }],
    sliceColors: Array.isArray(v.sliceColors) && v.sliceColors.length > 0 ? v.sliceColors.map(String) : [...DEFAULT_COLORS],
    showLabels: v.showLabels !== false,
    showLegend: v.showLegend !== false,
    fontFamily: typeof v.fontFamily === "string" ? v.fontFamily : "Inter",
    fontSize: typeof v.fontSize === "number" && v.fontSize > 0 ? v.fontSize : 20,
    textColor: typeof v.textColor === "string" ? v.textColor : "#3f3f46",
  };
}
