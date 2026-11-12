import { describe, expect, it } from "vitest";
import { clipPlaying, clipTime, detectVideo, formatClipTime, readVideoSettings } from "./video";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("detectVideo", () => {
  it("recognises MP4 and WebM by their headers", () => {
    expect(detectVideo(bytes([0, 0, 0, 0x20], "ftypisom", [0, 0, 0, 0]))).toEqual({ mimeType: "video/mp4", extension: "mp4" });
    expect(detectVideo(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84], "webm"))).toEqual({ mimeType: "video/webm", extension: "webm" });
  });

  it("refuses other files, including Matroska that is not WebM", () => {
    expect(detectVideo(bytes([0x89], "PNG"))).toBeNull();
    expect(detectVideo(bytes([0x1a, 0x45, 0xdf, 0xa3], "matroska"))).toBeNull();
  });
});

describe("readVideoSettings", () => {
  it("keeps the trim inside the file", () => {
    expect(readVideoSettings({ src: "/api/assets/v", duration: 10, trimStart: -2, trimEnd: 30 })).toEqual({
      src: "/api/assets/v",
      duration: 10,
      trimStart: 0,
      trimEnd: 10,
      muted: false,
      loop: false,
    });
    expect(readVideoSettings({ src: "/v", duration: 10, trimStart: 6, trimEnd: 4 })).toMatchObject({ trimStart: 6, trimEnd: 6 });
    expect(readVideoSettings({ duration: 1 })).toBeNull();
  });
});

describe("clipTime", () => {
  const clip = { src: "/v", duration: 10, trimStart: 2, trimEnd: 5, muted: false, loop: false };

  it("starts at the trim start with the page and stops at the trim end", () => {
    expect(clipTime(clip, 0)).toBe(2);
    expect(clipTime(clip, 1.5)).toBe(3.5);
    expect(clipTime(clip, 9)).toBe(5);
    expect(clipPlaying(clip, 2.9)).toBe(true);
    expect(clipPlaying(clip, 3)).toBe(false);
  });

  it("starts over when looping", () => {
    expect(clipTime({ ...clip, loop: true }, 4)).toBe(3);
    expect(clipPlaying({ ...clip, loop: true }, 100)).toBe(true);
  });
});

describe("formatClipTime", () => {
  it("shows minutes and seconds", () => {
    expect(formatClipTime(65)).toBe("1:05");
    expect(formatClipTime(2.5)).toBe("0:02.5");
    expect(formatClipTime(3.0333)).toBe("0:03");
    expect(formatClipTime(59.97)).toBe("1:00");
  });
});
