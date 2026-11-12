/** A fill as the toolbar sees it: a hex colour, a linear gradient, or nothing. */
export type GradientStop = { offset: number; color: string };
export type LinearGradientPaint = { type: "linear"; angle: number; stops: GradientStop[] };
export type Paint = string | LinearGradientPaint | null;

/** Unit-square coordinates for a linear gradient at `angle` degrees (0 = left to right, 90 = top to bottom). */
export function angleToCoords(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const cx = Math.cos(rad) / 2;
  const cy = Math.sin(rad) / 2;
  return { x1: 0.5 - cx, y1: 0.5 - cy, x2: 0.5 + cx, y2: 0.5 + cy };
}

/** Inverse of angleToCoords, rounded to whole degrees in [0, 360). */
export function coordsToAngle(c: { x1: number; y1: number; x2: number; y2: number }): number {
  const deg = (Math.atan2(c.y2 - c.y1, c.x2 - c.x1) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

export const DEFAULT_GRADIENT: LinearGradientPaint = {
  type: "linear",
  angle: 90,
  stops: [
    { offset: 0, color: "#6366f1" },
    { offset: 1, color: "#ec4899" },
  ],
};
