"use client";

import { CloudUpload, Image, LayoutTemplate, Layers, Palette, PenLine, Shapes, Sparkle, Sticker, Type, type LucideIcon } from "lucide-react";
import { useEditorStore, type PanelId } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

const ITEMS: { id: PanelId; label: string; icon: LucideIcon }[] = [
  { id: "design", label: "Návrh", icon: LayoutTemplate },
  { id: "brand", label: "Značka", icon: Palette },
  { id: "elements", label: "Prvky", icon: Shapes },
  { id: "text", label: "Text", icon: Type },
  { id: "draw", label: "Kreslení", icon: PenLine },
  { id: "photos", label: "Fotky", icon: Image },
  { id: "graphics", label: "Grafika", icon: Sticker },
  { id: "uploads", label: "Nahrané", icon: CloudUpload },
  { id: "layers", label: "Vrstvy", icon: Layers },
  { id: "ai", label: "AI", icon: Sparkle },
];

export function Rail() {
  const activePanel = useEditorStore((s) => s.activePanel);
  const togglePanel = useEditorStore((s) => s.togglePanel);

  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r bg-background py-2" aria-label="Nástroje">
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={activePanel === id}
          onClick={() => togglePanel(id)}
          className={cn(
            "flex w-14 flex-col items-center gap-1 rounded-md py-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            activePanel === id && "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="size-5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
