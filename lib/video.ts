/**
 * Video clips: recognising uploaded files, the settings a placed clip stores, and where in the clip
 * a page time falls. Pure, unit tested; shared by the upload route and the editor.
 */

/** Largest video upload: enough for a minute or two of 1080p, small enough to keep in memory while uploading. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

export type VideoSettings = {
  /** The uploaded file (an asset URL). The image the object draws when not playing is its poster. */
  src: string;
  /** Length of the file, seconds. */
  duration: number;
  /** The part of the file that plays, seconds. */
  trimStart: number;
  trimEnd: number;
  muted: boolean;
  loop: boolean;
};

const matchesAt = (bytes: Uint8Array, offset: number, text: string) => [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0));

/** MP4 (an ISO media file: "ftyp" box first) or WebM (EBML with the "webm" doc type), by content. */
export function detectVideo(bytes: Uint8Array): { mimeType: (typeof ACCEPTED_VIDEO_TYPES)[number]; extension: string } | null {
  if (bytes.length >= 12 && matchesAt(bytes, 4, "ftyp")) return { mimeType: "video/mp4", extension: "mp4" };
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 64));
    if (head.includes("webm")) return { mimeType: "video/webm", extension: "webm" };
  }
  return null;
}

const finite = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function readVideoSettings(value: unknown): VideoSettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.src !== "string" || !v.src) return null;
  const duration = Math.max(0, finite(v.duration, 0));
  const trimStart = Math.min(Math.max(0, finite(v.trimStart, 0)), duration);
  const trimEnd = Math.min(Math.max(trimStart, finite(v.trimEnd, duration)), duration);
  return { src: v.src, duration, trimStart, trimEnd, muted: v.muted === true, loop: v.loop === true };
}

/**
 * Where the clip is at page time `t` (seconds from the page's start): it starts at its trim start
 * when the page starts; a looping clip starts over at its trim end, others stop on their last frame.
 */
export function clipTime(video: VideoSettings, t: number): number {
  const length = video.trimEnd - video.trimStart;
  if (length <= 0) return video.trimStart;
  const into = Math.max(0, t);
  if (video.loop) return video.trimStart + (into % length);
  return video.trimStart + Math.min(into, length);
}

/** Whether the clip is still playing (not stopped at its end) at page time `t`. */
export function clipPlaying(video: VideoSettings, t: number): boolean {
  return video.loop || t < video.trimEnd - video.trimStart;
}

/** "1:05" style time for labels. */
export function formatClipTime(seconds: number): string {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const m = Math.floor(tenths / 600);
  const rest = (tenths - m * 600) / 10;
  return `${m}:${rest < 10 ? "0" : ""}${rest.toFixed(Number.isInteger(rest) ? 0 : 1)}`;
}
