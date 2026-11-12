import { ActiveSelection, classRegistry, Control, FabricObject, Point, util, type Canvas, type TMat2D, type TPointerEvent, type Transform } from "fabric";
import {
  anchorPoint,
  connectorPoints,
  headInset,
  headShape,
  nearestAnchor,
  type Anchor,
  type Head,
  type Pt,
  type Route,
} from "@/lib/connector-math";

/** Where an end of a connector is attached: an object by id and the anchor on its box. */
export type Link = { id: string; anchor: Anchor };

/** How close (in screen pixels) an end has to come to a shape to attach to it. */
const ATTACH_DISTANCE = 14;

const isLink = (v: unknown): v is Link =>
  !!v && typeof v === "object" && typeof (v as Link).id === "string" && typeof (v as Link).anchor === "string";

/** Head size for a stroke width: big enough to read, growing with the line. */
export const headSize = (strokeWidth: number) => Math.max(10, strokeWidth * 4);

/**
 * A line or connector (phase 14). Its ends are points in the object's own coordinates (centred, the
 * object is never rotated or scaled), dragged by their own handles. An end dropped on a shape is
 * attached to the nearest side midpoint (or the centre) and follows the shape when it moves.
 * Straight or elbow route; each end has its own head.
 */
export class Connector extends FabricObject {
  static type = "Connector";

  declare start: Pt;
  declare end: Pt;
  declare route: Route;
  declare startHead: Head;
  declare endHead: Head;
  declare startLink: Link | null;
  declare endLink: Link | null;

  constructor(options: Record<string, unknown> = {}) {
    super();
    this.set({
      start: { x: -50, y: 0 },
      end: { x: 50, y: 0 },
      route: "straight",
      startHead: "none",
      endHead: "none",
      startLink: null,
      endLink: null,
      fill: null,
      stroke: "#18181b",
      strokeWidth: 4,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      objectCaching: false,
      perPixelTargetFind: true,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
    });
    this.setOptions(options);
    this.startLink = isLink(this.startLink) ? this.startLink : null;
    this.endLink = isLink(this.endLink) ? this.endLink : null;
    this.controls = { start: endControl("start"), end: endControl("end") };
    if (!(options.width && options.height)) this.setEnds(this.pageEnd("start"), this.pageEnd("end"));
  }

  /** An end in page coordinates. */
  pageEnd(which: "start" | "end"): Pt {
    const local = this[which];
    const c = this.getCenterPoint();
    return { x: c.x + local.x, y: c.y + local.y };
  }

  /** The route in the object's own coordinates. */
  routePoints(): Pt[] {
    return connectorPoints(this.route, this.start, this.end, this.startLink?.anchor, this.endLink?.anchor);
  }

  /**
   * Puts the ends at these page points and fits the object's box around the route and its heads,
   * so selection, snapping and export see what is drawn.
   */
  setEnds(startPage: Pt, endPage: Pt) {
    const points = connectorPoints(this.route, startPage, endPage, this.startLink?.anchor, this.endLink?.anchor);
    const pad = Math.max(this.strokeWidth, headSize(this.strokeWidth)) / 2 + 2;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const width = Math.max(...xs) + pad - minX;
    const height = Math.max(...ys) + pad - minY;
    const cx = minX + width / 2;
    const cy = minY + height / 2;
    this.set({
      width,
      height,
      start: { x: startPage.x - cx, y: startPage.y - cy },
      end: { x: endPage.x - cx, y: endPage.y - cy },
      dirty: true,
    });
    this.setPositionByOrigin(new Point(cx, cy), "center", "center");
    this.setCoords();
  }

  /** Re-fits the box after a change of route, width or heads. */
  refit() {
    this.setEnds(this.pageEnd("start"), this.pageEnd("end"));
  }

