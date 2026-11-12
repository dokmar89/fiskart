import { cache, FabricText, type Canvas, type FabricObject } from "fabric";
import { fontShorthand, loadFonts, normalizeWeight } from "@/lib/fonts";
import { applyTextCase } from "@/lib/text-case";
import { applyEffectStyle } from "./effects";

/**
 * After a corner drag scales a text box, moves the scale into the font size and width, so the
 * toolbar's size is the real size and later edits wrap as expected. Not for multi-selections,
 * whose members carry the group's transform until the selection is dropped.
 */
function normalizeTextScale(target: FabricObject) {
  if (!(target instanceof FabricText) || target.group) return;
  const { scaleX, scaleY } = target;
  if (Math.abs(scaleX - 1) < 1e-3 && Math.abs(scaleY - 1) < 1e-3) return;
  if (Math.abs(scaleX - scaleY) > 1e-3) return;
  target.set({ fontSize: target.fontSize * scaleY, width: target.width * scaleX, scaleX: 1, scaleY: 1 });
  // Effects are sized from the font size; until now Fabric scaled them along with the box.
  applyEffectStyle(target);
  target.setCoords();
}

/**
 * Typing a character from a subset not yet loaded (a Czech "ř" when only the latin subset is)
 * would be measured with a fallback font; load it and measure again.
 */
async function ensureTypedFonts(canvas: Canvas, target: FabricObject) {
  if (!(target instanceof FabricText)) return;
  const need = {
    family: target.fontFamily,
    weight: normalizeWeight(target.fontWeight),
    style: target.fontStyle === "italic" ? ("italic" as const) : ("normal" as const),
    text: applyTextCase(target.text, target.textCase),
  };
  if (document.fonts.check(fontShorthand(need), need.text)) return;
  await loadFonts([need]);
  cache.clearFontCache(need.family);
  target.initDimensions();
  target.setCoords();
  canvas.requestRenderAll();
}

export function installTextBehaviour(canvas: Canvas) {
  const onModified = ({ target }: { target: FabricObject }) => normalizeTextScale(target);
  const onChanged = ({ target }: { target: FabricObject }) => void ensureTypedFonts(canvas, target);
  canvas.on("object:modified", onModified);
  canvas.on("text:changed", onChanged);
  return () => {
    canvas.off("object:modified", onModified);
    canvas.off("text:changed", onChanged);
  };
}
