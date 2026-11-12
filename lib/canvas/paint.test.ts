import { describe, expect, it } from "vitest";
import { normalizeHex } from "@/lib/hex";
import { angleToCoords, coordsToAngle } from "./paint";

describe("gradient angle", () => {
  it("maps the main directions", () => {
    const lr = angleToCoords(0);
    expect(lr.x1).toBeCloseTo(0);
    expect(lr.x2).toBeCloseTo(1);
    expect(lr.y1).toBeCloseTo(0.5);
    const tb = angleToCoords(90);
    expect(tb.y1).toBeCloseTo(0);
    expect(tb.y2).toBeCloseTo(1);
  });

  it("round-trips", () => {
    for (const angle of [0, 45, 90, 135, 180, 270, 315]) expect(coordsToAngle(angleToCoords(angle))).toBe(angle);
  });
});

describe("normalizeHex", () => {
  it("accepts short and long forms with or without #", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("1a2B3c")).toBe("#1a2b3c");
    expect(normalizeHex(" #ffffff ")).toBe("#ffffff");
  });

  it("rejects anything else", () => {
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });
});
