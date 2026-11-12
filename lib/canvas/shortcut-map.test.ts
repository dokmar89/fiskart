import { describe, expect, it } from "vitest";
import { isTypingTarget, resolveShortcut, type KeyInput } from "./shortcut-map";

describe("rulers shortcut", () => {
  it("is Shift+R without a modifier", () => {
    const mods = { ctrlKey: false, metaKey: false, altKey: false };
    expect(resolveShortcut({ ...mods, key: "R", shiftKey: true })).toEqual({ type: "toggleRulers" });
    expect(resolveShortcut({ ...mods, key: "r", shiftKey: false })).toBeNull();
    expect(resolveShortcut({ ...mods, ctrlKey: true, key: "f", shiftKey: false })).toEqual({ type: "find" });
  });
});

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("resolveShortcut", () => {
  it("treats Cmd and Ctrl the same", () => {
    expect(resolveShortcut(key("d", { ctrlKey: true }))).toEqual({ type: "duplicate" });
    expect(resolveShortcut(key("d", { metaKey: true }))).toEqual({ type: "duplicate" });
    expect(resolveShortcut(key("A", { metaKey: true }))).toEqual({ type: "selectAll" });
  });

  it("maps undo and redo", () => {
    expect(resolveShortcut(key("z", { ctrlKey: true }))).toEqual({ type: "undo" });
    expect(resolveShortcut(key("z", { metaKey: true }))).toEqual({ type: "undo" });
    expect(resolveShortcut(key("Z", { metaKey: true, shiftKey: true }))).toEqual({ type: "redo" });
    expect(resolveShortcut(key("y", { ctrlKey: true }))).toEqual({ type: "redo" });
  });

  it("maps grouping", () => {
    expect(resolveShortcut(key("g", { ctrlKey: true }))).toEqual({ type: "group" });
    expect(resolveShortcut(key("G", { metaKey: true, shiftKey: true }))).toEqual({ type: "ungroup" });
  });

  it("maps clipboard keys", () => {
    expect(resolveShortcut(key("c", { ctrlKey: true }))?.type).toBe("copy");
    expect(resolveShortcut(key("x", { ctrlKey: true }))?.type).toBe("cut");
    expect(resolveShortcut(key("v", { ctrlKey: true }))?.type).toBe("paste");
  });

  it("nudges 1 px, or 10 px with Shift", () => {
    expect(resolveShortcut(key("ArrowLeft"))).toEqual({ type: "nudge", dx: -1, dy: 0 });
    expect(resolveShortcut(key("ArrowDown", { shiftKey: true }))).toEqual({ type: "nudge", dx: 0, dy: 10 });
  });

  it("deletes and deselects", () => {
    expect(resolveShortcut(key("Delete"))?.type).toBe("delete");
    expect(resolveShortcut(key("Backspace"))?.type).toBe("delete");
    expect(resolveShortcut(key("Escape"))?.type).toBe("deselect");
  });

  it("ignores unrelated keys and modifier combinations", () => {
    expect(resolveShortcut(key("d"))).toBeNull();
    expect(resolveShortcut(key("z"))).toBeNull();
    expect(resolveShortcut(key("y", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(resolveShortcut(key("d", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(resolveShortcut(key("ArrowLeft", { ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(key("c", { ctrlKey: true, altKey: true }))).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("recognises text fields", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
