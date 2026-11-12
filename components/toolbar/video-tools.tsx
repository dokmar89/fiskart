"use client";

import { Film, Repeat, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { changeSelection } from "@/lib/canvas/props";
import { useEditorStore } from "@/lib/store/editor";
import { formatClipTime, type VideoSettings } from "@/lib/video";
import { ToolButton } from "./controls";

function SecondsField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (seconds: number) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={0.1}
        defaultValue={Math.round(value * 10) / 10}
        key={value}
        onBlur={(e) => {
          const v = Math.min(max, Math.max(min, Number(e.target.value)));
          if (Number.isFinite(v) && Math.abs(v - value) > 0.001) onCommit(v);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground tabular-nums dark:bg-input/30"
      />
    </label>
  );
}

/** Trim, sound and looping of a selected video clip. */
export function VideoTools({ video }: { video: VideoSettings }) {
  const set = (patch: Partial<VideoSettings>) => void changeSelection({ video: patch });
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <ToolButton label="Zkrátit video">
            <Film />
          </ToolButton>
        </PopoverTrigger>
        <PopoverContent className="grid w-64 gap-3" align="start" aria-label="Zkrátit video">
          <p className="text-xs text-muted-foreground">
            Přehraje {formatClipTime(video.trimEnd - video.trimStart)} z {formatClipTime(video.duration)}, od začátku stránky.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SecondsField label="Začátek (s)" value={video.trimStart} min={0} max={video.trimEnd} onCommit={(trimStart) => set({ trimStart })} />
            <SecondsField label="Konec (s)" value={video.trimEnd} min={video.trimStart} max={video.duration} onCommit={(trimEnd) => set({ trimEnd })} />
          </div>
          <button type="button" className="justify-self-start text-xs underline" onClick={() => useEditorStore.setState({ previewing: true })}>
            Přehrát stránku
          </button>
        </PopoverContent>
      </Popover>
      <ToolButton label={video.muted ? "Zvuk vypnutý" : "Zvuk zapnutý"} pressed={video.muted} onClick={() => set({ muted: !video.muted })}>
        {video.muted ? <VolumeX /> : <Volume2 />}
      </ToolButton>
      <ToolButton label="Opakovat" pressed={video.loop} onClick={() => set({ loop: !video.loop })}>
        <Repeat />
      </ToolButton>
    </>
  );
}
