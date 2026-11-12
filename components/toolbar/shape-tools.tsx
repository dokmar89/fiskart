"use client";

import { MoveRight, SquareRoundCorner } from "lucide-react";
import { HEADS, type Head } from "@/lib/connector-math";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isMixed } from "@/lib/canvas/mixed";
import type { Dash } from "@/lib/canvas/object-kind";
import { changeSelection, endGesture } from "@/lib/canvas/props";
import type { SelectionSnapshot } from "@/lib/canvas/selection";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { SliderField, ToolButton } from "./controls";

const DASHES: { dash: Dash; label: string; preview: string }[] = [
  { dash: "solid", label: "Plná", preview: "" },
  { dash: "dashed", label: "Čárkovaná", preview: "6 4" },
  { dash: "dotted", label: "Tečkovaná", preview: "0.1 4" },
];

function DashPreview({ dasharray }: { dasharray: string }) {
  return (
    <svg width="28" height="8" aria-hidden>
      <line x1="2" y1="4" x2="26" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={dasharray || undefined} />
    </svg>
  );
}

/** Stroke colour, width and dash style, for shapes and lines. */
function StrokeControls({ selection, line }: { selection: SelectionSnapshot; line: boolean }) {
  return (
    <>
      <ColorPicker
        label="Barva obrysu"
        value={selection.stroke}
        allowNone={!line}
        onChange={(stroke, mode) => void changeSelection({ stroke: typeof stroke === "string" ? stroke : null }, mode)}
      />
      <Popover onOpenChange={(open) => !open && endGesture()}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Styl obrysu" title="Styl obrysu" className="flex h-8 items-center gap-1 rounded-md px-2 hover:bg-accent">
            <DashPreview dasharray={DASHES.find((d) => d.dash === selection.dash)?.preview ?? ""} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="grid w-60 gap-3" align="start">
          <div className="flex gap-1" role="group" aria-label="Styl čáry">
            {DASHES.map(({ dash, label, preview }) => (
              <button
                key={dash}
                type="button"
                aria-label={label}
                aria-pressed={isMixed(selection.dash) ? "mixed" : selection.dash === dash}
                onClick={() => void changeSelection({ dash })}
                className={cn("flex h-8 flex-1 items-center justify-center rounded-md border", selection.dash === dash && "border-ring bg-accent")}
              >
                <DashPreview dasharray={preview} />
              </button>
            ))}
          </div>
          <SliderField
            label="Šířka obrysu"
            value={selection.strokeWidth}
            min={line ? 1 : 0}
            max={100}
            onLive={(strokeWidth) => void changeSelection({ strokeWidth }, "live")}
            onCommit={(strokeWidth) => void changeSelection({ strokeWidth })}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

export function CornerRadiusControl({ selection }: { selection: SelectionSnapshot }) {
  if (selection.cornerRadius === undefined) return null;
  return (
    <Popover onOpenChange={(open) => !open && endGesture()}>
      <PopoverTrigger asChild>
        <ToolButton label="Zaoblení rohů">
          <SquareRoundCorner />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="w-60" align="start">
        <SliderField
          label="Zaoblení rohů"
          value={selection.cornerRadius}
          min={0}
          max={500}
          onLive={(cornerRadius) => void changeSelection({ cornerRadius }, "live")}
          onCommit={(cornerRadius) => void changeSelection({ cornerRadius })}
        />
      </PopoverContent>
    </Popover>
  );
}

const HEAD_LABELS: Record<Head, string> = { none: "Žádný", arrow: "Šipka", circle: "Kruh", square: "Čtverec" };

function HeadPreview({ head, flip }: { head: Head | null; flip?: boolean }) {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <line x1="2" y1="6" x2={head === "arrow" ? 20 : 22} y2="6" stroke="currentColor" strokeWidth="2" />
      {head === "arrow" && <polygon points="26,6 18,2 18,10" fill="currentColor" />}
      {head === "circle" && <circle cx="23" cy="6" r="3.5" fill="currentColor" />}
      {head === "square" && <rect x="19.5" y="2.5" width="7" height="7" fill="currentColor" />}
    </svg>
  );
}

/** Heads at either end and the route of lines and connectors. */
function LineEndControls({ connector }: { connector: NonNullable<SelectionSnapshot["connector"]> }) {
  const headRow = (end: "startHead" | "endHead", title: string) => (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{title}</span>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label={title}>
        {HEADS.map((head) => (
          <button
            key={head}
            type="button"
            aria-label={`${title}: ${HEAD_LABELS[head]}`}
            aria-pressed={isMixed(connector[end]) ? "mixed" : connector[end] === head}
            onClick={() => void changeSelection({ [end]: head })}
            className={cn("flex h-8 items-center justify-center rounded-md border", connector[end] === head && "border-ring bg-accent")}
          >
            <HeadPreview head={head} flip={end === "startHead"} />
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolButton label="Konce čáry">
          <MoveRight />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="grid w-64 gap-3" align="start">
        {headRow("startHead", "Začátek")}
        {headRow("endHead", "Konec")}
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Trasa</span>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5 text-xs" role="group" aria-label="Trasa">
            {([["straight", "Rovná"], ["elbow", "Lomená"]] as const).map(([route, routeLabel]) => (
              <button
                key={route}
                type="button"
                aria-pressed={connector.route === route}
                onClick={() => void changeSelection({ route })}
                className={cn("rounded px-2 py-1", connector.route === route && "bg-background shadow-xs")}
              >
                {routeLabel}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ShapeTools({ selection }: { selection: SelectionSnapshot }) {
  const line = selection.kind === "line";
  return (
    <>
      {!line && (
        <ColorPicker
          label="Barva výplně"
          value={selection.fill}
          allowGradient
          allowNone
          onChange={(fill, mode) => void changeSelection({ fill }, mode)}
        />
      )}
      <StrokeControls selection={selection} line={line} />
      {selection.connector && <LineEndControls connector={selection.connector} />}
      <CornerRadiusControl selection={selection} />
    </>
  );
}
