import { describe, expect, it } from "vitest";
import { isBuiltInFamily } from "@/lib/fonts";
import { TEXT_COMBOS } from "./text-combos";

describe("curated text combinations", () => {
  it("offers 25 distinct, editable compositions with bundled fonts", () => {
    expect(TEXT_COMBOS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(TEXT_COMBOS.map((c) => c.id)).size).toBe(TEXT_COMBOS.length);
    expect(new Set(TEXT_COMBOS.map((c) => c.lines[0]?.text)).size).toBe(TEXT_COMBOS.length);
    for (const combo of TEXT_COMBOS) {
      expect(combo.name.length).toBeGreaterThan(2);
      expect(combo.lines.length).toBeGreaterThanOrEqual(2);
      for (const line of combo.lines) {
        expect(line.text.trim().length).toBeGreaterThan(0);
        expect(isBuiltInFamily(line.family)).toBe(true);
      }
    }
  });

  it("includes the brief's eight named design directions", () => {
    const ids = new Set(TEXT_COMBOS.map((c) => c.id));
    for (const id of ["cyber", "retro", "luxury", "sale", "playful", "quote", "festival", "corporate"]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
