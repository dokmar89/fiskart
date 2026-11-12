"use client";

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { documentColors } from "@/lib/canvas/colors";
import { isMixed, type Mixed } from "@/lib/canvas/mixed";
import { DEFAULT_GRADIENT, type LinearGradientPaint, type Paint } from "@/lib/canvas/paint";
import { normalizeHex } from "@/lib/hex";
import { endGesture } from "@/lib/canvas/props";
import { useBrandStore } from "@/lib/store/brand";
import { cn } from "@/lib/utils";

export type PaintChange = (paint: Paint, mode: "live" | "commit") => void;

const BASICS = ["#000000", "#ffffff", "#71717a", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

/** CSS for a swatch showing a paint. Our angle 0 runs left to right, which is CSS's 90deg. */
export function paintCss(paint: Paint): string {
  if (paint === null) return "linear-gradient(135deg, #fff 45%, #ef4444 45%, #ef4444 55%, #fff 55%)";
  if (typeof paint === "string") return paint;
  return `linear-gradient(${paint.angle + 90}deg, ${paint.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(", ")})`;
}

const MIXED_CSS = "conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)";

function Swatch({ color, label, onClick, active }: { color: string; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("size-6 rounded border shadow-xs", active && "ring-2 ring-ring ring-offset-1")}
      style={{ background: color }}
    />
  );
}

function HexInput({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const hex = normalizeHex(draft);
    if (hex) onCommit(hex);
    else setDraft(value);
  };
  return (
    <input
      aria-label="Barva v hex"
      value={draft}
      maxLength={7}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="h-8 w-full rounded-md border border-input bg-transparent px-2 font-mono text-sm uppercase outline-none focus:border-ring dark:bg-input/30"
    />
  );
}

/**
 * Colour control: a swatch that opens a picker with hex input, the page's colours and, for fills,
 * a linear gradient. Dragging in the picker previews live and becomes one undo step on release.
 */
export function ColorPicker({
  label,
  value,
  onChange,
  allowGradient = false,
  allowNone = false,
}: {
  label: string;
  value: Mixed<Paint> | undefined;
  onChange: PaintChange;
  allowGradient?: boolean;
  allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [usedColors, setUsedColors] = useState<string[]>([]);
  const [stopIndex, setStopIndex] = useState(0);
  const kits = useBrandStore((s) => s.kits);
  const loadBrand = useBrandStore((s) => s.load);
  const brandKits = kits.filter((k) => k.colors.length > 0);
  const current = value === undefined || isMixed(value) ? null : value;
  const gradient: LinearGradientPaint | null = current !== null && typeof current === "object" ? current : null;
  const solid = typeof current === "string" ? current : null;
  const editedColor = gradient ? gradient.stops[stopIndex]?.color ?? "#000000" : solid ?? "#000000";

  const setColor = (hex: string, mode: "live" | "commit") => {
    if (!gradient) return onChange(hex, mode);
    const stops = gradient.stops.map((s, i) => (i === stopIndex ? { ...s, color: hex } : s));
    onChange({ ...gradient, stops }, mode);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setUsedColors(documentColors());
          void loadBrand();
        }
        else endGesture();
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              className="flex size-8 items-center justify-center rounded-md hover:bg-accent"
            >
              <span
                className="size-5 rounded border shadow-xs"
                style={{ background: isMixed(value) ? MIXED_CSS : paintCss(current) }}
                data-testid={`${label}-swatch`}
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent className="grid w-64 gap-3" align="start" aria-label={label}>
        {brandKits.map((kit) => (
          <div key={kit.id} className="grid gap-1.5">
            <span className="truncate text-xs text-muted-foreground">{brandKits.length > 1 ? kit.name : "Barvy značky"}</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Barvy značky: ${kit.name}`}>
              {kit.colors.map((c) => (
                <Swatch key={c} color={c} label={c} onClick={() => setColor(c, "commit")} />
              ))}
            </div>
          </div>
        ))}

        {allowGradient && (
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5 text-xs">
            {([["solid", "Jednolitá"], ["gradient", "Přechod"]] as const).map(([mode, modeLabel]) => {
              const active = mode === "gradient" ? gradient !== null : gradient === null;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    if (active) return;
                    setStopIndex(0);
                    if (mode === "gradient") {
                      const first = solid ?? DEFAULT_GRADIENT.stops[0].color;
                      onChange({ ...DEFAULT_GRADIENT, stops: [{ offset: 0, color: first }, DEFAULT_GRADIENT.stops[1]] }, "commit");
                    } else {
                      onChange(gradient?.stops[0].color ?? "#000000", "commit");
                    }
                  }}
                  className={cn("rounded px-2 py-1", active && "bg-background shadow-xs")}
                >
                  {modeLabel}
                </button>
              );
            })}
          </div>
        )}

        {gradient && (
          <div className="flex items-center gap-2">
            {gradient.stops.map((s, i) => (
              <Swatch key={i} color={s.color} label={`Barva přechodu ${i + 1}`} active={i === stopIndex} onClick={() => setStopIndex(i)} />
            ))}
            <div className="h-4 flex-1 rounded border" style={{ background: paintCss({ ...gradient, angle: 0 }) }} />
          </div>
        )}

        {/* Pointer release ends a drag in the picker: that drag is one undo step. */}
        <div onPointerUpCapture={() => endGesture()} className="[&_.react-colorful]:w-full">
          <HexColorPicker color={editedColor} onChange={(hex) => setColor(hex, "live")} />
        </div>
        <HexInput value={editedColor} onCommit={(hex) => setColor(hex, "commit")} />

        {gradient && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Úhel</span>
              <span className="tabular-nums">{gradient.angle}°</span>
            </div>
            <Slider
              aria-label="Úhel přechodu"
              value={[gradient.angle]}
              min={0}
              max={359}
              step={1}
              onValueChange={([angle]) => onChange({ ...gradient, angle }, "live")}
              onValueCommit={([angle]) => onChange({ ...gradient, angle }, "commit")}
            />
          </div>
        )}

        {usedColors.length > 0 && (
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Barvy v návrhu</span>
            <div className="flex flex-wrap gap-1.5" aria-label="Barvy v návrhu">
              {usedColors.map((c) => (
                <Swatch key={c} color={c} label={c} onClick={() => setColor(c, "commit")} />
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Základní barvy</span>
          <div className="flex flex-wrap gap-1.5">
            {BASICS.map((c) => (
              <Swatch key={c} color={c} label={c} onClick={() => setColor(c, "commit")} />
            ))}
            {allowNone && <Swatch color={paintCss(null)} label="Bez barvy" onClick={() => onChange(null, "commit")} />}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
