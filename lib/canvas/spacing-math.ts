import { bottom, right, type Box } from "./geometry";

/** A gap drawn as a measurement while spacing snaps: from `start` to `end` on its axis, at `at` across it. */
export type SpacingMark = { axis: "x" | "y"; start: number; end: number; at: number };
export type SpacingResult = { shift: number; marks: SpacingMark[] };

type Span = { start: number; end: number };
type Item = { main: Span; cross: Span };

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

function toItem(box: Box, axis: "x" | "y"): Item {
  return axis === "x"
    ? { main: { start: box.left, end: right(box) }, cross: { start: box.top, end: bottom(box) } }
    : { main: { start: box.top, end: bottom(box) }, cross: { start: box.left, end: right(box) } };
}

/** Middle of where two cross spans overlap, for drawing a gap between them. */
const crossMiddle = (a: Span, b: Span) => (Math.max(a.start, b.start) + Math.min(a.end, b.end)) / 2;

/**
 * Equal spacing along one axis: shifts the moving box (within `threshold`) so that it sits halfway
 * between its nearest neighbours in the same row (or column), or so that its gap to a neighbour
 * repeats the gap between that neighbour and the next one. Returns the smallest such shift and the
 * gaps to draw, or a zero shift with no marks.
 */
export function spacingSnap(moving: Box, others: Box[], axis: "x" | "y", threshold: number): SpacingResult {
  const m = toItem(moving, axis);
  const size = m.main.end - m.main.start;
  // Only boxes in the same row (column) count, and only those entirely on one side of the moving one.
  const row = others.map((b) => toItem(b, axis)).filter((o) => overlaps(o.cross, m.cross));
  const before = row.filter((o) => o.main.end <= m.main.start + threshold).sort((a, b) => b.main.end - a.main.end);
  const after = row.filter((o) => o.main.start >= m.main.end - threshold).sort((a, b) => a.main.start - b.main.start);

  type Candidate = { position: number; marks: (start: number) => SpacingMark[] };
  const candidates: Candidate[] = [];
  const mark = (start: number, end: number, a: Item, b: Item): SpacingMark => ({ axis, start, end, at: crossMiddle(a.cross, b.cross) });
  const [prev, prev2] = before;
  const [next, next2] = after;

  if (prev && next && next.main.start - prev.main.end > size) {
    // Halfway between the two neighbours.
    candidates.push({
      position: (prev.main.end + next.main.start - size) / 2,
      marks: (start) => [mark(prev.main.end, start, prev, m), mark(start + size, next.main.start, m, next)],
    });
  }
  if (prev && prev2 && prev.main.start - prev2.main.end > 0) {
    // Continues the row's spacing after the previous two.
    const gap = prev.main.start - prev2.main.end;
    candidates.push({
      position: prev.main.end + gap,
      marks: (start) => [mark(prev2.main.end, prev.main.start, prev2, prev), mark(prev.main.end, start, prev, m)],
    });
  }
  if (next && next2 && next2.main.start - next.main.end > 0) {
    const gap = next2.main.start - next.main.end;
    candidates.push({
      position: next.main.start - gap - size,
      marks: (start) => [mark(start + size, next.main.start, m, next), mark(next.main.end, next2.main.start, next, next2)],
    });
  }

  let best: SpacingResult = { shift: 0, marks: [] };
  let bestDistance = Infinity;
  for (const c of candidates) {
    const shift = c.position - m.main.start;
    if (Math.abs(shift) <= threshold && Math.abs(shift) < bestDistance) {
      bestDistance = Math.abs(shift);
      best = { shift, marks: c.marks(c.position) };
    }
  }
  return best;
}
