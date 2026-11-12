import { describe, expect, it } from "vitest";
import { arrange } from "./arrange-math";

const order = ["a", "b", "c", "d", "e"];

describe("arrange", () => {
  it("brings to front and sends to back, keeping relative order", () => {
    expect(arrange(order, new Set(["b", "d"]), "front")).toEqual(["a", "c", "e", "b", "d"]);
    expect(arrange(order, new Set(["b", "d"]), "back")).toEqual(["b", "d", "a", "c", "e"]);
  });

  it("moves one step forward or backward", () => {
    expect(arrange(order, new Set(["b"]), "forward")).toEqual(["a", "c", "b", "d", "e"]);
    expect(arrange(order, new Set(["b"]), "backward")).toEqual(["b", "a", "c", "d", "e"]);
    expect(arrange(order, new Set(["b", "c"]), "forward")).toEqual(["a", "d", "b", "c", "e"]);
  });

  it("leaves items already at the end alone", () => {
    expect(arrange(order, new Set(["e"]), "forward")).toEqual(order);
    expect(arrange(order, new Set(["a"]), "backward")).toEqual(order);
    expect(arrange(order, new Set(["d", "e"]), "forward")).toEqual(order);
  });
});
