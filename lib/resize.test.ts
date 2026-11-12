import { describe, expect, it } from "vitest";
import { contentScale, coverCrop, fullBleedImageSources, isFullBleed, resizeObjects, resizePage, unrotatedBounds } from "./resize";

const square = { width: 1080, height: 1080 };
const portrait = { width: 1080, height: 1920 };
const landscape = { width: 1920, height: 1080 };

describe("contentScale", () => {
  it("is the smaller of the two ratios", () => {
    expect(contentScale(square, portrait)).toBe(1);
    expect(contentScale(landscape, square)).toBeCloseTo(0.5625);
    expect(contentScale(square, { width: 540, height: 540 })).toBe(0.5);
  });
});

describe("unrotatedBounds and isFullBleed", () => {
  it("accounts for origin and scale", () => {
    expect(unrotatedBounds({ left: 540, top: 540, width: 540, height: 540, scaleX: 2, scaleY: 2, originX: "center", originY: "center" })).toEqual({
      left: 0,
      top: 0,
      width: 1080,
      height: 1080,
    });
    expect(unrotatedBounds({ left: 0, top: 0, width: 10, height: 10, angle: 30 })).toBeNull();
    expect(unrotatedBounds({ left: 0, top: 0, width: 10, height: 10, angle: 360 })).not.toBeNull();
  });

  it("finds objects that cover the page, with a little slack", () => {
    expect(isFullBleed({ left: 0, top: 0, width: 1080, height: 1080 }, square)).toBe(true);
    expect(isFullBleed({ left: -20, top: -20, width: 1120, height: 1120 }, square)).toBe(true);
    expect(isFullBleed({ left: 0.4, top: 0, width: 1079.4, height: 1080 }, square)).toBe(true);
    expect(isFullBleed({ left: 0, top: 0, width: 1080, height: 1000 }, square)).toBe(false);
    expect(isFullBleed({ left: 0, top: 0, width: 1080, height: 1080, angle: 45 }, square)).toBe(false);
    expect(isFullBleed({ role: "background", left: 0, top: 0, width: 10, height: 10 }, square)).toBe(true);
  });
});

