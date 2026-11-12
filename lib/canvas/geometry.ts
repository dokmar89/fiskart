/** Axis-aligned box in scene (page) pixels. */
export type Box = { left: number; top: number; width: number; height: number };

export const right = (b: Box) => b.left + b.width;
export const bottom = (b: Box) => b.top + b.height;
export const centerX = (b: Box) => b.left + b.width / 2;
export const centerY = (b: Box) => b.top + b.height / 2;

/** The smallest box containing all boxes. */
export function unionBox(boxes: Box[]): Box {
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  return {
    left,
    top,
    width: Math.max(...boxes.map(right)) - left,
    height: Math.max(...boxes.map(bottom)) - top,
  };
}
