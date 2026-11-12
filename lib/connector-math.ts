/**
 * Lines and connectors: where they attach to shapes, the path of an elbow connector, and the
 * geometry of their ends. Pure, unit tested.
 */

export type Pt = { x: number; y: number };
export type Box = { left: number; top: number; width: number; height: number };
export type Side = "top" | "right" | "bottom" | "left";
export type Anchor = Side | "center";
export type Route = "straight" | "elbow";
export type Head = "none" | "arrow" | "circle" | "square";

export const ANCHORS: Anchor[] = ["top", "right", "bottom", "left", "center"];
export const HEADS: Head[] = ["none", "arrow", "circle", "square"];

export function anchorPoint(box: Box, anchor: Anchor): Pt {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  switch (anchor) {
    case "top":
      return { x: cx, y: box.top };
    case "right":
      return { x: box.left + box.width, y: cy };
    case "bottom":
      return { x: cx, y: box.top + box.height };
    case "left":
      return { x: box.left, y: cy };
    case "center":
      return { x: cx, y: cy };
  }
}

/** The anchor of a box nearest to a point within `threshold`; dropped on the shape itself, the side nearest the point. */
export function nearestAnchor(box: Box, point: Pt, threshold: number): Anchor | null {
  let best: Anchor | null = null;
  let bestDistance = threshold;
  for (const anchor of ANCHORS) {
    const p = anchorPoint(box, anchor);
    const d = Math.hypot(p.x - point.x, p.y - point.y);
    if (d <= bestDistance) {
      best = anchor;
      bestDistance = d;
    }
  }
  if (best) return best;
  const inside = point.x >= box.left && point.x <= box.left + box.width && point.y >= box.top && point.y <= box.top + box.height;
  if (!inside) return null;
  const distances: [Side, number][] = [
    ["top", point.y - box.top],
    ["right", box.left + box.width - point.x],
    ["bottom", box.top + box.height - point.y],
    ["left", point.x - box.left],
  ];
  return distances.sort((a, b) => a[1] - b[1])[0][0];
}

const DIRECTION: Record<Side, Pt> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const isSide = (a: Anchor | null | undefined): a is Side => a === "top" || a === "right" || a === "bottom" || a === "left";
const horizontalSide = (a: Side) => a === "left" || a === "right";

/** Points without repeats and without the middle points of straight runs (a point where the line turns back stays). */
export function simplify(points: Pt[]): Pt[] {
  const same = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
  const unique = points.filter((p, i) => i === 0 || !same(p, points[i - 1]));
  return unique.filter((p, i) => {
    if (i === 0 || i === unique.length - 1) return true;
    const a = unique[i - 1];
    const b = unique[i + 1];
    const vertical = Math.abs(a.x - p.x) < 1e-6 && Math.abs(p.x - b.x) < 1e-6;
    const horizontal = Math.abs(a.y - p.y) < 1e-6 && Math.abs(p.y - b.y) < 1e-6;
    const onward = (p.x - a.x) * (b.x - p.x) + (p.y - a.y) * (b.y - p.y) >= 0;
    return !((vertical || horizontal) && onward);
  });
}

/**
 * The corner points of an elbow connector from `start` to `end`. An end attached to a side of a
 * shape leaves (or enters) it straight out of that side for at least `gap`; free ends just turn
 * halfway. Every segment is horizontal or vertical.
 */
export function elbowRoute(start: Pt, end: Pt, startSide?: Anchor | null, endSide?: Anchor | null, gap = 24): Pt[] {
  const s1 = isSide(startSide) ? { x: start.x + DIRECTION[startSide].x * gap, y: start.y + DIRECTION[startSide].y * gap } : start;
  const e1 = isSide(endSide) ? { x: end.x + DIRECTION[endSide].x * gap, y: end.y + DIRECTION[endSide].y * gap } : end;
  // Run first along the axis the start leaves on; between free ends, along the longer distance.
  const horizontalFirst = isSide(startSide)
    ? horizontalSide(startSide)
    : isSide(endSide)
      ? !horizontalSide(endSide)
      : Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  // When the end lies behind the way the start leaves, the line turns across first and comes round.
  const behind =
    isSide(startSide) &&
    (horizontalFirst ? Math.sign(e1.x - s1.x) === -DIRECTION[startSide].x : Math.sign(e1.y - s1.y) === -DIRECTION[startSide].y);
  const across = behind ? !horizontalFirst : horizontalFirst;
  const middle = across
    ? [{ x: (s1.x + e1.x) / 2, y: s1.y }, { x: (s1.x + e1.x) / 2, y: e1.y }]
    : [{ x: s1.x, y: (s1.y + e1.y) / 2 }, { x: e1.x, y: (s1.y + e1.y) / 2 }];
  return simplify([start, s1, ...middle, e1, end]);
}

/** The points a connector passes through. */
export function connectorPoints(route: Route, start: Pt, end: Pt, startSide?: Anchor | null, endSide?: Anchor | null): Pt[] {
  return route === "elbow" ? elbowRoute(start, end, startSide, endSide) : [start, end];
}

/** How much of the line's end a head covers, so the stroke stops under the head instead of poking through. */
export function headInset(head: Head, size: number): number {
  return head === "arrow" ? size * 0.9 : head === "none" ? 0 : size / 2;
}

/**
 * The outline of a head at `tip`, pointing along the direction from `from` to `tip`: an arrow is a
 * filled triangle, a square is centred on the tip, a circle is its centre and radius.
 */
export function headShape(head: Head, tip: Pt, from: Pt, size: number): { polygon?: Pt[]; circle?: { center: Pt; radius: number } } {
  if (head === "none") return {};
  const length = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / length;
  const uy = (tip.y - from.y) / length;
  const px = -uy;
  const py = ux;
  if (head === "circle") return { circle: { center: tip, radius: size / 2 } };
  if (head === "square") {
    const h = size / 2;
    return {
      polygon: [
        { x: tip.x + (ux + px) * h, y: tip.y + (uy + py) * h },
        { x: tip.x + (ux - px) * h, y: tip.y + (uy - py) * h },
        { x: tip.x - (ux + px) * h, y: tip.y - (uy + py) * h },
        { x: tip.x - (ux - px) * h, y: tip.y - (uy - py) * h },
      ],
    };
  }
  const back = { x: tip.x - ux * size, y: tip.y - uy * size };
  return {
    polygon: [tip, { x: back.x + px * size * 0.5, y: back.y + py * size * 0.5 }, { x: back.x - px * size * 0.5, y: back.y - py * size * 0.5 }],
  };
}
