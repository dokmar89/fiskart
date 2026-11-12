import { describe, expect, it } from "vitest";
import { cellAt, createTable, insertColumn, insertRow, layoutTable, readTable, removeColumn, removeRow, setColumnWidth, wrapText } from "./table-math";

// Every character is 10 px wide.
const measure = (s: string) => s.length * 10;
const metrics = { measure, lineHeight: 20, padding: 5 };

describe("wrapText", () => {
  it("breaks at spaces to fit", () => {
    expect(wrapText("one two three", 75, measure)).toEqual(["one two", "three"]);
  });
  it("breaks words that are too long alone, and keeps line breaks", () => {
    expect(wrapText("abcdefghij", 40, measure)).toEqual(["abcd", "efgh", "ij"]);
    expect(wrapText("a\nb", 100, measure)).toEqual(["a", "b"]);
    expect(wrapText("", 100, measure)).toEqual([""]);
  });
});

describe("layoutTable", () => {
  it("puts columns side by side and grows rows to fit their text", () => {
    const model = createTable(3, 2, 300, 40);
    model.cells[1][2].text = "a long cell text";
    const layout = layoutTable(model, metrics);
    expect(layout.x).toEqual([0, 100, 200, 300]);
    // 90 px for text: "a long" / "cell text" → two lines, 40 + 10 padding.
    expect(layout.lines[1][2]).toEqual(["a long", "cell text"]);
    expect(layout.y).toEqual([0, 40, 90]);
    expect(layout).toMatchObject({ width: 300, height: 90 });
  });
});

describe("editing", () => {
  it("adds and removes rows, keeping at least one", () => {
    const model = createTable(2, 1, 200, 30);
    const two = insertRow(model, 1);
    expect(two.rows).toEqual([30, 30]);
    expect(two.cells).toHaveLength(2);
    expect(removeRow(removeRow(two, 0), 0).rows).toHaveLength(1);
  });

  it("adds and removes columns without changing the table's width", () => {
    const model = createTable(2, 2, 200, 30);
    model.cells[0][1].text = "B";
    const three = insertColumn(model, 1);
    expect(three.columns.reduce((a, b) => a + b, 0)).toBeCloseTo(200);
    expect(three.cells[0].map((c) => c.text)).toEqual(["", "", "B"]);
    const back = removeColumn(three, 1);
    expect(back.columns[0]).toBeCloseTo(100);
    expect(back.columns[1]).toBeCloseTo(100);
    expect(back.cells[0][1].text).toBe("B");
  });

  it("sets a column width with a minimum", () => {
    expect(setColumnWidth(createTable(2, 1, 200, 30), 0, 5).columns).toEqual([24, 100]);
  });
});

describe("cellAt", () => {
  it("finds the cell under a point", () => {
    const layout = layoutTable(createTable(3, 2, 300, 40), metrics);
    expect(cellAt(layout, 150, 50)).toEqual({ row: 1, column: 1 });
    expect(cellAt(layout, 300, 80)).toEqual({ row: 1, column: 2 });
    expect(cellAt(layout, 301, 10)).toBeNull();
  });
});

describe("readTable", () => {
  it("repairs missing cells and rejects non-tables", () => {
    expect(readTable({ columns: [50, 50], rows: [20], cells: [[{ text: "x" }]] })).toEqual({
      columns: [50, 50],
      rows: [20],
      cells: [[{ text: "x", fill: null }, { text: "", fill: null }]],
    });
    expect(readTable({ columns: [], rows: [20] })).toBeNull();
    expect(readTable("nope")).toBeNull();
  });
});
