import { Gradient, Group, type FabricObject } from "fabric";
import { getEditorInstance } from "./instance";
import { toHex } from "./paint-fabric";

/** Colours used on the current page (fills, strokes, gradient stops), most used first. */
export function documentColors(limit = 14): string[] {
  const counts = new Map<string, number>();
  const add = (color: unknown) => {
    const hex = toHex(color);
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  };
  const visit = (o: FabricObject) => {
    if (o.fill instanceof Gradient) o.fill.colorStops.forEach((s) => add(s.color));
    else add(o.fill);
    add(o.stroke);
    if (o instanceof Group) o.getObjects().forEach(visit);
  };
  getEditorInstance()?.canvas.getObjects().forEach(visit);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([hex]) => hex);
}
