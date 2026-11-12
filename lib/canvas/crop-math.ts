export type CropAxis = { crop: number; size: number };

/**
 * Turns a scale proposed by dragging a crop handle into a crop along one axis. `size` and `crop`
 * are in the image's own pixels; `scale` is the object's (unchanged) scale; `natural` is the full
 * image size on this axis. Dragging the start edge (left/top) moves the crop origin and keeps the
 * end edge in place; dragging the end edge keeps the origin. The result stays inside the image.
 */
export function cropAxis(
  current: CropAxis,
  scale: number,
  proposedScale: number,
  edge: "start" | "end",
  natural: number,
): CropAxis {
  const wanted = Math.max(1, (current.size * proposedScale) / scale);
  if (edge === "end") {
    return { crop: current.crop, size: Math.min(wanted, natural - current.crop) };
  }
  const end = current.crop + current.size;
  const crop = Math.max(0, end - wanted);
  return { crop, size: end - crop };
}
