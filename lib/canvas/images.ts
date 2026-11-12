import type { AssetDto } from "@/lib/assets";
import { useUploadsStore } from "@/lib/store/uploads";
import { loadDesignImage } from "./design-image";
import { fillFrame, selectedFrame } from "./frames";
import { addVideoFromAsset } from "./video";
import { placeLargestFit } from "./image-fit";
import { placeObject } from "./elements";
import { getEditorInstance } from "./instance";

/**
 * Places an uploaded image by its URL, scaled down to fit comfortably on the page. With a frame
 * selected (and no drop point), the image goes into the frame instead.
 */
export async function addImageFromAsset(asset: AssetDto, at?: { x: number; y: number }) {
  const editor = getEditorInstance();
  if (!editor) return;
  if (asset.kind === "video") return addVideoFromAsset(asset, at);
  const frame = at ? null : selectedFrame();
  if (frame) return fillFrame(frame, asset.url);
  const image = await loadDesignImage(asset.url);
  const scale = placeLargestFit({ width: image.width, height: image.height }, editor.artboard);
  image.set({ scaleX: scale, scaleY: scale });
  placeObject(image, asset.kind === "svg" ? "Grafika" : "Obrázek", at);
}

/**
 * Uploads image files and places them, so the page only ever references stored assets. Several
 * files at one point are fanned out slightly so they do not stack exactly.
 */
export async function uploadAndPlace(files: File[], at?: { x: number; y: number }) {
  const { upload } = useUploadsStore.getState();
  await Promise.all(
    files.map(async (file, i) => {
      try {
        const asset = await upload(file);
        await addImageFromAsset(asset, at && { x: at.x + i * 24, y: at.y + i * 24 });
      } catch {
        // The uploads store shows the error.
      }
    }),
  );
}
