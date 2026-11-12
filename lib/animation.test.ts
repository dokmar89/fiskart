import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMING,
  ease,
  effectiveAnimation,
  elementStateAt,
  elementTimes,
  FINAL_STATE,
  readElementAnimation,
  readTiming,
  typewriterText,
  transitionStyle,
  ANIMATION_TYPES,
  LOOP_TYPES,
  type Anim,
} from "./animation";

const page = { width: 1000, height: 800 };
const fade = (over: Partial<Anim> = {}): Anim => ({ type: "fade", duration: 1000, delay: 0, easing: "linear", direction: "up", ...over });

describe("elementTimes", () => {
  it("starts the entrance at its delay and ends the exit before the page ends", () => {
    expect(elementTimes({ in: fade({ delay: 500 }), out: fade({ duration: 400, delay: 100 }) }, 5000)).toEqual({
      inStart: 500,
      inEnd: 1500,
      outStart: 4500,
      outEnd: 4900,
    });
  });

  it("is the whole page without animations, and clamps to short pages", () => {
    expect(elementTimes({}, 3000)).toEqual({ inStart: 0, inEnd: 0, outStart: 3000, outEnd: 3000 });
    expect(elementTimes({ in: fade({ delay: 2500 }), out: fade() }, 3000)).toEqual({ inStart: 2500, inEnd: 3000, outStart: 3000, outEnd: 3000 });
  });
});

describe("elementStateAt", () => {
  it("fades in over the entrance, holds, and fades out over the exit", () => {
    const anim = { in: fade({ delay: 1000 }), out: fade() };
    expect(elementStateAt(anim, 5000, 0, page, false).opacity).toBe(0);
    expect(elementStateAt(anim, 5000, 1500, page, false).opacity).toBeCloseTo(0.5);
    expect(elementStateAt(anim, 5000, 3000, page, false)).toEqual(FINAL_STATE);
    expect(elementStateAt(anim, 5000, 4500, page, false).opacity).toBeCloseTo(0.5);
    expect(elementStateAt(anim, 5000, 5000, page, false).opacity).toBe(0);
  });

  it("is always the design without animations", () => {
    for (const t of [0, 1000, 5000]) expect(elementStateAt({}, 5000, t, page, false)).toEqual(FINAL_STATE);
  });

  it("slides in from the named side", () => {
    const left = elementStateAt({ in: fade({ type: "slide", direction: "left" }) }, 5000, 0, page, false);
    expect(left.dx).toBeCloseTo(-350);
    const down = elementStateAt({ in: fade({ type: "slide", direction: "down" }) }, 5000, 500, page, false);
    expect(down.dy).toBeCloseTo(140);
  });

  it("rises, pops, wipes and types", () => {
    expect(elementStateAt({ in: fade({ type: "rise" }) }, 5000, 0, page, false).dy).toBeCloseTo(64);
    const pop = elementStateAt({ in: fade({ type: "pop" }) }, 5000, 800, page, false);
    expect(pop.scale).toBeGreaterThan(1);
    expect(elementStateAt({ in: fade({ type: "wipe", direction: "right" }) }, 5000, 250, page, false)).toMatchObject({ wipe: 0.25, wipeFrom: "right" });
    expect(elementStateAt({ in: fade({ type: "typewriter" }) }, 5000, 400, page, true).chars).toBeCloseTo(0.4);
    // Typewriter on something that is not text fades.
    expect(elementStateAt({ in: fade({ type: "typewriter" }) }, 5000, 400, page, false).opacity).toBeCloseTo(0.4);
  });

  it("ends every entrance exactly at the design", () => {
    for (const type of ["fade", "slide", "pop", "wipe", "rise", "typewriter"] as const) {
      expect(elementStateAt({ in: fade({ type }) }, 5000, 1000, page, true)).toEqual(FINAL_STATE);
    }
  });
});

