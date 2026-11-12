import type { Canvas, IText } from "fabric";
import { migratePage, SCHEMA_VERSION, type CanvasData, type PageData } from "@/lib/page-data";
import { useEditorStore } from "@/lib/store/editor";
import type { Unit } from "@/lib/units";
import { Autosaver } from "./autosave";
import { HistoryStack } from "./history";
import { renderPageToBlob } from "./render";
import { loadCanvasData, serializeCanvas } from "./serialize";
import { setArtboardSize } from "./viewport";
import type { Size } from "./viewport-math";

/** How long changes must be quiet before they become one undo step. */
const SETTLE_DELAY = 300;
const THUMBNAIL_MAX_SIDE = 480;
// Browsers refuse keepalive requests with bodies over 64 KiB.
const KEEPALIVE_LIMIT = 60 * 1024;

/** `artboard` is the editor's shared size object; a resize changes it in place. */
export type ProjectRef = { projectId: string; artboard: Size; unit: Unit };

export type DesignSize = Size & { unit: Unit };

/** A snapshot is a page's canvasData as a JSON string: cheap to compare, immune to later mutation. */
export type Snapshot = string;

const EMPTY_SNAPSHOT: Snapshot = '{"objects":[]}';

function pageBody(snapshot: Snapshot): string {
  return `{"schemaVersion":${SCHEMA_VERSION},"canvasData":${snapshot}}`;
}

