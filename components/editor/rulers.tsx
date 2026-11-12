"use client";

import { useEffect, useRef, useState } from "react";
import { commitHistoryStep } from "@/lib/canvas/document";
import { guidesOf, setCanvasGuides } from "@/lib/canvas/guide-state";
import { getEditorInstance } from "@/lib/canvas/instance";
import { rulerTicks, withGuide, type GuideAxis } from "@/lib/guides";
import { useEditorStore } from "@/lib/store/editor";
import type { Unit } from "@/lib/units";

/** Thickness of the rulers in screen pixels; the canvas starts this far in. */
export const RULER_SIZE = 20;

function useLength(ref: React.RefObject<HTMLElement | null>, axis: "x" | "y") {
  const [length, setLength] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setLength(axis === "x" ? element.clientWidth : element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, axis]);
  return length;
}

/**
 * Moves a guide while the pointer is down: live on the canvas, one undo step when released.
 * Releasing it over a ruler (or outside the view) removes it.
 */
function dragGuide(
  e: React.PointerEvent,
  axis: GuideAxis,
  index: number | null,
  area: HTMLElement,
) {
  const editor = getEditorInstance();
  if (!editor) return;
  e.preventDefault();
  const { canvas } = editor;
  const element = e.currentTarget as HTMLElement;
  element.setPointerCapture(e.pointerId);
  commitHistoryStep();

  // A new guide is appended and then moved like an existing one.
  let at = index ?? guidesOf(canvas)[axis].length;
  const toPage = (ev: PointerEvent | React.PointerEvent) => {
    const rect = area.getBoundingClientRect();
    const v = canvas.viewportTransform;
    return axis === "vertical" ? (ev.clientX - rect.left - v[4]) / v[0] : (ev.clientY - rect.top - v[5]) / v[3];
  };
  const inside = (ev: PointerEvent) => {
    const rect = area.getBoundingClientRect();
    return ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
  };
  if (index === null) setCanvasGuides(canvas, withGuide(guidesOf(canvas), axis, null, toPage(e)));

  const onMove = (ev: PointerEvent) => setCanvasGuides(canvas, withGuide(guidesOf(canvas), axis, at, toPage(ev)));
  const onUp = (ev: PointerEvent) => {
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onUp);
    element.removeEventListener("pointercancel", onUp);
    if (!inside(ev)) {
      setCanvasGuides(canvas, withGuide(guidesOf(canvas), axis, at, null));
      at = -1;
    }
    commitHistoryStep();
  };
  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onUp);
}

function Ruler({ axis, unit, area }: { axis: "x" | "y"; unit: Unit; area: React.RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const length = useLength(ref, axis);
  const viewport = useEditorStore((s) => s.viewport);
  const scale = axis === "x" ? viewport[0] : viewport[3];
  const offset = axis === "x" ? viewport[4] : viewport[5];
  const ticks = length > 0 && scale > 0 ? rulerTicks(-offset / scale, scale, length, unit) : [];
  // The top ruler makes horizontal guides (dragged down from it), the left one vertical guides.
  const guideAxis: GuideAxis = axis === "x" ? "horizontal" : "vertical";
  const horizontal = axis === "x";

  return (
    <div
      ref={ref}
      title={horizontal ? "Tažením dolů přidáte vodorovné vodítko" : "Tažením doprava přidáte svislé vodítko"}
      data-testid={horizontal ? "ruler-top" : "ruler-left"}
      className={
        horizontal
          ? "absolute top-0 right-0 h-5 cursor-row-resize overflow-hidden border-b bg-background text-muted-foreground select-none"
          : "absolute bottom-0 left-0 w-5 cursor-col-resize overflow-hidden border-r bg-background text-muted-foreground select-none"
      }
      style={horizontal ? { left: RULER_SIZE } : { top: RULER_SIZE }}
      onPointerDown={(e) => area.current && dragGuide(e, guideAxis, null, area.current)}
    >
      <svg className="absolute inset-0 size-full" aria-hidden>
        {ticks.map((t, i) =>
          horizontal ? (
            <g key={i}>
              <line x1={t.at + 0.5} x2={t.at + 0.5} y1={t.label === null ? 14 : 4} y2={20} stroke="currentColor" strokeOpacity={0.6} />
              {t.label !== null && (
                <text x={t.at + 3} y={10} fontSize={9} fill="currentColor">
                  {t.label}
                </text>
              )}
            </g>
          ) : (
            <g key={i}>
              <line y1={t.at + 0.5} y2={t.at + 0.5} x1={t.label === null ? 14 : 4} x2={20} stroke="currentColor" strokeOpacity={0.6} />
              {t.label !== null && (
                <text x={10} y={t.at + 3} fontSize={9} fill="currentColor" transform={`rotate(-90 10 ${t.at + 3})`}>
                  {t.label}
                </text>
              )}
            </g>
          ),
        )}
      </svg>
    </div>
  );
}

/** Thin hit areas over each guide line, so a guide can be dragged (or dragged back to a ruler to remove it). */
function GuideHandles({ area }: { area: React.RefObject<HTMLDivElement | null> }) {
  const guides = useEditorStore((s) => s.guides);
  const v = useEditorStore((s) => s.viewport);
  return (
    <>
      {guides.vertical.map((x, i) => (
        <div
          key={`v${i}`}
          data-testid="guide-vertical"
          title="Tažením přesunete; přetažením na pravítko odstraníte"
          className="absolute top-0 bottom-0 w-[7px] -translate-x-[3px] cursor-col-resize"
          style={{ left: x * v[0] + v[4] }}
          onPointerDown={(e) => area.current && dragGuide(e, "vertical", i, area.current)}
        />
      ))}
      {guides.horizontal.map((y, i) => (
        <div
          key={`h${i}`}
          data-testid="guide-horizontal"
          title="Tažením přesunete; přetažením na pravítko odstraníte"
          className="absolute right-0 left-0 h-[7px] -translate-y-[3px] cursor-row-resize"
          style={{ top: y * v[3] + v[5] }}
          onPointerDown={(e) => area.current && dragGuide(e, "horizontal", i, area.current)}
        />
      ))}
    </>
  );
}

/** Rulers along the top and left of the view, in the design's unit, and the guides' drag handles. */
export function Rulers({ unit, area }: { unit: Unit; area: React.RefObject<HTMLDivElement | null> }) {
  return (
    <>
      <div className="absolute top-0 left-0 size-5 border-r border-b bg-background" aria-hidden />
      <Ruler axis="x" unit={unit} area={area} />
      <Ruler axis="y" unit={unit} area={area} />
    </>
  );
}

export { GuideHandles };
