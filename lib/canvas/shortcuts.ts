import type { Canvas } from "fabric";
import {
  copySelection,
  cutSelection,
  deleteSelection,
  deselect,
  duplicateSelection,
  nudgeSelection,
  paste,
  selectAll,
} from "./commands";
import { useEditorStore } from "@/lib/store/editor";
import { redo, undo } from "./document";
import { groupSelection, ungroupSelection } from "./grouping";
import { setRulersShown } from "./guides";
import { uploadAndPlace } from "./images";
import { isTypingTarget, resolveShortcut, type ShortcutCommand } from "./shortcut-map";

function run(canvas: Canvas, command: ShortcutCommand) {
  switch (command.type) {
    case "undo":
      return void undo();
    case "redo":
      return void redo();
    case "group":
      return groupSelection(canvas);
    case "ungroup":
      return ungroupSelection(canvas);
    case "delete":
      return deleteSelection(canvas);
    case "duplicate":
      return void duplicateSelection(canvas);
    case "copy":
      return void copySelection(canvas);
    case "cut":
      return void cutSelection(canvas);
    case "paste":
      return void paste(canvas);
    case "selectAll":
      return selectAll(canvas);
    case "deselect":
      return deselect(canvas);
    case "nudge":
      return nudgeSelection(canvas, command.dx, command.dy);
    case "toggleRulers":
      return setRulersShown(!useEditorStore.getState().showRulers);
    case "find":
      return useEditorStore.setState({ findOpen: true });
  }
}

// Clipboard keys keep their default so the browser still fires its copy and paste events.
const KEEP_DEFAULT = new Set<ShortcutCommand["type"]>(["copy", "cut", "paste"]);

/** Image and video files of a drop or paste (both are uploaded and placed the same way). */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((f) => f.type.startsWith("image/") || f.type === "video/mp4" || f.type === "video/webm");
}

/** Editor keyboard shortcuts and image paste on the window. Returns a cleanup function. */
export function installShortcuts(canvas: Canvas, isEditingText: (canvas: Canvas) => boolean) {
  const isTyping = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    // Fabric edits text through a hidden textarea, so the typing check covers in-place text editing too.
    return isTypingTarget(element) || isEditingText(canvas);
  };

  // Modal dialogs (rename, confirm delete...) get no canvas shortcuts. Toolbar popovers are dialogs
  // too, but focus often stays in them after a slider drag, so undo and redo still work there.
  const blockedByDialog = (target: EventTarget | null, command: ShortcutCommand) => {
    const dialog = target instanceof HTMLElement ? target.closest("[role='dialog'], [role='alertdialog']") : null;
    if (!dialog) return false;
    const popover = dialog.matches("[data-slot='popover-content']");
    return !popover || (command.type !== "undo" && command.type !== "redo");
  };

  // Cmd/Ctrl+V pastes copied objects, unless the browser's paste event that follows carries an
  // image, which wins. The event arrives within the same task as the key press, before this timer.
  let objectPaste: ReturnType<typeof setTimeout> | null = null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing || isTyping(e.target)) return;
    // While another page is being loaded, an edit would be replaced by the load.
    if (useEditorStore.getState().loadState !== "ready") return;
    const command = resolveShortcut(e);
    if (!command || blockedByDialog(e.target, command)) return;
    if (!KEEP_DEFAULT.has(command.type)) e.preventDefault();
    if (command.type === "paste") {
      if (objectPaste) clearTimeout(objectPaste);
      objectPaste = setTimeout(() => {
        objectPaste = null;
        run(canvas, command);
      }, 0);
      return;
    }
    run(canvas, command);
  };

  const onPaste = (e: ClipboardEvent) => {
    if (useEditorStore.getState().loadState !== "ready") return;
    if (isTyping(e.target) || (e.target instanceof HTMLElement && e.target.closest("[role='dialog'], [role='alertdialog']"))) return;
    const files = imageFilesFrom(e.clipboardData);
    if (files.length === 0) return;
    e.preventDefault();
    if (objectPaste) clearTimeout(objectPaste);
    objectPaste = null;
    void uploadAndPlace(files);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("paste", onPaste);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("paste", onPaste);
    if (objectPaste) clearTimeout(objectPaste);
  };
}