async function putPage(pageId: string, snapshot: Snapshot) {
  const res = await fetch(`/api/pages/${pageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: pageBody(snapshot),
  });
  if (!res.ok) throw new Error(`Uložení selhalo: ${res.status}`);
}

/** Uploads a thumbnail of the project's first page; never two at once, and failures only cost the thumbnail. */
function createThumbnailer(projectId: string, artboard: Size) {
  let running = false;
  let next: Snapshot | null = null;

  async function run(snapshot: Snapshot) {
    running = true;
    try {
      const size = { ...artboard };
      const scale = Math.min(1, THUMBNAIL_MAX_SIDE / Math.max(size.width, size.height));
      const blob = await renderPageToBlob(JSON.parse(snapshot) as CanvasData, size, { scale });
      await fetch(`/api/projects/${projectId}/thumbnail`, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
    } catch (error) {
      console.warn("Thumbnail update failed", error);
    } finally {
      running = false;
      if (next !== null) {
        const queued = next;
        next = null;
        void run(queued);
      }
    }
  }

  return (snapshot: Snapshot) => {
    if (running) next = snapshot;
    else void run(snapshot);
  };
}

/**
 * The open project. History and the latest data of every page are kept for as long as the editor
 * is open, so switching back to a page restores its undo stack.
 */
type OpenDocument = {
  ref: ProjectRef;
  canvas: Canvas;
  /** Latest known canvasData of every page; for the open page, its last settled state. */
  snapshots: Map<string, Snapshot>;
  histories: Map<string, HistoryStack<Snapshot>>;
  /** Pages that were left while their latest change was unsaved; saved again when next opened. */
  unsaved: Set<string>;
  thumbnail: (snapshot: Snapshot) => void;
  listeners: Set<(pageId: string) => void>;
  /** Resizes that can be undone, latest last, and resizes undone that can be redone. */
  resizeUndo: ResizeStep[];
  resizeRedo: ResizeStep[];
  /** A resize, or its undo or redo, is in progress. */
  resizing: boolean;
};

/**
 * A resize as a document-wide undo step. Page histories hold snapshots at one size, so a resize
 * starts every page's history afresh; the histories from before are kept here and come back on undo.
 */
type ResizeStep = {
  before: { size: DesignSize; pages: Map<string, Snapshot>; histories: Map<string, HistoryStack<Snapshot>> };
  after: { size: DesignSize; pages: Map<string, Snapshot> };
};

export type PageSession = {
  pageId: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  flushSave: () => Promise<void>;
  retrySave: () => Promise<void>;
  /** Turns any changes made so far into an undo step now, without waiting for them to settle. */
  commitStep: () => void;
  /** Whether the page's own history has a step to undo or redo (pending changes count as one). */
  canStep: (direction: "undo" | "redo") => boolean;
  /** Stops watching the page; saves what is pending in the background (or keeps it for later if `save` is false). */
  dispose: (options?: { save: boolean }) => void;
};

let doc: OpenDocument | null = null;
let current: PageSession | null = null;

/**
 * Undoes the open page's latest change; once the page has none left and every page is as the
 * latest resize left it, undoes that resize.
 */
export function undo(): Promise<void> {
  if (!current) return Promise.resolve();
  if (current.canStep("undo") || !doc || !resizeUndoable(doc)) return current.undo();
  return undoResize().catch((error: unknown) => reportResizeError(error, "Změnu velikosti se nepodařilo vrátit."));
}

export function redo(): Promise<void> {
  if (!current) return Promise.resolve();
  if (current.canStep("redo") || !doc || !resizeRedoable(doc)) return current.redo();
  return redoResize().catch((error: unknown) => reportResizeError(error, "Změnu velikosti se nepodařilo zopakovat."));
}
export const retrySave = () => current?.retrySave() ?? Promise.resolve();
export const flushSave = () => current?.flushSave() ?? Promise.resolve();
export const commitHistoryStep = () => current?.commitStep();
export const currentPageId = () => current?.pageId ?? null;

/**
 * Runs a discrete edit (add, delete, group, a layer change...) as an undo step of its own. Without
 * this, an edit made within the settle delay of the previous one would be merged into its step.
 * Continuous edits (typing, held arrow keys) are left to the settle delay instead.
 */
export function recordStep(change: () => void) {
  current?.commitStep();
  change();
  current?.commitStep();
}

export async function recordStepAsync(change: () => Promise<void>) {
  current?.commitStep();
  await change();
  current?.commitStep();
}

/** Latest data of a page of the open project (the open page's as of its last undo step). */
export function pageSnapshot(pageId: string): Snapshot | null {
  return doc?.snapshots.get(pageId) ?? null;
}

/** Registers a page created on the server, so it can be opened. */
export function addPageSnapshot(pageId: string, snapshot: Snapshot) {
  doc?.snapshots.set(pageId, snapshot);
}

/** Forgets a deleted page. */
export function forgetPage(pageId: string) {
  doc?.snapshots.delete(pageId);
  doc?.histories.delete(pageId);
  doc?.unsaved.delete(pageId);
}

/** Calls `listener` with a page id whenever that page's data changes. Returns an unsubscribe function. */
export function onPageChange(listener: (pageId: string) => void): () => void {
  const listeners = doc?.listeners;
  listeners?.add(listener);
  return () => listeners?.delete(listener);
}

/** Uploads a new project thumbnail from the current first page (after the page order changed). */
export function refreshProjectThumbnail() {
  const first = useEditorStore.getState().pageIds[0];
  const snapshot = first ? pageSnapshot(first) : null;
  if (snapshot !== null) doc?.thumbnail(snapshot);
}

function notify(d: OpenDocument, pageId: string) {
  d.listeners.forEach((listener) => listener(pageId));
}

/**
 * Loads all pages of a project and opens the first. Resolves once it is on the canvas, or with
 * false when aborted first.
 */
export async function openProject(canvas: Canvas, ref: ProjectRef, signal: AbortSignal): Promise<boolean> {
  useEditorStore.setState({ loadState: "loading" });
  const res = await fetch(`/api/projects/${ref.projectId}/pages`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`Stránky se nepodařilo načíst: ${res.status}`);
  // Pages saved by older versions are brought up to date as they load (migrations never change content).
  const pages = ((await res.json()) as ({ id: string } & PageData)[]).map(migratePage);
  if (signal.aborted) return false;
  if (pages.length === 0) throw new Error("Návrh nemá žádné stránky");

  doc = {
    ref,
    canvas,
    snapshots: new Map(pages.map((p) => [p.id, JSON.stringify(p.canvasData)])),
    histories: new Map(),
    unsaved: new Set(),
    thumbnail: createThumbnailer(ref.projectId, ref.artboard),
    listeners: new Set(),
    resizeUndo: [],
    resizeRedo: [],
    resizing: false,
  };
  useEditorStore.setState({
    pageIds: pages.map((p) => p.id),
    design: { projectId: ref.projectId, width: ref.artboard.width, height: ref.artboard.height, unit: ref.unit },
  });
  return (await openPage(pages[0].id, signal)) !== null;
}

/** Closes the open page (saving in the background) and forgets the project. */
export function closeProject() {
  current?.dispose();
  doc = null;
  useEditorStore.setState({ pageIds: [], currentPageId: null, design: null });
}

/**
 * Stops editing the open page. Its pending changes are saved in the background, or with
 * `save: false` (the page is being deleted) dropped.
 */
export function closeCurrentPage(options?: { save: boolean }) {
  current?.dispose(options);
}

/**
 * Loads a page of the open project into the canvas and keeps it saved, with undo/redo for it.
 * Resolves once the page is on the canvas. Changes are watched only after loading, so loading
 * never becomes an undo step. The previous page must have been closed first.
 */
export async function openPage(pageId: string, signal?: AbortSignal): Promise<PageSession | null> {
  const d = doc;
  if (!d) return null;
  const { canvas } = d;
  const store = useEditorStore.setState;
  const stored = d.snapshots.get(pageId);
  if (stored === undefined) throw new Error(`Neznámá stránka ${pageId}`);
  store({ loadState: "loading", currentPageId: pageId, saveStatus: "saved", canUndo: false, canRedo: false });

  const existing = d.histories.get(pageId);
  await loadCanvasData(canvas, JSON.parse(existing?.current ?? stored) as CanvasData);
  if (signal?.aborted || doc !== d) return null;

  const snapshot = (): Snapshot => JSON.stringify(serializeCanvas(canvas));
  const history = existing ?? new HistoryStack<Snapshot>(snapshot());
  d.histories.set(pageId, history);
  d.snapshots.set(pageId, history.current);
  const updateHistoryState = () =>
    store({ canUndo: history.canUndo || resizeUndoable(d), canRedo: history.canRedo || resizeRedoable(d) });
  updateHistoryState();

  const saver = new Autosaver<Snapshot>({
    save: async (s) => {
      await putPage(pageId, s);
      if (useEditorStore.getState().pageIds[0] === pageId) d.thumbnail(s);
    },
    onStatus: (saveStatus) => {
      if (current?.pageId === pageId) store({ saveStatus });
    },
  });
  if (d.unsaved.delete(pageId)) saver.schedule(history.current);

  const record = (s: Snapshot) => {
    d.snapshots.set(pageId, s);
    notify(d, pageId);
    saver.schedule(s);
  };

  let restoring = false;
  // While the mouse is down a drag or resize may be in progress; a snapshot then would catch it halfway.
  let pointerDown = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let deferred = false;
  let disposed = false;

  /** Turns the changes made since the last step into one undo step and schedules a save. */
  const settle = () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = null;
    if (pointerDown) {
      deferred = true;
      return;
    }
    deferred = false;
    const s = snapshot();
    if (s === history.current) return;
    history.push(s);
    // A new change ends any chance to redo an undone resize, as it does for page steps.
    d.resizeRedo = [];
    updateHistoryState();
    record(s);
  };

  const onChange = () => {
    if (restoring) return;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_DELAY);
  };

  // A drag fires object:modified once at the end, not on every move.
  const events = ["object:added", "object:removed", "object:modified", "text:changed"] as const;
  events.forEach((name) => canvas.on(name, onChange));
  const onMouseDown = () => {
    // Close the step for earlier changes first, so this interaction becomes a step of its own.
    if (settleTimer) settle();
    pointerDown = true;
  };
  const onMouseUp = () => {
    pointerDown = false;
    if (deferred) onChange();
  };
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:up", onMouseUp);

  // Undo and redo run one at a time, in the order they were asked for.
  let queue = Promise.resolve();
  const step = (direction: "undo" | "redo") => {
    queue = queue.then(async () => {
      if (disposed) return;
      const active = canvas.getActiveObject() as Partial<IText> | undefined;
      if (active?.isEditing) active.exitEditing?.();
      if (settleTimer) settle();
      const target = direction === "undo" ? history.undo() : history.redo();
      updateHistoryState();
      if (target === null) return;
      restoring = true;
      try {
        await loadCanvasData(canvas, JSON.parse(target) as CanvasData);
      } finally {
        restoring = false;
      }
      record(target);
    });
    return queue;
  };

  const flushSave = async () => {
    if (settleTimer) settle();
    await saver.flush();
  };

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (settleTimer) settle();
    if (!saver.hasUnsavedChanges && d.unsaved.size === 0) return;
    const pending = saver.pendingSnapshot;
    if (pending !== null) {
      const body = pageBody(pending);
      if (body.length <= KEEPALIVE_LIMIT) {
        void fetch(`/api/pages/${pageId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    }
    // Ask the browser to confirm leaving; if the person stays, the save above or the autosave completes.
    e.preventDefault();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") void flushSave();
  };

  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("visibilitychange", onVisibilityChange);

  const session: PageSession = {
    pageId,
    commitStep: () => {
      if (!restoring && !disposed) settle();
    },
    canStep: (direction) => {
      if (settleTimer) settle();
      return direction === "undo" ? history.canUndo : history.canRedo;
    },
    undo: () => step("undo"),
    redo: () => step("redo"),
    flushSave,
    retrySave: () => saver.retry(),
    dispose: (options) => {
      if (disposed) return;
      const save = options?.save ?? true;
      if (save && settleTimer) settle();
      disposed = true;
      if (settleTimer) clearTimeout(settleTimer);
      events.forEach((name) => canvas.off(name, onChange));
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:up", onMouseUp);
      pointerDown = false;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (save) {
        // The request outlives the page (and the editor, when navigating within the app). If it
        // fails, the page is saved again the next time it is opened.
        void saver.flush().finally(() => {
          if (saver.hasUnsavedChanges && doc === d && d.snapshots.has(pageId)) d.unsaved.add(pageId);
          saver.dispose();
        });
      } else {
        saver.dispose();
      }
      if (current === session) current = null;
    },
  };
  current = session;
  store({ loadState: "ready" });
  notify(d, pageId);
  return session;
}

