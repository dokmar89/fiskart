export type SaveStatus = "saved" | "pending" | "saving" | "failed";

export const AUTOSAVE_DELAY = 2000;

type AutosaverOptions<T> = {
  save: (snapshot: T) => Promise<void>;
  onStatus: (status: SaveStatus) => void;
  delay?: number;
};

/**
 * Saves the latest snapshot a while after the last change. Only one save runs at a time; changes
 * made during a save are saved afterwards. A failed save keeps its snapshot until a retry or the
 * next change.
 */
export class Autosaver<T> {
  private unsaved: T | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private status: SaveStatus = "saved";
  private readonly delay: number;

  constructor(private readonly options: AutosaverOptions<T>) {
    this.delay = options.delay ?? AUTOSAVE_DELAY;
  }

  get hasUnsavedChanges(): boolean {
    return this.unsaved !== null || this.running !== null;
  }

  /** The snapshot that still needs saving, if any (for a last-chance save on tab close). */
  get pendingSnapshot(): T | null {
    return this.unsaved;
  }

  schedule(snapshot: T) {
    this.unsaved = snapshot;
    this.setStatus(this.running ? "saving" : "pending");
    this.clearTimer();
    this.timer = setTimeout(() => void this.flush(), this.delay);
  }

  /** Saves now if anything is unsaved, and resolves once everything known so far is saved (or failed). */
  async flush(): Promise<void> {
    this.clearTimer();
    while (this.running) await this.running;
    if (this.unsaved === null) return;
    this.running = this.run();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
    // Changes made while saving were not scheduled behind the running save; save them now.
    if (this.unsaved !== null && this.status !== "failed") await this.flush();
  }

  retry(): Promise<void> {
    return this.flush();
  }

  dispose() {
    this.clearTimer();
  }

  private async run() {
    const snapshot = this.unsaved as T;
    this.unsaved = null;
    this.setStatus("saving");
    try {
      await this.options.save(snapshot);
      this.setStatus(this.unsaved === null ? "saved" : "saving");
    } catch {
      // Keep the newest snapshot: a change made during the failed save supersedes this one.
      if (this.unsaved === null) this.unsaved = snapshot;
      this.setStatus("failed");
    }
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private setStatus(status: SaveStatus) {
    if (status === this.status) return;
    this.status = status;
    this.options.onStatus(status);
  }
}
