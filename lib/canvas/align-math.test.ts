import { describe, expect, it } from "vitest";
import { alignOffsets, distributeOffsets } from "./align-math";
import { unionBox } from "./geometry";

const a = { left: 10, top: 20, width: 100, height: 50 };
const b = { left: 300, top: 200, width: 40, height: 80 };
const page = { left: 0, top: 0, width: 1000, height: 600 };

describe("alignOffsets", () => {
  it("aligns to the page", () => {
    expect(alignOffsets([a], page, "left")).toEqual([{ dx: -10, dy: 0 }]);
    expect(alignOffsets([a], page, "center")).toEqual([{ dx: 440, dy: 0 }]);
    expect(alignOffsets([a], page, "right")).toEqual([{ dx: 890, dy: 0 }]);
    expect(alignOffsets([a], page, "top")).toEqual([{ dx: 0, dy: -20 }]);
    expect(alignOffsets([a], page, "middle")).toEqual([{ dx: 0, dy: 255 }]);
    expect(alignOffsets([a], page, "bottom")).toEqual([{ dx: 0, dy: 530 }]);
  });

  it("aligns to the selection's bounds", () => {
    const bounds = unionBox([a, b]);
    expect(bounds).toEqual({ left: 10, top: 20, width: 330, height: 260 });
    expect(alignOffsets([a, b], bounds, "right")).toEqual([{ dx: 230, dy: 0 }, { dx: 0, dy: 0 }]);
    expect(alignOffsets([a, b], bounds, "middle")).toEqual([{ dx: 0, dy: 105 }, { dx: 0, dy: -90 }]);
  });
});

describe("distributeOffsets", () => {
  it("makes the gaps equal and keeps the outermost in place", () => {
    const boxes = [
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 70, top: 0, width: 20, height: 10 }, // listed out of order on purpose
      { left: 15, top: 0, width: 10, height: 10 },
    ];
    // Span 0..90, sizes 40, so two gaps of 25: positions 0, 35, 70.
    expect(distributeOffsets(boxes, "horizontal")).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
      { dx: 20, dy: 0 },
    ]);
  });

  it("works vertically and ignores fewer than three boxes", () => {
    const boxes = [
      { left: 0, top: 0, width: 5, height: 10 },
      { left: 0, top: 12, width: 5, height: 10 },
      { left: 0, top: 100, width: 5, height: 10 },
    ];
    const offsets = distributeOffsets(boxes, "vertical");
    // Span 0..110, sizes 30: gaps of 40, so the middle one goes to 50.
    expect(offsets[1].dy).toBeCloseTo(38);
    expect(distributeOffsets(boxes.slice(0, 2), "vertical")).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
  });
});
