"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DESIGN_PRESETS, MAX_DESIGN_SIZE, MIN_DESIGN_SIZE } from "@/lib/presets";
import { UNITS, formatSize, fromPx, toPx, type Unit } from "@/lib/units";

type NewDesign = { width: number; height: number; unit: Unit };

export function NewDesignDialog({ autoOpen = false }: { autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState({ width: "1200", height: "800", unit: "px" as Unit });

  async function create(design: NewDesign) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Návrh se nepodařilo vytvořit");
      router.push(`/design/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Návrh se nepodařilo vytvořit");
      setPending(false);
    }
  }

  const customWidth = toPx(Number(custom.width), custom.unit);
  const customHeight = toPx(Number(custom.height), custom.unit);
  const inRange = (px: number) => Number.isFinite(px) && px >= MIN_DESIGN_SIZE && px <= MAX_DESIGN_SIZE;
  const customValid = inRange(customWidth) && inRange(customHeight);
  const limit = (px: number) => Number(fromPx(px, custom.unit).toFixed(custom.unit === "in" ? 2 : custom.unit === "cm" ? 1 : 0));

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Nový návrh
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nový návrh</DialogTitle>
          <DialogDescription>Vyberte velikost. Můžete začít z předvolby, nebo zadat vlastní.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1">
          {DESIGN_PRESETS.slice(0, 8).map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={pending}
              onClick={() => create({ width: preset.width, height: preset.height, unit: preset.unit })}
              className="flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <span className="font-medium">{preset.name}</span>
              <span className="text-xs text-muted-foreground">{formatSize(preset.width, preset.height, preset.unit)}</span>
            </button>
          ))}
        </div>

        <form
          className="grid gap-3 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (customValid) void create({ width: customWidth, height: customHeight, unit: custom.unit });
          }}
        >
          <div className="text-sm font-medium">Vlastní velikost</div>
          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-1">
              <Label htmlFor="custom-width" className="text-xs">Šířka</Label>
              <Input
                id="custom-width"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={custom.width}
                onChange={(e) => setCustom({ ...custom, width: e.target.value })}
              />
            </div>
            <div className="grid flex-1 gap-1">
              <Label htmlFor="custom-height" className="text-xs">Výška</Label>
              <Input
                id="custom-height"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={custom.height}
                onChange={(e) => setCustom({ ...custom, height: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="custom-unit" className="text-xs">Jednotka</Label>
              <select
                id="custom-unit"
                value={custom.unit}
                onChange={(e) => setCustom({ ...custom, unit: e.target.value as Unit })}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs dark:bg-input/30"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          {!customValid && (
            <p className="text-xs text-muted-foreground">
              Každá strana musí mít {limit(MIN_DESIGN_SIZE)} až {limit(MAX_DESIGN_SIZE)} {custom.unit}.
            </p>
          )}
          <Button type="submit" disabled={!customValid || pending}>
            Vytvořit návrh vlastní velikosti
          </Button>
        </form>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
