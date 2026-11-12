/**
 * Photo grid layouts: rows of cells (fractions of the grid's width and height) laid out in an area
 * with even spacing between cells. Pure, unit tested.
 */

export type Box = { left: number; top: number; width: number; height: number; angle?: number };

/** Each layout is rows of cells; a cell spanning two rows is given as a column split instead. */
type NormalizedBox = readonly [x: number, y: number, width: number, height: number];
type Layout = { id: string; label: string; cells: number; columns?: { width: number; rows: number }[]; boxes?: readonly NormalizedBox[]; angles?: readonly number[] };

const boxes = (id: string, label: string, cells: readonly NormalizedBox[], angles?: readonly number[]): Layout => ({ id, label, cells: cells.length, boxes: cells, angles });
const columns = (id: string, label: string, widths: number[], rows: number[]): Layout => ({ id, label, cells: rows.reduce((a, b) => a + b, 0), columns: widths.map((width, i) => ({ width, rows: rows[i] })) });
const strips = (count: number): NormalizedBox[] => Array.from({ length: count }, (_, i) => [i / count, 0, 1 / count, 1]);
const mosaic = (cols: number, rows: number): NormalizedBox[] => Array.from({ length: cols * rows }, (_, i) => [(i % cols) / cols, Math.floor(i / cols) / rows, 1 / cols, 1 / rows]);

/** Column-wise layouts: each column has a share of the width and a number of equal rows. */
export const GRID_LAYOUTS: Layout[] = [
  { id: "2-side", label: "2 vedle sebe", cells: 2, columns: [{ width: 1, rows: 1 }, { width: 1, rows: 1 }] },
  { id: "2-stack", label: "2 pod sebou", cells: 2, columns: [{ width: 1, rows: 2 }] },
  { id: "3-feature", label: "3, jedna velká", cells: 3, columns: [{ width: 2, rows: 1 }, { width: 1, rows: 2 }] },
  { id: "3-side", label: "3 vedle sebe", cells: 3, columns: [{ width: 1, rows: 1 }, { width: 1, rows: 1 }, { width: 1, rows: 1 }] },
  { id: "4-grid", label: "4 v mřížce", cells: 4, columns: [{ width: 1, rows: 2 }, { width: 1, rows: 2 }] },
  { id: "6-grid", label: "6 v mřížce", cells: 6, columns: [{ width: 1, rows: 2 }, { width: 1, rows: 2 }, { width: 1, rows: 2 }] },
  boxes("2-hero-left", "2, velká vlevo", [[0, 0, 0.7, 1], [0.7, 0, 0.3, 1]]),
  boxes("2-hero-top", "2, velká nahoře", [[0, 0, 1, 0.7], [0, 0.7, 1, 0.3]]),
  boxes("3-hero-right", "3, velká vpravo", [[0, 0, 0.35, 0.5], [0, 0.5, 0.35, 0.5], [0.35, 0, 0.65, 1]]),
  boxes("3-hero-top", "3, velká nahoře", [[0, 0, 1, 0.65], [0, 0.65, 0.5, 0.35], [0.5, 0.65, 0.5, 0.35]]),
  boxes("3-hero-bottom", "3, velká dole", [[0, 0, 0.5, 0.35], [0.5, 0, 0.5, 0.35], [0, 0.35, 1, 0.65]]),
  boxes("4-columns", "4 svislé pruhy", strips(4)),
  columns("4-hero-left", "4, velká vlevo", [1.6, 1], [1, 3]),
  columns("4-hero-right", "4, velká vpravo", [1, 1.6], [3, 1]),
  boxes("4-hero-top", "4, velká nahoře", [[0, 0, 1, 0.62], [0, 0.62, 1 / 3, 0.38], [1 / 3, 0.62, 1 / 3, 0.38], [2 / 3, 0.62, 1 / 3, 0.38]]),
  boxes("4-hero-bottom", "4, velká dole", [[0, 0, 1 / 3, 0.38], [1 / 3, 0, 1 / 3, 0.38], [2 / 3, 0, 1 / 3, 0.38], [0, 0.38, 1, 0.62]]),
  boxes("5-bento-left", "Bento, velká vlevo", [[0, 0, 0.6, 0.65], [0, 0.65, 0.6, 0.35], [0.6, 0, 0.4, 1 / 3], [0.6, 1 / 3, 0.4, 1 / 3], [0.6, 2 / 3, 0.4, 1 / 3]]),
  boxes("5-bento-right", "Bento, velká vpravo", [[0, 0, 0.4, 1 / 3], [0, 1 / 3, 0.4, 1 / 3], [0, 2 / 3, 0.4, 1 / 3], [0.4, 0, 0.6, 0.65], [0.4, 0.65, 0.6, 0.35]]),
  boxes("5-columns", "5 svislých pruhů", strips(5)),
  boxes("6-bento", "Bento, 6 snímků", [[0, 0, 0.5, 0.65], [0, 0.65, 0.5, 0.35], [0.5, 0, 0.25, 0.5], [0.75, 0, 0.25, 0.5], [0.5, 0.5, 0.25, 0.5], [0.75, 0.5, 0.25, 0.5]]),
  boxes("6-strips", "6 svislých pruhů", strips(6)),
  boxes("7-grid", "7, hlavní a mozaika", [[0, 0, 0.4, 1], ...mosaic(2, 3).map(([x, y, w, h]) => [0.4 + x * 0.6, y, w * 0.6, h] as NormalizedBox)]),
  boxes("8-grid", "8 v mřížce", mosaic(4, 2)),
  boxes("9-grid", "9 v mřížce", mosaic(3, 3)),
  boxes("polaroid-3", "Polaroidy", [[0.04, 0.13, 0.45, 0.72], [0.28, 0.08, 0.45, 0.72], [0.53, 0.16, 0.45, 0.72]], [-8, 5, 11]),
];

