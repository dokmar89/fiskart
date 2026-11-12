import { ActiveSelection, Point, Textbox, type FabricObject } from "fabric";
import { resizeBox, type Placement } from "@/lib/position-math";
import { recordStep } from "./document";
import { getEditorInstance } from "./instance";
import { placementOf, refreshSelection } from "./selection";

/** Text boxes get their height from their text; only their width can be typed. */
export const fixedHeight = (o: FabricObject) => o instanceof Textbox;

/**
 * Applies typed numbers from the position panel to the selection (an object or a whole multiple
 * selection), as one undo step. Size changes keep the centre; with `lockRatio` the other side follows.
 */
export function setPlacement(change: Partial<Placement>, lockRatio: boolean) {
  const editor = getEditorInstance();
  const o = editor?.canvas.getActiveObject();
  if (!editor || !o || o.locked) return;
  const { canvas } = editor;
  const before = placementOf(o);
  recordStep(() => {
    if (change.width !== undefined || change.height !== undefined) {
      const centre = o.getCenterPoint();
      if (fixedHeight(o)) {
        // A text box reflows to the new width instead of stretching its letters.
        if (change.width !== undefined) o.set({ width: Math.max(1, change.width / Math.abs(o.scaleX)) });
      } else {
        const size = resizeBox({ width: before.width, height: before.height }, change, lockRatio);
        o.set({
          scaleX: Math.sign(o.scaleX || 1) * (size.width / Math.max(o.width, 1e-6)),
          scaleY: Math.sign(o.scaleY || 1) * (size.height / Math.max(o.height, 1e-6)),
        });
      }
      o.setPositionByOrigin(centre, "center", "center");
    }
    if (change.angle !== undefined) o.rotate(change.angle);
    if (change.x !== undefined || change.y !== undefined) {
      const now = placementOf(o);
      o.setPositionByOrigin(new Point(change.x ?? now.x, change.y ?? now.y), "left", "top");
    }
    o.setCoords();
    if (o instanceof ActiveSelection) o.getObjects().forEach((child) => child.setCoords());
    canvas.fire("object:modified", { target: o });
  });
  canvas.requestRenderAll();
  refreshSelection();
}
