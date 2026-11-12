export const HISTORY_LIMIT = 50;

/**
 * Linear undo/redo over snapshots. The stack always holds the current state, so `limit`
 * snapshots allow `limit - 1` undo steps. Undo and redo only move the cursor; they never add entries.
 */
export class HistoryStack<T> {
  private entries: T[];
  private index = 0;

  constructor(
    initial: T,
    private readonly limit = HISTORY_LIMIT,
  ) {
    this.entries = [initial];
  }

  get current(): T {
    return this.entries[this.index];
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  /** Records a new state. Anything that could have been redone is discarded. */
  push(snapshot: T) {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(snapshot);
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    this.index = this.entries.length - 1;
  }

  /** Forgets anything that could have been redone, as a new action elsewhere would. */
  clearRedo() {
    this.entries = this.entries.slice(0, this.index + 1);
  }

  undo(): T | null {
    if (!this.canUndo) return null;
    this.index -= 1;
    return this.current;
  }

  redo(): T | null {
    if (!this.canRedo) return null;
    this.index += 1;
    return this.current;
  }
}
