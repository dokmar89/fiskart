/**
 * Small builders for the built-in templates' page JSON, in the shape Fabric 6 writes and reads.
 * Positions are page pixels from the top-left corner; every object gets a stable id derived from
 * the template, so reseeding an unchanged template produces identical JSON.
 */
import { angleToCoords } from "../../lib/canvas/paint";
import type { CanvasData } from "../../lib/page-data";
import { effectStyle, type TextEffect } from "../../lib/text-effects";
import { framePath, type FrameShape } from "../../lib/frames";

export type Obj = Record<string, unknown>;
export type Fill = string | Obj;

const LOCKED = {
  locked: true,
  selectable: false,
  evented: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
};

export class PageBuilder {
  private objects: Obj[] = [];
  private count = 0;

  constructor(
    private readonly prefix: string,
    readonly width: number,
    readonly height: number,
  ) {}

  private add(type: string, name: string, props: Obj): this {
    this.count += 1;
    this.objects.push({ type, version: "6.9.1", originX: "left", originY: "top", id: `${this.prefix}-${this.count}`, name, ...props });
    return this;
  }

  /**
   * A full-page rectangle marked as the background: locked (it can be picked in the layers panel
   * and unlocked from the toolbar) so clicks on the page select the content in front of it.
   */
  background(fill: Fill): this {
    return this.add("Rect", "Background", { left: 0, top: 0, width: this.width, height: this.height, fill, strokeWidth: 0, role: "background", ...LOCKED });
  }

  rect(name: string, p: { x: number; y: number; w: number; h: number; fill?: Fill | null; r?: number; stroke?: string; strokeWidth?: number; angle?: number; opacity?: number }): this {
    return this.add("Rect", name, {
      left: p.x,
      top: p.y,
      width: p.w,
      height: p.h,
      fill: p.fill ?? null,
      rx: p.r ?? 0,
      ry: p.r ?? 0,
      stroke: p.stroke ?? null,
      strokeWidth: p.strokeWidth ?? 0,
      strokeUniform: true,
      angle: p.angle ?? 0,
      opacity: p.opacity ?? 1,
    });
  }

  /** An ellipse given by its centre and radii (a circle when `ry` is left out). */
  circle(name: string, p: { cx: number; cy: number; r: number; ry?: number; fill?: Fill | null; stroke?: string; strokeWidth?: number; opacity?: number }): this {
    const ry = p.ry ?? p.r;
    return this.add("Ellipse", name, {
      left: p.cx - p.r,
      top: p.cy - ry,
      rx: p.r,
      ry,
      fill: p.fill ?? null,
      stroke: p.stroke ?? null,
      strokeWidth: p.strokeWidth ?? 0,
      strokeUniform: true,
      opacity: p.opacity ?? 1,
    });
  }

  /**
   * An SVG path (`d` in its own coordinates), placed with its top-left corner at x, y, or with
   * `anchor: "bottom"` the middle of its bottom edge, which lines up paths of different heights.
   */
  path(
    name: string,
    p: { x: number; y: number; d: string; anchor?: "bottom"; scale?: number; fill?: Fill | null; stroke?: string; strokeWidth?: number; angle?: number; opacity?: number },
  ): this {
    return this.add("Path", name, {
      ...(p.anchor === "bottom" ? { originX: "center", originY: "bottom" } : {}),
      path: p.d,
      left: p.x,
      top: p.y,
      scaleX: p.scale ?? 1,
      scaleY: p.scale ?? 1,
      fill: p.fill ?? null,
      stroke: p.stroke ?? null,
      strokeWidth: p.strokeWidth ?? 0,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      strokeUniform: true,
      angle: p.angle ?? 0,
      opacity: p.opacity ?? 1,
    });
  }

  polygon(name: string, p: { points: [number, number][]; fill: Fill; opacity?: number; angle?: number }): this {
    const xs = p.points.map(([x]) => x);
    const ys = p.points.map(([, y]) => y);
    return this.add("Polygon", name, {
      points: p.points.map(([x, y]) => ({ x, y })),
      left: Math.min(...xs),
      top: Math.min(...ys),
      fill: p.fill,
      strokeWidth: 0,
      angle: p.angle ?? 0,
      opacity: p.opacity ?? 1,
    });
  }

  /** Empty editable photo placeholder; the editor replaces it with a clipped image. */
  frame(name: string, p: { x: number; y: number; w: number; h: number; shape?: FrameShape }): this {
    const shape = p.shape ?? "rounded";
    return this.add("Path", name, {
      left: p.x, top: p.y, width: p.w, height: p.h,
      path: framePath(shape, p.w, p.h), frame: shape,
      fill: "#d4d4d8", strokeWidth: 0,
    });
  }

  text(
    name: string,
    p: {
      x: number;
      y: number;
      w: number;
      text: string;
      size: number;
      font: string;
      color: string;
      bold?: boolean;
      italic?: boolean;
      align?: "left" | "center" | "right" | "justify";
      lineHeight?: number;
      spacing?: number;
      upper?: boolean;
      list?: "bullet" | "number";
      effect?: TextEffect;
      opacity?: number;
      angle?: number;
    },
  ): this {
    const style = effectStyle(p.effect, p.size);
    return this.add("Textbox", name, {
      left: p.x,
      top: p.y,
      width: p.w,
      text: p.text,
      fontSize: p.size,
      fontFamily: p.font,
      fontWeight: p.bold ? "700" : "400",
      fontStyle: p.italic ? "italic" : "normal",
      fill: style.fill ?? p.color,
      textAlign: p.align ?? "left",
      lineHeight: p.lineHeight ?? 1.16,
      charSpacing: p.spacing ?? 0,
      opacity: p.opacity ?? 1,
      angle: p.angle ?? 0,
      ...(p.upper ? { textCase: "upper" } : {}),
      ...(p.list ? { listStyle: p.list } : {}),
      ...(p.effect
        ? {
            effect: p.effect,
            shadow: style.shadow ? { type: "shadow", ...style.shadow, affectStroke: true, nonScaling: false } : null,
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            paintFirst: style.paintFirst,
            strokeLineJoin: "round",
          }
        : {}),
    });
  }

  build(): CanvasData {
    return { objects: this.objects };
  }
}

/** A linear gradient fill at `angle` degrees (0 = left to right, 90 = top to bottom), following the object's size. */
export function gradient(angle: number, ...colors: string[]): Obj {
  return {
    type: "linear",
    gradientUnits: "percentage",
    coords: angleToCoords(angle),
    colorStops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
    offsetX: 0,
    offsetY: 0,
  };
}

export type BuiltInTemplate = {
  slug: string;
  title: string;
  category: string;
  width: number;
  height: number;
  unit: "px" | "mm" | "in";
  tags: string[];
  pages: CanvasData[];
};
