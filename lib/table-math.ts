/**
 * Tables: the data model stored with the page, and laying it out (column positions, wrapped cell
 * text, row heights). Pure: text is measured by a function passed in. Unit tested.
 */

export type TableCell = { text: string; fill: string | null; textColor?: string };

export type TableModel = {
  /** Column widths in page pixels. */
  columns: number[];
  /** Smallest height of each row; rows grow to fit their text. */
  rows: number[];
  /** cells[row][column]. */
  cells: TableCell[][];
};

export type TableLayout = {
  /** Left edge of each column, then the right edge of the last one. */
  x: number[];
  /** Top edge of each row, then the bottom of the last one. */
  y: number[];
  width: number;
  height: number;
  /** The wrapped lines of each cell. */
  lines: string[][][];
};

export type TextMetrics = { measure: (text: string) => number; lineHeight: number; padding: number };

export const MIN_COLUMN_WIDTH = 24;
export const MIN_ROW_HEIGHT = 16;
export const MAX_CELLS = 400;

/** Splits text into lines that fit `maxWidth`: at spaces where possible, inside a word when it is too long alone. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
      // A word wider than the cell is broken where it overflows.
      while (measure(line) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

export function layoutTable(model: TableModel, metrics: TextMetrics): TableLayout {
  const x = [0];
  for (const w of model.columns) x.push(x[x.length - 1] + w);
  const lines = model.cells.map((row) =>
    row.map((cell, c) => wrapText(cell.text, Math.max(1, model.columns[c] - metrics.padding * 2), metrics.measure)),
  );
  const y = [0];
  model.rows.forEach((minHeight, r) => {
    const tallest = Math.max(1, ...lines[r].map((l) => l.length));
    const needed = tallest * metrics.lineHeight + metrics.padding * 2;
    y.push(y[y.length - 1] + Math.max(minHeight, needed));
  });
  return { x, y, width: x[x.length - 1], height: y[y.length - 1], lines };
}

const emptyCell = (): TableCell => ({ text: "", fill: null });

export function createTable(columns: number, rows: number, width: number, rowHeight: number): TableModel {
  return {
    columns: Array.from({ length: columns }, () => width / columns),
    rows: Array.from({ length: rows }, () => rowHeight),
    cells: Array.from({ length: rows }, () => Array.from({ length: columns }, emptyCell)),
  };
}

/** A row added at `index` (0 = above the first), as tall as the row it was added next to. */
export function insertRow(model: TableModel, index: number): TableModel {
  if ((model.rows.length + 1) * model.columns.length > MAX_CELLS) return model;
  const at = Math.max(0, Math.min(model.rows.length, index));
  const like = model.rows[Math.min(at, model.rows.length - 1)] ?? MIN_ROW_HEIGHT;
  const rows = [...model.rows];
  rows.splice(at, 0, like);
  const cells = [...model.cells];
  cells.splice(at, 0, model.columns.map(emptyCell));
  return { ...model, rows, cells };
}

export function removeRow(model: TableModel, index: number): TableModel {
  if (model.rows.length <= 1) return model;
  return { ...model, rows: model.rows.filter((_, i) => i !== index), cells: model.cells.filter((_, i) => i !== index) };
}

/**
 * A column added at `index`. The table keeps its width: the new column takes an even share and the
 * others give up space in proportion to their widths.
 */
export function insertColumn(model: TableModel, index: number): TableModel {
  if (model.rows.length * (model.columns.length + 1) > MAX_CELLS) return model;
  const at = Math.max(0, Math.min(model.columns.length, index));
  const total = model.columns.reduce((a, b) => a + b, 0);
  const share = total / (model.columns.length + 1);
  const scale = (total - share) / total;
  const columns = model.columns.map((w) => w * scale);
  columns.splice(at, 0, share);
  return { ...model, columns, cells: model.cells.map((row) => [...row.slice(0, at), emptyCell(), ...row.slice(at)]) };
}

/** A column removed; the others widen in proportion so the table keeps its width. */
export function removeColumn(model: TableModel, index: number): TableModel {
  if (model.columns.length <= 1) return model;
  const total = model.columns.reduce((a, b) => a + b, 0);
  const rest = model.columns.filter((_, i) => i !== index);
  const restTotal = rest.reduce((a, b) => a + b, 0);
  return { ...model, columns: rest.map((w) => (w * total) / restTotal), cells: model.cells.map((row) => row.filter((_, i) => i !== index)) };
}

/** One column set to a width; the table grows or shrinks by the difference. */
export function setColumnWidth(model: TableModel, index: number, width: number): TableModel {
  const columns = [...model.columns];
  columns[index] = Math.max(MIN_COLUMN_WIDTH, width);
  return { ...model, columns };
}

/** The cell under a point in the table's own coordinates (0, 0 at its top-left corner), or null. */
export function cellAt(layout: TableLayout, px: number, py: number): { row: number; column: number } | null {
  if (px < 0 || py < 0 || px > layout.width || py > layout.height) return null;
  // The last edge counts as inside the last column (row).
  const index = (edges: number[], p: number) => {
    const after = edges.findIndex((e) => e > p);
    return after === -1 ? edges.length - 2 : Math.max(0, after - 1);
  };
  return { row: index(layout.y, py), column: index(layout.x, px) };
}

/** Reads a stored table, repairing what does not fit together; null when it is not a table at all. */
export function readTable(value: unknown): TableModel | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const nums = (a: unknown) => (Array.isArray(a) ? a.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0) : []);
  const columns = nums(v.columns);
  const rows = nums(v.rows);
  if (columns.length === 0 || rows.length === 0) return null;
  const raw = Array.isArray(v.cells) ? v.cells : [];
  const cells = rows.map((_, r) =>
    columns.map((__, c) => {
      const cell = Array.isArray(raw[r]) ? (raw[r] as unknown[])[c] : undefined;
      const o = cell && typeof cell === "object" ? (cell as Record<string, unknown>) : {};
      return { text: typeof o.text === "string" ? o.text : "", fill: typeof o.fill === "string" ? o.fill : null, ...(typeof o.textColor === "string" ? { textColor: o.textColor } : {}) };
    }),
  );
  return { columns, rows, cells };
}
