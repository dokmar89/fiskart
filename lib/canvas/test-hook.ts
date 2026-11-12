import { FabricText, type Canvas } from "fabric";
import { useEditorStore } from "@/lib/store/editor";
import type { CanvasData } from "@/lib/page-data";
import { currentPageId, pageSnapshot } from "./document";
import { PagePlayer } from "./player";
import { serializeCanvas } from "./serialize";
import { chooseFormat, VideoWriter } from "./video-encode";
import { sceneToViewport, type Matrix, type Size } from "./viewport-math";

export type TestObjectInfo = {
  id: string | undefined;
  name: string | undefined;
  type: string;
  visible: boolean;
  locked: boolean;
  /** Centre in scene (artboard) pixels. */
  center: { x: number; y: number };
};

export type OpenCanvaTestHook = {
  artboard: Size;
  /** The page on the canvas. */
  pageId: () => string | null;
  /** All page ids in page order. */
  pageIds: () => string[];
  objects: () => TestObjectInfo[];
  activeIds: () => (string | undefined)[];
  /** The page as it would be saved, as a JSON string. */
  serialized: () => string;
  zoom: () => number;
  /** Page-space bounding boxes, in stacking order. */
  boxes: () => { left: number; top: number; width: number; height: number }[];
  /** Scene point to page (client) coordinates, for driving the mouse in tests. */
  sceneToClient: (x: number, y: number) => { x: number; y: number };
  clientToScene: (x: number, y: number) => { x: number; y: number };
  /** Text objects as Fabric measured them: widest line and number of lines. */
  texts: () => { id: string | undefined; family: string; width: number; lines: number }[];
  /** RGBA of the rendered main canvas at a client point. */
  pixelAt: (x: number, y: number) => [number, number, number, number];
  /**
   * A WebM clip whose red channel counts tenths of a second (12 per step) and whose green is
   * `green`, so a test can tell which clip it sees and where in it; base64.
   */
  makeTestVideo: (options: { width: number; height: number; seconds: number; fps: number; green: number; tone?: number }) => Promise<string>;
  /** RGBA at page points of page `index` drawn by the page player at `timeMs` (what preview and video export show). */
  framePixels: (index: number, timeMs: number, scale: number, points: { x: number; y: number }[]) => Promise<number[][]>;
};

declare global {
  interface Window {
    __opencanva?: OpenCanvaTestHook;
  }
}

/** Read-only view of the canvas for Playwright. Only installed outside production builds. */
export function installTestHook(canvas: Canvas, artboard: Size): () => void {
  if (process.env.NODE_ENV === "production") return () => {};

  const rect = () => canvas.upperCanvasEl.getBoundingClientRect();
  const vpt = () => [...canvas.viewportTransform] as Matrix;

  window.__opencanva = {
    artboard,
    pageId: currentPageId,
    pageIds: () => useEditorStore.getState().pageIds,
    objects: () =>
      canvas.getObjects().map((o) => {
        const c = o.getCenterPoint();
        return { id: o.id, name: o.name, type: o.type, visible: o.visible, locked: Boolean(o.locked), center: { x: c.x, y: c.y } };
      }),
    activeIds: () => canvas.getActiveObjects().map((o) => o.id),
    serialized: () => JSON.stringify(serializeCanvas(canvas)),
    zoom: () => canvas.getZoom(),
    texts: () =>
      canvas
        .getObjects()
        .filter((o): o is FabricText => o instanceof FabricText)
        .map((o) => ({ id: o.id, family: o.fontFamily, width: o.calcTextWidth(), lines: o.textLines.length })),
    boxes: () => canvas.getObjects().map((o) => o.getBoundingRect()),
    sceneToClient: (x, y) => {
      const p = sceneToViewport(vpt(), { x, y });
      const r = rect();
      return { x: p.x + r.left, y: p.y + r.top };
    },
    clientToScene: (x, y) => {
      const r = rect();
      const v = vpt();
      return { x: (x - r.left - v[4]) / v[0], y: (y - r.top - v[5]) / v[3] };
    },
    makeTestVideo: async ({ width, height, seconds, fps, green, tone }) => {
      const format = await chooseFormat(width, height, fps, true);
      if (!format) throw new Error("This browser cannot encode video");
      const writer = new VideoWriter(format, width, height, fps, tone !== undefined && format.audio !== null);
      if (tone !== undefined) {
        // A sine tone of `tone` Hz for the whole clip.
        const samples = Math.round(seconds * 48_000);
        const wave = new Float32Array(samples);
        for (let i = 0; i < samples; i++) wave[i] = 0.4 * Math.sin((2 * Math.PI * tone * i) / 48_000);
        writer.addAudio([wave, wave]);
      }
      const frame = new OffscreenCanvas(width, height);
      const ctx = frame.getContext("2d")!;
      for (let i = 0; i < Math.round(seconds * fps); i++) {
        ctx.fillStyle = `rgb(${Math.min(252, Math.floor((i / fps) * 10) * 12)}, ${green}, 80)`;
        ctx.fillRect(0, 0, width, height);
        await writer.addFrame(frame);
      }
      const bytes = new Uint8Array(await (await writer.finish()).arrayBuffer());
      let text = "";
      for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(text);
    },
    framePixels: async (index, timeMs, scale, points) => {
      const id = useEditorStore.getState().pageIds[index];
      const snapshot = id ? pageSnapshot(id) : null;
      if (!snapshot) throw new Error(`No page ${index}`);
      const player = await PagePlayer.create(JSON.parse(snapshot) as CanvasData, artboard, scale, undefined, { muted: true });
      try {
        await player.seekExact(timeMs);
        const ctx = player.canvas.getElement().getContext("2d")!;
        return points.map((p) => Array.from(ctx.getImageData(Math.round(p.x * scale), Math.round(p.y * scale), 1, 1).data));
      } finally {
        await player.dispose();
      }
    },
    pixelAt: (x, y) => {
      const r = rect();
      const ratio = canvas.getRetinaScaling();
      const data = canvas
        .getContext()
        .getImageData(Math.round((x - r.left) * ratio), Math.round((y - r.top) * ratio), 1, 1).data;
      return [data[0], data[1], data[2], data[3]];
    },
  };

  return () => {
    delete window.__opencanva;
  };
}
