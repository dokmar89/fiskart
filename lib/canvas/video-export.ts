import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { readTiming, transitionStyle } from "@/lib/animation";
import type { CanvasData } from "@/lib/page-data";
import { framesFor, gifDelay, pageStarts, VIDEO_FPS, videoSize, type VideoResolution } from "@/lib/video-options";
import { readVideoSettings } from "@/lib/video";
import { PagePlayer } from "./player";
import type { Size } from "./viewport-math";
import { chooseFormat, VideoWriter, type VideoFormat } from "./video-encode";

export type AnimationExport = {
  kind: "video" | "gif";
  resolution: VideoResolution;
  /** Pages in the order they play. */
  pages: CanvasData[];
  artboard: Size;
  onProgress: (done: number, total: number) => void;
  signal?: AbortSignal;
};

export type AnimationExportResult = { blob: Blob; extension: string; durationMs: number };

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException("Export zrušen", "AbortError");
};

/** The format a video export would use here, or null when this browser cannot encode video. */
export function videoFormatFor(artboard: Size, resolution: VideoResolution): Promise<VideoFormat | null> {
  const size = videoSize(artboard, resolution);
  return chooseFormat(size.width, size.height, VIDEO_FPS);
}

/**
 * Mixes the sound of every clip that is not muted, at the times its page plays, into one stereo
 * track at 48 kHz. Clips whose files have no sound (or a sound this browser cannot decode) are
 * left out. Null when there is nothing to hear.
 */
async function mixAudio(pages: CanvasData[], starts: number[], durations: number[], signal?: AbortSignal): Promise<Float32Array[] | null> {
  const total = (starts[starts.length - 1] ?? 0) + (durations[durations.length - 1] ?? 0);
  // Hidden objects do not play, their sound included.
  const clips = pages.flatMap((page, i) =>
    page.objects
      .filter((o) => o.visible !== false)
      .map((o) => readVideoSettings(o.video))
      .filter((v): v is NonNullable<typeof v> => v !== null && !v.muted)
      .map((settings) => ({ settings, start: starts[i] / 1000, length: durations[i] / 1000 })),
  );
  if (clips.length === 0 || total <= 0) return null;
  const context = new OfflineAudioContext(2, Math.ceil((total / 1000) * 48_000), 48_000);
  const buffers = new Map<string, AudioBuffer | null>();
  let any = false;
  for (const clip of clips) {
    throwIfAborted(signal);
    if (!buffers.has(clip.settings.src)) {
      try {
        const data = await (await fetch(clip.settings.src)).arrayBuffer();
        buffers.set(clip.settings.src, await context.decodeAudioData(data));
      } catch {
        buffers.set(clip.settings.src, null);
      }
    }
    const buffer = buffers.get(clip.settings.src);
    if (!buffer) continue;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const { trimStart, trimEnd, loop } = clip.settings;
    if (loop) {
      source.loop = true;
      source.loopStart = trimStart;
      source.loopEnd = trimEnd;
      source.start(clip.start, trimStart);
      source.stop(clip.start + clip.length);
    } else {
      source.start(clip.start, trimStart, Math.min(trimEnd - trimStart, clip.length));
    }
    source.connect(context.destination);
    any = true;
  }
  if (!any) return null;
  const rendered = await context.startRendering();
  return [rendered.getChannelData(0), rendered.getChannelData(rendered.numberOfChannels > 1 ? 1 : 0)];
}

/** Draws a player's current frame onto the output, with a transition style when given. */
function draw(ctx: CanvasRenderingContext2D, source: CanvasImageSource, style?: { opacity: number; x: number; scale: number }) {
  const { width, height } = ctx.canvas;
  ctx.save();
  if (style) {
    ctx.globalAlpha = style.opacity;
    ctx.translate(width / 2 + style.x * width, height / 2);
    ctx.scale(style.scale, style.scale);
    ctx.translate(-width / 2, -height / 2);
  }
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();
}

/**
 * Renders the pages' animations frame by frame off screen, at 30 fps, and encodes them as they
 * come: MP4 (H.264) where the browser supports it, else WebM, or a GIF. One page is loaded at a
 * time (the previous page's last frame is kept for its transition), and every frame is released
 * once encoded, so memory stays flat however long the design.
 */
export async function exportAnimation(options: AnimationExport): Promise<AnimationExportResult> {
  const { pages, artboard, signal } = options;
  const size = videoSize(artboard, options.resolution);
  const scale = size.width / artboard.width;
  const durations = pages.map((p) => readTiming(p.timing).duration);
  const starts = pageStarts(durations);
  const frames = durations.map((d) => framesFor(d));
  const total = frames.reduce((a, b) => a + b, 0);
  const durationMs = (total * 1000) / VIDEO_FPS;

  const output = document.createElement("canvas");
  output.width = size.width;
  output.height = size.height;
  const ctx = output.getContext("2d", { willReadFrequently: options.kind === "gif" })!;
  // The last frame of the page before, for the next page's transition.
  const previous = document.createElement("canvas");
  previous.width = size.width;
  previous.height = size.height;
  const previousCtx = previous.getContext("2d")!;
  let hasPrevious = false;

  let writer: VideoWriter | null = null;
  let gif: ReturnType<typeof GIFEncoder> | null = null;
  let extension = "gif";
  if (options.kind === "video") {
    const format = await chooseFormat(size.width, size.height, VIDEO_FPS);
    if (!format) throw new Error("Tento prohlížeč neumí kódovat video. Chrome, Edge a Safari to umí.");
    const audio = await mixAudio(pages, starts, durations, signal);
    writer = new VideoWriter(format, size.width, size.height, VIDEO_FPS, audio !== null);
    if (audio) writer.addAudio(audio);
    extension = format.container;
  } else {
    gif = GIFEncoder();
  }

  let done = 0;
  options.onProgress(0, total);
  try {
    for (const [index, data] of pages.entries()) {
      throwIfAborted(signal);
      const player = await PagePlayer.create(data, artboard, scale, undefined, { muted: true });
      try {
        const transition = player.timing.transition;
        for (let f = 0; f < frames[index]; f++) {
          throwIfAborted(signal);
          const t = (f * 1000) / VIDEO_FPS;
          await player.seekExact(t);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size.width, size.height);
          if (hasPrevious && transition.type !== "none" && t < transition.duration) {
            const style = transitionStyle(transition.type, t / transition.duration);
            draw(ctx, previous, style.from);
            draw(ctx, player.canvas.getElement(), style.to);
          } else {
            draw(ctx, player.canvas.getElement());
          }
          if (writer) {
            await writer.addFrame(output);
          } else if (gif) {
            const rgba = ctx.getImageData(0, 0, size.width, size.height).data;
            const palette = quantize(rgba, 256);
            gif.writeFrame(applyPalette(rgba, palette), size.width, size.height, { palette, delay: gifDelay() * 10 });
            // Let the page breathe between frames; quantizing is heavy.
            if (f % 5 === 0) await new Promise((r) => setTimeout(r, 0));
          }
          done++;
          options.onProgress(done, total);
        }
        previousCtx.drawImage(output, 0, 0);
        hasPrevious = true;
      } finally {
        await player.dispose();
      }
    }
    if (writer) return { blob: await writer.finish(), extension, durationMs };
    gif!.finish();
    return { blob: new Blob([gif!.bytes() as Uint8Array<ArrayBuffer>], { type: "image/gif" }), extension, durationMs };
  } catch (error) {
    writer?.close();
    throw error;
  } finally {
    output.width = 0;
    previous.width = 0;
  }
}