  _render(ctx: CanvasRenderingContext2D) {
    const points = this.routePoints();
    if (points.length < 2) return;
    const size = headSize(this.strokeWidth);
    // The stroke stops under each head so a thick line does not poke through an arrow's tip.
    const trimmed = points.map((p) => ({ ...p }));
    const trim = (at: number, toward: number, head: Head) => {
      const inset = headInset(head, size);
      if (inset === 0) return;
      const a = trimmed[at];
      const b = points[toward];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length <= inset) return;
      trimmed[at] = { x: a.x + ((b.x - a.x) / length) * inset, y: a.y + ((b.y - a.y) / length) * inset };
    };
    trim(0, 1, this.startHead);
    trim(trimmed.length - 1, points.length - 2, this.endHead);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(trimmed[0].x, trimmed[0].y);
    for (const p of trimmed.slice(1)) ctx.lineTo(p.x, p.y);
    this._setStrokeStyles(ctx, this);
    this._setLineDash(ctx, this.strokeDashArray);
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = this.strokeLineCap;
    ctx.lineJoin = this.strokeLineJoin;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = typeof this.stroke === "string" ? this.stroke : "#18181b";
    this.drawHead(ctx, this.startHead, points[0], points[1], size);
    this.drawHead(ctx, this.endHead, points[points.length - 1], points[points.length - 2], size);
    ctx.restore();
  }

  private drawHead(ctx: CanvasRenderingContext2D, head: Head, tip: Pt, from: Pt, size: number) {
    const shape = headShape(head, tip, from, size);
    ctx.beginPath();
    if (shape.circle) {
      ctx.arc(shape.circle.center.x, shape.circle.center.y, shape.circle.radius, 0, Math.PI * 2);
    } else if (shape.polygon) {
      shape.polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
    } else {
      return;
    }
    ctx.fill();
  }

  toObject(propertiesToInclude: string[] = []) {
    return {
      ...super.toObject(propertiesToInclude as never[]),
      start: { ...this.start },
      end: { ...this.end },
      route: this.route,
      startHead: this.startHead,
      endHead: this.endHead,
      startLink: this.startLink ? { ...this.startLink } : null,
      endLink: this.endLink ? { ...this.endLink } : null,
    };
  }

  static async fromObject(object: Record<string, unknown>) {
    const { type, ...options } = object;
    void type;
    return new Connector(options);
  }

  /** SVG: the route as a polyline, heads as shapes, all in the object's own coordinates. */
  _toSVG(): string[] {
    const points = this.routePoints();
    const n = (v: number) => String(Math.round(v * 1000) / 1000);
    const size = headSize(this.strokeWidth);
    const color = typeof this.stroke === "string" ? this.stroke : "#18181b";
    const heads = ([[this.startHead, points[0], points[1]], [this.endHead, points[points.length - 1], points[points.length - 2]]] as const)
      .map(([head, tip, from]) => {
        const shape = headShape(head, tip, from, size);
        if (shape.circle) return `<circle cx="${n(shape.circle.center.x)}" cy="${n(shape.circle.center.y)}" r="${n(shape.circle.radius)}" fill="${color}" />`;
        if (shape.polygon) return `<polygon points="${shape.polygon.map((p) => `${n(p.x)},${n(p.y)}`).join(" ")}" fill="${color}" />`;
        return "";
      })
      .join("");
    return [
      "<g ",
      "COMMON_PARTS",
      " >",
      `<polyline points="${points.map((p) => `${n(p.x)},${n(p.y)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${this.strokeWidth}" stroke-linecap="${this.strokeLineCap}" stroke-linejoin="${this.strokeLineJoin}"${this.strokeDashArray ? ` stroke-dasharray="${this.strokeDashArray.join(" ")}"` : ""} />`,
      heads,
      "</g>\n",
    ];
  }
}

classRegistry.setClass(Connector);

/** Objects an end can attach to: anything visible on the page but connectors. */
function attachable(canvas: Canvas, self: Connector) {
  return canvas.getObjects().filter((o) => o !== self && !(o instanceof Connector) && o.visible && typeof o.id === "string");
}

