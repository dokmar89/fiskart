"use client";

import { CircleDashed, Crop, FlipHorizontal2, FlipVertical2, Move, SlidersHorizontal, WandSparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { dismissBackgroundError, removeSelectedBackground } from "@/lib/canvas/bg-removal";
import { endCrop, startCrop } from "@/lib/canvas/crop";
import { svgSource } from "@/lib/canvas/design-image";
import { endReposition, setFrameZoom, startReposition } from "@/lib/canvas/frames";
import { isMixed } from "@/lib/canvas/mixed";
import { changeSelection, endGesture } from "@/lib/canvas/props";
import type { SelectionSnapshot } from "@/lib/canvas/selection";
import { FILTER_PRESETS, PRESET_LABELS, type Adjustments } from "@/lib/image-adjust";
import { DEFAULT_STICKER, type StickerSettings } from "@/lib/sticker";
import { useEditorStore } from "@/lib/store/editor";
import { svgColors } from "@/lib/svg-colors";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { Divider, pressedState, SliderField, ToolButton } from "./controls";
import { QrTools } from "./qr-tools";
import { VideoTools } from "./video-tools";
import { CornerRadiusControl } from "./shape-tools";

/** The colours of the image's source when it is an SVG; null for other images or while loading. */
function useSvgColors(src: string | undefined): string[] | null {
  const [result, setResult] = useState<{ src: string; colors: string[] | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    void svgSource(src).then((text) => live && setResult({ src, colors: text === null ? null : svgColors(text) }));
    return () => {
      live = false;
    };
  }, [src]);
  return result && result.src === src ? result.colors : null;
}

const SLIDERS: { key: "brightness" | "contrast" | "saturation" | "blur" | "temperature" | "tint" | "sharpness" | "vignette"; label: string; min: number }[] = [
  { key: "brightness", label: "Jas", min: -100 },
  { key: "contrast", label: "Kontrast", min: -100 },
  { key: "saturation", label: "Sytost", min: -100 },
  { key: "blur", label: "Rozostření", min: 0 },
  { key: "temperature", label: "Teplota", min: -100 },
  { key: "tint", label: "Odstín zelená / purpur", min: -100 },
  { key: "sharpness", label: "Ostrost", min: 0 },
  { key: "vignette", label: "Vinětace", min: 0 },
];

