import type { FrameShape } from "./frames";

type Detail =
  | { t: "rect"; x: number; y: number; w: number; h: number; radius: number; fill: string; opacity?: number; stroke?: string }
  | { t: "circle"; x: number; y: number; radius: number; fill: string; opacity?: number }
  | { t: "line"; x: number; y: number; x2: number; y2: number; width: number; stroke: string; opacity?: number };

/** Details use the same local coordinates as a Fabric image or path: the box is centred at zero. */
export function deviceOverlay(shape: FrameShape, w: number, h: number): Detail[] {
  const left = -w / 2, top = -h / 2;
  const dark = "#18181b", muted = "#52525b";
  switch (shape) {
    case "phone": return [
      { t: "rect", x: -w * 0.145, y: top + h * 0.028, w: w * 0.29, h: h * 0.052, radius: h * 0.026, fill: dark },
      { t: "circle", x: w * 0.09, y: top + h * 0.054, radius: Math.max(1, w * 0.012), fill: muted },
      { t: "line", x: -w * 0.11, y: top + h * 0.965, x2: w * 0.11, y2: top + h * 0.965, width: Math.max(1, h * 0.007), stroke: dark, opacity: 0.7 },
    ];
    case "tablet": return [
      { t: "circle", x: 0, y: top + h * 0.032, radius: Math.max(1, w * 0.009), fill: dark },
      { t: "rect", x: left + w * 0.028, y: top + h * 0.025, w: w * 0.944, h: h * 0.95, radius: Math.min(w, h) * 0.045, fill: "none", stroke: dark, opacity: 0.7 },
    ];
    case "smartwatch": return [
      { t: "rect", x: left + w * 0.055, y: top + h * 0.055, w: w * 0.89, h: h * 0.89, radius: Math.min(w, h) * 0.22, fill: "none", stroke: dark, opacity: 0.8 },
      { t: "circle", x: left + w * 0.94, y: 0, radius: Math.max(2, w * 0.025), fill: dark },
    ];
    case "browser": return [
      { t: "rect", x: left, y: top, w, h: h * 0.145, radius: Math.min(w, h) * 0.03, fill: "#f4f4f5", opacity: 0.98 },
      { t: "circle", x: left + w * 0.045, y: top + h * 0.07, radius: Math.max(2, h * 0.014), fill: "#ef4444" },
      { t: "circle", x: left + w * 0.078, y: top + h * 0.07, radius: Math.max(2, h * 0.014), fill: "#f59e0b" },
      { t: "circle", x: left + w * 0.111, y: top + h * 0.07, radius: Math.max(2, h * 0.014), fill: "#22c55e" },
      { t: "rect", x: left + w * 0.19, y: top + h * 0.032, w: w * 0.57, h: h * 0.075, radius: h * 0.02, fill: "#ffffff", stroke: "#d4d4d8" },
      { t: "line", x: left + w * 0.22, y: top + h * 0.07, x2: left + w * 0.46, y2: top + h * 0.07, width: Math.max(1, h * 0.008), stroke: "#a1a1aa" },
    ];
    case "laptop": return [
      { t: "circle", x: 0, y: top + h * 0.035, radius: Math.max(1, w * 0.006), fill: dark },
      { t: "rect", x: left + w * 0.025, y: top + h * 0.825, w: w * 0.95, h: h * 0.15, radius: h * 0.018, fill: "#27272a", opacity: 0.94 },
      ...[0, 1, 2].map((i): Detail => ({ t: "line", x: left + w * 0.13, y: top + h * (0.85 + i * 0.032), x2: left + w * 0.87, y2: top + h * (0.85 + i * 0.032), width: Math.max(1, h * 0.01), stroke: "#71717a" })),
      { t: "rect", x: left + w * 0.42, y: top + h * 0.945, w: w * 0.16, h: h * 0.022, radius: h * 0.006, fill: "#52525b" },
    ];
    default: return [];
  }
}

export function renderDeviceOverlay(ctx: CanvasRenderingContext2D, shape: FrameShape, w: number, h: number) {
  for (const p of deviceOverlay(shape, w, h)) {
    ctx.save();
    ctx.globalAlpha *= p.opacity ?? 1;
    if (p.t === "circle") { ctx.fillStyle = p.fill; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); }
    if (p.t === "rect") {
      ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, p.radius);
      if (p.fill !== "none") { ctx.fillStyle = p.fill; ctx.fill(); }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.007); ctx.stroke(); }
    }
    if (p.t === "line") { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.width; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke(); }
    ctx.restore();
  }
}

const num = (v: number) => String(Math.round(v * 1000) / 1000);

export function deviceOverlaySvg(shape: FrameShape, w: number, h: number): string {
  const details = deviceOverlay(shape, w, h);
  if (details.length === 0) return "";
  return `<g data-device-overlay="${shape}">${details.map((p) => {
    const opacity = p.opacity === undefined ? "" : ` opacity="${num(p.opacity)}"`;
    if (p.t === "circle") return `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(p.radius)}" fill="${p.fill}"${opacity} />`;
    if (p.t === "rect") return `<rect x="${num(p.x)}" y="${num(p.y)}" width="${num(p.w)}" height="${num(p.h)}" rx="${num(p.radius)}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${num(Math.max(1, Math.min(w, h) * 0.007))}"` : ""}${opacity} />`;
    return `<line x1="${num(p.x)}" y1="${num(p.y)}" x2="${num(p.x2)}" y2="${num(p.y2)}" stroke="${p.stroke}" stroke-width="${num(p.width)}" stroke-linecap="round"${opacity} />`;
  }).join("")}</g>`;
}
