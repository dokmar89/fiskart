"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Blend,
  Copy,
  Layers2,
  Link2,
  Lock,
  LockOpen,
  Unlink2,
  Move,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setPlacement } from "@/lib/canvas/position";
import type { Placement } from "@/lib/position-math";
import { useEditorStore } from "@/lib/store/editor";
import { fromPx, toPx, type Unit } from "@/lib/units";
import type { AlignMode } from "@/lib/canvas/align-math";
import { alignToPage, alignToSelection, arrangeSelection, distributeSelection, setSelectionLocked } from "@/lib/canvas/arrange";
import { deleteSelection, duplicateSelection } from "@/lib/canvas/commands";
import { getEditorInstance } from "@/lib/canvas/instance";
import { changeSelection, endGesture } from "@/lib/canvas/props";
import type { SelectionSnapshot } from "@/lib/canvas/selection";
import { AnimateControl } from "./animate-tools";
import { Divider, NumberField, SliderField, ToolButton } from "./controls";

// Lucide names these by the edge the shapes share: "start vertical" lines their left edges up.
const ALIGN: { mode: AlignMode; label: string; icon: LucideIcon }[] = [
  { mode: "left", label: "Vlevo", icon: AlignStartVertical },
  { mode: "center", label: "Na střed", icon: AlignCenterVertical },
  { mode: "right", label: "Vpravo", icon: AlignEndVertical },
  { mode: "top", label: "Nahoru", icon: AlignStartHorizontal },
  { mode: "middle", label: "Doprostřed", icon: AlignCenterHorizontal },
  { mode: "bottom", label: "Dolů", icon: AlignEndHorizontal },
];

function AlignRow({ title, onAlign }: { title: string; onAlign: (mode: AlignMode) => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{title}</span>
      <div className="grid grid-cols-6 gap-1" role="group" aria-label={title}>
        {ALIGN.map(({ mode, label, icon: Icon }) => (
          <ToolButton key={mode} label={`${title}: ${label.toLowerCase()}`} onClick={() => onAlign(mode)}>
            <Icon />
          </ToolButton>
        ))}
      </div>
    </div>
  );
}

const LIMIT = 100_000;

/** X, Y, width, height and rotation of the selection, typed in the design's unit. */
function PlacementFields({ placement, fixedHeight }: { placement: Placement; fixedHeight: boolean }) {
  const unit: Unit = useEditorStore((s) => s.design?.unit ?? "px");
  const [locked, setLocked] = useState(true);
  const step = unit === "px" ? 1 : 0.01;
  const shown = (px: number) => Number(fromPx(px, unit).toFixed(unit === "px" ? 1 : 2));
  const field = (label: string, key: "x" | "y" | "width" | "height", min: number) => (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <NumberField
        label={label}
        value={shown(placement[key])}
        min={min}
        max={LIMIT}
        step={step}
        className="w-full text-left"
        onCommit={(v) => setPlacement({ [key]: toPx(v, unit) }, locked)}
      />
    </label>
  );
  return (
    <div className="grid gap-2" role="group" aria-label="Velikost a pozice">
      <span className="text-xs text-muted-foreground">Velikost a pozice ({unit})</span>
      <div className="grid grid-cols-2 gap-2">
        {field("X", "x", -LIMIT)}
        {field("Y", "y", -LIMIT)}
        {field("Šířka", "width", fromPx(1, unit))}
        {fixedHeight ? (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Výška
            <span className="flex h-8 items-center px-2 text-sm tabular-nums" title="Textové pole je vždy stejně vysoké jako jeho text">
              {shown(placement.height)}
            </span>
          </label>
        ) : (
          field("Výška", "height", fromPx(1, unit))
        )}
        <label className="grid gap-1 text-xs text-muted-foreground">
          Otočení (°)
          <NumberField label="Otočení" value={Math.round(placement.angle * 10) / 10} min={-360} max={360} step={1} className="w-full text-left" onCommit={(angle) => setPlacement({ angle }, locked)} />
        </label>
        <div className="flex items-end">
          <ToolButton
            label={locked ? "Poměr stran zamčen" : "Poměr stran odemčen"}
            pressed={locked}
            onClick={() => setLocked(!locked)}
            disabled={fixedHeight}
          >
            {locked ? <Link2 /> : <Unlink2 />}
          </ToolButton>
        </div>
      </div>
    </div>
  );
}

function PositionControl({ count, placement, fixedHeight }: { count: number; placement?: Placement; fixedHeight: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolButton label="Pozice">
          <Move />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="grid w-64 gap-3" align="end">
        {placement && <PlacementFields placement={placement} fixedHeight={fixedHeight} />}
        <AlignRow title="Zarovnat ke stránce" onAlign={alignToPage} />
        {count >= 2 && <AlignRow title="Zarovnat k výběru" onAlign={alignToSelection} />}
        {count >= 3 && (
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Rozmístit</span>
            <div className="flex gap-1">
              <ToolButton label="Rozmístit vodorovně" onClick={() => distributeSelection("horizontal")}>
                <AlignHorizontalDistributeCenter />
              </ToolButton>
              <ToolButton label="Rozmístit svisle" onClick={() => distributeSelection("vertical")}>
                <AlignVerticalDistributeCenter />
              </ToolButton>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ArrangeMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolButton label="Uspořádat">
          <Layers2 />
        </ToolButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => arrangeSelection("forward")}>
          <ArrowUp /> Posunout dopředu
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => arrangeSelection("backward")}>
          <ArrowDown /> Posunout dozadu
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => arrangeSelection("front")}>
          <ArrowUpToLine /> Na popředí
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => arrangeSelection("back")}>
          <ArrowDownToLine /> Na pozadí
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OpacityControl({ selection }: { selection: SelectionSnapshot }) {
  return (
    <Popover onOpenChange={(open) => !open && endGesture()}>
      <PopoverTrigger asChild>
        <ToolButton label="Neprůhlednost">
          <Blend />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="w-60" align="end">
        <SliderField
          label="Neprůhlednost"
          value={selection.opacity}
          min={0}
          max={100}
          onLive={(opacity) => void changeSelection({ opacity }, "live")}
          onCommit={(opacity) => void changeSelection({ opacity })}
        />
      </PopoverContent>
    </Popover>
  );
}

const withCanvas = (run: (canvas: NonNullable<ReturnType<typeof getEditorInstance>>["canvas"]) => unknown) => () => {
  const canvas = getEditorInstance()?.canvas;
  if (canvas) void run(canvas);
};

/** Controls for any selection: position, arrangement, opacity, lock, duplicate, delete. */
export function CommonTools({ selection }: { selection: SelectionSnapshot }) {
  if (selection.locked) {
    return (
      <ToolButton label="Odemknout" pressed onClick={() => setSelectionLocked(false)}>
        <Lock />
      </ToolButton>
    );
  }
  return (
    <>
      <PositionControl count={selection.count} placement={selection.placement} fixedHeight={selection.fixedHeight === true} />
      <ArrangeMenu />
      <OpacityControl selection={selection} />
      <AnimateControl animation={selection.animation} text={selection.allText} />
      <Divider />
      <ToolButton label="Zamknout" onClick={() => setSelectionLocked(true)}>
        <LockOpen />
      </ToolButton>
      <ToolButton label="Duplikovat" onClick={withCanvas(duplicateSelection)}>
        <Copy />
      </ToolButton>
      <ToolButton label="Smazat" onClick={withCanvas(deleteSelection)}>
        <Trash2 />
      </ToolButton>
    </>
  );
}
