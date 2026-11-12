export type DropTarget = { index: number; position: "before" | "after" };

/** Final list index for an item dragged from `from` and dropped before or after row `target.index`. */
export function finalIndex(from: number, target: DropTarget): number {
  const slot = target.position === "before" ? target.index : target.index + 1;
  return from < slot ? slot - 1 : slot;
}
