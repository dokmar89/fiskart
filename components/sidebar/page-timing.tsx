"use client";

import { ANIMATION_TYPES, DEFAULT_ANIM, DIRECTIONS, TRANSITIONS, type AnimationType, type Direction, type TransitionType } from "@/lib/animation";
import { changeTiming } from "@/lib/canvas/timing";
import { useEditorStore } from "@/lib/store/editor";

const ANIMATION_LABELS: Record<AnimationType, string> = { fade: "Prolnutí", slide: "Pan", pop: "Pop", wipe: "Stírání", rise: "Vynoření", typewriter: "Psací stroj", breathe: "Dýchání", tumble: "Překlopení", neon: "Neonový záblesk", drift: "Drift" };
const DIRECTION_LABELS: Record<Direction, string> = { left: "Zleva", right: "Zprava", up: "Shora", down: "Zdola" };
const TRANSITION_LABELS: Record<TransitionType, string> = { none: "Žádný", fade: "Prolnutí", slide: "Zasunutí", push: "Vytlačení", zoom: "Přiblížení" };

function Seconds({ label, value, min, onCommit }: { label: string; value: number; min: number; onCommit: (ms: number) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <input
        aria-label={label}
        type="number"
        min={min / 1000}
        max={60}
        step={0.1}
        defaultValue={value / 1000}
        key={value}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && Math.round(v * 1000) !== value) onCommit(Math.max(min, Math.round(v * 1000)));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground tabular-nums dark:bg-input/30"
      />
    </label>
  );
}

/** How long the open page shows, how it comes in, and an entrance for all its elements. */
export function PageTimingSection() {
  const timing = useEditorStore((s) => s.timing);
  return (
    <section className="grid gap-3" aria-label="Časování stránky">
      <h2 className="text-xs font-medium text-muted-foreground">Tato stránka</h2>
      <div className="grid grid-cols-2 gap-2">
        <Seconds label="Délka stránky (s)" value={timing.duration} min={500} onCommit={(duration) => changeTiming({ duration })} />
        <label className="grid gap-1 text-xs text-muted-foreground">
          Přechod na stránku
          <select
            aria-label="Přechod na stránku"
            value={timing.transition.type}
            onChange={(e) => changeTiming({ transition: { ...timing.transition, type: e.target.value as TransitionType } })}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30"
          >
            {TRANSITIONS.map((t) => (
              <option key={t} value={t}>
                {TRANSITION_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Animace stránky
          <select
            aria-label="Animace stránky"
            value={timing.animation?.type ?? "none"}
            onChange={(e) => {
              const type = e.target.value;
              changeTiming({ animation: type === "none" ? null : { ...DEFAULT_ANIM, ...(timing.animation ?? { stagger: 150 }), type: type as AnimationType } });
            }}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30"
          >
            <option value="none">Žádná</option>
            {ANIMATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {ANIMATION_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        {timing.transition.type !== "none" && (
          <Seconds label="Přechod (s)" value={timing.transition.duration} min={50} onCommit={(duration) => changeTiming({ transition: { ...timing.transition, duration } })} />
        )}
        {timing.animation && <>
          <Seconds label="Animace stránky: délka (s)" value={timing.animation.duration} min={200} onCommit={(duration) => changeTiming({ animation: timing.animation && { ...timing.animation, duration: Math.min(5000, duration) } })} />
          <Seconds label="Animace stránky: zpoždění (s)" value={timing.animation.delay} min={0} onCommit={(delay) => changeTiming({ animation: timing.animation && { ...timing.animation, delay } })} />
          {(["slide", "wipe", "drift"] as AnimationType[]).includes(timing.animation.type) && <label className="grid gap-1 text-xs text-muted-foreground">
            Směr animace stránky
            <select aria-label="Směr animace stránky" value={timing.animation.direction} onChange={(e) => changeTiming({ animation: timing.animation && { ...timing.animation, direction: e.target.value as Direction } })} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30">
              {DIRECTIONS.map((direction) => <option key={direction} value={direction}>{DIRECTION_LABELS[direction]}</option>)}
            </select>
          </label>}
        </>}
      </div>
      <p className="text-[11px] text-muted-foreground">Animace stránky se postupně použije na prvky bez vlastního příchodu. Přehrávání ukazuje stránku; exporty zobrazí každý prvek tak, jak je navržen.</p>
    </section>
  );
}
