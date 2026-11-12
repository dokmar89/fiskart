import { ActiveSelection, Group, type Canvas } from "fabric";
import { recordStep } from "./document";
import { newObjectId } from "./serialize";

/** Cmd/Ctrl+G: turns the current multi-selection into one group, at the stacking position of its topmost member. */
export function groupSelection(canvas: Canvas) {
  const active = canvas.getActiveObject();
  if (!(active instanceof ActiveSelection)) return;
  const all = canvas.getObjects();
  const members = active
    .getObjects()
    .filter((o) => !o.locked)
    .sort((a, b) => all.indexOf(a) - all.indexOf(b));
  if (members.length < 2) return;
  const topIndex = all.indexOf(members[members.length - 1]);

  recordStep(() => {
    // Dropping the selection first puts the members back in page coordinates.
    canvas.discardActiveObject();
    canvas.remove(...members);
    const group = new Group(members);
    group.set({ id: newObjectId(), name: "Skupina", locked: false });
    canvas.insertAt(topIndex - members.length + 1, group);
    canvas.setActiveObject(group);
  });
  canvas.requestRenderAll();
}

/** Cmd/Ctrl+Shift+G: replaces the selected group with its members, in place, and selects them. */
export function ungroupSelection(canvas: Canvas) {
  const group = canvas.getActiveObject();
  if (!(group instanceof Group) || group instanceof ActiveSelection || group.locked) return;
  const index = canvas.getObjects().indexOf(group);
  recordStep(() => {
    canvas.discardActiveObject();
    // removeAll applies the group's transform to each member, so they keep their place on the page.
    const members = group.removeAll();
    canvas.remove(group);
    canvas.insertAt(index, ...members);
    canvas.setActiveObject(members.length === 1 ? members[0] : new ActiveSelection(members, { canvas }));
  });
  canvas.requestRenderAll();
}
