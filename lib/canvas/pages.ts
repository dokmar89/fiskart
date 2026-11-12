import type { IText } from "fabric";
import type { CanvasData, PageData } from "@/lib/page-data";
import { moveItem, withFreshIds } from "@/lib/page-ops";
import { useEditorStore } from "@/lib/store/editor";
import { endImageModes } from "./image-modes";
import {
  addPageSnapshot,
  closeCurrentPage,
  commitHistoryStep,
  currentPageId,
  flushSave,
  forgetPage,
  onPageChange,
  openPage,
  pageSnapshot,
  refreshProjectThumbnail,
} from "./document";
import { getEditorInstance } from "./instance";
import { renderPageToBlob } from "./render";
import { newObjectId } from "./serialize";
import type { Size } from "./viewport-math";

/** Page strip previews are rendered to fit this box (twice the displayed size, for sharp HiDPI). */
const THUMB_BOX = { width: 200, height: 112 };

const setState = useEditorStore.setState;
const getState = useEditorStore.getState;

// Page actions run one at a time, so a switch never interleaves with an add or a delete.
let queue: Promise<unknown> = Promise.resolve();
function serial(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task);
  queue = run.catch((error: unknown) => console.error(error));
  return run.catch(() => {});
}

/** Runs a task that changes every page (a resize) in the same queue as page actions; rejects with its error. */
export function runWithPagesLocked<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

function fail(message: string) {
  setState({ pageError: message });
}

function projectId(): string | null {
  return getEditorInstance()?.projectId ?? null;
}

/**
 * Saves and closes the open page. When its save fails, asks first; the changes are then kept and
 * saved again when the page is next opened. Returns false if the person chose to stay.
 */
async function leaveCurrentPage(): Promise<boolean> {
  const editor = getEditorInstance();
  if (!editor) return false;
  endImageModes();
  const active = editor.canvas.getActiveObject() as Partial<IText> | undefined;
  if (active?.isEditing) active.exitEditing?.();
  editor.canvas.discardActiveObject();
  await flushSave();
  if (
    getState().saveStatus === "failed" &&
    !window.confirm("Poslední změny na této stránce ještě nejsou uložené. Přesto přepnout? Uloží se znovu, až se na tuto stránku vrátíte.")
  ) {
    return false;
  }
  closeCurrentPage();
  return true;
}

async function open(pageId: string) {
  try {
    await openPage(pageId);
  } catch (error) {
    console.error(error);
    setState({ loadState: "error" });
  }
}

async function switchTo(pageId: string) {
  if (currentPageId() === pageId) return;
  if (await leaveCurrentPage()) await open(pageId);
}

/** Whether a page has anything on it (deleting an empty page needs no confirmation). */
export function pageHasObjects(pageId: string): boolean {
  if (pageId === currentPageId()) return (getEditorInstance()?.canvas.getObjects().length ?? 0) > 0;
  const snapshot = pageSnapshot(pageId);
  return snapshot !== null && (JSON.parse(snapshot) as CanvasData).objects.length > 0;
}

export function goToPage(pageId: string): Promise<void> {
  return serial(() => switchTo(pageId));
}

