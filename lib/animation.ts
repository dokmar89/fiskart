/**
 * Animation: element entrances and exits, page timing and transitions, and the timeline that says
 * how every element looks at a given time of its page. Pure (no Fabric), unit tested; the editor
 * preview, presentation mode and video export all draw from `elementStateAt`.
 */

export const ANIMATION_TYPES = ["fade", "slide", "pop", "wipe", "rise", "typewriter", "breathe", "tumble", "neon", "drift"] as const;
export type AnimationType = (typeof ANIMATION_TYPES)[number];
export const LOOP_TYPES = ["pulse", "jiggle", "spin", "glow"] as const;
export type LoopType = (typeof LOOP_TYPES)[number];
export const EASINGS = ["linear", "ease-in", "ease-out", "ease-in-out"] as const;
export type Easing = (typeof EASINGS)[number];
export const DIRECTIONS = ["left", "right", "up", "down"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** One animation: what, how long (ms), after how long (ms), how it accelerates, and from where. */
export type Anim = { type: AnimationType; duration: number; delay: number; easing: Easing; direction: Direction };
export type LoopAnim = { type: LoopType; duration: number; delay: number; direction: Direction };
/** Optional entrance, exit and continuous movement of an element. */
export type ElementAnimation = { in?: Anim; out?: Anim; loop?: LoopAnim };

export const TRANSITIONS = ["none", "fade", "slide", "push", "zoom"] as const;
export type TransitionType = (typeof TRANSITIONS)[number];

export type PageTiming = {
  /** How long the page shows, ms. */
  duration: number;
  /** How the page comes in after the previous one. */
  transition: { type: TransitionType; duration: number };
  /** Entrance for every element that has none of its own, started one after another. */
  animation: (Anim & { stagger: number }) | null;
};

export const DEFAULT_ANIM: Anim = { type: "fade", duration: 600, delay: 0, easing: "ease-out", direction: "up" };
export const DEFAULT_LOOP: LoopAnim = { type: "pulse", duration: 2000, delay: 0, direction: "right" };
export const DEFAULT_TIMING: PageTiming = { duration: 5000, transition: { type: "none", duration: 600 }, animation: null };
export const MAX_PAGE_DURATION = 60_000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);

export function readAnim(value: unknown): Anim | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (!ANIMATION_TYPES.includes(v.type as AnimationType)) return undefined;
  return {
    type: v.type as AnimationType,
    duration: num(v.duration, DEFAULT_ANIM.duration, 50, 20_000),
    delay: num(v.delay, 0, 0, MAX_PAGE_DURATION),
    easing: oneOf(EASINGS, v.easing, DEFAULT_ANIM.easing),
    direction: oneOf(DIRECTIONS, v.direction, DEFAULT_ANIM.direction),
  };
}

export function readLoop(value: unknown): LoopAnim | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (!LOOP_TYPES.includes(v.type as LoopType)) return undefined;
  return {
    type: v.type as LoopType,
    duration: num(v.duration, DEFAULT_LOOP.duration, 200, 5000),
    delay: num(v.delay, 0, 0, MAX_PAGE_DURATION),
    direction: oneOf(DIRECTIONS, v.direction, DEFAULT_LOOP.direction),
  };
}

export function readElementAnimation(value: unknown): ElementAnimation | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const result: ElementAnimation = {};
  const entrance = readAnim(v.in);
  const exit = readAnim(v.out);
  const loop = readLoop(v.loop);
  if (entrance) result.in = entrance;
  if (exit) result.out = exit;
  if (loop) result.loop = loop;
  return entrance || exit || loop ? result : null;
}

export function readTiming(value: unknown): PageTiming {
  if (!value || typeof value !== "object") return DEFAULT_TIMING;
  const v = value as Record<string, unknown>;
  const t = (v.transition && typeof v.transition === "object" ? v.transition : {}) as Record<string, unknown>;
  const a = readAnim(v.animation);
  const stagger = v.animation && typeof v.animation === "object" ? num((v.animation as Record<string, unknown>).stagger, 150, 0, 5000) : 150;
  return {
    duration: num(v.duration, DEFAULT_TIMING.duration, 500, MAX_PAGE_DURATION),
    transition: { type: oneOf(TRANSITIONS, t.type, "none"), duration: num(t.duration, 600, 50, 5000) },
    animation: a ? { ...a, stagger } : null,
  };
}