function reportResizeError(error: unknown, message: string) {
  console.error(error);
  useEditorStore.setState({ pageError: message });
}

function sameIds(a: readonly string[], b: Iterable<string>): boolean {
  const list = [...b];
  return a.length === list.length && a.every((id, i) => id === list[i]);
}

/** Every page is as `pages` has it: unchanged since, or changed and undone (or redone) back to it. */
function pagesUnchangedSince(d: OpenDocument, pages: Map<string, Snapshot>, direction: "undo" | "redo"): boolean {
  if (!sameIds(useEditorStore.getState().pageIds, pages.keys())) return false;
  return [...pages.keys()].every((id) => {
    const history = d.histories.get(id);
    if (history) return direction === "undo" ? !history.canUndo : !history.canRedo;
    return d.snapshots.get(id) === pages.get(id);
  });
}

function resizeUndoable(d: OpenDocument): boolean {
  const step = d.resizeUndo.at(-1);
  return !!step && !d.resizing && pagesUnchangedSince(d, step.after.pages, "undo");
}

function resizeRedoable(d: OpenDocument): boolean {
  const step = d.resizeRedo.at(-1);
  return !!step && !d.resizing && pagesUnchangedSince(d, step.before.pages, "redo");
}

async function putDesign(projectId: string, size: DesignSize, pages: Map<string, Snapshot>) {
  // Snapshots are JSON already; they are spliced in rather than parsed and serialized again.
  const list = [...pages].map(([id, snapshot]) => `{"id":${JSON.stringify(id)},"canvasData":${snapshot}}`).join(",");
  const head = JSON.stringify({ width: size.width, height: size.height, unit: size.unit }).slice(0, -1);
  const res = await fetch(`/api/projects/${projectId}/size`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: `${head},"pages":[${list}]}`,
  });
  if (!res.ok) throw new Error(`Velikost návrhu se nepodařilo změnit (${res.status})`);
}

