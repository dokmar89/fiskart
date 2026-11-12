"use client";

import { Eraser, Feather, Highlighter, Pen, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { ColorPicker } from "@/components/toolbar/color-picker";
import { SliderField } from "@/components/toolbar/controls";
import { setDrawing, type DrawSettings } from "@/lib/canvas/draw";
import { useEditorStore } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

const DEFAULT: DrawSettings = { mode: "pen", color: "#18181b", width: 8, opacity: 1 };
// The last pen settings, so reopening the panel picks up where it was left.
let remembered: DrawSettings = DEFAULT;

const TOOLS = [
  { mode: "pen", label: "Pero", icon: Pen },
  { mode: "marker", label: "Zvýrazňovač", icon: Highlighter },
  { mode: "glow", label: "Neonové pero", icon: Sparkles },
  { mode: "calligraphy", label: "Krasopis", icon: Feather },
  { mode: "eraser", label: "Guma", icon: Eraser },
] as const;

const PALETTE = ["#18181b", "#ffffff", "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];

/** The draw tool is on while this panel is open. */
export function DrawPanel() {
  const drawing = useEditorStore((s) => s.drawing);

  useEffect(() => {
    setDrawing(remembered);
    return () => setDrawing(null);
  }, []);

  const settings = drawing ?? remembered;
  const update = (patch: Partial<DrawSettings>) => {
    remembered = { ...settings, ...patch };
    setDrawing(remembered);
  };

  return (
    <div className="grid gap-4 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5 text-xs" role="group" aria-label="Nástroj kreslení">
        {TOOLS.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={settings.mode === mode}
            onClick={() => update({ mode, opacity: mode === "marker" ? 0.4 : settings.opacity })}
            className={cn("flex items-center justify-center gap-1.5 rounded px-2 py-1.5", settings.mode === mode && "bg-background shadow-xs")}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {settings.mode !== "eraser" ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Barva</span>
            <ColorPicker label="Barva pera" value={settings.color} onChange={(paint) => typeof paint === "string" && update({ color: paint })} />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Rychlé barvy kreslení">
            {PALETTE.map((color) => <button key={color} type="button" aria-label={`Barva ${color}`} aria-pressed={settings.color === color} onClick={() => update({ color })} className="size-6 rounded-full border border-foreground/20 ring-offset-background aria-pressed:ring-2 aria-pressed:ring-primary" style={{ backgroundColor: color }} />)}
          </div>
          <SliderField
            label="Šířka štětce"
            value={settings.width}
            min={1}
            max={100}
            onLive={(width) => update({ width })}
            onCommit={(width) => update({ width })}
          />
          <SliderField label="Krytí štětce (%)" value={Math.round(settings.opacity * 100)} min={10} max={100} onLive={(value) => update({ opacity: value / 100 })} onCommit={(value) => update({ opacity: value / 100 })} />
          <p className="text-xs text-muted-foreground">
            Kreslete na stránku. Shift srovná tah vodorovně nebo svisle. Krasopis reaguje na tlak pera. Každý tah lze po zavření panelu upravit jako tvar.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Přetáhněte přes tahy, které chcete vymazat. Mažou se jen nakreslené tahy, a to celé.</p>
      )}
      <p className="text-xs text-muted-foreground">Kreslení ukončíte zavřením panelu nebo klávesou Escape.</p>
    </div>
  );
}
