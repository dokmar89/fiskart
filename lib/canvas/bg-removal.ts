import { FabricImage } from "fabric";
import { useEditorStore } from "@/lib/store/editor";
import { useUploadsStore } from "@/lib/store/uploads";
import type { BgRemovalRequest, BgRemovalResponse } from "./bg-removal-protocol";
import { setImageSource } from "./design-image";
import { recordStepAsync } from "./document";
import { getEditorInstance } from "./instance";
import { refreshSelection } from "./selection";

let worker: Worker | null = null;
let nextId = 1;
const setState = useEditorStore.setState;

function getWorker(): Worker {
  worker ??= new Worker(new URL("./bg-removal.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/** Runs the model in the worker; resolves with a PNG of the image without its background (also the AI tools' subject mask). */
export function removeInWorker(image: Blob, onProgress: (stage: "download" | "process", share: number | null) => void): Promise<Blob> {
  const id = nextId++;
  const w = getWorker();
  return new Promise<Blob>((resolve, reject) => {
    const onMessage = (event: MessageEvent<BgRemovalResponse>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === "progress") {
        onProgress(message.stage, message.total > 0 ? message.current / message.total : null);
        return;
      }
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      if (message.type === "done") resolve(message.result);
      else reject(new Error(message.message));
    };
    const onError = (event: ErrorEvent) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      // A worker that failed to start cannot be reused.
      worker?.terminate();
      worker = null;
      reject(new Error(event.message || "Odstranění pozadí selhalo"));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    const request: BgRemovalRequest = { id, image, publicPath: new URL("/bg-removal/", window.location.origin).href };
    w.postMessage(request);
  });
}

/**
 * Removes the background of the selected image: the model runs in a worker on the full original
 * picture, the result is uploaded as a new asset and becomes the image's source. Position, size,
 * crop and adjustments stay; it is one undo step.
 */
export async function removeSelectedBackground() {
  const editor = getEditorInstance();
  const image = editor?.canvas.getActiveObject();
  if (!editor || !(image instanceof FabricImage) || image.locked) return;
  const state = useEditorStore.getState().removingBackground;
  if (state && state.stage !== "failed") return;
  const { canvas } = editor;
  setState({ removingBackground: { stage: "download", progress: null } });
  try {
    const res = await fetch(image.getSrc(false));
    if (!res.ok) throw new Error("Obrázek se nepodařilo načíst.");
    const result = await removeInWorker(await res.blob(), (stage, progress) => setState({ removingBackground: { stage, progress } }));
    setState({ removingBackground: { stage: "upload", progress: null } });
    const asset = await useUploadsStore.getState().upload(new File([result], "background-removed.png", { type: "image/png" }));
    // The image may have been deleted, or its page left, in the meantime; the result stays in Uploads.
    if (!canvas.getObjects().includes(image)) {
      setState({ removingBackground: null });
      return;
    }
    await recordStepAsync(async () => {
      await setImageSource(image, asset.url);
      image.setCoords();
      canvas.fire("object:modified", { target: image });
    });
    canvas.requestRenderAll();
    refreshSelection();
    setState({ removingBackground: null });
  } catch (error) {
    console.error(error);
    setState({ removingBackground: { stage: "failed", message: error instanceof Error ? error.message : "Odstranění pozadí selhalo." } });
  }
}

export function dismissBackgroundError() {
  if (useEditorStore.getState().removingBackground?.stage === "failed") setState({ removingBackground: null });
}
