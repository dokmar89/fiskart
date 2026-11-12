import type { Point } from "./viewport-math";

/** Points of a star centred on the origin, starting at the top and alternating outer and inner radius. */
export function starPoints(spikes: number, outerRadius: number, innerRadius: number): Point[] {
  const points: Point[] = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + i * step;
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return points;
}

/** SVG path of a horizontal arrow from (0, 0) to (length, 0) with an open head. */
export function arrowPath(length: number, headSize: number): string {
  const back = length - headSize;
  return `M 0 0 L ${length} 0 M ${back} ${-headSize} L ${length} 0 L ${back} ${headSize}`;
}
