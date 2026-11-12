/** Marks a property whose value differs across a multi-selection; controls show it as indeterminate. */
export const MIXED = "__mixed__" as const;
export type Mixed<T> = T | typeof MIXED;

function same(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.005;
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The shared value of a property across a selection, MIXED when they differ, undefined for none. */
export function merge<T>(values: T[]): Mixed<T> | undefined {
  if (values.length === 0) return undefined;
  return values.every((v) => same(v, values[0])) ? values[0] : MIXED;
}

export const isMixed = <T>(value: Mixed<T> | undefined): value is typeof MIXED => value === MIXED;
