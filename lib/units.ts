export const UNITS = ["px", "mm", "cm", "in"] as const;
export type Unit = (typeof UNITS)[number];

/** All geometry is stored in CSS pixels at 96 DPI. */
export const PX_PER_INCH = 96;
const MM_PER_INCH = 25.4;

const pxPerUnit: Record<Unit, number> = {
  px: 1,
  mm: PX_PER_INCH / MM_PER_INCH,
  cm: PX_PER_INCH / 2.54,
  in: PX_PER_INCH,
};

export function toPx(value: number, unit: Unit): number {
  return value * pxPerUnit[unit];
}

export function fromPx(px: number, unit: Unit): number {
  return px / pxPerUnit[unit];
}

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}

/** Formats a pixel size in the given unit, e.g. "210 × 297 mm". */
export function formatSize(widthPx: number, heightPx: number, unit: Unit): string {
  const digits = unit === "in" ? 2 : unit === "cm" ? 1 : 0;
  const format = (px: number) => Number(fromPx(px, unit).toFixed(digits)).toString();
  return `${format(widthPx)} × ${format(heightPx)} ${unit}`;
}
