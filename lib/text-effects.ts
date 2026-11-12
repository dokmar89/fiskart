/**
 * Text effects. A text has at most one. Its parameters are relative (0–100, and an angle), and
 * the drawing values are worked out from the font size, so an effect keeps its look when the
 * text is resized. Pure functions, unit tested; lib/canvas/effects.ts applies the result to Fabric.
 */

export type TextEffect =
  | { type: "shadow"; offset: number; direction: number; blur: number; color: string; transparency: number }
  | { type: "outline"; thickness: number; color: string }
  /** `color` is the text's colour, kept here while the fill is empty. */
  | { type: "hollow"; thickness: number; color: string }
  /** `color` is the text's colour: the glow, with a pale tint of it as the fill. */
  | { type: "neon"; intensity: number; color: string }
  | { type: "lift"; intensity: number; color: string }
  | { type: "splice"; thickness: number; offset: number; direction: number; color: string }
  | { type: "glitch"; intensity: number; color: string; magenta: string }
  | { type: "background"; padding: number; radius: number; transparency: number; color: string };

export type TextEffectType = TextEffect["type"];

export const TEXT_EFFECT_TYPES: { type: TextEffectType; label: string }[] = [
  { type: "shadow", label: "Stín" },
  { type: "outline", label: "Obrys" },
  { type: "hollow", label: "Dutý" },
  { type: "neon", label: "Neon" },
  { type: "lift", label: "Zvednutí" },
  { type: "splice", label: "Spojení" },
  { type: "glitch", label: "Glitch" },
  { type: "background", label: "Pozadí" },
];

export type TextOverlay = { offsetX: number; offsetY: number; fill: string | null; stroke: string | null; strokeWidth: number };
export type TextBackground = { color: string; padding: number; radius: number; transparency: number };

/** Fabric properties an effect controls. `fill` is only set when the effect changes it. */
export type EffectStyle = {
  shadow: { color: string; blur: number; offsetX: number; offsetY: number } | null;
  stroke: string | null;
  strokeWidth: number;
  paintFirst: "fill" | "stroke";
  fill?: string;
};

export const NO_EFFECT_STYLE: EffectStyle = { shadow: null, stroke: null, strokeWidth: 0, paintFirst: "fill" };

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000})`;
}

/** Relative luminance 0–1, for picking a default outline colour that stands out from the text. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Hollow and neon draw the text's colour themselves; the text colour control edits `color`. */
export function ownsTextColor(effect: TextEffect | undefined | null): effect is Extract<TextEffect, { type: "hollow" | "neon" }> {
  return effect?.type === "hollow" || effect?.type === "neon";
}

/** `hex` mixed with white; 0 keeps it, 1 is white. */
export function tint(hex: string, amount: number): string {
  const mixed = hexToRgb(hex).map((c) => Math.round(c + (255 - c) * amount));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** A new effect of the given type with default parameters, for text of colour `textColor`. */
export function defaultEffect(type: TextEffectType, textColor: string): TextEffect {
  switch (type) {
    case "shadow":
      return { type, offset: 50, direction: 45, blur: 20, color: "#000000", transparency: 60 };
    case "outline":
      return { type, thickness: 50, color: luminance(textColor) > 0.5 ? "#18181b" : "#ffffff" };
    case "hollow":
      return { type, thickness: 50, color: textColor };
    case "neon":
      return { type, intensity: 50, color: textColor };
    case "lift":
      return { type, intensity: 45, color: "#171717" };
    case "splice":
      return { type, thickness: 42, offset: 50, direction: 45, color: "#a855f7" };
    case "glitch":
      return { type, intensity: 42, color: "#00e5ff", magenta: "#ff3ba7" };
    case "background":
      return { type, padding: 25, radius: 30, transparency: 0, color: "#fef08a" };
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Drawing values for an effect on text of the given font size (in the text's own units). */
export function effectStyle(effect: TextEffect | undefined | null, fontSize: number): EffectStyle {
  if (!effect) return NO_EFFECT_STYLE;
  switch (effect.type) {
    case "shadow": {
      const distance = (effect.offset / 100) * fontSize * 0.25;
      const angle = (effect.direction * Math.PI) / 180;
      return {
        ...NO_EFFECT_STYLE,
        shadow: {
          color: withAlpha(effect.color, 1 - effect.transparency / 100),
          blur: round((effect.blur / 100) * fontSize * 0.5),
          offsetX: round(Math.cos(angle) * distance),
          offsetY: round(Math.sin(angle) * distance),
        },
      };
    }
    case "outline":
      // The stroke is painted under the fill, so only its outer half shows.
      return { shadow: null, stroke: effect.color, strokeWidth: round((effect.thickness / 100) * fontSize * 0.24), paintFirst: "stroke" };
    case "hollow":
      return {
        shadow: null,
        stroke: effect.color,
        strokeWidth: round(Math.max(0.5, (effect.thickness / 100) * fontSize * 0.08)),
        paintFirst: "fill",
        fill: "",
      };
    case "neon":
      return {
        ...NO_EFFECT_STYLE,
        shadow: { color: effect.color, blur: round((0.1 + (effect.intensity / 100) * 0.5) * fontSize), offsetX: 0, offsetY: 0 },
        fill: tint(effect.color, 0.6),
      };
    case "lift":
      return {
        ...NO_EFFECT_STYLE,
        shadow: { color: withAlpha(effect.color, 0.18 + effect.intensity / 230), blur: round((0.18 + effect.intensity / 170) * fontSize), offsetX: 0, offsetY: 0 },
      };
    case "splice":
    case "glitch":
    case "background":
      return NO_EFFECT_STYLE;
  }
}

/** Extra text drawings, behind the original glyphs. Values scale with font size. */
export function effectOverlayLayers(effect: TextEffect | undefined | null, fontSize: number): TextOverlay[] {
  if (!effect) return [];
  if (effect.type === "splice") {
    const distance = (effect.offset / 100) * fontSize * 0.22;
    const angle = (effect.direction * Math.PI) / 180;
    return [{ offsetX: round(Math.cos(angle) * distance), offsetY: round(Math.sin(angle) * distance), fill: null, stroke: effect.color, strokeWidth: round(Math.max(1, effect.thickness / 100 * fontSize * 0.16)) }];
  }
  if (effect.type === "glitch") {
    const distance = round((0.02 + effect.intensity / 100 * 0.12) * fontSize);
    return [
      { offsetX: -distance, offsetY: -round(distance / 3), fill: effect.color, stroke: null, strokeWidth: 0 },
      { offsetX: distance, offsetY: round(distance / 3), fill: effect.magenta, stroke: null, strokeWidth: 0 },
    ];
  }
  return [];
}

export function effectBackground(effect: TextEffect | undefined | null): TextBackground | null {
  return effect?.type === "background" ? { color: effect.color, padding: effect.padding, radius: effect.radius, transparency: effect.transparency } : null;
}
