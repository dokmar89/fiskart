/**
 * Ruler guides of a page: positions in page pixels. Stored with the page (`canvasData.guides`),
 * never drawn in exports. Pure helpers, unit tested.
 */
import { fromPx, type Unit } from "./units";

export type Guides = { vertical: number[]; horizontal: number[] };
export type GuideAxis = keyof Guides;

export const NO_GUIDES: Guides = { vertical: [], horizontal: [] };

const isNumberList = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === "number" && Number.isFinite(n));

/** Guides read from stored page data; anything malformed counts as none. */
export function readGuides(value: unknown): Guides {
  if (!value || typeof value !== "object") return NO_GUIDES;
  const g = value as Record<string, unknown>;
  return { vertical: isNumberList(g.vertical) ? g.vertical : [], horizontal: isNumberList(g.horizontal) ? g.horizontal : [] };
}

export const hasGuides = (g: Guides) => g.vertical.length > 0 || g.horizontal.length > 0;

/** Guides with one added, moved (by index) or removed (position null). Positions are rounded to 0.01 px. */
export function withGuide(g: Guides, axis: GuideAxis, index: number | null, position: number | null): Guides {
  const list = [...g[axis]];
  const value = position === null ? null : Math.round(position * 100) / 100;
  if (index === null) {
    if (value !== null) list.push(value);
  } else if (value === null) {
    list.splice(index, 1);
  } else {
    list[index] = value;
  }
  return { ...g, [axis]: list };
}

export type RulerTick = { at: number; label: string | null };

/** Ruler steps in the display unit: 1, 2 and 5 times powers of ten. */
function niceStep(minimum: number): number {
  const power = 10 ** Math.floor(Math.log10(minimum));
  for (const factor of [1, 2, 5, 10]) if (factor * power >= minimum) return factor * power;
  return 10 * power;
}

/**
 * Ticks for a ruler `length` screen pixels long whose first pixel shows page position `start`,
 * at `scale` screen pixels per page pixel. Labelled ticks are at least `minLabelGap` screen pixels
 * apart and fall on round numbers of the display unit; unlabelled ticks divide them.
 */
export function rulerTicks(start: number, scale: number, length: number, unit: Unit, minLabelGap = 60): RulerTick[] {
  const pxPerUnit = 1 / fromPx(1, unit);
  const step = niceStep(minLabelGap / (scale * pxPerUnit));
  const firstDigit = Number(String(step).replace(/[0.]/g, "")[0] ?? 1);
  const divisions = firstDigit === 2 ? 4 : 5;
  const minor = step / divisions;
  const ticks: RulerTick[] = [];
  const first = Math.floor(fromPx(start, unit) / minor);
  const last = Math.ceil(fromPx(start + length / scale, unit) / minor);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let i = first; i <= last; i++) {
    const value = i * minor;
    const at = ((value * pxPerUnit) - start) * scale;
    const labelled = i % divisions === 0;
    ticks.push({ at, label: labelled ? (Math.round(value * 1e6) / 1e6).toFixed(decimals) : null });
  }
  return ticks;
}
