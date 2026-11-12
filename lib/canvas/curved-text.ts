import { classRegistry, FabricText } from "fabric";
import { arcLayout, type ArcGlyph } from "@/lib/curve-math";
import { applyTextCase } from "@/lib/text-case";

declare module "fabric" {
  interface FabricText {
    /** Curved text only: -100 (smile) to 100 (arch); 0 is straight. */
    curve?: number;
  }
  interface SerializedObjectProps {
    curve?: number;
  }
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * Text on a circular arc (phase 12). One line: line breaks become spaces. Each character is drawn
 * turned along the arc (lib/curve-math.ts), and the object's box is the box around all of them, so
 * selection, snapping and export see the text as drawn. It is not edited in place; the toolbar has
 * a field for its text. Everything else (font, size, colour, effects) works as for other text.
 */
export class CurvedText extends FabricText {
  static type = "CurvedText";
  static textLayoutProperties = [...FabricText.textLayoutProperties, "curve", "textCase"];
  static cacheProperties = [...FabricText.cacheProperties, "curve", "textCase"];

  /** Glyph positions from the last layout. */
  declare _arc: ArcGlyph[];

  _splitTextIntoLines(text: string) {
    return super._splitTextIntoLines(applyTextCase(text.replace(/\r?\n/g, " "), this.textCase));
  }

  initDimensions() {
    super.initDimensions();
    const line = this._textLines[0] ?? [];
    const bounds = this.__charBounds?.[0] ?? [];
    const size = this.fontSize * this._fontSizeMult;
    const layout = arcLayout(
      line.map((_, i) => bounds[i]?.width ?? 0),
      this.curve ?? 0,
      size * (1 - this._fontSizeFraction),
      size * this._fontSizeFraction,
    );
    this._arc = layout.glyphs;
    this.width = Math.max(1, layout.width);
    this.height = Math.max(1, layout.height);
  }

  _renderTextCommon(ctx: CanvasRenderingContext2D, method: "fillText" | "strokeText") {
    const line = this._textLines[0] ?? [];
    const bounds = this.__charBounds?.[0] ?? [];
    ctx.save();
    line.forEach((char, i) => {
      const glyph = this._arc?.[i];
      if (!glyph) return;
      ctx.save();
      ctx.translate(glyph.x, glyph.y);
      ctx.rotate(glyph.angle);
      this._renderChar(method, ctx, 0, i, char, -(bounds[i]?.width ?? 0) / 2, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  // Backgrounds and underlines follow straight lines; curved text has neither.
  _renderTextLinesBackground() {}
  _renderTextDecoration() {}

  /** The SVG of the text: one tspan per character, placed and turned as on the canvas. */
  _toSVG(): string[] {
    const line = this._textLines[0] ?? [];
    const bounds = this.__charBounds?.[0] ?? [];
    const spans = line.map((char, i) => {
      const glyph = this._arc?.[i];
      if (!glyph) return "";
      const half = (bounds[i]?.width ?? 0) / 2;
      const x = glyph.x - Math.cos(glyph.angle) * half;
      const y = glyph.y - Math.sin(glyph.angle) * half;
      const degrees = (glyph.angle * 180) / Math.PI;
      return `<tspan x="${n(x)}" y="${n(y)}" rotate="${n(degrees)}">${escapeXml(char === " " ? " " : char)}</tspan>`;
    });
    return [
      '\t\t<text xml:space="preserve" ',
      `font-family="${escapeXml(this.fontFamily.replace(/"/g, "'"))}" `,
      `font-size="${this.fontSize}" `,
      this.fontStyle ? `font-style="${this.fontStyle}" ` : "",
      this.fontWeight ? `font-weight="${this.fontWeight}" ` : "",
      'style="',
      this.getSvgStyles(true),
      '"',
      this.addPaintOrder(),
      " >",
      spans.join(""),
      "</text>\n",
    ];
  }
}

classRegistry.setClass(CurvedText);
