import { classRegistry, FabricObject, util, type Canvas, type Point, type TPointerEventInfo } from "fabric";
import { DEFAULT_FONT_FAMILY } from "@/lib/fonts";
import { cellAt, layoutTable, readTable, type TableLayout, type TableModel } from "@/lib/table-math";

declare module "fabric" {
  interface FabricObject {
    /** Tables only: the stored table (columns, rows, cells). */
    table?: TableModel;
  }
}

/** Cell padding and line height relative to the font size. */
const PADDING = 0.5;
const LINE_HEIGHT = 1.3;

let measuring: CanvasRenderingContext2D | null = null;
function measurer(font: string) {
  measuring ??= document.createElement("canvas").getContext("2d");
  return (text: string) => {
    if (!measuring) return text.length * 8;
    measuring.font = font;
    return measuring.measureText(text).width;
  };
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * A table (phase 14): a grid of cells with text, each with an optional fill, drawn with one border
 * colour and width and one font. Rows grow to fit their text (lib/table-math.ts). Its size comes
 * from its columns and rows, so it is never scaled; resizing changes column widths instead.
 * Cells are edited in place in an overlay (see installTableEditing).
 */
export class Table extends FabricObject {
  static type = "Table";

  declare table: TableModel;
  declare fontFamily: string;
  declare fontSize: number;
  declare textColor: string;
  declare borderColor: string;
  declare borderWidth: number;
  /** Laid out on change; not stored. */
  declare layout: TableLayout;
  /** The cell being edited or last clicked; not stored. */
  declare activeCell: { row: number; column: number } | null;

  constructor(options: Record<string, unknown> = {}) {
    super();
    this.set({
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: 24,
      textColor: "#18181b",
      borderColor: "#a1a1aa",
      borderWidth: 2,
      fill: null,
      stroke: null,
      strokeWidth: 0,
      objectCaching: false,
      lockScalingFlip: true,
      lockSkewingX: true,
      lockSkewingY: true,
    });
    this.setOptions(options);
    this.table = readTable(options.table) ?? { columns: [200], rows: [60], cells: [[{ text: "", fill: null }]] };
    this.activeCell = null;
    this.relayout();
    // A table is resized by its columns, not stretched; only moving and rotating use handles.
    this.setControlsVisibility({ tl: false, tr: false, bl: false, br: false, ml: false, mr: false, mt: false, mb: false });
  }

  font(): string {
    return `${this.fontSize}px "${this.fontFamily}"`;
  }

  /** Lays the table out again and fits the object's size to it, keeping its top-left corner. */
  relayout() {
    const topLeft = this.width ? this.translateToOriginPoint(this.getCenterPoint(), "left", "top") : null;
    this.layout = layoutTable(this.table, {
      measure: measurer(this.font()),
      lineHeight: this.fontSize * LINE_HEIGHT,
      padding: this.fontSize * PADDING,
    });
    this.set({ width: this.layout.width, height: this.layout.height, dirty: true });
    if (topLeft) this.setPositionByOrigin(topLeft, "left", "top");
    this.setCoords();
  }

  setTable(table: TableModel) {
    this.table = table;
    this.relayout();
  }

  /** The cell under a page point, if any. */
  cellAtPage(point: Point): { row: number; column: number } | null {
    const local = util.transformPoint(point, util.invertTransform(this.calcTransformMatrix()));
    return cellAt(this.layout, local.x + this.width / 2, local.y + this.height / 2);
  }

  _render(ctx: CanvasRenderingContext2D) {
    const { x, y, lines } = this.layout;
    const ox = -this.width / 2;
    const oy = -this.height / 2;
    ctx.save();
    this.table.cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (!cell.fill) return;
        ctx.fillStyle = cell.fill;
        ctx.fillRect(ox + x[c], oy + y[r], x[c + 1] - x[c], y[r + 1] - y[r]);
      }),
    );
    ctx.font = this.font();
    ctx.textBaseline = "alphabetic";
    const padding = this.fontSize * PADDING;
    const lineHeight = this.fontSize * LINE_HEIGHT;
    // The first baseline sits where a line of this height puts it.
    const baseline = (lineHeight + this.fontSize * 0.7) / 2;
    lines.forEach((row, r) =>
      row.forEach((cellLines, c) =>
        cellLines.forEach((line, i) => {
          ctx.fillStyle = this.table.cells[r][c].textColor ?? this.textColor;
          ctx.fillText(line, ox + x[c] + padding, oy + y[r] + padding + baseline + i * lineHeight);
        }),
      ),
    );
    if (this.borderWidth > 0) {
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = this.borderWidth;
      ctx.beginPath();
      for (const px of x) {
        ctx.moveTo(ox + px, oy);
        ctx.lineTo(ox + px, oy + this.height);
      }
      for (const py of y) {
        ctx.moveTo(ox, oy + py);
        ctx.lineTo(ox + this.width, oy + py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  toObject(propertiesToInclude: string[] = []) {
    return {
      ...super.toObject(propertiesToInclude as never[]),
      table: JSON.parse(JSON.stringify(this.table)) as TableModel,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      textColor: this.textColor,
      borderColor: this.borderColor,
      borderWidth: this.borderWidth,
    };
  }

  static async fromObject(object: Record<string, unknown>) {
    const { type, ...options } = object;
    void type;
    return new Table(options);
  }

  _toSVG(): string[] {
    const { x, y, lines } = this.layout;
    const ox = -this.width / 2;
    const oy = -this.height / 2;
    const padding = this.fontSize * PADDING;
    const lineHeight = this.fontSize * LINE_HEIGHT;
    const baseline = (lineHeight + this.fontSize * 0.7) / 2;
    const parts: string[] = [];
    this.table.cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell.fill) parts.push(`<rect x="${n(ox + x[c])}" y="${n(oy + y[r])}" width="${n(x[c + 1] - x[c])}" height="${n(y[r + 1] - y[r])}" fill="${cell.fill}" />`);
      }),
    );
    lines.forEach((row, r) =>
      row.forEach((cellLines, c) =>
        cellLines.forEach((line, i) => {
          if (!line) return;
          parts.push(
            `<text xml:space="preserve" x="${n(ox + x[c] + padding)}" y="${n(oy + y[r] + padding + baseline + i * lineHeight)}" font-family="${escapeXml(this.fontFamily)}" font-size="${this.fontSize}" fill="${this.table.cells[r][c].textColor ?? this.textColor}">${escapeXml(line)}</text>`,
          );
        }),
      ),
    );
    if (this.borderWidth > 0) {
      const d = [...x.map((px) => `M${n(ox + px)} ${n(oy)}V${n(oy + this.height)}`), ...y.map((py) => `M${n(ox)} ${n(oy + py)}H${n(ox + this.width)}`)].join("");
      parts.push(`<path d="${d}" fill="none" stroke="${this.borderColor}" stroke-width="${this.borderWidth}" />`);
    }
    return ["<g ", "COMMON_PARTS", " >", ...parts, "</g>\n"];
  }
}

