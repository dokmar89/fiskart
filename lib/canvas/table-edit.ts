import { DEFAULT_FONT_FAMILY, loadFonts } from "@/lib/fonts";
import {
  createTable,
  insertColumn,
  insertRow,
  removeColumn,
  removeRow,
  setColumnWidth,
  type TableModel,
} from "@/lib/table-math";
import { useEditorStore } from "@/lib/store/editor";
import { styleTable, type TablePreset } from "@/lib/table-styles";
import { recordStep } from "./document";
import { artboardScale, placeObject } from "./elements";
import { getEditorInstance } from "./instance";
import { refreshSelection } from "./selection";
import { Table } from "./table";

export type TableCommand = "rowAbove" | "rowBelow" | "deleteRow" | "columnLeft" | "columnRight" | "deleteColumn";

/** Loads the table's font for all of its text before it is measured. */
export async function loadTableFont(table: { fontFamily: string; table: TableModel }, family = table.fontFamily) {
  const text = table.table.cells.flat().map((c) => c.text).join(" ");
  await loadFonts([{ family, weight: "400", style: "normal", text: text || "Aa" }]);
}

export async function addTable(columns = 3, rows = 3, preset: TablePreset = "clean") {
  const editor = getEditorInstance();
  if (!editor) return;
  const scale = artboardScale(editor.artboard);
  await loadFonts([{ family: DEFAULT_FONT_FAMILY, weight: "400", style: "normal", text: "Aa" }]);
  const model = createTable(columns, rows, 720 * scale, 64 * scale);
  model.cells[0] = model.cells[0].map((cell, i) => ({ ...cell, text: preset === "pricing" ? ["Balíček", "Start", "Pro"][i] ?? `Plán ${i + 1}` : `Nadpis ${i + 1}` }));
  if (preset === "pricing") {
    const examples = [["Cena", "0 Kč", "299 Kč"], ["Uživatelé", "1", "10"], ["Podpora", "E-mail", "Prioritní"]];
    model.cells.slice(1).forEach((row, r) => row.forEach((cell, c) => { cell.text = examples[r]?.[c] ?? ""; }));
  }
  const styled = styleTable(model, preset);
  const table = new Table({ table: styled.model, fontSize: 24 * scale, borderWidth: styled.borderWidth * scale, borderColor: styled.borderColor, textColor: styled.textColor });
  placeObject(table, "Tabulka");
}

function selectedTable(): Table | null {
  const active = getEditorInstance()?.canvas.getActiveObject();
  return active instanceof Table && !active.locked ? active : null;
}

/** Changes the selected table as one undo step and redraws it. */
function changeTable(change: (table: Table) => void) {
  const editor = getEditorInstance();
  const table = selectedTable();
  if (!editor || !table) return;
  recordStep(() => {
    change(table);
    table.relayout();
    editor.canvas.fire("object:modified", { target: table });
  });
  editor.canvas.requestRenderAll();
  refreshSelection();
}

/** Restyles the selected table without changing user-entered data. */
export function applyTablePreset(preset: TablePreset) {
  changeTable((table) => {
    const styled = styleTable(table.table, preset);
    table.table = styled.model;
    table.set({ borderColor: styled.borderColor, borderWidth: styled.borderWidth, textColor: styled.textColor });
  });
}

/** Row and column commands act on the active cell (the last one clicked), or the last cell. */
export function tableCommand(command: TableCommand) {
  changeTable((table) => {
    const rows = table.table.rows.length;
    const columns = table.table.columns.length;
    const cell = table.activeCell ?? { row: rows - 1, column: columns - 1 };
    const model = table.table;
    const next = {
      rowAbove: () => insertRow(model, cell.row),
      rowBelow: () => insertRow(model, cell.row + 1),
      deleteRow: () => removeRow(model, cell.row),
      columnLeft: () => insertColumn(model, cell.column),
      columnRight: () => insertColumn(model, cell.column + 1),
      deleteColumn: () => removeColumn(model, cell.column),
    }[command]();
    table.table = next;
    const row = command === "rowBelow" ? cell.row + 1 : Math.min(cell.row, next.rows.length - 1);
    const column = command === "columnRight" ? cell.column + 1 : Math.min(cell.column, next.columns.length - 1);
    table.activeCell = { row, column };
  });
}

export function setActiveColumnWidth(width: number) {
  changeTable((table) => {
    const column = table.activeCell?.column ?? 0;
    table.table = setColumnWidth(table.table, column, width);
  });
}

/** The table's font; loaded before the table is measured with it. Other styles go through changeSelection. */
export async function setTableFont(fontFamily: string) {
  const table = selectedTable();
  if (!table) return;
  await loadTableFont(table, fontFamily);
  changeTable((t) => t.set({ fontFamily }));
}

/** Sets one cell's text, as one undo step. */
export async function setCellText(table: Table, row: number, column: number, text: string) {
  const editor = getEditorInstance();
  if (!editor || !editor.canvas.getObjects().includes(table)) return;
  if (table.table.cells[row]?.[column]?.text === text) return;
  await loadTableFont({ fontFamily: table.fontFamily, table: { ...table.table, cells: [[{ text, fill: null }]] } });
  recordStep(() => {
    table.table = { ...table.table, cells: table.table.cells.map((r, ri) => r.map((c, ci) => (ri === row && ci === column ? { ...c, text } : c))) };
    table.relayout();
    editor.canvas.fire("object:modified", { target: table });
  });
  editor.canvas.requestRenderAll();
}

/** Opens the in-place editor over a cell (components/editor/table-cell-editor.tsx draws it). */
export function editCell(table: Table, cell: { row: number; column: number }) {
  if (!table.id) return;
  table.activeCell = cell;
  useEditorStore.setState({ editingCell: { tableId: table.id, ...cell } });
}
