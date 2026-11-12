import { bottom, centerX, centerY, right, type Box } from "./geometry";
import type { Size } from "./viewport-math";

/** A line objects can snap to: at `pos` on one axis, drawn from `start` to `end` on the other. */
export type SnapLine = { pos: number; start: number; end: number };
export type SnapTargets = { vertical: SnapLine[]; horizontal: SnapLine[] };
export type Guide = { orientation: "vertical" | "horizontal"; pos: number; start: number; end: number };
export type SnapResult = { dx: number; dy: number; guides: Guide[] };

/** Edges and centres of the page and of the other objects, collected once when a drag starts. */
export function snapTargets(others: Box[], page: Size): SnapTargets {
  const vertical: SnapLine[] = [0, page.width / 2, page.width].map((pos) => ({ pos, start: 0, end: page.height }));
  const horizontal: SnapLine[] = [0, page.height / 2, page.height].map((pos) => ({ pos, start: 0, end: page.width }));
  for (const b of others) {
    for (const pos of [b.left, centerX(b), right(b)]) vertical.push({ pos, start: b.top, end: bottom(b) });
    for (const pos of [b.top, centerY(b), bottom(b)]) horizontal.push({ pos, start: b.left, end: right(b) });
  }
  return { vertical, horizontal };
}

/** Smallest shift within `threshold` that puts one of `points` on one of `lines`, or 0. */
function bestShift(points: number[], lines: SnapLine[], threshold: number): number {
  let best = 0;
  let bestDistance = threshold;
  let found = false;
  for (const line of lines) {
    for (const p of points) {
      const d = line.pos - p;
      if (Math.abs(d) <= bestDistance && (!found || Math.abs(d) < Math.abs(best))) {
        best = d;
        bestDistance = Math.abs(d);
        found = true;
      }
    }
  }
  return best;
}

/** Guides for every target line that one of `points` now lies on, merged per position. */
function guidesFor(
  orientation: Guide["orientation"],
  points: number[],
  lines: SnapLine[],
  span: [number, number],
): Guide[] {
  const byPos = new Map<number, Guide>();
  for (const line of lines) {
    if (!points.some((p) => Math.abs(line.pos - p) < 0.5)) continue;
    const key = Math.round(line.pos * 2) / 2;
    const existing = byPos.get(key);
    const start = Math.min(line.start, span[0], existing?.start ?? Infinity);
    const end = Math.max(line.end, span[1], existing?.end ?? -Infinity);
    byPos.set(key, { orientation, pos: line.pos, start, end });
  }
  return [...byPos.values()];
}

/**
 * Where a moving box should go: each axis snaps its edges or centre to the nearest target line
 * within `threshold` (scene pixels), independently. Guides show every alignment after the snap.
 */
export function snap(moving: Box, targets: SnapTargets, threshold: number): SnapResult {
  const dx = bestShift([moving.left, centerX(moving), right(moving)], targets.vertical, threshold);
  const dy = bestShift([moving.top, centerY(moving), bottom(moving)], targets.horizontal, threshold);
  const moved: Box = { ...moving, left: moving.left + dx, top: moving.top + dy };
  return {
    dx,
    dy,
    guides: [
      ...guidesFor("vertical", [moved.left, centerX(moved), right(moved)], targets.vertical, [moved.top, bottom(moved)]),
      ...guidesFor("horizontal", [moved.top, centerY(moved), bottom(moved)], targets.horizontal, [moved.left, right(moved)]),
    ],
  };
}
