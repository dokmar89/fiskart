import { describe, expect, it } from "vitest";
import { countIn, countInPages, replaceIn, replaceInPages } from "./find-replace";

const pages = [
  {
    objects: [
      { type: "Textbox", text: "Summer sale. SUMMER prices!" },
      { type: "Rect", text: "not text" },
      { type: "Group", objects: [{ type: "CurvedText", text: "summer" }] },
    ],
  },
  { objects: [{ type: "Table", table: { columns: [10], rows: [10], cells: [[{ text: "Summer menu", fill: null }]] } }] },
  { objects: [{ type: "Textbox", text: "Winter" }] },
];

describe("countIn and replaceIn", () => {
  it("match case only when asked, and treat the query literally", () => {
    expect(countIn("A.a.A", "a", { matchCase: false })).toBe(3);
    expect(countIn("A.a.A", "a", { matchCase: true })).toBe(1);
    expect(countIn("1+1=2, 1+1", "1+1", { matchCase: true })).toBe(2);
    expect(replaceIn("cat Cat", "cat", "dog", { matchCase: false })).toEqual({ text: "dog dog", count: 2 });
    expect(replaceIn("x", "", "y", { matchCase: false })).toEqual({ text: "x", count: 0 });
  });
});

describe("pages", () => {
  it("counts in text, curved text inside groups and table cells", () => {
    expect(countInPages(pages, "summer", { matchCase: false })).toEqual([3, 1, 0]);
  });

  it("replaces everywhere and leaves untouched pages as they were", () => {
    const { pages: out, counts } = replaceInPages(pages, "summer", "Autumn", { matchCase: false });
    expect(counts).toEqual([3, 1, 0]);
    expect(out[0].objects[0].text).toBe("Autumn sale. Autumn prices!");
    expect(out[0].objects[1]).toBe(pages[0].objects[1]);
    expect((out[0].objects[2].objects as { text: string }[])[0].text).toBe("Autumn");
    expect((out[1].objects[0].table as { cells: { text: string }[][] }).cells[0][0].text).toBe("Autumn menu");
    expect(out[2]).toBe(pages[2]);
  });
});
