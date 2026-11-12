export type BrushPoint = { x: number; y: number; pressure: number };

/** Project a Shift-assisted stroke onto whichever axis is closer to its starting point. */
export function snapDrawingPoint(start: { x: number; y: number }, point: { x: number; y: number }) {
  return Math.abs(point.x - start.x) >= Math.abs(point.y - start.y) ? { x: point.x, y: start.y } : { x: start.x, y: point.y };
}

/** A filled vector ribbon with a fixed angled nib and a width that follows pen pressure. */
export function chiselPath(points: BrushPoint[], width: number): string {
  if (points.length < 2) return "";
  const coordinate = (point: BrushPoint, side: number) => {
    const half = Math.max(0.5, width * Math.max(0.1, Math.min(1, point.pressure)) / 2);
    return `${Number((point.x + side * half * 0.7071).toFixed(2))} ${Number((point.y - side * half * 0.7071).toFixed(2))}`;
  };
  return `M ${points.map((p) => coordinate(p, 1)).join(" L ")} L ${[...points].reverse().map((p) => coordinate(p, -1)).join(" L ")} Z`;
}
