import { FabricImage, FabricText, Point, Rect, Shadow, StaticCanvas, type FabricObject } from "fabric";
import { effectiveAnimation, elementStateAt, readElementAnimation, readTiming, textGraphemes, typewriterText, type ElementAnimation, type PageTiming } from "@/lib/animation";
import type { CanvasData } from "@/lib/page-data";
import { clipPlaying, clipTime, readVideoSettings, type VideoSettings } from "@/lib/video";
import { PAGE_BACKGROUND } from "./render";
import { enlivenCanvasObjects } from "./serialize";
import { loadVideoElement, seekVideo } from "./video";
import type { Size } from "./viewport-math";

type Base = { center: Point; scaleX: number; scaleY: number; opacity: number; angle: number; shadow: FabricObject["shadow"]; glowShadow?: Shadow; glowColor: string; clipPath: FabricObject["clipPath"]; text: string | null; graphemes?: string[]; box: { left: number; top: number; width: number; height: number } };
type Clip = { object: FabricImage; element: HTMLVideoElement; settings: VideoSettings };

/** How far (seconds) a playing clip may drift from the page's clock before it is put back in step. */
const MAX_DRIFT = 0.25;

export type PlayerOptions = { muted?: boolean };

/**
 * Plays a page: its objects on an off-screen canvas, drawn as they look at any time of the page
 * (lib/animation.ts), with video clips playing in their place in step with the page's clock. Used
 * by the editor preview, presentation mode and video export. The page data is never changed; the
 * player works on its own copies of the objects.
 */
export class PagePlayer {
  readonly canvas: StaticCanvas;
  readonly timing: PageTiming;
  readonly clips: Clip[];
  private readonly objects: FabricObject[];
  private readonly base: Base[];
  private readonly animations: ElementAnimation[];

  private constructor(canvas: StaticCanvas, objects: FabricObject[], clips: Clip[], timing: PageTiming, private readonly artboard: Size) {
    this.canvas = canvas;
    this.objects = objects;
    this.clips = clips;
    this.timing = timing;
    this.animations = objects.map((o, i) => effectiveAnimation(readElementAnimation(o.animation), timing, i));
    this.base = objects.map((o) => ({
      center: o.getCenterPoint(),
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      opacity: o.opacity,
      angle: o.angle,
      shadow: o.shadow,
      glowColor: typeof o.fill === "string" && o.fill !== "transparent" ? o.fill : "#8b5cf6",
      clipPath: o.clipPath,
      text: o instanceof FabricText ? o.text : null,
      graphemes: o instanceof FabricText ? textGraphemes(o.text) : undefined,
      box: o.getBoundingRect(),
    }));
  }

  /** Loads a page for playing at `scale` output pixels per page pixel, onto `element` if given. */
  static async create(data: CanvasData, artboard: Size, scale: number, element?: HTMLCanvasElement, options: PlayerOptions = {}): Promise<PagePlayer> {
    const canvas = new StaticCanvas(element ?? document.createElement("canvas"), {
      width: Math.max(1, Math.round(artboard.width * scale)),
      height: Math.max(1, Math.round(artboard.height * scale)),
      enableRetinaScaling: false,
      renderOnAddRemove: false,
      backgroundColor: PAGE_BACKGROUND,
    });
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    const objects = (await enlivenCanvasObjects(data.objects.filter((o) => o.visible !== false))).filter((o) => !o.placeholderFor);
    const clips: Clip[] = [];
    await Promise.all(
      objects.map(async (o) => {
        const settings = o instanceof FabricImage ? readVideoSettings(o.video) : null;
        if (!settings || !(o instanceof FabricImage)) return;
        try {
          const video = await loadVideoElement(settings, options.muted ?? false);
          await seekVideo(video, settings.trimStart);
          // The clip has the poster's size, so the crop, frame and corners stay as they are.
          o.setElement(video, { width: o.width, height: o.height });
          o.set({ objectCaching: false });
          clips.push({ object: o, element: video, settings });
        } catch (error) {
          // The poster stays in place of a clip that cannot be played.
          console.warn(error);
        }
      }),
    );
    if (objects.length > 0) canvas.add(...objects);
    return new PagePlayer(canvas, objects, clips, readTiming(data.timing), artboard);
  }

