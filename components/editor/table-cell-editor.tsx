"use client";

import { Point, util } from "fabric";
import { useEffect, useRef, useState } from "react";
import { getEditorInstance } from "@/lib/canvas/instance";
import { Table } from "@/lib/canvas/table";
import { editCell, setCellText } from "@/lib/canvas/table-edit";
import { useEditorStore } from "@/lib/store/editor";

type Box = { left: number; top: number; width: number; height: number };

function findTable(id: string): Table | null {
  const o = getEditorInstance()?.canvas.getObjects().find((x) => x.id === id);
  return o instanceof Table ? o : null;
}

/** The cell's box on screen (an upright box around it when the table is rotated). */
function cellBox(table: Table, row: number, column: number): Box | null {
  const canvas = getEditorInstance()?.canvas;
  const { x, y } = table.layout;
  if (!canvas || row >= y.length - 1 || column >= x.length - 1) return null;
  const m = util.multiplyTransformMatrices(canvas.viewportTransform, table.calcTransformMatrix());
  const ox = -table.width / 2;
  const oy = -table.height / 2;
  const corners = [
    [x[column], y[row]],
    [x[column + 1], y[row]],
    [x[column], y[row + 1]],
    [x[column + 1], y[row + 1]],
  ].map(([cx, cy]) => util.transformPoint(new Point(ox + cx, oy + cy), m));
  const rect = canvas.upperCanvasEl.getBoundingClientRect();
  const xs = corners.map((p) => p.x + rect.left);
  const ys = corners.map((p) => p.y + rect.top);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/**
 * Edits a table cell in place: a text area over the cell, in the table's font at the current
 * zoom. Enter (without Shift) or leaving the cell saves, Tab moves to the next cell, Escape cancels.
 */
export function TableCellEditor() {
  const editing = useEditorStore((s) => s.editingCell);
  const viewport = useEditorStore((s) => s.viewport);
  const ref = useRef<HTMLTextAreaElement>(null);
  const table = editing ? findTable(editing.tableId) : null;
  const original = table && editing ? (table.table.cells[editing.row]?.[editing.column]?.text ?? "") : "";
  const [draft, setDraft] = useState(original);
  const key = editing ? `${editing.tableId}:${editing.row}:${editing.column}` : "";

  useEffect(() => {
    setDraft(original);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    // Only when another cell starts being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!editing || !table) return null;
  void viewport;
  const box = cellBox(table, editing.row, editing.column);
  if (!box) return null;
  const zoom = getEditorInstance()?.canvas.getZoom() ?? 1;
  const close = () => useEditorStore.setState({ editingCell: null });
  const save = async () => {
    await setCellText(table, editing.row, editing.column, draft);
  };

  return (
    <textarea
      ref={ref}
      aria-label="Text buňky"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        void save();
        close();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(original);
          close();
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          void save();
          close();
        } else if (e.key === "Tab") {
          e.preventDefault();
          const columns = table.table.columns.length;
          const rows = table.table.rows.length;
          const index = editing.row * columns + editing.column + (e.shiftKey ? -1 : 1);
          void save().then(() => {
            if (index < 0 || index >= rows * columns) close();
            else editCell(table, { row: Math.floor(index / columns), column: index % columns });
          });
        }
      }}
      className="fixed z-40 resize-none overflow-hidden rounded-none border-2 border-indigo-500 bg-white text-zinc-900 outline-none"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        fontFamily: `"${table.fontFamily}"`,
        fontSize: table.fontSize * zoom * Math.abs(table.scaleY),
        lineHeight: 1.3,
        padding: table.fontSize * 0.5 * zoom * Math.abs(table.scaleY),
        color: table.textColor,
      }}
    />
  );
}
