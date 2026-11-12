import { describe, expect, it } from "vitest";
import { defaultEffect, effectBackground, effectOverlayLayers, effectStyle, luminance, NO_EFFECT_STYLE, ownsTextColor, TEXT_EFFECT_TYPES, tint, withAlpha } from "./text-effects";

describe("effectStyle", () => {
  it("is nothing without an effect", () => {
    expect(effectStyle(null, 100)).toEqual(NO_EFFECT_STYLE);
    expect(effectStyle(undefined, 100)).toEqual(NO_EFFECT_STYLE);
  });

  it("scales a shadow with the font size and points it in its direction", () => {
    const shadow = { type: "shadow", offset: 100, direction: 90, blur: 40, color: "#ff0000", transparency: 25 } as const;
    const small = effectStyle(shadow, 40).shadow;
    const large = effectStyle(shadow, 80).shadow;
    expect(small).toEqual({ color: "rgba(255, 0, 0, 0.75)", blur: 8, offsetX: 0, offsetY: 10 });
    expect(large).toEqual({ color: "rgba(255, 0, 0, 0.75)", blur: 16, offsetX: 0, offsetY: 20 });
  });

  it("paints an outline under the fill, and hollow text without a fill", () => {
    expect(effectStyle({ type: "outline", thickness: 50, color: "#000000" }, 100)).toEqual({
      shadow: null,
      stroke: "#000000",
      strokeWidth: 12,
      paintFirst: "stroke",
    });
    const hollow = effectStyle({ type: "hollow", thickness: 50, color: "#123456" }, 100);
    expect(hollow).toMatchObject({ stroke: "#123456", strokeWidth: 4, fill: "" });
  });

  it("gives neon a centred glow in the text colour over a pale fill", () => {
    const neon = effectStyle({ type: "neon", intensity: 0, color: "#00ff00" }, 100);
    expect(neon.shadow).toEqual({ color: "#00ff00", blur: 10, offsetX: 0, offsetY: 0 });
    expect(neon.fill).toBe(tint("#00ff00", 0.6));
  });
});

describe("helpers", () => {
  it("defaults an outline to a colour that stands out from the text", () => {
    expect(defaultEffect("outline", "#ffffff")).toMatchObject({ color: "#18181b" });
    expect(defaultEffect("outline", "#101010")).toMatchObject({ color: "#ffffff" });
    expect(defaultEffect("hollow", "#abcdef")).toMatchObject({ color: "#abcdef" });
  });

  it("knows which effects carry the text colour", () => {
    expect(ownsTextColor(defaultEffect("hollow", "#000000"))).toBe(true);
    expect(ownsTextColor(defaultEffect("neon", "#000000"))).toBe(true);
    expect(ownsTextColor(defaultEffect("shadow", "#000000"))).toBe(false);
    expect(ownsTextColor(null)).toBe(false);
  });

  it("converts colours", () => {
    expect(withAlpha("#336699", 0.5)).toBe("rgba(51, 102, 153, 0.5)");
    expect(tint("#000000", 0.5)).toBe("#808080");
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(luminance("#000000")).toBe(0);
  });
});

describe("expanded effects", () => {
  it("exposes lift, offset splice, dual-channel glitch and a rounded text background", () => {
    expect(TEXT_EFFECT_TYPES.map((item) => item.type)).toEqual(["shadow", "outline", "hollow", "neon", "lift", "splice", "glitch", "background"]);
    expect(effectStyle(defaultEffect("lift", "#123456"), 80).shadow).toMatchObject({ offsetX: 0, offsetY: 0 });
    const splice = effectOverlayLayers(defaultEffect("splice", "#123456"), 80);
    expect(splice).toHaveLength(1);
    expect(splice[0].stroke).toBeTruthy();
    expect(splice[0].offsetX).not.toBe(0);
    const glitch = effectOverlayLayers(defaultEffect("glitch", "#123456"), 80);
    expect(glitch).toHaveLength(2);
    expect(glitch.map((layer) => layer.fill)).toEqual(["#00e5ff", "#ff3ba7"]);
    expect(glitch[0].offsetX).toBeLessThan(0);
    expect(glitch[1].offsetX).toBeGreaterThan(0);
    expect(effectBackground(defaultEffect("background", "#123456"))).toMatchObject({ color: "#fef08a", radius: 30, padding: 25 });
  });
});
