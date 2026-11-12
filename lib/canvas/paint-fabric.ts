import { Color, Gradient, type TFiller } from "fabric";
import { angleToCoords, coordsToAngle, type Paint } from "./paint";

type FabricFill = string | TFiller | null | undefined;

/** Any CSS colour Fabric understands as "#rrggbb", or null when transparent or unset. */
export function toHex(color: unknown): string | null {
  if (typeof color !== "string" || color === "" || color === "transparent") return null;
  const parsed = new Color(color);
  if (parsed.getAlpha() === 0) return null;
  return `#${parsed.toHex().toLowerCase()}`;
}

/** A Fabric fill as the toolbar's Paint. Only linear gradients are understood; others read as null. */
export function toPaint(fill: FabricFill): Paint {
  if (fill instanceof Gradient && fill.type === "linear") {
    const c = fill.coords as { x1: number; y1: number; x2: number; y2: number };
    return {
      type: "linear",
      angle: fill.gradientUnits === "percentage" ? coordsToAngle(c) : 0,
      stops: fill.colorStops.map((s) => ({ offset: s.offset, color: toHex(s.color) ?? "#000000" })),
    };
  }
  return typeof fill === "string" ? toHex(fill) : null;
}

/** The toolbar's Paint as a Fabric fill. Gradients use percentage units, so they follow the object's size. */
export function toFabricFill(paint: Paint): string | Gradient<"linear"> | null {
  if (paint === null || typeof paint === "string") return paint;
  return new Gradient({
    type: "linear",
    gradientUnits: "percentage",
    coords: angleToCoords(paint.angle),
    colorStops: paint.stops.map((s) => ({ offset: s.offset, color: s.color })),
  });
}
