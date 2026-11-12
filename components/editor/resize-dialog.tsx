"use client";

import { Scaling } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyAndResizeDesign, resizeDesign } from "@/lib/canvas/resize";
import { cn } from "@/lib/utils";
import { DESIGN_PRESETS, isValidDesignSize, MAX_DESIGN_SIZE, MIN_DESIGN_SIZE } from "@/lib/presets";
import { sameSize } from "@/lib/resize";
import { UNITS, formatSize, fromPx, toPx, type Unit } from "@/lib/units";

type Design = { width: number; height: number; unit: Unit };

/** A value in the given unit as typed into a field: whole pixels, up to two decimals otherwise. */
function fieldValue(px: number, unit: Unit): string {
  return Number(fromPx(px, unit).toFixed(unit === "px" ? 0 : 2)).toString();
}

/**
 * The size being entered. A preset or the current size is kept exactly in pixels (A4 is not a whole
 * number of them), so it is not rounded by what the fields show; typing replaces it.
 */
type Entry = { width: string; height: string; unit: Unit; exact: { width: number; height: number } | null };

function entryFor(size: Design): Entry {
  return { width: fieldValue(size.width, size.unit), height: fieldValue(size.height, size.unit), unit: size.unit, exact: { width: size.width, height: size.height } };
}

function targetOf(entry: Entry): Design {
  return entry.exact
    ? { ...entry.exact, unit: entry.unit }
    : { width: toPx(Number(entry.width), entry.unit), height: toPx(Number(entry.height), entry.unit), unit: entry.unit };
}

export function ResizeDialog({ design }: { design: Design }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"resize" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<Entry>(() => entryFor(design));

  const target = targetOf(entry);
  const valid = isValidDesignSize(target.width) && isValidDesignSize(target.height);
  // Changing only the unit is a change too: it decides how sizes are shown and entered.
  const unchanged = sameSize(target, design) && target.unit === design.unit;
  const limit = (px: number) => fieldValue(px, entry.unit);

  function changeOpen(next: boolean) {
    if (pending) return;
    if (next) {
      setEntry(entryFor(design));
      setError(null);
    }
    setOpen(next);
  }

  function changeUnit(unit: Unit) {
    // The size stays; only how it is shown changes.
    const exact = valid ? { width: target.width, height: target.height } : null;
    setEntry(exact ? { width: fieldValue(exact.width, unit), height: fieldValue(exact.height, unit), unit, exact } : { ...entry, unit });
  }

  async function run(kind: "resize" | "copy") {
    if (!valid || pending) return;
    setPending(kind);
    setError(null);
    try {
      if (kind === "resize") {
        await resizeDesign(target);
        setPending(null);
        setOpen(false);
      } else {
        const id = await copyAndResizeDesign(target);
        router.push(`/design/${id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Velikost návrhu se nepodařilo změnit");
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Scaling />
          Změnit velikost
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Změnit velikost</DialogTitle>
          <DialogDescription>
            Nyní {formatSize(design.width, design.height, design.unit)}. Změní se velikost všech stránek; obsah se rovnoměrně
            zvětší či zmenší a vycentruje a pozadí přes celou stránku se roztáhne, aby ji pokrylo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1" role="radiogroup" aria-label="Předvolby">
          {DESIGN_PRESETS.map((preset) => {
            const selected = sameSize(target, preset);
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending !== null}
                onClick={() => setEntry(entryFor(preset))}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50",
                  selected && "bg-accent",
                )}
              >
                <span className="font-medium">{preset.name}</span>
                <span className="text-xs text-muted-foreground">{formatSize(preset.width, preset.height, preset.unit)}</span>
              </button>
            );
          })}
        </div>

        <form
          id="resize-form"
          className="grid gap-3 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!unchanged) void run("resize");
          }}
        >
          <div className="text-sm font-medium">Vlastní velikost</div>
          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-1">
              <Label htmlFor="resize-width" className="text-xs">Šířka</Label>
              <Input
                id="resize-width"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={entry.width}
                disabled={pending !== null}
                onChange={(e) => setEntry({ ...entry, width: e.target.value, exact: null })}
              />
            </div>
            <div className="grid flex-1 gap-1">
              <Label htmlFor="resize-height" className="text-xs">Výška</Label>
              <Input
                id="resize-height"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={entry.height}
                disabled={pending !== null}
                onChange={(e) => setEntry({ ...entry, height: e.target.value, exact: null })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="resize-unit" className="text-xs">Jednotka</Label>
              <select
                id="resize-unit"
                value={entry.unit}
                disabled={pending !== null}
                onChange={(e) => changeUnit(e.target.value as Unit)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs dark:bg-input/30"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          {!valid && (
            <p className="text-xs text-muted-foreground">
              Každá strana musí mít {limit(MIN_DESIGN_SIZE)} až {limit(MAX_DESIGN_SIZE)} {entry.unit}.
            </p>
          )}
        </form>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={!valid || pending !== null}
            onClick={() => void run("copy")}
            title="Vytvořit kopii s novou velikostí a otevřít ji; tento návrh zůstane beze změny"
          >
            {pending === "copy" ? "Kopíruji…" : "Kopírovat a změnit velikost"}
          </Button>
          <Button type="submit" form="resize-form" disabled={!valid || unchanged || pending !== null}>
            {pending === "resize" ? "Měním velikost…" : "Změnit velikost tohoto návrhu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
