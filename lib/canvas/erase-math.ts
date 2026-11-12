import type { Point } from "./viewport-math";

/**
 * The points a path passes through or near, in order: the end and control points of its commands.
 * Freehand strokes are short curves, so the polyline through these is close to the drawn line.
 */
export function pathPoints(path: readonly (readonly (string | number)[])[]): Point[] {
  const points: Point[] = [];
  for (const command of path) {
    const numbers = command.slice(1).filter((n): n is number => typeof n === "number");
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return points;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Shortest distance from `p` to the polyline through `points` (Infinity for none). */
export function distanceToPolyline(points: Point[], p: Point): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) best = Math.min(best, distanceToSegment(p, points[i - 1], points[i]));
  return best;
}

/** Points along the pointer's movement from `a` to `b`, at most `step` apart, so a fast swipe misses nothing. */
export function sweep(a: Point, b: Point, step: number): Point[] {
  const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / Math.max(step, 0.001)));
  return Array.from({ length: count + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / count, y: a.y + ((b.y - a.y) * i) / count }));
}
