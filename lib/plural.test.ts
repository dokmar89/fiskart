import { describe, expect, it } from "vitest";
import { plural } from "./plural";

describe("plural", () => {
  it("picks the Czech form for the count", () => {
    expect([0, 1, 2, 4, 5, 12].map((n) => plural(n, "stránka", "stránky", "stránek"))).toEqual([
      "stránek",
      "stránka",
      "stránky",
      "stránky",
      "stránek",
      "stránek",
    ]);
  });
});