/** The shape and anchor an end at `point` would attach to, if any is close enough. */
function findAttachment(canvas: Canvas, self: Connector, point: Pt): { link: Link; at: Pt } | null {
  const threshold = ATTACH_DISTANCE / canvas.getZoom();
  const candidates = attachable(canvas, self).reverse();
  for (const o of candidates) {
    const box = o.getBoundingRect();
    const anchor = nearestAnchor(box, point, threshold);
    if (anchor) return { link: { id: o.id!, anchor }, at: anchorPoint(box, anchor) };
  }
  return null;
}

function endControl(which: "start" | "end"): Control {
  const linkKey = which === "start" ? "startLink" : "endLink";
  return new Control({
    actionName: "moveEnd",
    cursorStyle: "crosshair",
    sizeX: 14,
    sizeY: 14,
    positionHandler(_dim, _finalMatrix, object) {
      // Fabric's final matrix leaves out the zoom; the end is a point in the object's own units.
      const c = object as Connector;
      const vpt = c.canvas?.viewportTransform ?? ([1, 0, 0, 1, 0, 0] as TMat2D);
      return util.transformPoint(new Point(c[which].x, c[which].y), util.multiplyTransformMatrices(vpt, c.calcTransformMatrix()));
    },
    actionHandler(_e: TPointerEvent, transform: Transform, x: number, y: number) {
      const c = transform.target as Connector;
      const canvas = c.canvas;
      if (!canvas) return false;
      const other = c.pageEnd(which === "start" ? "end" : "start");
      // Near a shape the end snaps to its anchor, showing where it will attach.
      const attach = findAttachment(canvas, c, { x, y });
      c[linkKey] = attach ? attach.link : null;
      const point = attach ? attach.at : { x, y };
      if (which === "start") c.setEnds(point, other);
      else c.setEnds(other, point);
      return true;
    },
    render(ctx, left, top) {
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(left, top, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
  });
}

/** Moves the ends of connectors attached to these objects to where the objects are now. */
export function followLinks(canvas: Canvas, moved: Set<string>, skip: Set<unknown> = new Set()) {
  if (moved.size === 0) return;
  const byId = new Map(canvas.getObjects().filter((o) => o.id).map((o) => [o.id!, o]));
  let changed = false;
  for (const o of canvas.getObjects()) {
    if (!(o instanceof Connector) || skip.has(o)) continue;
    const startTarget = o.startLink && moved.has(o.startLink.id) ? byId.get(o.startLink.id) : undefined;
    const endTarget = o.endLink && moved.has(o.endLink.id) ? byId.get(o.endLink.id) : undefined;
    if (!startTarget && !endTarget) continue;
    const start = startTarget && o.startLink ? anchorPoint(startTarget.getBoundingRect(), o.startLink.anchor) : o.pageEnd("start");
    const end = endTarget && o.endLink ? anchorPoint(endTarget.getBoundingRect(), o.endLink.anchor) : o.pageEnd("end");
    o.setEnds(start, end);
    changed = true;
  }
  if (changed) canvas.requestRenderAll();
}

/**
 * Keeps attached connectors on their shapes while the shapes are moved, scaled or rotated. The
 * connectors change in the same moment, so the shape's undo step includes them. Returns a cleanup
 * function.
 */
export function installConnectors(canvas: Canvas) {
  const onTransform = ({ target }: { target?: FabricObject }) => {
    if (!target) return;
    const members = target instanceof ActiveSelection ? target.getObjects() : [target];
    const ids = new Set(members.map((o) => o.id).filter((id): id is string => typeof id === "string"));
    // Connectors that are part of the moved selection move with it instead.
    followLinks(canvas, ids, new Set(members));
  };
  const events = ["object:moving", "object:scaling", "object:rotating", "object:skewing", "object:modified"] as const;
  events.forEach((e) => canvas.on(e, onTransform));
  return () => events.forEach((e) => canvas.off(e, onTransform));
}
