import { describe, expect, it } from "vitest";
import { brandColorMapping, byUse, MAX_BRAND_COLORS, parseBrandKitInput } from "./brand";

const entries = (m: Map<string, string>) => Object.fromEntries(m);

describe("brandColorMapping", () => {
  const palette = ["#111111", "#222222", "#333333"];

  it("gives the most used colour the kit's first colour, and so on", () => {
    expect(entries(brandColorMapping(["#ffffff", "#000000", "#ff0000"], palette, 0))).toEqual({
      "#ffffff": "#111111",
      "#000000": "#222222",
      "#ff0000": "#333333",
    });
  });

  it("moves every colour on to the kit's next colour on each cycle, and comes back round", () => {
    const source = ["#ffffff", "#000000"];
    expect(entries(brandColorMapping(source, palette, 1))).toEqual({ "#ffffff": "#222222", "#000000": "#333333" });
    expect(entries(brandColorMapping(source, palette, 2))).toEqual({ "#ffffff": "#333333", "#000000": "#111111" });
    expect(brandColorMapping(source, palette, 3)).toEqual(brandColorMapping(source, palette, 0));
  });

  it("gives every page colour a different kit colour while the kit has enough", () => {
    const source = ["#a", "#b", "#c"];
    for (let cycle = 0; cycle < 3; cycle++) expect(new Set(brandColorMapping(source, palette, cycle).values()).size).toBe(3);
  });

  it("wraps round when the page has more colours than the kit", () => {
    const m = brandColorMapping(["#1", "#2", "#3", "#4"], ["#aaaaaa", "#bbbbbb"], 0);
    expect([...m.values()]).toEqual(["#aaaaaa", "#bbbbbb", "#aaaaaa", "#bbbbbb"]);
  });

  it("maps nothing without a palette, and only one way with a single colour", () => {
    expect(brandColorMapping(["#ffffff"], [], 0).size).toBe(0);
    expect(entries(brandColorMapping(["#ffffff", "#000000"], ["#123456"], 5))).toEqual({ "#ffffff": "#123456", "#000000": "#123456" });
  });
});

describe("byUse", () => {
  it("orders by count, ties in order of first appearance", () => {
    expect(byUse(["#b", "#a", "#a", "#c", "#b", "#a"])).toEqual(["#a", "#b", "#c"]);
    expect(byUse(["#x", "#y"])).toEqual(["#x", "#y"]);
  });
});

describe("parseBrandKitInput", () => {
  it("normalises colours and drops duplicates", () => {
    const result = parseBrandKitInput({ name: "  Acme ", colors: ["#ABC", "aabbcc", "#123456"], fonts: ["Inter", "Inter", " "] });
    expect(result).toEqual({ ok: true, value: { name: "Acme", colors: ["#aabbcc", "#123456"], fonts: ["Inter"] } });
  });

  it("refuses what it cannot store", () => {
    expect(parseBrandKitInput(null).ok).toBe(false);
    expect(parseBrandKitInput({ name: "  " }).ok).toBe(false);
    expect(parseBrandKitInput({ colors: ["red"] }).ok).toBe(false);
    expect(parseBrandKitInput({ fonts: "Inter" }).ok).toBe(false);
    expect(parseBrandKitInput({ logoAssetIds: [1] }).ok).toBe(false);
    const many = Array.from({ length: MAX_BRAND_COLORS + 1 }, (_, i) => `#${i.toString(16).padStart(6, "0")}`);
    expect(parseBrandKitInput({ colors: many }).ok).toBe(false);
  });

  it("leaves out fields that were not sent", () => {
    expect(parseBrandKitInput({ fonts: [] })).toEqual({ ok: true, value: { fonts: [] } });
  });
});
