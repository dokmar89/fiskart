/** Video and GIF export settings and the sizes and frame counts they give. Pure, unit tested. */

export const VIDEO_RESOLUTIONS = [720, 1080] as const;
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];
export const VIDEO_FPS = 30;

type Size = { width: number; height: number };

/**
 * Output size for "720p" or "1080p": the page's shorter side becomes that many pixels, the other
 * follows its shape. Both sides are even, as H.264 and most players need.
 */
export function videoSize(artboard: Size, resolution: VideoResolution): Size {
  const scale = resolution / Math.min(artboard.width, artboard.height);
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(artboard.width * scale), height: even(artboard.height * scale) };
}

/** Frames a page of `durationMs` takes at `fps` (at least one). */
export function framesFor(durationMs: number, fps = VIDEO_FPS): number {
  return Math.max(1, Math.round((durationMs / 1000) * fps));
}

/** Where each page starts in the video, ms, when the pages play one after another. */
export function pageStarts(durationsMs: number[], fps = VIDEO_FPS): number[] {
  const starts: number[] = [];
  let frames = 0;
  for (const d of durationsMs) {
    starts.push((frames * 1000) / fps);
    frames += framesFor(d, fps);
  }
  return starts;
}

/** GIF frame delays are in hundredths of a second; 30 fps is shown as 3 (33 fps), the closest a GIF allows. */
export function gifDelay(fps = VIDEO_FPS): number {
  return Math.max(2, Math.round(100 / fps));
}
