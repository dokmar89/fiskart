"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ANIMATION_TYPES, DEFAULT_ANIM, DEFAULT_LOOP, DIRECTIONS, EASINGS, elementStateAt, FINAL_STATE, LOOP_TYPES, type Anim, type AnimationType, type Direction, type Easing, type ElementAnimation, type LoopAnim, type LoopType } from "@/lib/animation";
import { isMixed, type Mixed } from "@/lib/canvas/mixed";
import { changeSelection, endGesture } from "@/lib/canvas/props";
import { useEditorStore } from "@/lib/store/editor";
import { ToolButton } from "./controls";

const LABELS: Record<AnimationType, string> = { fade: "Prolnutí", slide: "Pan", pop: "Pop", wipe: "Stírání", rise: "Vynoření", typewriter: "Psací stroj", breathe: "Dýchání", tumble: "Překlopení", neon: "Neonový záblesk", drift: "Drift" };
const LOOP_LABELS: Record<LoopType, string> = { pulse: "Pulzování", jiggle: "Vibrace", spin: "Rotace", glow: "Záře" };
const EASING_LABELS: Record<Easing, string> = { linear: "Lineární", "ease-in": "Zrychlení", "ease-out": "Zpomalení", "ease-in-out": "Zrychlení a zpomalení" };
const DIRECTION_LABELS: Record<Direction, string> = { left: "Zleva", right: "Zprava", up: "Shora", down: "Zdola" };
const USES_DIRECTION = new Set<AnimationType>(["slide", "wipe", "drift"]);

function PreviewTile({ type, label, selected, loop = false, onSelect }: { type: AnimationType | LoopType; label: string; selected: boolean; loop?: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!hovered) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setElapsed(now - start);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hovered]);
  const motion = hovered
    ? loop
      ? elementStateAt({ loop: { ...DEFAULT_LOOP, type: type as LoopType, duration: 1000 } }, 1000, 1000, { width: 24, height: 24 }, true, elapsed)
      : elementStateAt({ in: { ...DEFAULT_ANIM, type: type as AnimationType, duration: 700 } }, 1200, Math.min(elapsed % 1200, 700), { width: 24, height: 24 }, true)
    : FINAL_STATE;
  const clipped = 100 - motion.wipe * 100;
  const clipPath = motion.wipe >= 1 ? undefined : motion.wipeFrom === "left" ? `inset(0 ${clipped}% 0 0)` : motion.wipeFrom === "right" ? `inset(0 0 0 ${clipped}%)` : motion.wipeFrom === "up" ? `inset(0 0 ${clipped}% 0)` : `inset(${clipped}% 0 0 0)`;
  const glyph = motion.chars >= 1 ? "Aa" : [..."Aa"].slice(0, Math.floor(motion.chars * 2)).join("");
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={`${label} – najetím zobrazíte náhled`}
      onMouseEnter={() => { setElapsed(0); setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => { setElapsed(0); setHovered(true); }}
      onBlur={() => setHovered(false)}
      onClick={onSelect}
      className={`flex min-w-16 flex-col items-center gap-1 rounded-md border p-1 text-[10px] hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring ${selected ? "border-ring bg-accent" : ""}`}
    >
      <span className="flex h-7 w-9 items-center justify-center overflow-hidden">
        <span style={{ opacity: motion.opacity, transform: `translate(${motion.dx}px, ${motion.dy}px) scale(${motion.scale}) scaleX(${motion.flipX}) rotate(${motion.rotation}deg)`, clipPath, filter: motion.glow > 0 ? `drop-shadow(0 0 ${2 + motion.glow * 7}px #8b5cf6)` : undefined }} className="font-semibold text-violet-500">{glyph}</span>
      </span>
      <span className="max-w-20 truncate">{label}</span>
    </button>
  );
}

function DurationRange({ label, value, onLive }: { label: string; value: number; onLive: (ms: number) => void }) {
  return <label className="col-span-2 grid gap-1 text-xs text-muted-foreground">
    <span>{label}: {(value / 1000).toFixed(1)} s</span>
    <input type="range" aria-label={label} min={0.2} max={5} step={0.1} value={Math.min(5, Math.max(0.2, value / 1000))} onChange={(e) => onLive(Math.round(Number(e.target.value) * 1000))} onPointerUp={endGesture} onKeyUp={endGesture} onBlur={endGesture} className="w-full accent-violet-500" />
  </label>;
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[] | { value: T; label: string }[]; onChange: (v: T) => void }) {
  const list = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground capitalize dark:bg-input/30"
      >
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Seconds({ label, value, onCommit }: { label: string; value: number; onCommit: (ms: number) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <input
        aria-label={label}
        type="number"
        min={0}
        max={60}
        step={0.1}
        defaultValue={value / 1000}
        key={value}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && Math.round(v * 1000) !== value) onCommit(Math.max(0, Math.round(v * 1000)));
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground tabular-nums dark:bg-input/30"
      />
    </label>
  );
}

