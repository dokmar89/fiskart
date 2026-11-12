import { describe, expect, it } from "vitest";
import { isPermutation, moveItem, parsePageRange, withFreshIds } from "./page-ops";

describe("withFreshIds", () => {
  it("replaces every object id, including inside groups, and keeps everything else", () => {
    let n = 0;
    const data = {
      objects: [
        { id: "a", type: "Rect", left: 1 },
        { id: "g", type: "Group", objects: [{ id: "b", type: "Rect" }, { type: "Rect" }] },
      ],
    };
    const copy = withFreshIds(data, () => `new-${++n}`);
    expect(copy).toEqual({
      objects: [
        { id: "new-1", type: "Rect", left: 1 },
        { id: "new-3", type: "Group", objects: [{ id: "new-2", type: "Rect" }, { type: "Rect" }] },
      ],
    });
    expect(data.objects[0].id).toBe("a");
  });
});

describe("moveItem", () => {
  it("moves forwards and backwards", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("isPermutation", () => {
  it("accepts the same ids in another order only", () => {
    expect(isPermutation(["a", "b"], ["b", "a"])).toBe(true);
    expect(isPermutation(["a", "b"], ["a", "a"])).toBe(false);
    expect(isPermutation(["a", "b"], ["a"])).toBe(false);
    expect(isPermutation(["a", "b"], ["a", "c"])).toBe(false);
    expect(isPermutation(["a"], [1])).toBe(false);
  });
});

describe("parsePageRange", () => {
  it("parses single pages and ranges into sorted zero-based indexes", () => {
    expect(parsePageRange("1-3, 5", 6)).toEqual([0, 1, 2, 4]);
    expect(parsePageRange("4,2,2-3", 4)).toEqual([1, 2, 3]);
    expect(parsePageRange(" 2 - 2 ", 2)).toEqual([1]);
  });

  it("rejects empty, malformed and out-of-range selections", () => {
    expect(parsePageRange("", 3)).toBeNull();
    expect(parsePageRange("0", 3)).toBeNull();
    expect(parsePageRange("4", 3)).toBeNull();
    expect(parsePageRange("3-1", 3)).toBeNull();
    expect(parsePageRange("a", 3)).toBeNull();
    expect(parsePageRange("1-", 3)).toBeNull();
  });
});