describe("resizeObjects", () => {
  it("leaves objects alone at the same size", () => {
    const objects = [{ left: 10, top: 20 }];
    expect(resizeObjects(objects, square, { ...square })).toBe(objects);
  });

  it("square to portrait: same scale, content centred vertically, background stretched", () => {
    const [bg, box, text] = resizeObjects(
      [
        { type: "Rect", left: 0, top: 0, width: 1080, height: 1080 },
        { type: "Rect", left: 100, top: 200, width: 50, height: 50, scaleX: 2, scaleY: 2 },
        { type: "Textbox", left: 540, top: 1000, width: 800, height: 60, originX: "center", originY: "center", angle: 10 },
      ],
      square,
      portrait,
    );
    expect(bg).toMatchObject({ left: 0, top: 0, scaleX: 1, scaleY: 1920 / 1080 });
    // Scale 1 (the width did not change), moved down by half the extra height.
    expect(box).toMatchObject({ left: 100, top: 620, scaleX: 2, scaleY: 2 });
    expect(text).toMatchObject({ left: 540, top: 1420, scaleX: 1, scaleY: 1, angle: 10 });
  });

  it("landscape to square: scaled down uniformly, centred vertically", () => {
    const f = 1080 / 1920;
    const [bg, box] = resizeObjects(
      [
        { type: "Rect", left: -10, top: -10, width: 1940, height: 1100 },
        { type: "Ellipse", left: 1920, top: 0, width: 200, height: 100, originX: "right", scaleX: 1.5, scaleY: 1.5 },
      ],
      landscape,
      square,
    );
    expect(bg.left).toBeCloseTo(-10 * (1080 / 1920));
    expect(bg.top).toBeCloseTo(-10);
    expect(bg.scaleX).toBeCloseTo(1080 / 1920);
    expect(bg.scaleY).toBeCloseTo(1);
    const dy = (1080 - 1080 * f) / 2;
    expect(box.left).toBeCloseTo(1080);
    expect(box.top).toBeCloseTo(dy);
    expect(box.scaleX).toBeCloseTo(1.5 * f);
    expect(box.scaleY).toBeCloseTo(1.5 * f);
    // Uniform: the ellipse keeps its aspect ratio; only the background changes it.
    expect((box.scaleX as number) / (box.scaleY as number)).toBeCloseTo(1);
  });

  it("keeps relative positions: every non-background object gets the same similarity transform", () => {
    const objects = [
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 500, top: 300, width: 10, height: 10 },
    ];
    const [a, b] = resizeObjects(objects, landscape, portrait);
    const f = contentScale(landscape, portrait);
    expect((b.left as number) - (a.left as number)).toBeCloseTo(500 * f);
    expect((b.top as number) - (a.top as number)).toBeCloseTo(300 * f);
    // The scaled old page is centred on the new one.
    expect(a.left).toBeCloseTo(0);
    expect(a.top).toBeCloseTo((1920 - 1080 * f) / 2);
  });

  it("cover-crops a background image instead of stretching it", () => {
    const image = { type: "Image", src: "/api/assets/a", left: 0, top: 0, width: 1000, height: 1000, cropX: 500, cropY: 0, scaleX: 1.08, scaleY: 1.08 };
    const [out] = resizeObjects([image], square, portrait, () => ({ width: 2000, height: 3000 }));
    expect(out.scaleX).toBeCloseTo(out.scaleY as number);
    expect((out.width as number) * (out.scaleX as number)).toBeCloseTo(1080);
    expect((out.height as number) * (out.scaleY as number)).toBeCloseTo(1920);
    // The image has room, so the whole old view stays and more is shown above and below it.
    expect(out).toMatchObject({ cropX: 500, width: 1000, left: 0, top: 0 });
    expect(out.height).toBeCloseTo(1000 * (1920 / 1080));
  });

  it("crops further into a background image that has no more room", () => {
    const image = { type: "Image", src: "/x", left: 0, top: 0, width: 1000, height: 1000, scaleX: 1.08, scaleY: 1.08 };
    // Natural size unknown: only the part up to the crop's far edge is used.
    const [out] = resizeObjects([image], square, portrait);
    expect(out.height).toBeCloseTo(1000);
    expect(out.width).toBeCloseTo(1000 * (1080 / 1920));
    expect(out.cropX).toBeCloseTo((1000 - (out.width as number)) / 2);
    expect((out.height as number) * (out.scaleY as number)).toBeCloseTo(1920);
  });

  it("keeps a rounded background image's corners in step with the crop", () => {
    const image = {
      type: "Image",
      src: "/x",
      left: 0,
      top: 0,
      width: 1080,
      height: 1080,
      clipPath: { type: "Rect", width: 1080, height: 1080, rx: 40, ry: 40 },
    };
    const [out] = resizeObjects([image], square, landscape, () => ({ width: 1080, height: 1080 }));
    const clip = out.clipPath as Record<string, number>;
    expect(clip.width).toBeCloseTo(out.width as number);
    expect(clip.height).toBeCloseTo(out.height as number);
    // Content scale is 1, so the corners keep their 40 px on the page.
    expect(clip.rx * (out.scaleX as number)).toBeCloseTo(40);
  });

  it("finds the background images to measure", () => {
    const pages = [
      { objects: [{ type: "Image", src: "/a", left: 0, top: 0, width: 1080, height: 1080 }, { type: "Image", src: "/b", left: 0, top: 0, width: 10, height: 10 }] },
      { objects: [{ type: "Image", src: "/a", left: 0, top: 0, width: 1080, height: 1080 }] },
    ];
    expect(fullBleedImageSources(pages, square)).toEqual(["/a"]);
  });

  it("resizes a page and keeps its other fields", () => {
    const page = resizePage({ objects: [{ left: 10, top: 10 }] }, square, { width: 540, height: 540 });
    expect(page.objects[0]).toMatchObject({ left: 5, top: 5, scaleX: 0.5, scaleY: 0.5 });
  });
});

describe("coverCrop", () => {
  it("stays inside the image", () => {
    const crop = coverCrop({ x: 900, y: 0, width: 100, height: 100 }, { width: 1000, height: 1000 }, 2);
    expect(crop).toEqual({ x: 800, y: 0, width: 200, height: 100 });
  });
});

describe("resizePage guides", () => {
  it("moves guides with the content", () => {
    const page = resizePage({ objects: [], guides: { vertical: [540], horizontal: [100] } }, square, portrait);
    expect(page.guides).toEqual({ vertical: [540], horizontal: [520] });
  });
});