function AnimEditor({ title, anim, text, onChange }: { title: string; anim: Anim | undefined; text: boolean; onChange: (a: Anim | undefined, mode?: "live" | "commit") => void }) {
  const types = ANIMATION_TYPES.filter((t) => t !== "typewriter" || text);
  return (
    <fieldset className="grid gap-2" aria-label={title}>
      <legend className="mb-1 text-xs font-medium">{title}</legend>
      <Select
        label={`${title}: efekt`}
        value={anim?.type ?? "none"}
        options={[{ value: "none", label: "Žádná" }, ...types.map((t) => ({ value: t, label: LABELS[t] }))]}
        onChange={(v) => onChange(v === "none" ? undefined : { ...(anim ?? DEFAULT_ANIM), type: v as AnimationType })}
      />
      <div className="flex gap-1 overflow-x-auto pb-1" role="group" aria-label={`${title}: předvolby`}>
        {types.map((type) => <PreviewTile key={type} type={type} label={LABELS[type]} selected={anim?.type === type} onSelect={() => onChange({ ...(anim ?? DEFAULT_ANIM), type })} />)}
      </div>
      {anim && (
        <div className="grid grid-cols-2 gap-2">
          <DurationRange label={`${title}: rychlost`} value={anim.duration} onLive={(duration) => onChange({ ...anim, duration }, "live")} />
          <Seconds label={`${title}: délka (s)`} value={anim.duration} onCommit={(duration) => onChange({ ...anim, duration: Math.max(200, Math.min(5000, duration)) })} />
          <Seconds label={`${title}: zpoždění (s)`} value={anim.delay} onCommit={(delay) => onChange({ ...anim, delay })} />
          <Select label={`${title}: průběh`} value={anim.easing} options={EASINGS.map((e) => ({ value: e, label: EASING_LABELS[e] }))} onChange={(easing) => onChange({ ...anim, easing })} />
          {USES_DIRECTION.has(anim.type) && <Select label={`${title}: směr`} value={anim.direction} options={DIRECTIONS.map((d) => ({ value: d, label: DIRECTION_LABELS[d] }))} onChange={(direction) => onChange({ ...anim, direction })} />}
        </div>
      )}
    </fieldset>
  );
}

function LoopEditor({ loop, onChange }: { loop: LoopAnim | undefined; onChange: (a: LoopAnim | undefined, mode?: "live" | "commit") => void }) {
  return <fieldset className="grid gap-2" aria-label="Smyčka">
    <legend className="mb-1 text-xs font-medium">Smyčka</legend>
    <Select
      label="Smyčka: efekt"
      value={loop?.type ?? "none"}
      options={[{ value: "none", label: "Žádná" }, ...LOOP_TYPES.map((type) => ({ value: type, label: LOOP_LABELS[type] }))]}
      onChange={(type) => onChange(type === "none" ? undefined : { ...(loop ?? DEFAULT_LOOP), type: type as LoopType })}
    />
    <div className="flex gap-1 overflow-x-auto pb-1" role="group" aria-label="Smyčka: předvolby">
      {LOOP_TYPES.map((type) => <PreviewTile key={type} type={type} label={LOOP_LABELS[type]} selected={loop?.type === type} loop onSelect={() => onChange({ ...(loop ?? DEFAULT_LOOP), type })} />)}
    </div>
    {loop && <div className="grid grid-cols-2 gap-2">
      <DurationRange label="Smyčka: rychlost" value={loop.duration} onLive={(duration) => onChange({ ...loop, duration }, "live")} />
      <Seconds label="Smyčka: délka (s)" value={loop.duration} onCommit={(duration) => onChange({ ...loop, duration: Math.max(200, Math.min(5000, duration)) })} />
      <Seconds label="Smyčka: zpoždění (s)" value={loop.delay} onCommit={(delay) => onChange({ ...loop, delay })} />
      {(loop.type === "jiggle" || loop.type === "spin") && <Select label="Smyčka: směr" value={loop.direction} options={DIRECTIONS.map((direction) => ({ value: direction, label: DIRECTION_LABELS[direction] }))} onChange={(direction) => onChange({ ...loop, direction })} />}
    </div>}
  </fieldset>;
}

/** Entrance, exit and continuous animations of the selection. */
export function AnimateControl({ animation, text }: { animation: Mixed<ElementAnimation | null> | undefined; text: boolean }) {
  const current = isMixed(animation) || !animation ? {} : animation;
  const set = (next: ElementAnimation, mode: "live" | "commit" = "commit") => void changeSelection({ animation: next.in || next.out || next.loop ? next : null }, mode);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolButton label="Animovat" pressed={Boolean(current.in || current.out || current.loop)}>
          <Sparkles />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="grid max-h-[80vh] w-80 gap-4 overflow-y-auto" align="end" aria-label="Animovat" onPointerUp={endGesture} onBlur={endGesture}>
        {isMixed(animation) && <p className="text-xs text-muted-foreground">Vybrané prvky mají různé animace; změna se použije na všechny.</p>}
        <AnimEditor title="Příchod" anim={current.in} text={text} onChange={(a, mode) => set({ ...current, in: a }, mode)} />
        <AnimEditor title="Odchod" anim={current.out} text={text} onChange={(a, mode) => set({ ...current, out: a }, mode)} />
        <LoopEditor loop={current.loop} onChange={(a, mode) => set({ ...current, loop: a }, mode)} />
        <Button variant="outline" size="sm" onClick={() => useEditorStore.setState({ previewing: true })}>
          Náhled stránky
        </Button>
      </PopoverContent>
    </Popover>
  );
}
