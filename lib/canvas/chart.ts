import { classRegistry, FabricObject, Point, type Canvas, type FabricObject as FO } from "fabric";
import { defaultChart, layoutChart, readChart, type ChartModel, type Prim } from "@/lib/chart-math";
import { DEFAULT_FONT_FAMILY } from "@/lib/fonts";

declare module "fabric" {
  interface FabricObject {
    /** Charts only: the stored chart (kind, data, colours, options). */
    chart?: ChartModel;
  }
}

let measuring: CanvasRenderingContext2D | null = null;
function measurer(family: string) {
  measuring ??= document.createElement("canvas").getContext("2d");
  return (text: string, size: number) => {
    if (!measuring) return text.length * size * 0.55;
    measuring.font = `${size}px "${family}"`;
    return measuring.measureText(text).width;
  };
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => String(Math.round(v * 1000) / 1000);

function wedgePath(p: Extract<Prim, { t: "wedge" }>): string {
  const full = p.end - p.start >= Math.PI * 2 - 1e-6;
  const end = full ? p.end - 1e-4 : p.end;
  const large = end - p.start > Math.PI ? 1 : 0;
  const at = (r: number, a: number) => `${n(p.cx + r * Math.cos(a))} ${n(p.cy + r * Math.sin(a))}`;
  if (p.inner > 0) {
    return `M${at(p.r, p.start)} A${n(p.r)} ${n(p.r)} 0 ${large} 1 ${at(p.r, end)} L${at(p.inner, end)} A${n(p.inner)} ${n(p.inner)} 0 ${large} 0 ${at(p.inner, p.start)} Z`;
  }
  return `M${n(p.cx)} ${n(p.cy)} L${at(p.r, p.start)} A${n(p.r)} ${n(p.r)} 0 ${large} 1 ${at(p.r, end)} Z`;
}

/**
 * A chart (phase 15): bar, line, pie or donut, drawn from its data by lib/chart-math.ts. The canvas
 * and the SVG export draw the same layout. Resizing changes the chart's box (and lays it out
 * again) rather than stretching its text.
 */
export class Chart extends FabricObject {
  static type = "Chart";

  declare chart: ChartModel;

  constructor(options: Record<string, unknown> = {}) {
    super();
    this.set({ width: 640, height: 420, fill: null, stroke: null, strokeWidth: 0, objectCaching: false, lockSkewingX: true, lockSkewingY: true });
    this.setOptions(options);
    this.chart = readChart(options.chart) ?? defaultChart("bar", DEFAULT_FONT_FAMILY, 20);
  }

  prims(): Prim[] {
    return layoutChart(this.chart, this.width, this.height, measurer(this.chart.fontFamily));
  }

  _render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    for (const p of this.prims()) {
      switch (p.t) {
        case "rect":
          ctx.fillStyle = p.fill;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          break;
        case "line":
          if (p.points.length < 2) break;
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = p.width;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.beginPath();
          p.points.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
          ctx.stroke();
          break;
        case "polygon":
          if (p.points.length < 3) break;
          ctx.beginPath();
          p.points.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
          ctx.closePath();
          if (p.fill !== "none") {
            ctx.save();
            ctx.globalAlpha *= p.opacity ?? 1;
            ctx.fillStyle = p.fill;
            ctx.fill();
            ctx.restore();
          }
          if (p.stroke) {
            ctx.strokeStyle = p.stroke;
            ctx.lineWidth = p.width ?? 1;
            ctx.stroke();
          }
          break;
        case "dot":
          ctx.fillStyle = p.fill;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "wedge":
          ctx.fillStyle = p.fill;
          ctx.fill(new Path2D(wedgePath(p)));
          break;
        case "text":
          ctx.fillStyle = p.fill;
          ctx.font = `${p.size}px "${this.chart.fontFamily}"`;
          ctx.textAlign = p.align;
          ctx.textBaseline = "alphabetic";
          ctx.fillText(p.text, p.x, p.y);
          break;
      }
    }
    ctx.restore();
  }

  toObject(propertiesToInclude: string[] = []) {
    return { ...super.toObject(propertiesToInclude as never[]), chart: JSON.parse(JSON.stringify(this.chart)) as ChartModel };
  }

  static async fromObject(object: Record<string, unknown>) {
    const { type, ...options } = object;
    void type;
    return new Chart(options);
  }

  _toSVG(): string[] {
    const ox = -this.width / 2;
    const oy = -this.height / 2;
    const family = escapeXml(this.chart.fontFamily);
    const parts = this.prims().map((p) => {
      switch (p.t) {
        case "rect":
          return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="${p.fill}" />`;
        case "line":
          return `<polyline points="${p.points.map((q) => `${n(q.x)},${n(q.y)}`).join(" ")}" fill="none" stroke="${p.stroke}" stroke-width="${n(p.width)}" stroke-linejoin="round" stroke-linecap="round" />`;
        case "polygon":
          return `<polygon points="${p.points.map((q) => `${n(q.x)},${n(q.y)}`).join(" ")}" fill="${p.fill}" fill-opacity="${n(p.opacity ?? 1)}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${n(p.width ?? 1)}"` : ""} />`;
        case "dot":
          return `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(p.r)}" fill="${p.fill}" />`;
        case "wedge":
          return `<path d="${wedgePath(p)}" fill="${p.fill}" />`;
        case "text": {
          const anchor = p.align === "left" ? "start" : p.align === "right" ? "end" : "middle";
          return `<text x="${n(p.x)}" y="${n(p.y)}" font-family="${family}" font-size="${n(p.size)}" text-anchor="${anchor}" fill="${p.fill}">${escapeXml(p.text)}</text>`;
        }
      }
    });
    return ["<g ", "COMMON_PARTS", " >", `<g transform="translate(${n(ox)} ${n(oy)})">`, ...parts, "</g>", "</g>\n"];
  }
}

classRegistry.setClass(Chart);

/**
 * A chart scaled with its handles gets the new size as its box, unscaled, so the layout uses the
 * room instead of stretching text. Returns a cleanup function.
 */
export function installCharts(canvas: Canvas) {
  const onModified = ({ target }: { target?: FO }) => {
    if (!(target instanceof Chart) || (target.scaleX === 1 && target.scaleY === 1)) return;
    const corner = target.translateToOriginPoint(target.getCenterPoint(), "left", "top");
    target.set({
      width: Math.max(80, target.width * Math.abs(target.scaleX)),
      height: Math.max(60, target.height * Math.abs(target.scaleY)),
      scaleX: 1,
      scaleY: 1,
      dirty: true,
    });
    target.setPositionByOrigin(new Point(corner.x, corner.y), "left", "top");
    target.setCoords();
    canvas.requestRenderAll();
  };
  canvas.on("object:modified", onModified);
  return () => canvas.off("object:modified", onModified);
}
