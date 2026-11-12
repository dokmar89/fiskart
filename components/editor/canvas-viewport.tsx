"use client";

import { useEffect, useRef, useState } from "react";
import { mountEditor } from "@/lib/canvas/setup";
import type { Size } from "@/lib/canvas/viewport-math";
import { useEditorStore } from "@/lib/store/editor";
import type { Unit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { GuideHandles, Rulers } from "./rulers";
import { TableCellEditor } from "./table-cell-editor";

/**
 * `initial` is the size the editor mounts with; a resize changes the mounted canvas in place.
 * `unit` is the design's current unit, for the rulers.
 */
export function CanvasViewport({ initial, projectId, unit }: { initial: Size & { unit: Unit }; projectId: string; unit: Unit }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const loadState = useEditorStore((s) => s.loadState);
  const showRulers = useEditorStore((s) => s.showRulers && s.loadState === "ready");
  const [mountSize] = useState(() => ({ width: initial.width, height: initial.height, unit: initial.unit }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return mountEditor(host, mountSize, projectId);
  }, [mountSize, projectId]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={hostRef}
        data-testid="canvas-viewport"
        className={cn("absolute overflow-hidden bg-zinc-200 dark:bg-zinc-900", showRulers ? "top-5 right-0 bottom-0 left-5" : "inset-0")}
      />
      {showRulers && (
        <>
          {/* Same box as the canvas: guide handles sit over the guide lines Fabric draws. */}
          <div ref={areaRef} className="pointer-events-none absolute top-5 right-0 bottom-0 left-5 overflow-hidden [&>*]:pointer-events-auto">
            <GuideHandles area={areaRef} />
          </div>
          <Rulers unit={unit} area={areaRef} />
        </>
      )}
      <TableCellEditor />
      {loadState !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {loadState === "loading" ? (
            "Načítám…"
          ) : (
            <div className="rounded-md bg-background px-4 py-3 shadow-sm" role="alert">
              Tuto stránku se nepodařilo načíst.{" "}
              <button type="button" className="underline" onClick={() => window.location.reload()}>
                Načíst znovu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