  get duration(): number {
    return this.timing.duration;
  }

  /** The time to stay at when a page is shown without moving on: just before the first exit starts. */
  holdTime(): number {
    let hold = this.timing.duration;
    this.animations.forEach((a) => {
      if (a.out) hold = Math.min(hold, Math.max(0, this.timing.duration - a.out.delay - a.out.duration));
    });
    return hold;
  }

  private applyStates(t: number, clock = t) {
    this.objects.forEach((o, i) => {
      const b = this.base[i];
      const s = elementStateAt(this.animations[i], this.timing.duration, t, this.artboard, b.text !== null, clock);
      o.set({ opacity: b.opacity * s.opacity, scaleX: b.scaleX * s.scale * s.flipX, scaleY: b.scaleY * s.scale, angle: b.angle + s.rotation });
      o.setPositionByOrigin(new Point(b.center.x + s.dx, b.center.y + s.dy), "center", "center");
      if (s.glow > 0) {
        b.glowShadow ??= new Shadow({ color: b.glowColor, blur: 8, offsetX: 0, offsetY: 0 });
        b.glowShadow.blur = 8 + s.glow * 24;
        if (o.shadow !== b.glowShadow) o.set({ shadow: b.glowShadow });
      } else if (o.shadow !== b.shadow) {
        o.set({ shadow: b.shadow });
      }
      if (b.text !== null && o instanceof FabricText) {
        const shown = typewriterText(b.text, s.chars, b.graphemes);
        if (o.text !== shown) o.set({ text: shown });
      }
      if (s.wipe < 1) {
        // The part of the element's box revealed so far, from the side the wipe starts at.
        const { left, top, width, height } = b.box;
        const w = s.wipeFrom === "left" || s.wipeFrom === "right" ? width * s.wipe : width;
        const h = s.wipeFrom === "up" || s.wipeFrom === "down" ? height * s.wipe : height;
        const x = s.wipeFrom === "right" ? left + width - w : left;
        const y = s.wipeFrom === "down" ? top + height - h : top;
        o.clipPath = new Rect({ left: x, top: y, width: Math.max(0.01, w), height: Math.max(0.01, h), absolutePositioned: true });
      } else if (o.clipPath !== b.clipPath) {
        o.clipPath = b.clipPath;
      }
      o.set({ dirty: true });
    });
    // Filtered clips are filtered again for the frame now showing.
    this.clips.forEach((c) => c.object.filters.length > 0 && c.object.applyFilters());
  }

  /**
   * Draws the page at `t` ms while playing in real time: elements as they look at `t`, clips kept
   * playing in step with `clock` ms (the time the page has been showing, which keeps running while
   * a presentation holds a page).
   */
  frame(t: number, clock = t) {
    for (const c of this.clips) {
      const target = clipTime(c.settings, clock / 1000);
      if (clipPlaying(c.settings, clock / 1000)) {
        if (Math.abs(c.element.currentTime - target) > MAX_DRIFT) c.element.currentTime = target;
        if (c.element.paused) void c.element.play().catch(() => {});
      } else if (!c.element.paused || Math.abs(c.element.currentTime - target) > 0.01) {
        c.element.pause();
        c.element.currentTime = target;
      }
    }
    this.applyStates(t, clock);
    this.canvas.renderAll();
  }

  /** Draws the page exactly as it is at `t` ms, waiting for every clip to show its frame there (video export). */
  async seekExact(t: number) {
    await Promise.all(this.clips.map((c) => seekVideo(c.element, clipTime(c.settings, t / 1000))));
    this.applyStates(t);
    this.canvas.renderAll();
  }

  /** Draws `t` without moving clips (a still of the elements). */
  seek(t: number) {
    this.applyStates(t);
    this.canvas.renderAll();
  }

  pause() {
    this.clips.forEach((c) => c.element.pause());
  }

  async dispose() {
    for (const c of this.clips) {
      c.element.pause();
      c.element.removeAttribute("src");
      c.element.load();
    }
    const element = this.canvas.getElement();
    await this.canvas.dispose();
    element.width = 0;
    element.height = 0;
  }
}
