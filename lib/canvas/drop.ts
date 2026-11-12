import type { Canvas } from "fabric";
import type { AssetDto } from "@/lib/assets";
import { useUploadsStore } from "@/lib/store/uploads";
import { fillFrame, frameAt } from "./frames";
import { addImageFromAsset, uploadAndPlace } from "./images";
import { importStock, STOCK_DRAG_TYPE, type StockItem } from "./stock";
import { imageFilesFrom } from "./shortcuts";
import { viewportToScene, type Matrix } from "./viewport-math";

/** Drag type the uploads panel uses for an already uploaded asset. */
export const ASSET_DRAG_TYPE = "application/x-opencanva-asset";

function accepts(e: DragEvent) {
  const types = Array.from(e.dataTransfer?.types ?? []);
  return types.includes("Files") || types.includes(ASSET_DRAG_TYPE) || types.includes(STOCK_DRAG_TYPE);
}

/**
 * Dropping image files on the canvas uploads them and places them at the drop point; dropping a
 * tile from the uploads panel places that asset. Dropped on a frame, the (first) image goes into
 * the frame instead. Returns a cleanup function.
 */
export function installDrop(canvas: Canvas, host: HTMLElement) {
  const scenePoint = (e: DragEvent) => {
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    return viewportToScene([...canvas.viewportTransform] as Matrix, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const onDragOver = (e: DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    const at = scenePoint(e);
    const frame = frameAt(canvas, at);
    const stock = e.dataTransfer?.getData(STOCK_DRAG_TYPE);
    if (stock) {
      // Copied into local assets first, then placed like an upload.
      void importStock(JSON.parse(stock) as StockItem)
        .then((dto) => (frame ? fillFrame(frame, dto.url) : addImageFromAsset(dto, at)))
        .catch((error: unknown) => console.error(error));
      return;
    }
    const asset = e.dataTransfer?.getData(ASSET_DRAG_TYPE);
    if (asset) {
      const dto = JSON.parse(asset) as AssetDto;
      // Frames hold pictures; a video is placed beside them.
      void (frame && dto.kind !== "video" ? fillFrame(frame, dto.url) : addImageFromAsset(dto, at));
      return;
    }
    const files = imageFilesFrom(e.dataTransfer);
    if (files.length === 0) return;
    if (!frame) {
      void uploadAndPlace(files, at);
      return;
    }
    const [first, ...rest] = files;
    void useUploadsStore
      .getState()
      .upload(first)
      .then((uploaded) => fillFrame(frame, uploaded.url))
      .catch(() => {
        // The uploads store shows the error.
      });
    if (rest.length > 0) void uploadAndPlace(rest, at);
  };

  host.addEventListener("dragover", onDragOver);
  host.addEventListener("drop", onDrop);
  return () => {
    host.removeEventListener("dragover", onDragOver);
    host.removeEventListener("drop", onDrop);
  };
}
