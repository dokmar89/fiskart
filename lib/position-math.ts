/**
 * The position panel's numbers: an object's top-left corner (as Fabric places it), its size without
 * stroke, and its rotation, in page pixels and degrees. Pure, unit tested.
 */

export type Placement = { x: number; y: number; width: number; height: number; angle: number };

/** An angle in degrees, from 0 up to (not including) 360. */
export function normalizeAngle(angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  return Math.abs(a - 360) < 1e-9 ? 0 : a;
}

/**
 * A new size from a typed width or height. With the aspect ratio locked the other side follows;
 * sides never go below `min`.
 */
export function resizeBox(
  current: { width: number; height: number },
  change: { width?: number; height?: number },
  locked: boolean,
  min = 1,
): { width: number; height: number } {
  const ratio = current.height > 0 ? current.width / current.height : 1;
  let width = change.width ?? current.width;
  let height = change.height ?? current.height;
  if (locked && change.width !== undefined) height = width / ratio;
  if (locked && change.height !== undefined) width = height * ratio;
  return { width: Math.max(min, width), height: Math.max(min, height) };
}
