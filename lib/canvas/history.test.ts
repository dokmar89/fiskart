import { describe, expect, it } from "vitest";
import { HistoryStack } from "./history";

describe("HistoryStack", () => {
  it("starts with nothing to undo or redo", () => {
    const h = new HistoryStack("a");
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
    expect(h.current).toBe("a");
  });

  it("undoes and redoes in order", () => {
    const h = new HistoryStack("a");
    h.push("b");
    h.push("c");
    expect(h.undo()).toBe("b");
    expect(h.undo()).toBe("a");
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe("b");
    expect(h.redo()).toBe("c");
    expect(h.redo()).toBeNull();
  });

  it("clears redo after a new change", () => {
    const h = new HistoryStack("a");
    h.push("b");
    h.push("c");
    h.undo();
    h.push("d");
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBeNull();
    expect(h.undo()).toBe("b");
    expect(h.undo()).toBe("a");
  });

  it("restoring a snapshot does not push one", () => {
    const h = new HistoryStack("a");
    h.push("b");
    h.undo();
    h.redo();
    h.undo();
    // Still exactly one step forward available and none back.
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toBe("b");
    expect(h.canRedo).toBe(false);
  });

  it("is capped, dropping the oldest snapshots", () => {
    const h = new HistoryStack(0, 50);
    for (let i = 1; i <= 60; i++) h.push(i);
    let steps = 0;
    while (h.undo() !== null) steps++;
    expect(steps).toBe(49);
    expect(h.current).toBe(11);
  });

  it("can drop what would be redone", () => {
    const h = new HistoryStack("a");
    h.push("b");
    h.undo();
    h.clearRedo();
    expect(h.canRedo).toBe(false);
    expect(h.current).toBe("a");
    h.push("c");
    expect(h.undo()).toBe("a");
  });
});