classRegistry.setClass(Table);

export type CellEditor = (table: Table, cell: { row: number; column: number }) => void;

/**
 * Clicking a cell of the selected table makes it the active cell (for the toolbar's row and column
 * commands); double-clicking opens the cell editor. Returns a cleanup function.
 */
export function installTableEditing(canvas: Canvas, edit: CellEditor, onActiveCell: () => void) {
  const onMouseDown = (opt: TPointerEventInfo) => {
    const target = opt.target;
    if (!(target instanceof Table)) return;
    target.activeCell = target.cellAtPage(opt.scenePoint);
    canvas.requestRenderAll();
    onActiveCell();
  };
  const onDoubleClick = (opt: TPointerEventInfo) => {
    const target = opt.target;
    if (!(target instanceof Table) || target.locked) return;
    const cell = target.cellAtPage(opt.scenePoint);
    if (cell) edit(target, cell);
  };
  // The active cell gets an outline while its table is selected.
  const onAfterRender = ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    const table = canvas.getActiveObject();
    if (ctx !== canvas.getContext() || !(table instanceof Table) || !table.activeCell) return;
    const { row, column } = table.activeCell;
    const { x, y } = table.layout;
    if (row >= y.length - 1 || column >= x.length - 1) return;
    const m = table.calcTransformMatrix();
    const v = canvas.viewportTransform;
    ctx.save();
    ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2 / canvas.getZoom();
    ctx.strokeRect(-table.width / 2 + x[column], -table.height / 2 + y[row], x[column + 1] - x[column], y[row + 1] - y[row]);
    ctx.restore();
  };
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:dblclick", onDoubleClick);
  canvas.on("after:render", onAfterRender);
  return () => {
    canvas.off("mouse:down", onMouseDown);
    canvas.off("mouse:dblclick", onDoubleClick);
    canvas.off("after:render", onAfterRender);
  };
}
