/**
 * Pure helpers for the page list: ids of duplicated pages, reordering, page ranges. No Fabric or
 * React imports, so both the editor and the route handlers can use them, and they are unit tested.
 */
import type { CanvasData } from "./page-data";

function freshIds(value: unknown, newId: () => string): unknown {
  if (Array.isArray(value)) return value.map((v) => freshIds(v, newId));
  if (typeof value !== "object" || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) out[key] = freshIds(v, newId);
  if (typeof out.id === "string") out.id = newId();
  return out;
}

/**
 * A copy of page data in which every object (including those inside groups) has a new id, so a
 * duplicated page never shares object ids with its original.
 */
export function withFreshIds(data: CanvasData, newId: () => string): CanvasData {
  return { ...data, objects: data.objects.map((o) => freshIds(o, newId) as Record<string, unknown>) };
}

/** The list with the item at `from` moved so that it ends up at index `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

/** True when `next` holds exactly the same ids as `current`, in any order. */
export function isPermutation(current: readonly string[], next: readonly unknown[]): next is string[] {
  if (current.length !== next.length) return false;
  const remaining = new Set(current);
  for (const id of next) {
    if (typeof id !== "string" || !remaining.delete(id)) return false;
  }
  return remaining.size === 0;
}

/**
 * Parses a page selection such as "1-3, 5" into zero-based indexes, in page order without
 * duplicates. Returns null when the text is not a valid selection for `count` pages.
 */
export function parsePageRange(text: string, count: number): number[] | null {
  const parts = text.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  const picked = new Set<number>();
  for (const part of parts) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) return null;
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (start < 1 || end > count || start > end) return null;
    for (let n = start; n <= end; n++) picked.add(n - 1);
  }
  return [...picked].sort((a, b) => a - b);
}
