import { create } from "zustand";
import type { SaveStatus } from "@/lib/canvas/autosave";
import type { DrawSettings } from "@/lib/canvas/draw";
import type { SelectionSnapshot } from "@/lib/canvas/selection";
import { DEFAULT_TIMING, type PageTiming } from "@/lib/animation";
import { NO_GUIDES, type Guides } from "@/lib/guides";
import type { Unit } from "@/lib/units";

export type PanelId = "design" | "brand" | "elements" | "text" | "draw" | "photos" | "graphics" | "uploads" | "layers" | "chart" | "ai";
export type LoadState = "loading" | "ready" | "error";

/** Read-only summary of one canvas object for the layers panel. */
export type LayerInfo = {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
};

type EditorUiState = {
  activePanel: PanelId | null;
  /** Mirror of the canvas zoom, written by lib/canvas/viewport.ts whenever the viewport changes. */
  zoom: number;
  loadState: LoadState;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  /** Snapshot of the page's objects, top of the stack first; refreshed from Fabric events by lib/canvas/layers.ts. */
  layers: LayerInfo[];
  selectedIds: string[];
  /** Read-only snapshot of the selected objects' properties for the toolbar; see lib/canvas/selection.ts. */
  selection: SelectionSnapshot | null;
  /** An image is in crop mode. */
  cropping: boolean;
  /** A framed image is being moved or zoomed inside its frame; its zoom (1 = just fills the frame). */
  repositioning: { zoom: number } | null;
  /** Background removal of an image: running (progress 0–1, null when it cannot be told), or failed. */
  removingBackground:
    | { stage: "download" | "process" | "upload"; progress: number | null }
    | { stage: "failed"; message: string }
    | null;
  /** The design's page ids in page order. */
  pageIds: string[];
  /** The page on the canvas (or being loaded onto it). */
  currentPageId: string | null;
  /** Object URLs of small page previews for the page strip, by page id. */
  pageThumbs: Record<string, string>;
  /** A page action failed; shown by the page strip until the next action. */
  pageError: string | null;
  /**
   * The design's size after a resize (or its undo) in the open editor; until then the size the page
   * was rendered with applies. Written by lib/canvas/document.ts.
   */
  design: { projectId: string; width: number; height: number; unit: Unit } | null;
  /** The project title as last saved, for export file names. */
  projectTitle: string;
  /** The find and replace dialog is open. */
  findOpen: boolean;
  /** A table cell being edited in place (components/editor/table-cell-editor.tsx). */
  editingCell: { tableId: string; row: number; column: number } | null;
  /** The draw tool while the Draw panel is open (lib/canvas/draw.ts). */
  drawing: DrawSettings | null;
  /** Timing of the page on the canvas; written by lib/canvas/timing.ts. */
  timing: PageTiming;
  /** The page preview (its animations) is playing over the editor. */
  previewing: boolean;
  /** Rulers and guides are shown (a view setting, remembered in this browser). */
  showRulers: boolean;
  /** Guides of the page on the canvas; written by lib/canvas/guides.ts. */
  guides: Guides;
  /** Mirror of the canvas viewport transform, for the rulers. */
  viewport: number[];
  togglePanel: (panel: PanelId) => void;
  setZoom: (zoom: number) => void;
};

export const useEditorStore = create<EditorUiState>((set) => ({
  activePanel: "elements",
  zoom: 1,
  loadState: "loading",
  saveStatus: "saved",
  canUndo: false,
  canRedo: false,
  layers: [],
  selectedIds: [],
  selection: null,
  cropping: false,
  repositioning: null,
  removingBackground: null,
  pageIds: [],
  currentPageId: null,
  pageThumbs: {},
  pageError: null,
  design: null,
  projectTitle: "",
  drawing: null,
  editingCell: null,
  findOpen: false,
  timing: DEFAULT_TIMING,
  previewing: false,
  showRulers: false,
  guides: NO_GUIDES,
  viewport: [1, 0, 0, 1, 0, 0],
  togglePanel: (panel) => set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),
  setZoom: (zoom) => set({ zoom }),
}));
