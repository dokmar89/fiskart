import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("lets a later Tailwind class override a conflicting earlier one", () => {
    expect(cn("p-2 text-sm", "p-4")).toBe("text-sm p-4");
  });
});
