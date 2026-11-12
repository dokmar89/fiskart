export { DESIGN_PRESETS, findDesignPreset, type DesignPreset } from "@/constants/presets";

/** Limits for a project's artboard, in pixels. */
export const MIN_DESIGN_SIZE = 16;
export const MAX_DESIGN_SIZE = 8000;

/** A usable artboard side in pixels. */
export function isValidDesignSize(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= MIN_DESIGN_SIZE && value <= MAX_DESIGN_SIZE;
}
