"use client";

import { useEditorStore } from "@/lib/store/editor";
import { CommonTools } from "./common-tools";
import { Divider } from "./controls";
import { ImageTools } from "./image-tools";
import { ShapeTools } from "./shape-tools";
import { ChartTools } from "./chart-tools";
import { TableTools } from "./table-tools";
import { TextTools } from "./text-tools";

/** Contextual toolbar above the canvas. It renders from the read-only selection snapshot only. */
export function Toolbar() {
  const selection = useEditorStore((s) => s.selection);

  return (
    <div
      className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b bg-background px-2"
      role="toolbar"
      aria-label="Výběr"
      data-kind={selection?.kind ?? "none"}
    >
      {selection === null ? (
        <span className="px-2 text-xs text-muted-foreground">Vyberte něco na stránce a můžete to upravit.</span>
      ) : (
        <>
          {!selection.locked && (selection.kind === "shape" || selection.kind === "line") && <ShapeTools selection={selection} />}
          {!selection.locked && selection.kind === "text" && <TextTools selection={selection} />}
          {!selection.locked && selection.kind === "image" && <ImageTools selection={selection} />}
          {!selection.locked && selection.table && <TableTools table={selection.table} />}
          {!selection.locked && selection.chart && <ChartTools />}
          <div className="flex-1" />
          {!selection.locked && selection.kind !== "mixed" && selection.kind !== "group" && selection.kind !== "other" && <Divider />}
          <CommonTools selection={selection} />
        </>
      )}
    </div>
  );
}
