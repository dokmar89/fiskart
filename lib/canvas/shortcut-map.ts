export type ShortcutCommand =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "group" }
  | { type: "ungroup" }
  | { type: "delete" }
  | { type: "duplicate" }
  | { type: "copy" }
  | { type: "cut" }
  | { type: "paste" }
  | { type: "selectAll" }
  | { type: "deselect" }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "toggleRulers" }
  | { type: "find" };

export type KeyInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Maps a key press to an editor command. Cmd and Ctrl are treated the same on every platform. */
export function resolveShortcut(e: KeyInput): ShortcutCommand | null {
  const mod = e.ctrlKey || e.metaKey;
  if (e.altKey) return null;
  const lower = e.key.toLowerCase();

  if (mod && lower === "z") return e.shiftKey ? { type: "redo" } : { type: "undo" };
  if (mod && !e.shiftKey && lower === "y") return { type: "redo" };
  if (mod && lower === "g") return e.shiftKey ? { type: "ungroup" } : { type: "group" };

  if (mod && !e.shiftKey) {
    switch (lower) {
      case "d":
        return { type: "duplicate" };
      case "c":
        return { type: "copy" };
      case "x":
        return { type: "cut" };
      case "v":
        return { type: "paste" };
      case "a":
        return { type: "selectAll" };
      case "f":
        return { type: "find" };
    }
    return null;
  }
  if (mod) return null;

  if (e.shiftKey && lower === "r") return { type: "toggleRulers" };

  if (e.key === "Delete" || e.key === "Backspace") return { type: "delete" };
  if (e.key === "Escape") return { type: "deselect" };

  const arrow = ARROWS[e.key];
  if (arrow) {
    const step = e.shiftKey ? 10 : 1;
    return { type: "nudge", dx: arrow[0] * step, dy: arrow[1] * step };
  }
  return null;
}

type TargetLike = { tagName?: string; isContentEditable?: boolean } | null;

/** True when keys should go to a text field rather than the canvas. */
export function isTypingTarget(target: TargetLike): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