/**
 * Puts the whole design into another state (size, every page's data and histories): saved on the
 * server first, in one request, then shown. On failure nothing changes and the error is thrown.
 */
async function switchDesign(d: OpenDocument, size: DesignSize, pages: Map<string, Snapshot>, histories: Map<string, HistoryStack<Snapshot>>) {
  const pageId = current?.pageId ?? useEditorStore.getState().currentPageId;
  if (!pageId) throw new Error("Není otevřená žádná stránka");
  d.resizing = true;
  useEditorStore.setState({ loadState: "loading", canUndo: false, canRedo: false });
  try {
    // The open page's autosave must not land after the request below with data of the old size.
    await current?.flushSave();
    current?.dispose({ save: false });
    try {
      await putDesign(d.ref.projectId, size, pages);
    } catch (error) {
      // Its latest state may not have reached the server; save it again when it is opened.
      d.unsaved.add(pageId);
      throw error;
    }
    if (doc !== d) return;
    d.snapshots = new Map(pages);
    d.histories = histories;
    d.unsaved.clear();
    d.ref.unit = size.unit;
    setArtboardSize(d.canvas, d.ref.artboard, size);
    useEditorStore.setState({ design: { projectId: d.ref.projectId, width: size.width, height: size.height, unit: size.unit } });
  } finally {
    d.resizing = false;
    if (doc === d) await openPage(pageId);
  }
  for (const id of pages.keys()) notify(d, id);
  refreshProjectThumbnail();
}

