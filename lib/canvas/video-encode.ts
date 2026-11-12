import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from "webm-muxer";

/**
 * Encoding frames (and sound) into a video file in the browser with WebCodecs: H.264 in MP4 where
 * the browser can encode it, VP9 (or VP8) in WebM otherwise. Used by video export (phase 18) and by
 * the tests to make clips.
 */

export type VideoFormat = { container: "mp4" | "webm"; codec: string; muxerCodec: string; mimeType: string; audio: { codec: string; muxerCodec: string } | null };

const CANDIDATES: Omit<VideoFormat, "audio">[] = [
  { container: "mp4", codec: "avc1.640028", muxerCodec: "avc", mimeType: "video/mp4" },
  { container: "mp4", codec: "avc1.42E028", muxerCodec: "avc", mimeType: "video/mp4" },
  { container: "webm", codec: "vp09.00.40.08", muxerCodec: "V_VP9", mimeType: "video/webm" },
  { container: "webm", codec: "vp8", muxerCodec: "V_VP8", mimeType: "video/webm" },
];

export function webCodecsAvailable(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

/** The best format this browser can encode at this size: MP4/H.264 first, then WebM. */
export async function chooseFormat(width: number, height: number, fps: number, preferWebm = false): Promise<VideoFormat | null> {
  if (!webCodecsAvailable()) return null;
  const list = preferWebm ? CANDIDATES.filter((c) => c.container === "webm") : CANDIDATES;
  for (const candidate of list) {
    const support = await VideoEncoder.isConfigSupported({ codec: candidate.codec, width, height, framerate: fps, bitrate: bitrateFor(width, height, fps) }).catch(() => null);
    if (!support?.supported) continue;
    const audio = await chooseAudio(candidate.container);
    return { ...candidate, audio };
  }
  return null;
}

/** AAC for MP4 where the browser encodes it, Opus otherwise (MP4 can carry Opus too). */
async function chooseAudio(container: "mp4" | "webm"): Promise<VideoFormat["audio"]> {
  if (typeof AudioEncoder === "undefined") return null;
  const tries = container === "mp4" ? [{ codec: "mp4a.40.2", muxerCodec: "aac" }, { codec: "opus", muxerCodec: "opus" }] : [{ codec: "opus", muxerCodec: "A_OPUS" }];
  for (const t of tries) {
    const support = await AudioEncoder.isConfigSupported({ codec: t.codec, sampleRate: 48_000, numberOfChannels: 2, bitrate: 128_000 }).catch(() => null);
    if (support?.supported) return t;
  }
  return null;
}

export const bitrateFor = (width: number, height: number, fps: number) => Math.round(width * height * fps * 0.12);

/**
 * Writes frames into a video file. Frames are encoded as they come and released straight away;
 * `addFrame` waits while the encoder has a backlog, so memory stays flat however long the video.
 */
export class VideoWriter {
  private readonly encoder: VideoEncoder;
  private audioEncoder: AudioEncoder | null = null;
  private readonly muxer: Mp4Muxer<Mp4Target> | WebmMuxer<WebmTarget>;
  private failure: Error | null = null;
  private frames = 0;

  constructor(
    readonly format: VideoFormat,
    readonly width: number,
    readonly height: number,
    readonly fps: number,
    withAudio: boolean,
  ) {
    const audio = withAudio && format.audio ? { codec: format.audio.muxerCodec, numberOfChannels: 2, sampleRate: 48_000 } : undefined;
    this.muxer =
      format.container === "mp4"
        ? new Mp4Muxer({
            target: new Mp4Target(),
            video: { codec: format.muxerCodec as "avc", width, height, frameRate: fps },
            audio: audio as { codec: "aac" | "opus"; numberOfChannels: number; sampleRate: number } | undefined,
            fastStart: "in-memory",
            firstTimestampBehavior: "offset",
          })
        : new WebmMuxer({
            target: new WebmTarget(),
            video: { codec: format.muxerCodec, width, height, frameRate: fps },
            audio,
            firstTimestampBehavior: "offset",
          });
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (e) => (this.failure = e instanceof Error ? e : new Error(String(e))),
    });
    this.encoder.configure({ codec: format.codec, width, height, framerate: fps, bitrate: bitrateFor(width, height, fps), latencyMode: "quality" });
    if (audio && format.audio) {
      this.audioEncoder = new AudioEncoder({
        output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
        error: (e) => (this.failure = e instanceof Error ? e : new Error(String(e))),
      });
      this.audioEncoder.configure({ codec: format.audio.codec, sampleRate: 48_000, numberOfChannels: 2, bitrate: 128_000 });
    }
  }

  /** Adds the canvas's current picture as the next frame. */
  async addFrame(source: HTMLCanvasElement | OffscreenCanvas) {
    if (this.failure) throw this.failure;
    while (this.encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
    const timestamp = Math.round((this.frames * 1_000_000) / this.fps);
    // A snapshot of the canvas now: a frame made from the canvas itself may be read only later,
    // after the canvas has been drawn over with the next frame.
    const bitmap = await createImageBitmap(source);
    const frame = new VideoFrame(bitmap, { timestamp, duration: Math.round(1_000_000 / this.fps) });
    // A key frame every two seconds, so players can seek.
    this.encoder.encode(frame, { keyFrame: this.frames % (this.fps * 2) === 0 });
    frame.close();
    bitmap.close();
    this.frames++;
  }

  /** Adds mixed stereo sound at 48 kHz (planar, one array per channel). */
  addAudio(channels: Float32Array[]) {
    if (!this.audioEncoder || channels.length === 0) return;
    const length = channels[0].length;
    const chunk = 48_000;
    for (let start = 0; start < length; start += chunk) {
      const end = Math.min(length, start + chunk);
      const data = new Float32Array((end - start) * 2);
      data.set(channels[0].subarray(start, end), 0);
      data.set((channels[1] ?? channels[0]).subarray(start, end), end - start);
      const audio = new AudioData({ format: "f32-planar", sampleRate: 48_000, numberOfFrames: end - start, numberOfChannels: 2, timestamp: Math.round((start * 1_000_000) / 48_000), data });
      this.audioEncoder.encode(audio);
      audio.close();
    }
  }

  get frameCount() {
    return this.frames;
  }

  async finish(): Promise<Blob> {
    await this.encoder.flush();
    if (this.audioEncoder) await this.audioEncoder.flush();
    if (this.failure) throw this.failure;
    this.muxer.finalize();
    this.encoder.close();
    this.audioEncoder?.close();
    return new Blob([this.muxer.target.buffer], { type: this.format.mimeType });
  }

  close() {
    if (this.encoder.state !== "closed") this.encoder.close();
    if (this.audioEncoder && this.audioEncoder.state !== "closed") this.audioEncoder.close();
  }
}
