import { bottom, centerX, centerY, right, type Box } from "./geometry";

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type Offset = { dx: number; dy: number };

/** Offsets that align each box to `target` (the page, or the selection's bounds). */
export function alignOffsets(boxes: Box[], target: Box, mode: AlignMode): Offset[] {
  return boxes.map((b) => {
    switch (mode) {
      case "left":
        return { dx: target.left - b.left, dy: 0 };
      case "center":
        return { dx: centerX(target) - centerX(b), dy: 0 };
      case "right":
        return { dx: right(target) - right(b), dy: 0 };
      case "top":
        return { dx: 0, dy: target.top - b.top };
      case "middle":
        return { dx: 0, dy: centerY(target) - centerY(b) };
      case "bottom":
        return { dx: 0, dy: bottom(target) - bottom(b) };
    }
  });
}

/**
 * Offsets that space boxes evenly along an axis: the outermost stay put and the gaps between
 * neighbours become equal. Needs three or more boxes; otherwise nothing moves.
 */
export function distributeOffsets(boxes: Box[], axis: "horizontal" | "vertical"): Offset[] {
  const offsets: Offset[] = boxes.map(() => ({ dx: 0, dy: 0 }));
  if (boxes.length < 3) return offsets;
  const start = (b: Box) => (axis === "horizontal" ? b.left : b.top);
  const size = (b: Box) => (axis === "horizontal" ? b.width : b.height);
  const end = (b: Box) => start(b) + size(b);

  const order = boxes.map((_, i) => i).sort((a, b) => start(boxes[a]) - start(boxes[b]));
  const first = start(boxes[order[0]]);
  const last = Math.max(...boxes.map(end));
  const totalSize = boxes.reduce((sum, b) => sum + size(b), 0);
  const gap = (last - first - totalSize) / (boxes.length - 1);

  let cursor = first;
  for (const i of order) {
    const shift = cursor - start(boxes[i]);
    offsets[i] = axis === "horizontal" ? { dx: shift, dy: 0 } : { dx: 0, dy: shift };
    cursor += size(boxes[i]) + gap;
  }
  return offsets;
}
