import { describe, expect, it } from "vitest";
import { createTable } from "./table-math";
import { TABLE_PRESETS, styleTable } from "./table-styles";

describe("table templates", () => {
  it("offers four distinctive presets without discarding cell text", () => {
    expect(TABLE_PRESETS.map((p) => p.id)).toEqual(["clean", "zebra", "minimal", "pricing"]);
    const model = createTable(3, 4, 600, 60);
    model.cells[1][1].text = "Použivatelská data";
    const styled = TABLE_PRESETS.map((p) => styleTable(model, p.id));
    for (const result of styled) expect(result.model.cells[1][1].text).toBe("Použivatelská data");
    expect(styled[0].model.cells[0][0].fill).not.toBeNull();
    expect(styled[1].model.cells[1][0].fill).not.toBe(styled[1].model.cells[2][0].fill);
    expect(styled[2].borderWidth).toBe(0);
    expect(styled[3].model.cells[0][0].textColor).toBe("#ffffff");
    expect(styled[3].model.cells[1][1].fill).not.toBe(styled[3].model.cells[1][0].fill);
  });
});
