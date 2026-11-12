"use client";

import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isMixed } from "@/lib/canvas/mixed";
import { changeSelection, endGesture, type EffectPatch } from "@/lib/canvas/props";
import type { EffectView, SelectionSnapshot } from "@/lib/canvas/selection";
import { effectStyle, TEXT_EFFECT_TYPES, type TextEffect, type TextEffectType } from "@/lib/text-effects";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { SliderField, ToolButton } from "./controls";

type NumberParam = { key: string; label: string; min: number; max: number };

const PARAMS: Record<TextEffectType, NumberParam[]> = {
  shadow: [
    { key: "offset", label: "Odsazení", min: 0, max: 100 },
    { key: "direction", label: "Směr", min: 0, max: 359 },
    { key: "blur", label: "Rozostření", min: 0, max: 100 },
    { key: "transparency", label: "Průhlednost", min: 0, max: 100 },
  ],
  outline: [{ key: "thickness", label: "Tloušťka", min: 1, max: 100 }],
  hollow: [{ key: "thickness", label: "Tloušťka", min: 1, max: 100 }],
  neon: [{ key: "intensity", label: "Intenzita", min: 0, max: 100 }],
  lift: [{ key: "intensity", label: "Výška", min: 0, max: 100 }],
  splice: [
    { key: "thickness", label: "Tloušťka", min: 1, max: 100 },
    { key: "offset", label: "Odsazení", min: 0, max: 100 },
    { key: "direction", label: "Směr", min: 0, max: 359 },
  ],
  glitch: [{ key: "intensity", label: "Posun barev", min: 0, max: 100 }],
  background: [
    { key: "padding", label: "Odsazení", min: 0, max: 100 },
    { key: "radius", label: "Zaoblení", min: 0, max: 100 },
    { key: "transparency", label: "Průhlednost", min: 0, max: 100 },
  ],
};

const HAS_OWN_COLOR: Partial<Record<TextEffectType, string>> = { shadow: "Barva stínu", outline: "Barva obrysu", lift: "Barva stínu", splice: "Barva obrysu", glitch: "Azurová", background: "Barva pozadí" };

/** A small "Ag" drawn with the effect, as CSS, so the tiles show what each effect does. */
function previewStyle(type: TextEffectType | null): React.CSSProperties {
  if (!type) return {};
  const sample: Record<TextEffectType, TextEffect> = {
    shadow: { type: "shadow", offset: 60, direction: 45, blur: 20, color: "#000000", transparency: 50 },
    outline: { type: "outline", thickness: 60, color: "#6366f1" },
    hollow: { type: "hollow", thickness: 60, color: "#000000" },
    neon: { type: "neon", intensity: 60, color: "#ec4899" },
    lift: { type: "lift", intensity: 60, color: "#171717" },
    splice: { type: "splice", thickness: 60, offset: 60, direction: 45, color: "#a855f7" },
    glitch: { type: "glitch", intensity: 60, color: "#00e5ff", magenta: "#ff3ba7" },
    background: { type: "background", padding: 30, radius: 30, transparency: 0, color: "#fef08a" },
  };
  const style = effectStyle(sample[type], 22);
  const css: React.CSSProperties = {};
  if (style.shadow) css.textShadow = `${style.shadow.offsetX}px ${style.shadow.offsetY}px ${style.shadow.blur}px ${style.shadow.color}`;
  if (type === "outline") css.WebkitTextStroke = `3px ${style.stroke}`;
  if (type === "outline") css.paintOrder = "stroke fill";
  if (type === "hollow") {
    // Not currentColor: that is the transparent fill here.
    css.WebkitTextStroke = "1.5px var(--foreground)";
    css.color = "transparent";
  }
  if (type === "neon") css.color = style.fill;
  if (type === "splice") css.textShadow = "3px 3px 0 #a855f7";
  if (type === "glitch") css.textShadow = "-2px -1px 0 #00e5ff, 2px 1px 0 #ff3ba7";
  if (type === "background") {
    css.backgroundColor = "#fef08a";
    css.borderRadius = 6;
    css.padding = "0 3px";
  }
  return css;
}

export function TextEffects({ selection }: { selection: SelectionSnapshot }) {
  const effect = selection.effect;
  const mixed = isMixed(effect);
  const current: EffectView | null = effect === undefined || mixed ? null : effect;
  const set = (patch: EffectPatch | null, mode: "live" | "commit" = "commit") => void changeSelection({ effect: patch }, mode);

  return (
    <Popover onOpenChange={(open) => !open && endGesture()}>
      <PopoverTrigger asChild>
        <ToolButton label="Efekty" pressed={mixed ? "mixed" : current !== null}>
          <Sparkles />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="grid w-80 gap-4" align="start" aria-label="Efekty">
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Efekt">
          {[{ type: null, label: "Žádný" }, ...TEXT_EFFECT_TYPES].map(({ type, label }) => {
            const active = !mixed && (current?.type ?? null) === type;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => !active && set(type ? { type } : null)}
                className={cn(
                  "grid gap-1 rounded-md border p-1 text-[10px] text-muted-foreground hover:bg-accent",
                  active && "border-ring bg-accent text-accent-foreground",
                )}
              >
                <span className="text-lg leading-7 font-bold text-foreground" style={previewStyle(type)} aria-hidden>
                  Ag
                </span>
                {label}
              </button>
            );
          })}
        </div>
        {mixed && <p className="text-xs text-muted-foreground">Vybrané texty mají různé efekty.</p>}
        {current && (
          <div className="grid gap-4">
            {PARAMS[current.type].map((p) => {
              const value = (current as Record<string, unknown>)[p.key];
              return (
                <SliderField
                  key={p.key}
                  label={p.label}
                  value={typeof value === "number" ? value : p.min}
                  min={p.min}
                  max={p.max}
                  onLive={(v) => set({ type: current.type, [p.key]: v }, "live")}
                  onCommit={(v) => set({ type: current.type, [p.key]: v })}
                />
              );
            })}
            {HAS_OWN_COLOR[current.type] && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{HAS_OWN_COLOR[current.type]}</span>
                <ColorPicker
                  label={HAS_OWN_COLOR[current.type] ?? "Barva"}
                  value={typeof current.color === "string" ? current.color : null}
                  onChange={(color, mode) => typeof color === "string" && set({ type: current.type, color }, mode)}
                />
              </div>
            )}
            {current.type === "glitch" && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Purpurová</span>
                <ColorPicker
                  label="Purpurová glitch"
                  value={typeof (current as Record<string, unknown>).magenta === "string" ? (current as Record<string, string>).magenta : "#ff3ba7"}
                  onChange={(color, mode) => typeof color === "string" && set({ type: "glitch", magenta: color }, mode)}
                />
              </div>
            )}
            {(current.type === "hollow" || current.type === "neon") && (
              <p className="text-xs text-muted-foreground">Používá barvu textu.</p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
