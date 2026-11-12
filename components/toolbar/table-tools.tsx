"use client";

import { Columns3, Rows3, Table2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { changeSelection } from "@/lib/canvas/props";
import type { SelectionSnapshot } from "@/lib/canvas/selection";
import { applyTablePreset, setActiveColumnWidth, setTableFont, tableCommand } from "@/lib/canvas/table-edit";
import { TABLE_PRESETS } from "@/lib/table-styles";
import { useEditorStore } from "@/lib/store/editor";
import { fromPx, toPx } from "@/lib/units";
import { ColorPicker } from "./color-picker";
import { Divider, NumberField, ToolButton } from "./controls";
import { FontPicker } from "./font-picker";

export function TableTools({ table }: { table: NonNullable<SelectionSnapshot["table"]> }) {
  const unit = useEditorStore((s) => s.design?.unit ?? "px");
  const cell = table.activeCell;
  return (
    <>
      <FontPicker value={table.fontFamily} onChange={(fontFamily) => void setTableFont(fontFamily)} />
      <NumberField label="Velikost písma" value={table.fontSize} min={4} max={400} onCommit={(fontSize) => void changeSelection({ tableStyle: { fontSize } })} />
      <ColorPicker label="Barva textu" value={table.textColor} onChange={(c, mode) => typeof c === "string" && void changeSelection({ tableStyle: { textColor: c } }, mode)} />
      <Divider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolButton label="Styl tabulky"><Table2 /></ToolButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TABLE_PRESETS.map((preset) => <DropdownMenuItem key={preset.id} onSelect={() => applyTablePreset(preset.id)}>{preset.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolButton label="Řádky">
            <Rows3 />
          </ToolButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => tableCommand("rowAbove")}>Přidat řádek nad</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => tableCommand("rowBelow")}>Přidat řádek pod</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={table.rows <= 1} onSelect={() => tableCommand("deleteRow")}>
            <Trash2 /> Smazat řádek
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolButton label="Sloupce">
            <Columns3 />
          </ToolButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => tableCommand("columnLeft")}>Přidat sloupec vlevo</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => tableCommand("columnRight")}>Přidat sloupec vpravo</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={table.columns <= 1} onSelect={() => tableCommand("deleteColumn")}>
            <Trash2 /> Smazat sloupec
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NumberField
        label="Šířka sloupce"
        value={Number(fromPx(table.columnWidth, unit).toFixed(unit === "px" ? 0 : 2))}
        min={fromPx(24, unit)}
        max={100_000}
        step={unit === "px" ? 1 : 0.01}
        onCommit={(w) => setActiveColumnWidth(toPx(w, unit))}
      />
      <ColorPicker
        label="Barva buňky"
        value={table.cellFill}
        allowNone
        onChange={(c, mode) => (typeof c === "string" || c === null) && void changeSelection({ tableStyle: { cellFill: c } }, mode)}
      />
      <Divider />
      <ColorPicker label="Barva ohraničení" value={table.borderColor} onChange={(c, mode) => typeof c === "string" && void changeSelection({ tableStyle: { borderColor: c } }, mode)} />
      <NumberField label="Šířka ohraničení" value={table.borderWidth} min={0} max={40} onCommit={(borderWidth) => void changeSelection({ tableStyle: { borderWidth } })} />
      <span className="flex items-center gap-1 px-1 text-xs text-muted-foreground" title="Buňku upravíte dvojklikem; příkazy pro řádky a sloupce se týkají naposledy vybrané buňky">
        <Table2 className="size-3.5" />
        {cell ? `Řádek ${cell.row + 1}, sloupec ${cell.column + 1}` : "Klikněte na buňku"}
      </span>
    </>
  );
}