export function ease(easing: Easing, p: number): number {
  const x = clamp(p, 0, 1);
  switch (easing) {
    case "linear":
      return x;
    case "ease-in":
      return x * x * x;
    case "ease-out":
      return 1 - (1 - x) ** 3;
    case "ease-in-out":
      return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  }
}

/** The animations that apply to an element: its own, or the page animation (staggered by its place). */
export function effectiveAnimation(own: ElementAnimation | null, timing: PageTiming, index: number): ElementAnimation {
  const result: ElementAnimation = { ...(own ?? {}) };
  if (!result.in && timing.animation) {
    const { stagger, ...anim } = timing.animation;
    result.in = { ...anim, delay: anim.delay + stagger * index };
  }
  return result;
}

/**
 * When an element's animations run on a page of `pageDuration` ms: the entrance from its delay, the
 * exit so that it ends `delay` ms before the page does. Times are clamped to the page.
 */
export function elementTimes(animation: ElementAnimation, pageDuration: number) {
  const entrance = animation.in;
  const exit = animation.out;
  const inStart = entrance ? clamp(entrance.delay, 0, pageDuration) : 0;
  const inEnd = entrance ? clamp(entrance.delay + entrance.duration, 0, pageDuration) : 0;
  const outEnd = exit ? clamp(pageDuration - exit.delay, 0, pageDuration) : pageDuration;
  const outStart = exit ? clamp(outEnd - exit.duration, inEnd, pageDuration) : pageDuration;
  return { inStart, inEnd, outStart, outEnd };
}

export type ElementState = {
  /** Multiplies the element's own opacity. */
  opacity: number;
  /** Offset in page pixels. */
  dx: number;
  dy: number;
  /** Scale about the element's centre. */
  scale: number;
  /** Share of the element shown by a wipe (1 = all), revealed from `wipeFrom`. */
  wipe: number;
  wipeFrom: Direction;
  /** Share of the text's characters shown (typewriter). */
  chars: number;
  /** Additional rotation in degrees relative to the object's designed angle. */
  rotation: number;
  /** Horizontal flip multiplier; negative values show the back of a tumbling object. */
  flipX: number;
  /** Temporary glow amount for animation, 0–1. */
  glow: number;
};

export const FINAL_STATE: ElementState = { opacity: 1, dx: 0, dy: 0, scale: 1, wipe: 1, wipeFrom: "left", chars: 1, rotation: 0, flipX: 1, glow: 0 };

const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("cs", { granularity: "grapheme" }) : null;

export function textGraphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
}

/** Complete visible characters only: never split an emoji sequence or a combining accent. */
export function typewriterText(text: string, share: number, segments?: readonly string[]): string {
  if (share <= 0) return "";
  if (share >= 1) return text;
  const graphemes = segments ?? textGraphemes(text);
  return graphemes.slice(0, Math.floor(clamp(share, 0, 1) * graphemes.length)).join("");
}

/** How an animation of one type looks at progress p (0 = start of the entrance, 1 = done). */
function stateFor(anim: Anim, p: number, page: { width: number; height: number }, isText: boolean): ElementState {
  if (p >= 1) return FINAL_STATE;
  const e = ease(anim.easing, p);
  const state: ElementState = { ...FINAL_STATE };
  const away = (distance: number) => {
    const d = (1 - e) * distance;
    if (anim.direction === "left") state.dx = -d;
    if (anim.direction === "right") state.dx = d;
    if (anim.direction === "up") state.dy = -d;
    if (anim.direction === "down") state.dy = d;
  };
  switch (anim.type) {
    case "fade":
      state.opacity = e;
      break;
    case "slide":
      // Comes in from the side it is named after.
      away(anim.direction === "left" || anim.direction === "right" ? page.width * 0.35 : page.height * 0.35);
      state.opacity = Math.min(1, e * 2);
      break;
    case "rise":
      state.dy = (1 - e) * page.height * 0.08;
      state.opacity = e;
      break;
    case "pop": {
      // Grows past full size a little and settles (an "back out" curve on top of the easing).
      const c = 1.70158;
      const back = 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2;
      state.scale = clamp(0.3 + 0.7 * back, 0, 1.2);
      state.opacity = Math.min(1, p * 3);
      break;
    }
    case "wipe":
      state.wipe = e;
      state.wipeFrom = anim.direction;
      break;
    case "typewriter":
      if (isText) state.chars = p;
      else state.opacity = e;
      break;
    case "breathe":
      state.scale = 1 - 0.07 * (1 - e) + 0.035 * Math.sin(p * Math.PI * 2) * (1 - e);
      state.opacity = e;
      break;
    case "tumble":
      state.rotation = -40 * (1 - e) + 6 * Math.sin(p * Math.PI * 2) * (1 - e);
      state.scale = 0.78 + 0.22 * e;
      state.flipX = Math.sign(Math.cos((1 - e) * Math.PI) || 1) * Math.max(0.04, Math.abs(Math.cos((1 - e) * Math.PI)));
      state.opacity = e;
      break;
    case "neon":
      state.opacity = Math.min(1, e * (0.7 + 0.3 * Math.abs(Math.sin(p * Math.PI * 12))));
      state.glow = Math.sin(Math.PI * e) * 0.9;
      break;
    case "drift":
      state.dx = (1 - e) * page.width * 0.06 * Math.cos(p * Math.PI * 1.5);
      state.dy = (1 - e) * page.height * 0.06 * Math.sin(p * Math.PI * 1.5);
      state.opacity = e;
      break;
  }
  return state;
}

