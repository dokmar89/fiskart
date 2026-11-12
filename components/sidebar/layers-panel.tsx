"use client";

import {
  Circle,
  Eye,
  EyeOff,
  Group,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Minus,
  Shapes,
  Spline,
  Square,
  Star,
  Triangle,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { finalIndex, type DropTarget } from "@/lib/canvas/layer-order";
import { moveLayer, renameLayer, selectLayer, toggleLayerLocked, toggleLayerVisible } from "@/lib/canvas/layers";
import { useEditorStore, type LayerInfo } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  rect: Square,
  ellipse: Circle,
  circle: Circle,
  triangle: Triangle,
  polygon: Star,
  line: Minus,
  path: Spline,
  textbox: Type,
  "i-text": Type,
  text: Type,
  image: ImageIcon,
  group: Group,
};

const LAYER_DRAG_TYPE = "application/x-opencanva-layer";

function IconToggle({ label, active, onClick, children }: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground",
        !active && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      {children}
    </button>
  );
}

function LayerRow({ layer, index, selected, dropTarget, onDragTarget, onDragEnd }: {
  layer: LayerInfo;
  index: number;
  selected: boolean;
  dropTarget: DropTarget | null;
  onDragTarget: (target: DropTarget | null) => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const Icon = ICONS[layer.type.toLowerCase()] ?? Shapes;

  return (
    <li
      draggable={!editing}
      data-testid="layer-row"
      data-layer-id={layer.id}
      onDragStart={(e) => {
        e.dataTransfer.setData(LAYER_DRAG_TYPE, JSON.stringify({ id: layer.id, from: index }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(LAYER_DRAG_TYPE)) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onDragTarget({ index, position: e.clientY < rect.top + rect.height / 2 ? "before" : "after" });
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(LAYER_DRAG_TYPE);
        if (!raw || !dropTarget) return;
        e.preventDefault();
        const { id, from } = JSON.parse(raw) as { id: string; from: number };
        moveLayer(id, finalIndex(from, dropTarget));
        onDragEnd();
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => selectLayer(layer.id, e.shiftKey || e.metaKey || e.ctrlKey)}
      className={cn(
        "group relative flex h-9 cursor-default items-center gap-2 rounded-md px-2 text-sm hover:bg-accent",
        selected && "bg-accent",
        !layer.visible && "text-muted-foreground",
      )}
      aria-selected={selected}
      role="option"
    >
      {dropTarget?.index === index && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-1 h-0.5 rounded bg-primary",
            dropTarget.position === "before" ? "-top-px" : "-bottom-px",
          )}
        />
      )}
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      {editing ? (
        <input
          autoFocus
          aria-label="Název vrstvy"
          defaultValue={layer.name}
          maxLength={100}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            renameLayer(layer.id, e.target.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = layer.name;
              e.currentTarget.blur();
            }
          }}
          className="h-7 min-w-0 flex-1 rounded border bg-background px-1.5 text-sm outline-none focus:border-ring"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate" onDoubleClick={() => setEditing(true)}>
          {layer.name}
        </span>
      )}
      <IconToggle label={layer.locked ? "Odemknout" : "Zamknout"} active={layer.locked} onClick={() => toggleLayerLocked(layer.id)}>
        {layer.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
      </IconToggle>
      <IconToggle label={layer.visible ? "Skrýt" : "Zobrazit"} active={!layer.visible} onClick={() => toggleLayerVisible(layer.id)}>
        {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </IconToggle>
    </li>
  );
}

export function LayersPanel() {
  const layers = useEditorStore((s) => s.layers);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  return (
    <div className="p-3">
      <h2 className="mb-2 text-xs font-medium text-muted-foreground">Vrstvy</h2>
      {layers.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Na této stránce zatím nic není.</p>
      ) : (
        <ul role="listbox" aria-label="Vrstvy" aria-multiselectable className="grid gap-0.5" onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
        }}>
          {layers.map((layer, index) => (
            <LayerRow
              key={layer.id || index}
              layer={layer}
              index={index}
              selected={selectedIds.includes(layer.id)}
              dropTarget={dropTarget}
              onDragTarget={setDropTarget}
              onDragEnd={() => setDropTarget(null)}
            />
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Co je v seznamu nahoře, je vpředu. Přetažením změníte pořadí, dvojklikem přejmenujete.</p>
    </div>
  );
}
