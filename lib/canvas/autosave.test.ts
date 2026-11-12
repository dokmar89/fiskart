import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Autosaver, type SaveStatus } from "./autosave";

function setup(save: (s: string) => Promise<void>) {
  const statuses: SaveStatus[] = [];
  const saver = new Autosaver<string>({ save, onStatus: (s) => statuses.push(s), delay: 2000 });
  return { saver, statuses };
}

describe("Autosaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves the latest snapshot once, two seconds after the last change", async () => {
    const save = vi.fn(async () => {});
    const { saver, statuses } = setup(save);
    saver.schedule("a");
    await vi.advanceTimersByTimeAsync(1500);
    saver.schedule("b");
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("b");
    expect(statuses).toEqual(["pending", "saving", "saved"]);
  });

  it("flush saves immediately", async () => {
    const save = vi.fn(async () => {});
    const { saver } = setup(save);
    saver.schedule("a");
    await saver.flush();
    expect(save).toHaveBeenCalledWith("a");
    expect(saver.hasUnsavedChanges).toBe(false);
  });

  it("saves changes made during a save afterwards, never two at once", async () => {
    let release: () => void = () => {};
    let concurrent = 0;
    let maxConcurrent = 0;
    const save = vi.fn<(s: string) => Promise<void>>(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise<void>((r) => (release = r));
      concurrent--;
    });
    const { saver } = setup(save);
    saver.schedule("a");
    const first = saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    saver.schedule("b");
    const second = saver.flush();
    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await Promise.all([first, second]);
    expect(save.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    expect(maxConcurrent).toBe(1);
  });

  it("reports a failure and succeeds on retry", async () => {
    let online = false;
    const save = vi.fn<(s: string) => Promise<void>>(async () => {
      if (!online) throw new Error("offline");
    });
    const { saver, statuses } = setup(save);
    saver.schedule("a");
    await saver.flush();
    expect(statuses.at(-1)).toBe("failed");
    expect(saver.hasUnsavedChanges).toBe(true);
    online = true;
    await saver.retry();
    expect(statuses.at(-1)).toBe("saved");
    expect(save).toHaveBeenLastCalledWith("a");
    expect(saver.hasUnsavedChanges).toBe(false);
  });
});
