/**
 * A heavy page for checking that dragging stays smooth: 200 objects (shapes, outlined shapes,
 * gradients and text) on a 1920 × 1080 page. Plain Fabric JSON, as the editor stores it.
 */
export const STRESS_PAGE = { width: 1920, height: 1080 };

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#14b8a6", "#f43f5e", "#64748b"];

export function stressObjects(count = 200): Record<string, unknown>[] {
  const columns = 20;
  const rows = Math.ceil(count / columns);
  const cellW = STRESS_PAGE.width / columns;
  const cellH = STRESS_PAGE.height / rows;
  return Array.from({ length: count }, (_, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const left = col * cellW + 6;
    const top = row * cellH + 6;
    const color = COLORS[i % COLORS.length];
    const base = { id: `stress-${i}`, locked: false, left, top };
    switch (i % 5) {
      case 0:
        return { ...base, type: "Rect", name: "Rectangle", width: cellW - 12, height: cellH - 12, fill: color, rx: 8, ry: 8 };
      case 1:
        return { ...base, type: "Ellipse", name: "Ellipse", rx: (cellW - 12) / 2, ry: (cellH - 12) / 2, fill: color, stroke: "#18181b", strokeWidth: 3, strokeUniform: true };
      case 2:
        return {
          ...base,
          type: "Rect",
          name: "Gradient",
          width: cellW - 12,
          height: cellH - 12,
          fill: {
            type: "linear",
            gradientUnits: "percentage",
            coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
            colorStops: [
              { offset: 0, color },
              { offset: 1, color: "#ffffff" },
            ],
          },
        };
      case 3:
        return { ...base, type: "Triangle", name: "Triangle", width: cellW - 12, height: cellH - 12, fill: color };
      default:
        return {
          ...base,
          type: "Textbox",
          name: "Text",
          text: `Text ${i}`,
          width: cellW - 12,
          fontSize: 18,
          fontFamily: "Inter",
          fontWeight: i % 2 ? "700" : "400",
          fill: "#18181b",
          textAlign: "center",
        };
    }
  });
}
