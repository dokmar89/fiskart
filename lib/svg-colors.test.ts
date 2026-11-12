import { describe, expect, it } from "vitest";
import { effectiveColorMap, normalizeColor, recolorSvg, svgColors } from "./svg-colors";

const FOUR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10">
  <style>.d { fill: #00F; }</style>
  <rect width="10" height="10" fill="#ff0000"/>
  <rect x="10" width="10" height="10" style="fill:rgb(0, 128, 0);stroke: #FF0000"/>
  <rect x="20" width="10" height="10" class="d"/>
  <circle cx="35" cy="5" r="5" fill='orange' stroke="none"/>
  <path d="M0 0" fill="url(#g)"/>
</svg>`;

describe("normalizeColor", () => {
  it("reads hex, rgb and names", () => {
    expect(normalizeColor("#ABC")).toBe("#aabbcc");
    expect(normalizeColor("#aabbccdd")).toBe("#aabbcc");
    expect(normalizeColor("rgb(255, 0, 10)")).toBe("#ff000a");
    expect(normalizeColor("rgba(100%, 0%, 0%, 0.5)")).toBe("#ff0000");
    expect(normalizeColor(" Black ")).toBe("#000000");
  });

  it("is null for things that are not plain colours", () => {
    expect(normalizeColor("none")).toBeNull();
    expect(normalizeColor("url(#g)")).toBeNull();
    expect(normalizeColor("currentColor")).toBeNull();
  });
});

describe("svgColors", () => {
  it("lists each fill and stroke colour once", () => {
    expect(svgColors(FOUR)).toEqual(["#0000ff", "#ff0000", "#008000", "#ffa500"]);
  });
});

describe("recolorSvg", () => {
  it("changes each colour independently, wherever it is written", () => {
    const red = recolorSvg(FOUR, { "#ff0000": "#111111" });
    expect(svgColors(red)).toEqual(["#0000ff", "#111111", "#008000", "#ffa500"]);
    expect(red).toContain('fill="#111111"');
    expect(red).toContain("stroke: #111111");

    const all = recolorSvg(FOUR, { "#0000ff": "#000001", "#ff0000": "#000002", "#008000": "#000003", "#ffa500": "#000004" });
    expect(svgColors(all)).toEqual(["#000001", "#000002", "#000003", "#000004"]);
    expect(all).toContain(".d { fill: #000001; }");
    expect(all).toContain("fill='#000004'");
    expect(all).toContain('fill="url(#g)"');
  });

  it("leaves the document alone for an empty map", () => {
    expect(recolorSvg(FOUR, {})).toBe(FOUR);
  });
});

describe("effectiveColorMap", () => {
  it("drops entries that change nothing", () => {
    expect(effectiveColorMap({ "#ff0000": "#FF0000" })).toBeNull();
    expect(effectiveColorMap({ "#ff0000": "#00ff00", "#0000ff": "#0000ff" })).toEqual({ "#ff0000": "#00ff00" });
    expect(effectiveColorMap(undefined)).toBeNull();
  });
});
