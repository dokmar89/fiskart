import { describe, expect, it } from "vitest";
import { arcLayout, curveToDegrees, degreesToCurve } from "./curve-math";

describe("degree control", () => {
  it("maps the visible ±180° range to the existing arc geometry", () => {
    expect(degreesToCurve(180)).toBeCloseTo(52.0833, 3);
    expect(degreesToCurve(-180)).toBeCloseTo(-52.0833, 3);
    expect(curveToDegrees(degreesToCurve(135))).toBeCloseTo(135);
    expect(degreesToCurve(240)).toBeCloseTo(degreesToCurve(180));
  });
});

const widths = [20, 20, 20, 20, 20];

describe("arcLayout", () => {
  it("is a straight line at curve 0", () => {
    const layout = arcLayout(widths, 0, 30, 10);
    expect(layout.radius).toBeNull();
    expect(layout.width).toBe(100);
    expect(layout.height).toBe(40);
    expect(layout.glyphs.map((g) => g.x)).toEqual([-40, -20, 0, 20, 40]);
    expect(layout.glyphs.every((g) => g.angle === 0)).toBe(true);
  });

  it("bends into an arch for a positive curve, symmetric about the middle", () => {
    const { glyphs } = arcLayout(widths, 50, 30, 10);
    const [first, , middle, , last] = glyphs;
    expect(middle.y).toBeLessThan(first.y);
    expect(first.y).toBeCloseTo(last.y);
    expect(first.x).toBeCloseTo(-last.x);
    expect(first.angle).toBeLessThan(0);
    expect(last.angle).toBeCloseTo(-first.angle);
    expect(middle.angle).toBeCloseTo(0);
  });

  it("bends into a smile for a negative curve", () => {
    const { glyphs } = arcLayout(widths, -50, 30, 10);
    expect(glyphs[2].y).toBeGreaterThan(glyphs[0].y);
    expect(glyphs[0].angle).toBeGreaterThan(0);
  });

  it("keeps the text's length along the arc", () => {
    const layout = arcLayout(widths, 50, 30, 10);
    // Half the curve spans 0.48 of a full turn.
    expect(layout.radius! * Math.PI * 2 * 0.48).toBeCloseTo(100);
  });

  it("nearly closes the circle at full curve: about as wide as tall", () => {
    const layout = arcLayout(Array(40).fill(10), 100, 12, 4);
    expect(layout.width / layout.height).toBeGreaterThan(0.9);
    expect(layout.width / layout.height).toBeLessThan(1.1);
  });

  it("handles empty text", () => {
    expect(arcLayout([], 50, 30, 10)).toMatchObject({ glyphs: [], width: 0, height: 40 });
  });
});
