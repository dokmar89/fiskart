"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isMixed, type Mixed } from "@/lib/canvas/mixed";
import { cn } from "@/lib/utils";

/**
 * Icon button with a tooltip; `pressed` may be "mixed" for a selection that disagrees. Extra props
 * reach the button itself, so it can be the child of a popover or menu trigger (`asChild`).
 */
export function ToolButton({
  label,
  pressed,
  children,
  className,
  ...rest
}: Omit<React.ComponentProps<typeof Button>, "aria-pressed"> & {
  label: string;
  pressed?: boolean | "mixed";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...rest}
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            "size-8",
            pressed === true && "bg-accent text-accent-foreground",
            pressed === "mixed" && "bg-accent/50",
            className,
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function pressedState(value: Mixed<boolean> | undefined): boolean | "mixed" {
  return isMixed(value) ? "mixed" : Boolean(value);
}

export function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

const format = (n: number, step: number) => (step < 1 ? String(Number(n.toFixed(2))) : String(Math.round(n)));

/**
 * A number typed in and applied on Enter or blur; Escape restores. A mixed value shows as an
 * empty field with "Mixed" as its placeholder.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
  className,
}: {
  label: string;
  value: Mixed<number> | undefined;
  min: number;
  max: number;
  step?: number;
  onCommit: (value: number) => void;
  className?: string;
}) {
  const shown = value === undefined || isMixed(value) ? "" : format(value, step);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      setDraft(shown);
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    setDraft(format(clamped, step));
    if (shown === "" || Math.abs(clamped - Number(shown)) > 1e-9) onCommit(clamped);
  };

  return (
    <input
      aria-label={label}
      title={label}
      inputMode="decimal"
      value={draft}
      placeholder={isMixed(value) ? "Různé" : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(shown);
          requestAnimationFrame(() => e.currentTarget?.blur());
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const base = Number(draft) || 0;
          const next = Math.min(max, Math.max(min, base + (e.key === "ArrowUp" ? step : -step) * (e.shiftKey ? 10 : 1)));
          setDraft(format(next, step));
          onCommit(next);
        }
      }}
      className={cn(
        "h-8 w-14 rounded-md border border-input bg-transparent px-2 text-center text-sm tabular-nums outline-none focus:border-ring dark:bg-input/30",
        className,
      )}
    />
  );
}

/**
 * A labelled slider with a number field. Dragging previews live; releasing (or typing a value)
 * makes it one undo step.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onLive,
  onCommit,
}: {
  label: string;
  value: Mixed<number> | undefined;
  min: number;
  max: number;
  step?: number;
  onLive: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const numeric = value === undefined || isMixed(value) ? min : value;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <NumberField label={label} value={value} min={min} max={max} step={step} onCommit={onCommit} />
      </div>
      <Slider
        aria-label={`${label}: posuvník`}
        value={[numeric]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onLive(v)}
        onValueCommit={([v]) => onCommit(v)}
      />
    </div>
  );
}
