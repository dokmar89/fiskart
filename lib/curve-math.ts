/**
 * Laying text out on a circular arc, for curved text. Pure: glyph advance widths in, glyph
 * positions out. Unit tested.
 */

export type ArcGlyph = {
  /** Middle of the glyph on its baseline, relative to the centre of the whole text's box. */
  x: number;
  y: number;
  /** Rotation of the glyph, radians, clockwise. */
  angle: number;
};

export type ArcLayout = { glyphs: ArcGlyph[]; width: number; height: number; radius: number | null };

/** At full curve the text wraps almost all the way round, leaving a small gap between its ends. */
const MAX_SPAN = Math.PI * 2 * 0.96;

/** The stored curve uses the older ±100 scale; expose the corresponding arc span in degrees. */
const DEGREES_PER_CURVE_UNIT = MAX_SPAN * 180 / Math.PI / 100;
export const curveToDegrees = (curve: number) => curve * DEGREES_PER_CURVE_UNIT;
export const degreesToCurve = (degrees: number) => Math.max(-180, Math.min(180, degrees)) / DEGREES_PER_CURVE_UNIT;

/**
 * Places glyphs along an arc. `curve` runs from -100 to 100: 0 is straight, positive bends the text
 * into an arch (centre below), negative into a smile (centre above), and ±100 nearly closes the
 * circle. `ascent` and `descent` are how far glyphs reach above and below their baseline, for the
 * bounding box. The arc keeps the text's length, so the radius shrinks as the curve grows.
 */
export function arcLayout(widths: number[], curve: number, ascent: number, descent: number): ArcLayout {
  const total = widths.reduce((sum, w) => sum + w, 0);
  const amount = Math.max(-100, Math.min(100, curve)) / 100;
  const span = Math.abs(amount) * MAX_SPAN;
  const radius = span > 1e-6 && total > 0 ? total / span : null;
  const sign = amount >= 0 ? 1 : -1;

  let cursor = -total / 2;
  const raw = widths.map((w) => {
    const s = cursor + w / 2;
    cursor += w;
    if (radius === null) return { x: s, y: 0, angle: 0 };
    const phi = s / radius;
    return { x: radius * Math.sin(phi), y: sign * radius * (1 - Math.cos(phi)), angle: sign * phi };
  });

  // The box around every glyph's own box (its advance by ascent plus descent, turned with it).
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  raw.forEach((g, i) => {
    const tx = Math.cos(g.angle);
    const ty = Math.sin(g.angle);
    // "Up" for the glyph, perpendicular to its baseline.
    const ux = Math.sin(g.angle);
    const uy = -Math.cos(g.angle);
    const half = widths[i] / 2;
    for (const along of [-half, half]) {
      for (const up of [ascent, -descent]) {
        const x = g.x + tx * along + ux * up;
        const y = g.y + ty * along + uy * up;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  });
  if (raw.length === 0) return { glyphs: [], width: 0, height: ascent + descent, radius };
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    glyphs: raw.map((g) => ({ x: g.x - cx, y: g.y - cy, angle: g.angle })),
    width: maxX - minX,
    height: maxY - minY,
    radius,
  };
}