function AdjustControl({ adjustments }: { adjustments: NonNullable<SelectionSnapshot["adjustments"]> }) {
  const adjust = (patch: Partial<Adjustments>, mode: "live" | "commit" = "commit") => void changeSelection({ adjust: patch }, mode);
  return (
    <Popover onOpenChange={(open) => !open && endGesture()}>
      <PopoverTrigger asChild>
        <ToolButton label="Upravit">
          <SlidersHorizontal />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent className="grid w-72 gap-4" align="start" aria-label="Upravit">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Filtr</span>
          <div className="grid grid-cols-4 gap-1" role="group" aria-label="Filtr">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={isMixed(adjustments.preset) ? "mixed" : adjustments.preset === preset}
                onClick={() => adjust({ preset })}
                className={cn(
                  "rounded-md border px-1 py-1.5 text-[11px] hover:bg-accent",
                  adjustments.preset === preset && "border-ring bg-accent",
                )}
              >
                {PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </div>
        {SLIDERS.map(({ key, label, min }) => (
          <SliderField
            key={key}
            label={label}
            value={adjustments[key]}
            min={min}
            max={100}
            onLive={(value) => adjust({ [key]: value }, "live")}
            onCommit={(value) => adjust({ [key]: value })}
          />
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => adjust({ brightness: 0, contrast: 0, saturation: 0, blur: 0, temperature: 0, tint: 0, sharpness: 0, vignette: 0, preset: "none" })}
        >
          Obnovit úpravy
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function StickerControl({ sticker }: { sticker: StickerSettings | null }) {
  const current = sticker ?? DEFAULT_STICKER;
  const update = (patch: Partial<StickerSettings>, mode: "live" | "commit" = "commit") => void changeSelection({ sticker: { ...current, ...patch } }, mode);
  return (
    <Popover onOpenChange={(open) => !open && endGesture()}>
      <PopoverTrigger asChild>
        <ToolButton label="Nálepka / obrys" pressed={Boolean(sticker)}><CircleDashed /></ToolButton>
      </PopoverTrigger>
      <PopoverContent className="grid w-72 gap-3" align="start" aria-label="Nálepka / obrys">
        <Button type="button" variant={sticker ? "default" : "outline"} size="sm" onClick={() => void changeSelection({ sticker: sticker ? null : DEFAULT_STICKER })}>
          {sticker ? "Vypnout obrys" : "Zapnout obrys"}
        </Button>
        {sticker && <>
          <div className="flex items-center justify-between text-xs"><span>Barva obrysu</span><ColorPicker label="Barva obrysu nálepky" value={current.color} onChange={(paint, mode) => typeof paint === "string" && update({ color: paint }, mode)} /></div>
          <SliderField label="Tloušťka obrysu" value={current.thickness} min={1} max={32} onLive={(v) => update({ thickness: v }, "live")} onCommit={(v) => update({ thickness: v })} />
          <SliderField label="Stín nálepky" value={current.shadowBlur} min={0} max={32} onLive={(v) => update({ shadowBlur: v }, "live")} onCommit={(v) => update({ shadowBlur: v })} />
          <SliderField label="Průhlednost stínu" value={Math.round(current.shadowOpacity * 100)} min={0} max={100} onLive={(v) => update({ shadowOpacity: v / 100 }, "live")} onCommit={(v) => update({ shadowOpacity: v / 100 })} />
        </>}
      </PopoverContent>
    </Popover>
  );
}

function SvgColorControls({ colors, colorMap }: { colors: string[]; colorMap: Record<string, string> }) {
  return (
    <div className="flex items-center" role="group" aria-label="Barvy grafiky">
      {colors.map((color, i) => (
        <ColorPicker
          key={color}
          label={`Barva grafiky ${i + 1}`}
          value={colorMap[color] ?? color}
          onChange={(paint, mode) => typeof paint === "string" && void changeSelection({ svgColor: { from: color, to: paint } }, mode)}
        />
      ))}
    </div>
  );
}

function BackgroundRemovalStatus() {
  const state = useEditorStore((s) => s.removingBackground);
  if (!state) return null;
  if (state.stage === "failed") {
    return (
      <span className="flex items-center gap-1 px-2 text-xs text-destructive" role="alert">
        Odstranění pozadí selhalo: {state.message}
        <ToolButton label="Zavřít" onClick={dismissBackgroundError}>
          <X />
        </ToolButton>
      </span>
    );
  }
  const text = state.stage === "download" ? "Načítám model" : state.stage === "process" ? "Odstraňuji pozadí" : "Ukládám";
  return (
    <span className="flex items-center gap-2 px-2 text-xs text-muted-foreground" role="status" aria-label="Odstranění pozadí">
      {text}
      {state.progress !== null ? ` ${Math.round(state.progress * 100)}%` : "…"}
      <span className="h-1 w-20 overflow-hidden rounded bg-muted">
        <span
          className={cn("block h-full bg-primary", state.progress === null && "animate-pulse")}
          style={{ width: `${state.progress === null ? 100 : Math.round(state.progress * 100)}%` }}
        />
      </span>
    </span>
  );
}

export function ImageTools({ selection }: { selection: SelectionSnapshot }) {
  const cropping = useEditorStore((s) => s.cropping);
  const repositioning = useEditorStore((s) => s.repositioning);
  const removing = useEditorStore((s) => s.removingBackground);
  const single = selection.image;
  const colors = useSvgColors(single?.src);
  const busy = removing !== null && removing.stage !== "failed";

  if (cropping) {
    return (
      <>
        <span className="px-2 text-xs text-muted-foreground">Oříznutí upravte tažením úchytů.</span>
        <Button size="sm" onClick={endCrop}>
          Hotovo
        </Button>
      </>
    );
  }
  if (repositioning) {
    return (
      <>
        <span className="px-2 text-xs text-muted-foreground">Tažením posuňte obrázek v rámečku.</span>
        <span className="text-xs text-muted-foreground">Přiblížení</span>
        <Slider
          aria-label="Přiblížení v rámečku"
          className="w-32"
          value={[repositioning.zoom]}
          min={1}
          max={4}
          step={0.01}
          onValueChange={([zoom]) => setFrameZoom(zoom, "live")}
          onValueCommit={([zoom]) => setFrameZoom(zoom, "commit")}
        />
        <Button size="sm" onClick={endReposition}>
          Hotovo
        </Button>
      </>
    );
  }
  return (
    <>
      {single?.qr && <QrTools qr={single.qr} />}
      {single?.video && <VideoTools video={single.video} />}
      {single && colors === null && !single.qr && !single.video && (
        <ToolButton label="Odstranit pozadí" onClick={() => void removeSelectedBackground()} disabled={busy}>
          <WandSparkles />
        </ToolButton>
      )}
      <BackgroundRemovalStatus />
      {selection.adjustments && <AdjustControl adjustments={selection.adjustments} />}
      {single && !single.video && !single.qr && <StickerControl sticker={single.sticker} />}
      {single?.frame ? (
        <ToolButton label="Posunout v rámečku" onClick={startReposition}>
          <Move />
        </ToolButton>
      ) : (
        <ToolButton label="Oříznout" onClick={startCrop} disabled={selection.count !== 1}>
          <Crop />
        </ToolButton>
      )}
      <ToolButton
        label="Převrátit vodorovně"
        pressed={pressedState(selection.flipX)}
        onClick={() => void changeSelection({ flipX: selection.flipX !== true })}
      >
        <FlipHorizontal2 />
      </ToolButton>
      <ToolButton
        label="Převrátit svisle"
        pressed={pressedState(selection.flipY)}
        onClick={() => void changeSelection({ flipY: selection.flipY !== true })}
      >
        <FlipVertical2 />
      </ToolButton>
      <CornerRadiusControl selection={selection} />
      {single && !single.qr && colors && colors.length > 0 && (
        <>
          <Divider />
          <SvgColorControls colors={colors} colorMap={single.colorMap} />
        </>
      )}
    </>
  );
}
