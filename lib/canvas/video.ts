import type { FabricImage } from "fabric";
import type { AssetDto } from "@/lib/assets";
import { readVideoSettings, type VideoSettings } from "@/lib/video";
import { loadDesignImage } from "./design-image";
import { placeObject } from "./elements";
import { placeLargestFit } from "./image-fit";
import { getEditorInstance } from "./instance";

/** Places an uploaded video like an image: its poster on the page, the clip remembered with it. */
export async function addVideoFromAsset(asset: AssetDto, at?: { x: number; y: number }) {
  const editor = getEditorInstance();
  if (!editor || asset.kind !== "video" || !asset.posterUrl) return;
  const image = await loadDesignImage(asset.posterUrl);
  const scale = placeLargestFit({ width: image.width, height: image.height }, editor.artboard);
  const duration = asset.duration ?? 0;
  image.set({ scaleX: scale, scaleY: scale, video: { src: asset.url, duration, trimStart: 0, trimEnd: duration, muted: false, loop: false } });
  placeObject(image, "Video", at);
}

export const videoOf = (image: FabricImage): VideoSettings | null => readVideoSettings(image.video);

/** A video element for a clip, loaded far enough to draw frames. */
export function loadVideoElement(settings: VideoSettings, muted: boolean): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = muted || settings.muted;
  video.playsInline = true;
  video.preload = "auto";
  video.loop = false;
  video.src = settings.src;
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener("loadeddata", done);
      // Fabric reads a source's size from its width and height, which a video only has as attributes.
      video.width = video.videoWidth;
      video.height = video.videoHeight;
      resolve(video);
    };
    video.addEventListener("loadeddata", done);
    video.addEventListener("error", () => reject(new Error(`Video ${settings.src} se nepodařilo načíst`)), { once: true });
  });
}

/** Seeks a video and resolves once the frame there can be drawn. */
export function seekVideo(video: HTMLVideoElement, seconds: number): Promise<void> {
  if (Math.abs(video.currentTime - seconds) < 0.001 && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = seconds;
  });
}
