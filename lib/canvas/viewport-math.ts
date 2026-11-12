/** A 2D affine transform in canvas order [a, b, c, d, e, f], as Fabric's viewportTransform. */
export type Matrix = [number, number, number, number, number, number];

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 10;
const FIT_PADDING = 48;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Transform that shows the whole artboard centred in the viewport with some padding. */
export function fitTransform(viewport: Size, artboard: Size, padding = FIT_PADDING): Matrix {
  const availableW = Math.max(1, viewport.width - padding * 2);
  const availableH = Math.max(1, viewport.height - padding * 2);
  const zoom = clampZoom(Math.min(availableW / artboard.width, availableH / artboard.height));
  return [
    zoom,
    0,
    0,
    zoom,
    (viewport.width - artboard.width * zoom) / 2,
    (viewport.height - artboard.height * zoom) / 2,
  ];
}

/**
 * Transform with a new zoom such that the scene point currently under the viewport point `at`
 * stays under it.
 */
export function zoomAtPoint(vpt: Matrix, at: Point, zoom: number): Matrix {
  const next = clampZoom(zoom);
  const scene = viewportToScene(vpt, at);
  return [next, 0, 0, next, at.x - scene.x * next, at.y - scene.y * next];
}

export function sceneToViewport(vpt: Matrix, p: Point): Point {
  return { x: p.x * vpt[0] + vpt[4], y: p.y * vpt[3] + vpt[5] };
}

export function viewportToScene(vpt: Matrix, p: Point): Point {
  return { x: (p.x - vpt[4]) / vpt[0], y: (p.y - vpt[5]) / vpt[3] };
}

const ZOOM_STEPS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 10];

/** Next preset zoom level above or below the current one. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const epsilon = 1e-6;
  if (direction > 0) return ZOOM_STEPS.find((z) => z > current + epsilon) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((z) => z < current - epsilon) ?? MIN_ZOOM;
}

/** Zoom factor for one wheel event; tuned so a mouse notch and a trackpad pinch both feel right. */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaY;
  const clamped = Math.max(-50, Math.min(50, pixels));
  return Math.exp(-clamped * 0.006);
}
