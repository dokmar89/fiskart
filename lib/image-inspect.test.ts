import { describe, expect, it } from "vitest";
import { assetIdFromUrl, assetUrl } from "./assets";
import { ensureSvgSize, inspectImage } from "./image-inspect";

const fromBase64 = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));
const text = (s: string) => new TextEncoder().encode(s);

// Real 1×1 / 2×1 files.
const PNG_1x1 = fromBase64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
const WEBP_1x1 = fromBase64("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=");
const GIF_1x1 = fromBase64("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==");

/** A minimal baseline JPEG header: SOI, a JFIF APP0 segment, then a SOF0 segment declaring the size. */
function jpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
}

describe("inspectImage", () => {
  it("recognises PNG, JPEG and WebP by content", () => {
    expect(inspectImage(PNG_1x1)).toMatchObject({ kind: "image", mimeType: "image/png", width: 1, height: 1 });
    expect(inspectImage(jpegHeader(640, 480))).toMatchObject({ mimeType: "image/jpeg", extension: "jpg", width: 640, height: 480 });
    expect(inspectImage(WEBP_1x1)).toMatchObject({ mimeType: "image/webp", width: 1, height: 1 });
  });

  it("rejects other formats and junk", () => {
    expect(inspectImage(GIF_1x1)).toBeNull();
    expect(inspectImage(text("hello"))).toBeNull();
    expect(inspectImage(new Uint8Array())).toBeNull();
  });

  it("reads SVG size from attributes or the viewBox", () => {
    expect(inspectImage(text('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"></svg>'))).toMatchObject({
      kind: "svg",
      mimeType: "image/svg+xml",
      width: 40,
      height: 20,
    });
    const viewBoxOnly = inspectImage(text('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect/></svg>'));
    expect(viewBoxOnly).toMatchObject({ width: 300, height: 100 });
    expect(new TextDecoder().decode(viewBoxOnly!.data)).toContain('<svg width="300" height="100" xmlns');
  });
});

describe("ensureSvgSize", () => {
  it("adds only what is missing and leaves sized SVGs untouched", () => {
    const sized = '<svg width="1" height="2"></svg>';
    expect(ensureSvgSize(sized, 5, 5)).toBe(sized);
    expect(ensureSvgSize('<svg width="7" viewBox="0 0 7 3"></svg>', 7, 3)).toBe('<svg height="3" width="7" viewBox="0 0 7 3"></svg>');
  });
});

describe("asset URLs", () => {
  it("round-trips the id and ignores other URLs", () => {
    expect(assetIdFromUrl(assetUrl("abc123"))).toBe("abc123");
    expect(assetIdFromUrl("http://host:3000/api/assets/abc123")).toBe("abc123");
    expect(assetIdFromUrl("/api/projects/abc123/thumbnail")).toBeNull();
  });
});
