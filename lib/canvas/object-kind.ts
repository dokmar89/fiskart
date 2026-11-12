import { FabricImage, FabricText, Group, Line, Path, Rect, type FabricObject } from "fabric";
import { Connector } from "./connector";
import { Table } from "./table";
import { Chart } from "./chart";

/** Which toolbar an object gets. */
export type ObjectKind = "shape" | "line" | "text" | "image" | "table" | "chart" | "group" | "other";

export function kindOf(o: FabricObject): ObjectKind {
  if (o.placeholderFor) return "other";
  if (o instanceof FabricText) return "text";
  if (o instanceof FabricImage) return "image";
  if (o instanceof Table) return "table";
  if (o instanceof Chart) return "chart";
  if (o instanceof Group) return "group";
  if (o instanceof Line || o instanceof Connector) return "line";
  // An open path such as the arrow has no fill: it is drawn by its stroke only.
  if (o instanceof Path && !o.fill) return "line";
  return "shape";
}

// A framed image is clipped by its frame's shape instead.
export const supportsCornerRadius = (o: FabricObject) => o instanceof Rect || (o instanceof FabricImage && !o.frame);

export type Dash = "solid" | "dashed" | "dotted";

export function dashArray(dash: Dash, width: number): number[] | null {
  const w = Math.max(1, width);
  if (dash === "dashed") return [w * 3, w * 2];
  // Near-zero dashes with round caps draw as dots.
  if (dash === "dotted") return [0.001, w * 2];
  return null;
}

export function dashOf(array: number[] | null | undefined): Dash {
  if (!array || array.length === 0) return "solid";
  return array[0] < 1 ? "dotted" : "dashed";
}
