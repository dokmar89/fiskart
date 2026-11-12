import { describe, expect, it } from "vitest";
import { finalIndex } from "./layer-order";

describe("finalIndex", () => {
  it("moves down past the target", () => {
    expect(finalIndex(0, { index: 2, position: "after" })).toBe(2);
    expect(finalIndex(0, { index: 2, position: "before" })).toBe(1);
  });

  it("moves up before the target", () => {
    expect(finalIndex(3, { index: 0, position: "before" })).toBe(0);
    expect(finalIndex(3, { index: 0, position: "after" })).toBe(1);
  });

  it("stays put when dropped on either edge of itself", () => {
    expect(finalIndex(2, { index: 2, position: "before" })).toBe(2);
    expect(finalIndex(2, { index: 2, position: "after" })).toBe(2);
  });
});
