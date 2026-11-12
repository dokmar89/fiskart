import { Shadow, type FabricText, type Textbox } from "fabric";
import { effectStyle, ownsTextColor, type TextEffect } from "@/lib/text-effects";
import type { Paint } from "./paint";
import { toFabricFill, toPaint } from "./paint-fabric";

/** The colour the text is drawn in, as the toolbar shows it. */
type DesignText = FabricText | Textbox;

export function textColorOf(text: DesignText): Paint {
  return ownsTextColor(text.effect) ? text.effect.color : toPaint(text.fill);
}

function firstColor(paint: Paint): string {
  if (paint === null) return "#18181b";
  return typeof paint === "string" ? paint : (paint.stops[0]?.color ?? "#18181b");
}

/** Sets the Fabric properties the text's effect controls, for its current font size. */
export function applyEffectStyle(text: DesignText) {
  const style = effectStyle(text.effect, text.fontSize);
  text.set({
    shadow: style.shadow ? new Shadow({ ...style.shadow, affectStroke: true }) : null,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    paintFirst: style.paintFirst,
    strokeLineJoin: "round",
    dirty: true,
  });
  if (style.fill !== undefined) text.set({ fill: style.fill });
}

/** Gives the text an effect (or none), keeping its colour across hollow and neon, which draw it themselves. */
export function setTextEffect(text: DesignText, effect: TextEffect | null) {
  const color = textColorOf(text);
  const next = effect && ownsTextColor(effect) ? { ...effect, color: firstColor(color) } : effect;
  if (ownsTextColor(text.effect) && !ownsTextColor(next)) text.set({ fill: text.effect.color });
  text.set({ effect: next ?? undefined });
  applyEffectStyle(text);
}

/** Changes the text colour, wherever the current effect keeps it. */
export function setTextColor(text: DesignText, paint: Paint) {
  if (paint === null) return;
  if (ownsTextColor(text.effect)) {
    text.set({ effect: { ...text.effect, color: firstColor(paint) } });
    applyEffectStyle(text);
  } else {
    text.set({ fill: toFabricFill(paint) });
  }
}
