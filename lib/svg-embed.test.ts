import { describe, expect, it } from "vitest";
import { assetRefs, insertSvgStyle, parseUnicodeRange, replaceAssetRefs, textUsesRanges } from "./svg-embed";

describe("unicode ranges", () => {
  it("parses single code points, ranges and wildcards", () => {
    expect(parseUnicodeRange("U+0000-00FF, U+0131, U+4??")).toEqual([
      [0, 0xff],
      [0x131, 0x131],
      [0x400, 0x4ff],
    ]);
    expect(parseUnicodeRange("")).toEqual([[0, 0x10ffff]]);
  });

  it("tells whether text needs a subset", () => {
    const latin = parseUnicodeRange("U+0000-00FF");
    const latinExt = parseUnicodeRange("U+0100-02BA, U+02BD-02C5");
    expect(textUsesRanges("Hello", latin)).toBe(true);
    expect(textUsesRanges("Hello", latinExt)).toBe(false);
    expect(textUsesRanges("Příliš", latinExt)).toBe(true);
  });
});

describe("asset references", () => {
  const svg = '<svg><image xlink:href="/api/assets/a1"/><image xlink:href="/api/assets/a1"/><image href="/api/assets/b2"/></svg>';

  it("lists each asset once", () => {
    expect(assetRefs(svg)).toEqual(["/api/assets/a1", "/api/assets/b2"]);
  });

  it("replaces known references and leaves others", () => {
    const out = replaceAssetRefs(svg, new Map([["/api/assets/a1", "data:image/png;base64,AAA"]]));
    expect(out).toBe(
      '<svg><image xlink:href="data:image/png;base64,AAA"/><image xlink:href="data:image/png;base64,AAA"/><image href="/api/assets/b2"/></svg>',
    );
  });
});

describe("insertSvgStyle", () => {
  it("puts the style first inside the root element", () => {
    expect(insertSvgStyle('<?xml version="1.0"?><svg width="1"><rect/></svg>', "a{}")).toBe(
      '<?xml version="1.0"?><svg width="1">\n<style><![CDATA[a{}]]></style><rect/></svg>',
    );
    expect(insertSvgStyle("<svg></svg>", "")).toBe("<svg></svg>");
  });
});
