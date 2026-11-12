export type ArrangeOp = "forward" | "backward" | "front" | "back";

/**
 * New stacking order (index 0 = back) after moving the selected items. Forward and backward move
 * each selected item one place past its unselected neighbour; selected items keep their relative order.
 */
export function arrange<T>(order: readonly T[], selected: ReadonlySet<T>, op: ArrangeOp): T[] {
  const next = [...order];
  switch (op) {
    case "front":
      return [...next.filter((x) => !selected.has(x)), ...next.filter((x) => selected.has(x))];
    case "back":
      return [...next.filter((x) => selected.has(x)), ...next.filter((x) => !selected.has(x))];
    case "forward":
      for (let i = next.length - 2; i >= 0; i--) {
        if (selected.has(next[i]) && !selected.has(next[i + 1])) [next[i], next[i + 1]] = [next[i + 1], next[i]];
      }
      return next;
    case "backward":
      for (let i = 1; i < next.length; i++) {
        if (selected.has(next[i]) && !selected.has(next[i - 1])) [next[i], next[i - 1]] = [next[i - 1], next[i]];
      }
      return next;
  }
}