async function createPage(index: number, canvasData?: CanvasData): Promise<string | null> {
  const id = projectId();
  if (!id) return null;
  const res = await fetch(`/api/projects/${id}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index, canvasData }),
  }).catch(() => null);
  if (!res?.ok) {
    fail(res?.status === 409 ? "Návrh už má nejvyšší možný počet stránek." : "Stránku se nepodařilo přidat.");
    return null;
  }
  const page = (await res.json()) as { id: string } & PageData;
  addPageSnapshot(page.id, JSON.stringify(page.canvasData));
  const ids = [...getState().pageIds];
  ids.splice(index, 0, page.id);
  setState({ pageIds: ids });
  return page.id;
}

/** Adds an empty page after the open one and opens it. */
export function addPage(): Promise<void> {
  return serial(async () => {
    setState({ pageError: null });
    const { pageIds } = getState();
    const current = currentPageId();
    const index = current ? pageIds.indexOf(current) + 1 : pageIds.length;
    const id = await createPage(index);
    if (id) await switchTo(id);
  });
}

/** Adds a copy of a page (with new object ids) right after it and opens the copy. */
export function duplicatePage(pageId: string): Promise<void> {
  return serial(async () => {
    setState({ pageError: null });
    if (pageId === currentPageId()) commitHistoryStep();
    const snapshot = pageSnapshot(pageId);
    if (snapshot === null) return;
    const data = withFreshIds(JSON.parse(snapshot) as CanvasData, newObjectId);
    const id = await createPage(getState().pageIds.indexOf(pageId) + 1, data);
    if (id) await switchTo(id);
  });
}

export function deletePage(pageId: string): Promise<void> {
  return serial(async () => {
    setState({ pageError: null });
    const before = getState().pageIds;
    const index = before.indexOf(pageId);
    if (before.length <= 1 || index < 0) return;
    const isCurrent = pageId === currentPageId();
    // Let an autosave already under way finish first, so it cannot land after the delete.
    if (isCurrent) await flushSave();
    const res = await fetch(`/api/pages/${pageId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      fail("Stránku se nepodařilo smazat.");
      return;
    }
    const pageIds = before.filter((id) => id !== pageId);
    if (isCurrent) closeCurrentPage({ save: false });
    forgetPage(pageId);
    const { [pageId]: removed, ...pageThumbs } = getState().pageThumbs;
    if (removed) URL.revokeObjectURL(removed);
    setState({ pageIds, pageThumbs });
    if (before[0] !== pageIds[0]) refreshProjectThumbnail();
    if (isCurrent) await open(pageIds[Math.min(index, pageIds.length - 1)]);
  });
}

/** Moves a page so it ends up at position `to` in the page order. */
export function movePage(pageId: string, to: number): Promise<void> {
  return serial(async () => {
    setState({ pageError: null });
    const before = getState().pageIds;
    const from = before.indexOf(pageId);
    if (from < 0 || from === to) return;
    const pageIds = moveItem(before, from, to);
    // Shown at once; put back if the server refuses.
    setState({ pageIds });
    const id = projectId();
    const res = id
      ? await fetch(`/api/projects/${id}/pages`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: pageIds }),
        }).catch(() => null)
      : null;
    if (!res?.ok) {
      setState({ pageIds: before });
      fail("Pořadí stránek se nepodařilo změnit.");
      return;
    }
    if (before[0] !== pageIds[0]) refreshProjectThumbnail();
  });
}

/**
 * Keeps the page strip's previews up to date: renders every page once, then a page again whenever
 * its data changes. One render at a time; a page changed during its render is rendered again.
 * Returns a cleanup function.
 */
export function installPageThumbnails(artboard: Size): () => void {
  const waiting = new Set<string>();
  let running = false;
  let stopped = false;

  const pump = async () => {
    if (running) return;
    running = true;
    while (!stopped && waiting.size > 0) {
      const [pageId] = waiting;
      waiting.delete(pageId);
      const snapshot = pageSnapshot(pageId);
      if (snapshot === null) continue;
      try {
        // Worked out per render: a resize changes the artboard in place.
        const scale = Math.min(THUMB_BOX.width / artboard.width, THUMB_BOX.height / artboard.height);
        const blob = await renderPageToBlob(JSON.parse(snapshot) as CanvasData, { ...artboard }, { scale });
        if (stopped || pageSnapshot(pageId) === null) continue;
        const url = URL.createObjectURL(blob);
        const previous = getState().pageThumbs[pageId];
        setState({ pageThumbs: { ...getState().pageThumbs, [pageId]: url } });
        if (previous) URL.revokeObjectURL(previous);
      } catch (error) {
        console.warn("Page preview failed", error);
      }
    }
    running = false;
  };

  const request = (pageId: string) => {
    waiting.add(pageId);
    void pump();
  };

  const unsubscribe = onPageChange(request);
  const current = currentPageId();
  if (current) waiting.add(current);
  getState().pageIds.forEach((id) => waiting.add(id));
  void pump();

  return () => {
    stopped = true;
    unsubscribe();
    Object.values(getState().pageThumbs).forEach((url) => URL.revokeObjectURL(url));
    setState({ pageThumbs: {}, pageError: null });
  };
}
