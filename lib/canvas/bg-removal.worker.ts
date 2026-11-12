/// <reference lib="webworker" />
/**
 * Runs background removal off the main thread. The model and WASM runtime are served by this app
 * from public/bg-removal (see scripts/fetch-bg-removal.ts), never from the library's CDN.
 */
import { removeBackground } from "@imgly/background-removal";
import type { BgRemovalRequest, BgRemovalResponse } from "./bg-removal-protocol";

const post = (message: BgRemovalResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);

self.onmessage = async (event: MessageEvent<BgRemovalRequest>) => {
  const { id, image, publicPath } = event.data;
  try {
    const result = await removeBackground(image, {
      publicPath,
      model: "isnet_fp16",
      output: { format: "image/png" },
      progress: (key, current, total) => {
        post({ id, type: "progress", stage: key.startsWith("fetch:") ? "download" : "process", current, total });
      },
    });
    post({ id, type: "done", result });
  } catch (error) {
    post({ id, type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
