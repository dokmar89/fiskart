import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_FAMILIES } from "./fonts";

describe("bundled Czech fonts", () => {
  it("covers five useful groups and the requested families", () => {
    expect(Object.values(FONT_FAMILIES).every((ids) => ids.length >= 8)).toBe(true);
    const all = Object.values(FONT_FAMILIES).flat();
    expect(all.length).toBeGreaterThanOrEqual(45);
    expect(all).toEqual(expect.arrayContaining(["plus-jakarta-sans", "cinzel", "bodoni-moda", "syne", "kalam", "fira-code"]));
  });

  it("bundles the latin-ext subset for every family", () => {
    for (const id of Object.values(FONT_FAMILIES).flat()) {
      const metadata = JSON.parse(readFileSync(join(process.cwd(), "node_modules", "@fontsource", id, "metadata.json"), "utf8")) as { subsets: string[] };
      expect(metadata.subsets, id).toContain("latin-ext");
    }
  });
});
