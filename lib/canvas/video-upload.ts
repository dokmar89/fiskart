import type { AssetDto } from "@/lib/assets";
import { MAX_VIDEO_BYTES } from "@/lib/video";

function once(target: HTMLMediaElement, event: string, timeoutMs = 20_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Video se nenačetlo (${event}).`)), timeoutMs);
    const done = () => {
      clearTimeout(timer);
      target.removeEventListener(event, done);
      target.removeEventListener("error", failed);
      resolve();
    };
    const failed = () => {
      clearTimeout(timer);
      target.removeEventListener(event, done);
      reject(new Error("Tento prohlížeč video neumí přehrát."));
    };
    target.addEventListener(event, done);
    target.addEventListener("error", failed, { once: true });
  });
}

/**
 * Reads a video's size and length in the browser and draws its poster frame (a second in, or a
 * tenth of a short clip), at the video's own resolution so a poster and a playing frame line up.
 */
export async function probeVideo(file: Blob): Promise<{ width: number; height: number; duration: number; poster: Blob }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  video.src = url;
  try {
    await once(video, "loadedmetadata");
    let duration = video.duration;
    if (!Number.isFinite(duration)) {
      // Recorded WebM files often leave out their length; seeking far ahead makes the browser find it.
      video.currentTime = 1e7;
      await once(video, "seeked");
      duration = video.duration;
    }
    if (!(video.videoWidth > 0 && video.videoHeight > 0)) throw new Error("Soubor neobsahuje obraz.");
    video.currentTime = Math.min(1, duration / 10 || 0);
    await once(video, "seeked");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const poster = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Náhled videa se nepodařilo vytvořit."))), "image/jpeg", 0.88));
    return { width: video.videoWidth, height: video.videoHeight, duration: Number.isFinite(duration) ? duration : 0, poster };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Uploads a video with its poster frame and measurements as a video asset. */
export async function uploadVideo(file: File): Promise<AssetDto> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error(`${file.name} je větší než ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`);
  const probe = await probeVideo(file);
  const form = new FormData();
  form.append("file", file);
  form.append("poster", new File([probe.poster], "poster.jpg", { type: "image/jpeg" }));
  form.append("width", String(probe.width));
  form.append("height", String(probe.height));
  form.append("duration", String(probe.duration));
  const res = await fetch("/api/assets/video", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${file.name} se nepodařilo nahrát.`);
  }
  return (await res.json()) as AssetDto;
}
