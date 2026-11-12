"use client";

import { Eye, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setRulersShown, clearGuides } from "@/lib/canvas/guides";
import { PlayButton } from "./presentation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { zoomStep, zoomToFit } from "@/lib/canvas/viewport";
import { MAX_ZOOM, MIN_ZOOM } from "@/lib/canvas/viewport-math";
import { useEditorStore } from "@/lib/store/editor";

function IconButton({ label, onClick, disabled, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ViewMenu() {
  const showRulers = useEditorStore((s) => s.showRulers);
  const guides = useEditorStore((s) => s.guides);
  const hasGuides = guides.vertical.length + guides.horizontal.length > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7">
          <Eye />
          Zobrazení
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuCheckboxItem checked={showRulers} onCheckedChange={(checked) => setRulersShown(checked === true)}>
          Pravítka a vodítka
          <DropdownMenuShortcut>Shift+R</DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem disabled={!hasGuides} onSelect={clearGuides}>
          Odstranit vodítka na této stránce
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BottomBar() {
  const zoom = useEditorStore((s) => s.zoom);

  return (
    <footer className="flex h-10 shrink-0 items-center justify-end gap-1 border-t bg-background px-2">
      <ViewMenu />
      <PlayButton />
      <div className="flex-1" />
      <IconButton label="Oddálit" onClick={() => zoomStep(-1)} disabled={zoom <= MIN_ZOOM}>
        <Minus />
      </IconButton>
      <span className="w-12 text-center text-xs tabular-nums" data-testid="zoom-level">
        {Math.round(zoom * 100)}%
      </span>
      <IconButton label="Přiblížit" onClick={() => zoomStep(1)} disabled={zoom >= MAX_ZOOM}>
        <Plus />
      </IconButton>
      <IconButton label="Přizpůsobit obrazovce" onClick={zoomToFit}>
        <Maximize />
      </IconButton>
    </footer>
  );
}