/** A continuous motion at a precise clock time, including a presentation that holds its page. */
function loopState(loop: LoopAnim, clock: number, page: { width: number; height: number }): ElementState {
  if (clock <= loop.delay) return FINAL_STATE;
  const phase = (((clock - loop.delay) % loop.duration) + loop.duration) % loop.duration / loop.duration;
  const wave = Math.sin(phase * Math.PI * 2);
  const state: ElementState = { ...FINAL_STATE };
  switch (loop.type) {
    case "pulse":
      state.scale = 1 + wave * 0.065;
      break;
    case "jiggle": {
      const offset = Math.sin(phase * Math.PI * 6) * Math.min(page.width, page.height) * 0.009;
      if (loop.direction === "up" || loop.direction === "down") state.dy = offset;
      else state.dx = offset;
      state.rotation = wave * 2.5;
      break;
    }
    case "spin":
      state.rotation = phase * (loop.direction === "left" || loop.direction === "up" ? -360 : 360);
      break;
    case "glow":
      state.glow = (1 - Math.cos(phase * Math.PI * 2)) / 2;
      break;
  }
  return state;
}

/**
 * How an element looks at time `t` (ms) of its page: before its entrance it is in the entrance's
 * starting state (usually invisible), during it in between, then as designed until its exit, which
 * plays the entrance's motion in reverse. Without animations it is always as designed.
 */
export function elementStateAt(
  animation: ElementAnimation,
  pageDuration: number,
  t: number,
  page: { width: number; height: number },
  isText: boolean,
  loopClock = t,
): ElementState {
  const times = elementTimes(animation, pageDuration);
  if (animation.in && t < times.inEnd) {
    const span = Math.max(1, times.inEnd - times.inStart);
    return stateFor(animation.in, (t - times.inStart) / span, page, isText);
  }
  if (animation.out && t > times.outStart) {
    const span = Math.max(1, times.outEnd - times.outStart);
    return stateFor(animation.out, 1 - (t - times.outStart) / span, page, isText);
  }
  if (animation.loop && loopClock >= Math.max(times.inEnd, animation.loop.delay)) return loopState(animation.loop, loopClock, page);
  return FINAL_STATE;
}

/** The style of the outgoing and incoming page during a transition at progress p (0..1). */
export function transitionStyle(type: TransitionType, p: number): { from: { opacity: number; x: number; scale: number }; to: { opacity: number; x: number; scale: number } } {
  const e = ease("ease-in-out", p);
  switch (type) {
    case "fade":
      return { from: { opacity: 1 - e, x: 0, scale: 1 }, to: { opacity: e, x: 0, scale: 1 } };
    case "slide":
      return { from: { opacity: 1, x: 0, scale: 1 }, to: { opacity: 1, x: 1 - e, scale: 1 } };
    case "push":
      return { from: { opacity: 1, x: -e, scale: 1 }, to: { opacity: 1, x: 1 - e, scale: 1 } };
    case "zoom":
      return { from: { opacity: 1 - e, x: 0, scale: 1 + e * 0.15 }, to: { opacity: e, x: 0, scale: 0.85 + 0.15 * e } };
    case "none":
      return { from: { opacity: p < 1 ? 1 : 0, x: 0, scale: 1 }, to: { opacity: p >= 1 ? 1 : 0, x: 0, scale: 1 } };
  }
}
