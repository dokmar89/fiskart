import { describe, expect, it } from "vitest";
import { applyTextCase } from "./text-case";

describe("applyTextCase", () => {
  it("leaves text alone without a case", () => {
    expect(applyTextCase("Ahoj", undefined)).toBe("Ahoj");
  });

  it("upper-cases Czech text character for character", () => {
    expect(applyTextCase("žluťoučký kůň\nřeka", "upper")).toBe("ŽLUŤOUČKÝ KŮŇ\nŘEKA");
  });

  it("keeps characters whose upper case is longer, so positions still match", () => {
    const text = "straße ŉ";
    const upper = applyTextCase(text, "upper");
    expect(upper).toBe("STRAßE ŉ");
    expect([...upper].length).toBe([...text].length);
  });
});
