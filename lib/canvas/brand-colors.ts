import { Color, FabricImage, Gradient, Group, type FabricObject, type IText } from "fabric";
import { brandColorMapping, byUse } from "@/lib/brand";
import { applyEffectStyle } from "./effects";
import { currentPageId, recordStep } from "./document";
import { getEditorInstance } from "./instance";
import { toHex } from "./paint-fabric";
import { isText, refreshSelection } from "./selection";
import { serializeCanvas } from "./serialize";

/** One place on the page that holds a colour, with the colour it had before brand colours were applied. */
type Slot = { source: string; set: (hex: string) => void };

/** Keeps a colour's transparency when its hue is replaced. */
function withSourceAlpha(raw: unknown, hex: string): string {
  const alpha = typeof raw === "string" ? new Color(raw).getAlpha() : 1;
  return alpha < 1 ? new Color(hex).setAlpha(alpha).toRgba() : hex;
}

function fillSlots(o: FabricObject, slots: Slot[]) {
  const fill = o.fill;
  if (fill instanceof Gradient) {
    fill.colorStops.forEach((stop) => {
      const source = toHex(stop.color);
      if (!source) return;
      const raw = stop.color;
      slots.push({
        source,
        set: (hex) => {
          stop.color = withSourceAlpha(raw, hex);
          o.set({ dirty: true });
        },
      });
    });
    return;
  }
  const source = toHex(fill);
  if (source) slots.push({ source, set: (hex) => o.set({ fill: withSourceAlpha(fill, hex) }) });
}

/**
 * The colours of an object that brand colours replace: fills (gradient stops one by one), visible
 * strokes, and text colour and outline. Images, SVG uploads, placeholders and shadows keep theirs.
 */
function collect(o: FabricObject, slots: Slot[]) {
  if (o instanceof FabricImage || o.placeholderFor) return;
  if (o instanceof Group) {
    o.getObjects().forEach((child) => collect(child, slots));
    return;
  }
  if (isText(o)) {
    const effect = o.effect;
    // Hollow and neon keep the text colour in the effect; outline keeps its stroke colour there.
    if (effect?.type === "hollow" || effect?.type === "neon" || effect?.type === "outline") {
      const source = toHex(effect.color);
      if (source) {
        slots.push({
          source,
          set: (hex) => {
            if (o.effect) o.set({ effect: { ...o.effect, color: hex } });
            applyEffectStyle(o);
          },
        });
      }
    }
    if (effect?.type !== "hollow" && effect?.type !== "neon") fillSlots(o, slots);
    return;
  }
  fillSlots(o, slots);
  const stroke = o.stroke;
  const source = o.strokeWidth > 0 ? toHex(stroke) : null;
  if (source) slots.push({ source, set: (hex) => o.set({ stroke: withSourceAlpha(stroke, hex) }) });
}

type Session = {
  pageId: string;
  palette: string;
  /** The page's objects, to tell a reloaded page (same data, new objects) from the one recoloured. */
  objects: FabricObject[];
  /** The page as it was left by the last application; any other edit starts over at the first mapping. */
  after: string;
  slots: Slot[];
  sources: string[];
  cycle: number;
};

let session: Session | null = null;

const sameObjects = (a: FabricObject[], b: FabricObject[]) => a.length === b.length && a.every((o, i) => o === b[i]);

/**
 * Recolours the open page with a brand palette, as one undo step. The page's distinct colours,
 * most used first, are mapped onto the palette (see brandColorMapping). Pressing again while the
 * page is unchanged since moves on to the next mapping, still worked out from the colours the
 * page had before the first press. Returns false when there was nothing to recolour.
 */
export function applyBrandColors(palette: string[]): boolean {
  const editor = getEditorInstance();
  const pageId = currentPageId();
  if (!editor || !pageId || palette.length === 0) return false;
  const { canvas } = editor;
  const active = canvas.getActiveObject() as Partial<IText> | undefined;
  if (active?.isEditing) active.exitEditing?.();

  const key = palette.join(",");
  const objects = canvas.getObjects();
  const now = JSON.stringify(serializeCanvas(canvas));
  const continues =
    session !== null && session.pageId === pageId && session.palette === key && session.after === now && sameObjects(session.objects, objects);

  let next: Session;
  if (continues && session) {
    next = { ...session, cycle: session.cycle + 1 };
  } else {
    const slots: Slot[] = [];
    objects.forEach((o) => collect(o, slots));
    next = { pageId, palette: key, objects, after: now, slots, sources: byUse(slots.map((s) => s.source)), cycle: 0 };
  }
  if (next.slots.length === 0) return false;

  const mapping = brandColorMapping(next.sources, palette, next.cycle);
  recordStep(() => {
    next.slots.forEach((slot) => slot.set(mapping.get(slot.source) ?? slot.source));
    objects.forEach((o) => o.set({ dirty: true }));
    canvas.requestRenderAll();
  });
  refreshSelection();
  session = { ...next, after: JSON.stringify(serializeCanvas(canvas)) };
  return true;
}
