import { FabricImage, Point, type Canvas, type Transform } from "fabric";
import { useEditorStore } from "@/lib/store/editor";
import { cropAxis } from "./crop-math";
import { getEditorInstance } from "./instance";
import { cornerRadiusOf } from "./selection";
import { setImageRadius } from "./props";

type CropSession = {
  image: FabricImage;
  canvas: Canvas;
  cleanup: () => void;
};

let session: CropSession | null = null;

/** Which end of the image a handle moves on each axis, in the image's own (unflipped) space. */
function edges(corner: string, image: FabricImage) {
  const x = corner.includes("l") ? "start" : corner.includes("r") ? "end" : null;
  const y = corner.includes("t") ? "start" : corner.includes("b") ? "end" : null;
  const flip = (e: "start" | "end" | null, flipped: boolean) => (e && flipped ? (e === "start" ? "end" : "start") : e);
  return { x: flip(x, image.flipX), y: flip(y, image.flipY) };
}

/** Draws the parts of the image the crop hides, faintly, so it is clear what can be brought back. */
export function drawHiddenParts(canvas: Canvas, ctx: CanvasRenderingContext2D, image: FabricImage) {
  const element = image.getElement();
  const { width: naturalW, height: naturalH } = image.getOriginalSize();
  const v = canvas.viewportTransform;
  const m = image.calcTransformMatrix();
  const w = image.width;
  const h = image.height;
  const x0 = -w / 2 - image.cropX;
  const y0 = -h / 2 - image.cropY;
  ctx.save();
  ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.beginPath();
  ctx.rect(x0, y0, naturalW, naturalH);
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip("evenodd");
  ctx.globalAlpha = 0.35;
  ctx.drawImage(element, x0, y0, naturalW, naturalH);
  ctx.restore();
}

export function isCropping() {
  return session !== null;
}

/**
 * Crop mode for the selected image: its handles change what part of the image shows instead of
 * scaling it. Ends on Done, Enter, Escape or when the selection changes.
 */
export function startCrop() {
  const editor = getEditorInstance();
  const image = editor?.canvas.getActiveObject();
  if (!editor || !(image instanceof FabricImage) || image.locked || session) return;
  const { canvas } = editor;

  let start: { scaleX: number; scaleY: number; anchor: Point } | null = null;
  const radius = cornerRadiusOf(image);

  const onBeforeTransform = ({ transform }: { transform: Transform }) => {
    if (transform.target !== image) return;
    start = {
      scaleX: image.scaleX,
      scaleY: image.scaleY,
      anchor: image.translateToOriginPoint(image.getCenterPoint(), transform.originX, transform.originY),
    };
  };

  const onScaling = ({ target, transform }: { target: unknown; transform: Transform }) => {
    if (target !== image || !start) return;
    const natural = image.getOriginalSize();
    const { x, y } = edges(transform.corner, image);
    // Fabric proposes a scale relative to the current width, which the previous event already cropped.
    const currentX = { crop: image.cropX, size: image.width };
    const currentY = { crop: image.cropY, size: image.height };
    const nextX = x ? cropAxis(currentX, start.scaleX, image.scaleX, x, natural.width) : currentX;
    const nextY = y ? cropAxis(currentY, start.scaleY, image.scaleY, y, natural.height) : currentY;
    image.set({
      cropX: nextX.crop,
      width: nextX.size,
      cropY: nextY.crop,
      height: nextY.size,
      scaleX: start.scaleX,
      scaleY: start.scaleY,
    });
    // The edge opposite the handle stays where it was.
    image.setPositionByOrigin(start.anchor, transform.originX, transform.originY);
    if (radius > 0) setImageRadius(image, radius);
    image.setCoords();
  };

  const onAfterRender = ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    if (ctx === canvas.getContext()) drawHiddenParts(canvas, ctx, image);
  };

  const onSelectionChange = () => endCrop();

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      endCrop();
    }
  };

  const previousUniform = canvas.uniformScaling;
  canvas.uniformScaling = false;
  image.setControlsVisibility({ mtr: false });
  image.set({ lockScalingFlip: true, borderDashArray: [6, 4] });
  canvas.on("before:transform", onBeforeTransform);
  canvas.on("object:scaling", onScaling);
  canvas.on("after:render", onAfterRender);
  canvas.on("selection:updated", onSelectionChange);
  canvas.on("selection:cleared", onSelectionChange);
  // Captured before the editor's shortcuts, so Escape ends cropping without also deselecting.
  window.addEventListener("keydown", onKeyDown, { capture: true });

  session = {
    image,
    canvas,
    cleanup: () => {
      canvas.uniformScaling = previousUniform;
      image.setControlsVisibility({ mtr: true });
      image.set({ lockScalingFlip: false, borderDashArray: null });
      canvas.off("before:transform", onBeforeTransform);
      canvas.off("object:scaling", onScaling);
      canvas.off("after:render", onAfterRender);
      canvas.off("selection:updated", onSelectionChange);
      canvas.off("selection:cleared", onSelectionChange);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    },
  };
  useEditorStore.setState({ cropping: true });
  canvas.requestRenderAll();
}

export function endCrop() {
  if (!session) return;
  const { canvas, cleanup } = session;
  session = null;
  cleanup();
  useEditorStore.setState({ cropping: false });
  canvas.requestRenderAll();
}
