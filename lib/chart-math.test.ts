import { describe, expect, it } from "vitest";
import { CHART_KINDS, defaultChart, formatTick, layoutChart, niceStep, niceTicks, readChart, scale, slices } from "./chart-math";

const measure = (text: string, size: number) => text.length * size * 0.5;

describe("niceStep", () => {
  it("rounds up to 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.3)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(37)).toBe(50);
    expect(niceStep(0.012)).toBe(0.02);
  });
});

describe("niceTicks", () => {
  it("covers the data from zero on round numbers", () => {
    expect(niceTicks(12, 24, 5)).toEqual({ min: 0, max: 25, step: 5, values: [0, 5, 10, 15, 20, 25] });
  });

  it("includes negative values and zero", () => {
    const t = niceTicks(-30, 70, 5);
    expect(t.min).toBe(-40);
    expect(t.max).toBe(80);
    expect(t.values).toContain(0);
  });

  it("handles all-zero data and decimals", () => {
    expect(niceTicks(0, 0)).toMatchObject({ min: 0, max: 1 });
    expect(niceTicks(0, 0.9, 4).values).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe("formatTick and scale", () => {
  it("shows as many decimals as the step needs", () => {
    expect(formatTick(0.5, 0.25)).toBe("0.50");
    expect(formatTick(20, 5)).toBe("20");
    expect(formatTick(2.5, 2.5)).toBe("2.5");
  });

  it("maps values linearly between the axis ends", () => {
    const t = niceTicks(0, 100, 5);
    expect(scale(50, t, 200, 0)).toBe(100);
    expect(scale(0, t, 200, 0)).toBe(200);
  });
});

describe("slices", () => {
  it("splits the circle by share, clockwise from the top", () => {
    const s = slices([1, 1, 2]);
    expect(s[0].start).toBeCloseTo(-Math.PI / 2);
    expect(s[2].share).toBe(0.5);
    expect(s[2].end).toBeCloseTo(Math.PI * 1.5);
    expect(slices([0, -5])).toEqual([
      { start: -Math.PI / 2, end: -Math.PI / 2, share: 0 },
      { start: -Math.PI / 2, end: -Math.PI / 2, share: 0 },
    ]);
  });
});

describe("layoutChart", () => {
  it("has eight real chart kinds with finite drawing primitives", () => {
    expect(CHART_KINDS).toEqual(expect.arrayContaining(["bar", "stacked", "line", "area", "pie", "donut", "radar", "gauge"]));
    for (const kind of CHART_KINDS) {
      const prims = layoutChart(defaultChart(kind, "Inter", 20), 600, 420, measure);
      expect(prims.length).toBeGreaterThan(2);
      expect(JSON.stringify(prims)).not.toContain("null");
    }
  });

  it("draws stacked columns, filled area, radar polygon and half gauge", () => {
    const stacked = layoutChart(defaultChart("stacked", "Inter", 20), 600, 420, measure).filter((p) => p.t === "rect");
    expect(stacked.length).toBeGreaterThanOrEqual(8);
    const area = layoutChart(defaultChart("area", "Inter", 20), 600, 420, measure);
    expect(area.some((p) => p.t === "polygon")).toBe(true);
    const radar = layoutChart(defaultChart("radar", "Inter", 20), 600, 420, measure);
    expect(radar.some((p) => p.t === "polygon")).toBe(true);
    const gauge = layoutChart(defaultChart("gauge", "Inter", 20), 600, 420, measure);
    expect(gauge.filter((p) => p.t === "wedge").length).toBeGreaterThanOrEqual(2);
  });
  it("draws one bar per value with heights in proportion", () => {
    const model = { ...defaultChart("bar", "Inter", 20), series: [{ name: "A", values: [10, 20, 0, 5], color: "#000000" }], showLegend: false };
    const bars = layoutChart(model, 800, 500, measure).filter((p) => p.t === "rect");
    expect(bars).toHaveLength(4);
    const h = bars.map((b) => (b.t === "rect" ? b.h : 0));
    expect(h[1]).toBeCloseTo(h[0] * 2);
    expect(h[2]).toBe(0);
  });

  it("draws a line through every value and a legend entry per series", () => {
    const model = { ...defaultChart("line", "Inter", 20), showLegend: true };
    const prims = layoutChart(model, 800, 500, measure);
    const lines = prims.filter((p) => p.t === "line" && p.points.length === 4);
    expect(lines).toHaveLength(2);
    expect(prims.filter((p) => p.t === "text" && (p.text === "2025" || p.text === "2026"))).toHaveLength(2);
  });

  it("draws a donut as wedges with a hole, one per category", () => {
    const wedges = layoutChart(defaultChart("donut", "Inter", 20), 600, 600, measure).filter((p) => p.t === "wedge");
    expect(wedges).toHaveLength(4);
    expect(wedges.every((w) => w.t === "wedge" && w.inner > 0)).toBe(true);
  });
});

describe("readChart", () => {
  it("fills in missing values and rejects non-charts", () => {
    const chart = readChart({ kind: "bar", labels: ["a", "b"], series: [{ name: "S", values: [1] }] });
    expect(chart?.series[0].values).toEqual([1, 0]);
    expect(chart?.showLegend).toBe(true);
    expect(readChart({ kind: "radar" })?.kind).toBe("radar");
    expect(readChart({ kind: "missing" })).toBeNull();
  });
});