describe("expanded motion presets", () => {
  it("offers every requested entrance and four continuous motions", () => {
    expect(ANIMATION_TYPES).toEqual(["fade", "slide", "pop", "wipe", "rise", "typewriter", "breathe", "tumble", "neon", "drift"]);
    expect(LOOP_TYPES).toEqual(["pulse", "jiggle", "spin", "glow"]);
  });

  it("tumbles into place and a neon entrance settles into a glow", () => {
    const tumble = { in: fade({ type: "tumble" }) };
    expect(elementStateAt(tumble, 5000, 0, page, false).rotation).toBeLessThan(-20);
    expect(elementStateAt(tumble, 5000, 0, page, false).flipX).toBeLessThan(0);
    expect(elementStateAt(tumble, 5000, 1000, page, false)).toEqual(FINAL_STATE);
    const neon = { in: fade({ type: "neon" }) };
    expect(elementStateAt(neon, 5000, 100, page, true).opacity).toBeLessThan(1);
    expect(elementStateAt(neon, 5000, 500, page, true).glow).toBeGreaterThan(0);
    expect(elementStateAt(neon, 5000, 1000, page, true)).toEqual(FINAL_STATE);
  });

  it("breathes and drifts in, then returns exactly to the design", () => {
    for (const type of ["breathe", "drift"] as const) {
      const anim = { in: fade({ type }) };
      expect(elementStateAt(anim, 5000, 0, page, false)).not.toEqual(FINAL_STATE);
      expect(elementStateAt(anim, 5000, 1000, page, false)).toEqual(FINAL_STATE);
    }
  });

  it("keeps continuous motion running while a presentation holds a page", () => {
    const loop = { loop: { type: "pulse" as const, duration: 1000, delay: 0, direction: "right" as const } };
    const atHold = elementStateAt(loop, 5000, 5000, page, false, 5000);
    const later = elementStateAt(loop, 5000, 5000, page, false, 5250);
    expect(atHold.scale).toBeCloseTo(1);
    expect(later.scale).toBeGreaterThan(1.03);
    expect(elementStateAt(loop, 5000, 5000, page, false, 6000).scale).toBeCloseTo(1);
  });

  it("produces deterministic jiggle, spin and glow states, with delay", () => {
    for (const type of ["jiggle", "spin", "glow"] as const) {
      const animation = { loop: { type, duration: 1000, delay: 300, direction: "left" as const } };
      expect(elementStateAt(animation, 5000, 200, page, false)).toEqual(FINAL_STATE);
      expect(elementStateAt(animation, 5000, 550, page, false)).not.toEqual(FINAL_STATE);
      expect(elementStateAt(animation, 5000, 1550, page, false)).toEqual(elementStateAt(animation, 5000, 550, page, false));
    }
  });

  it("stops a loop when its exit starts", () => {
    const animation = { loop: { type: "pulse" as const, duration: 1000, delay: 0, direction: "left" as const }, out: fade({ duration: 1000 }) };
    expect(elementStateAt(animation, 5000, 4250, page, false).opacity).toBeCloseTo(0.75);
    expect(elementStateAt(animation, 5000, 4250, page, false).scale).toBe(1);
  });
});

it("reveals typewriter text by complete visible characters, including emoji and combining accents", () => {
  const phrase = "A👨‍👩‍👧‍👦čB";
  expect(typewriterText(phrase, 0)).toBe("");
  expect(typewriterText(phrase, 0.5)).toBe("A👨‍👩‍👧‍👦");
  expect(typewriterText(phrase, 0.75)).toBe("A👨‍👩‍👧‍👦č");
  expect(typewriterText(phrase, 1)).toBe(phrase);
});

describe("page animation", () => {
  it("applies to elements without their own entrance, one after another", () => {
    const timing = { ...DEFAULT_TIMING, animation: { ...fade(), stagger: 200 } };
    expect(effectiveAnimation(null, timing, 3).in?.delay).toBe(600);
    expect(effectiveAnimation({ in: fade({ type: "pop" }) }, timing, 3).in?.type).toBe("pop");
    expect(effectiveAnimation(null, DEFAULT_TIMING, 0)).toEqual({});
  });
});

describe("reading stored settings", () => {
  it("fills in defaults and drops junk", () => {
    expect(readElementAnimation({ in: { type: "fade" } })).toEqual({ in: { type: "fade", duration: 600, delay: 0, easing: "ease-out", direction: "up" } });
    expect(readElementAnimation({ in: { type: "spin" } })).toBeNull();
    expect(readTiming(undefined)).toEqual(DEFAULT_TIMING);
    expect(readTiming({ duration: 99_999_999, transition: { type: "push" } })).toMatchObject({ duration: 60_000, transition: { type: "push", duration: 600 } });
  });

  it("reads a loop independently of entrance and exit without changing older documents", () => {
    expect(readElementAnimation({ loop: { type: "spin", duration: 200, delay: 50, direction: "left" } })).toEqual({
      loop: { type: "spin", duration: 200, delay: 50, direction: "left" },
    });
    expect(readElementAnimation({ loop: { type: "unknown" } })).toBeNull();
    expect(readElementAnimation({ in: { type: "fade" } })).toMatchObject({ in: { type: "fade" } });
  });
});

describe("easing and transitions", () => {
  it("eases from 0 to 1", () => {
    for (const e of ["linear", "ease-in", "ease-out", "ease-in-out"] as const) {
      expect(ease(e, 0)).toBe(0);
      expect(ease(e, 1)).toBe(1);
    }
    expect(ease("ease-out", 0.5)).toBeGreaterThan(0.5);
  });

  it("moves pages in and out", () => {
    expect(transitionStyle("fade", 0.5).to.opacity).toBeCloseTo(0.5);
    expect(transitionStyle("push", 1)).toMatchObject({ from: { x: -1 }, to: { x: 0 } });
    expect(transitionStyle("none", 0.5).to.opacity).toBe(0);
  });
});