export function gridLayout(id: string): Layout | undefined {
  return GRID_LAYOUTS.find((l) => l.id === id);
}

/** The cells of a layout filling `area`, `spacing` apart (and not at the outer edges). */
export function gridCells(layoutId: string, area: Box, spacing: number): Box[] {
  const layout = gridLayout(layoutId);
  if (!layout) return [];
  if (layout.boxes) {
    const gap = Math.min(Math.max(0, spacing), area.width * 0.04, area.height * 0.04);
    return layout.boxes.map(([x, y, width, height], i) => {
      const leftInset = x > 0.00001 ? gap / 2 : 0;
      const rightInset = x + width < 0.99999 ? gap / 2 : 0;
      const topInset = y > 0.00001 ? gap / 2 : 0;
      const bottomInset = y + height < 0.99999 ? gap / 2 : 0;
      return {
        left: area.left + x * area.width + leftInset,
        top: area.top + y * area.height + topInset,
        width: Math.max(0.001, width * area.width - leftInset - rightInset),
        height: Math.max(0.001, height * area.height - topInset - bottomInset),
        ...(layout.angles?.[i] ? { angle: layout.angles[i] } : {}),
      };
    });
  }
  const columns = layout.columns ?? [];
  const gap = Math.min(Math.max(0, spacing), area.width / Math.max(2, columns.length * 2), area.height / Math.max(2, Math.max(...columns.map((c) => c.rows)) * 2));
  const totalShare = columns.reduce((s, c) => s + c.width, 0);
  const free = area.width - gap * (columns.length - 1);
  const cells: Box[] = [];
  let x = area.left;
  for (const column of columns) {
    const width = (free * column.width) / totalShare;
    const height = (area.height - gap * (column.rows - 1)) / column.rows;
    for (let r = 0; r < column.rows; r++) cells.push({ left: x, top: area.top + r * (height + gap), width, height });
    x += width + gap;
  }
  return cells;
}

/** An SVG preview path of a layout in a w × h box, for the panel buttons. */
export function gridPreview(layoutId: string, w: number, h: number, gap: number): Box[] {
  return gridCells(layoutId, { left: 0, top: 0, width: w, height: h }, gap);
}