/** Latest data of every page of the open design, in page order, after turning pending changes into a step. */
export function designPages(): { size: DesignSize; pages: Map<string, Snapshot> } | null {
  if (!doc) return null;
  current?.commitStep();
  const d = doc;
  const pages = new Map(useEditorStore.getState().pageIds.map((id) => [id, d.snapshots.get(id) ?? EMPTY_SNAPSHOT]));
  return { size: { width: d.ref.artboard.width, height: d.ref.artboard.height, unit: d.ref.unit }, pages };
}

/**
 * Resizes the open design to `size` with the given page data (from `designPages`, resized), as one
 * undo step for the whole design.
 */
export async function resizeOpenDesign(size: DesignSize, pages: Map<string, Snapshot>) {
  const d = doc;
  if (!d || d.resizing) return;
  const before = designPages();
  if (!before) return;
  // The resize is the newest action: nothing undone before it can be redone once it is undone.
  d.histories.forEach((history) => history.clearRedo());
  const step: ResizeStep = { before: { ...before, histories: d.histories }, after: { size, pages } };
  await switchDesign(d, size, pages, new Map());
  d.resizeUndo.push(step);
  d.resizeRedo = [];
  refreshHistoryState(d);
}

async function undoResize() {
  const d = doc;
  const step = d?.resizeUndo.at(-1);
  if (!d || !step || !resizeUndoable(d)) return;
  await switchDesign(d, step.before.size, step.before.pages, step.before.histories);
  d.resizeUndo.pop();
  d.resizeRedo.push(step);
  refreshHistoryState(d);
}

async function redoResize() {
  const d = doc;
  const step = d?.resizeRedo.at(-1);
  if (!d || !step || !resizeRedoable(d)) return;
  await switchDesign(d, step.after.size, step.after.pages, new Map());
  d.resizeRedo.pop();
  d.resizeUndo.push(step);
  refreshHistoryState(d);
}

function refreshHistoryState(d: OpenDocument) {
  const pageId = current?.pageId;
  const history = pageId ? d.histories.get(pageId) : undefined;
  if (!history) return;
  useEditorStore.setState({ canUndo: history.canUndo || resizeUndoable(d), canRedo: history.canRedo || resizeRedoable(d) });
}
