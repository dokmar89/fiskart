import { classRegistry, Textbox } from "fabric";
import { applyTextCase, type TextCase } from "@/lib/text-case";
import { effectBackground, effectOverlayLayers, withAlpha, type TextEffect } from "@/lib/text-effects";

export type ListStyle = "bullet" | "number";

declare module "fabric" {
  interface FabricText {
    listStyle?: ListStyle;
    textCase?: TextCase;
    effect?: TextEffect;
  }
  interface SerializedObjectProps {
    listStyle?: ListStyle;
    textCase?: TextCase;
    effect?: TextEffect;
  }
}

/** Fabric's SVG export methods, mixed into the text classes without types. */
type SvgTextParts = { textSpans: string[]; textBgRects: string[] };
type SvgExport = {
  _getSVGTextAndBg(textTopOffset: number, textLeftOffset: number): SvgTextParts;
  _wrapSVGTextAndBg(parts: SvgTextParts): string[];
  getSvgSpanStyles(style: object, useWhiteSpace: boolean): string;
};

function svgColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value) ? value : fallback;
}

const BULLET = "•";
/** Space between a list marker and its text, in em. */
const MARKER_GAP = 0.45;

let measuring: CanvasRenderingContext2D | null = null;

function measure(font: string, text: string): number {
  measuring ??= document.createElement("canvas").getContext("2d");
  if (!measuring) return 0;
  measuring.font = font;
  return measuring.measureText(text).width;
}

/**
 * The editor's text box. It adds what Fabric's Textbox lacks:
 *
 * - Lists: each paragraph starts with a bullet or its number, drawn in the text's own font and
 *   colour outside the text, and every line of the paragraph is indented (hanging indent). The
 *   markers are not characters of the text, so editing, cursor positions and the stored text are
 *   unaffected.
 * - Upper case as a display setting (see lib/text-case.ts).
 *
 * It is registered under Fabric's own "Textbox" type, so saved pages keep loading as before and
 * load into this class.
 */
export class DesignTextbox extends Textbox {
  static type = "Textbox";
  static textLayoutProperties = [...Textbox.textLayoutProperties, "listStyle", "textCase"];
  static cacheProperties = [...Textbox.cacheProperties, "listStyle", "textCase", "effect"];

  /**
   * Indent of every line while the text is a list; set while wrapping. Declared without an
   * initializer: a class field initializer runs after Fabric's constructor has already laid the
   * text out, and would reset it.
   */
  private declare listIndent: number | undefined;

  /** Extra layers are drawn inside the same Fabric object, so history and exports keep one text. */
  _render(ctx: CanvasRenderingContext2D) {
    const background = effectBackground(this.effect);
    if (background) {
      const pad = background.padding / 100 * this.fontSize * 0.6;
      const width = Math.min(this.width, Math.max(1, ...this._textLines.map((_, i) => this.getLineWidth(i))) + pad * 2);
      const height = this.height;
      const radius = Math.min(width / 2, height / 2, background.radius / 100 * this.fontSize * 0.65);
      const left = -width / 2;
      const top = -height / 2;
      ctx.save();
      ctx.fillStyle = withAlpha(background.color, 1 - background.transparency / 100);
      ctx.beginPath();
      ctx.moveTo(left + radius, top);
      ctx.lineTo(left + width - radius, top);
      ctx.quadraticCurveTo(left + width, top, left + width, top + radius);
      ctx.lineTo(left + width, top + height - radius);
      ctx.quadraticCurveTo(left + width, top + height, left + width - radius, top + height);
      ctx.lineTo(left + radius, top + height);
      ctx.quadraticCurveTo(left, top + height, left, top + height - radius);
      ctx.lineTo(left, top + radius);
      ctx.quadraticCurveTo(left, top, left + radius, top);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const overlays = effectOverlayLayers(this.effect, this.fontSize);
    if (overlays.length) {
      const original = { fill: this.fill, stroke: this.stroke, strokeWidth: this.strokeWidth, paintFirst: this.paintFirst, shadow: this.shadow };
      for (const layer of overlays) {
        ctx.save();
        ctx.translate(layer.offsetX, layer.offsetY);
        ctx.globalAlpha *= this.effect?.type === "glitch" ? 0.78 : 1;
        this.fill = layer.fill ?? "";
        this.stroke = layer.stroke;
        this.strokeWidth = layer.strokeWidth;
        this.paintFirst = layer.stroke ? "stroke" : "fill";
        this.shadow = null;
        super._render(ctx);
        ctx.restore();
      }
      this.fill = original.fill;
      this.stroke = original.stroke;
      this.strokeWidth = original.strokeWidth;
      this.paintFirst = original.paintFirst;
      this.shadow = original.shadow;
    }
    super._render(ctx);
  }

  private markerFont(): string {
    return this._getFontDeclaration();
  }

  private marker(paragraph: number): string {
    return this.listStyle === "number" ? `${paragraph + 1}.` : BULLET;
  }

  private computeListIndent(paragraphs: number): number {
    if (!this.listStyle) return 0;
    const widest = this.listStyle === "number" ? measure(this.markerFont(), `${"0".repeat(String(paragraphs).length)}.`) : this.fontSize * 0.75;
    return widest + this.fontSize * MARKER_GAP;
  }

  _splitTextIntoLines(text: string) {
    return super._splitTextIntoLines(applyTextCase(text, this.textCase));
  }

  _wrapText(lines: string[], desiredWidth: number): string[][] {
    this.listIndent = this.computeListIndent(lines.length);
    if (!this.listIndent) return super._wrapText(lines, desiredWidth);
    this.isWrapping = true;
    const data = this.getGraphemeDataForRender(lines);
    const wrapped: string[][] = [];
    for (let i = 0; i < data.wordsData.length; i++) {
      wrapped.push(...this._wrapLine(i, desiredWidth, data, this.listIndent));
    }
    this.isWrapping = false;
    return wrapped;
  }

  _getLineLeftOffset(lineIndex: number): number {
    const offset = super._getLineLeftOffset(lineIndex);
    if (!this.listIndent) return offset;
    // Lines are aligned within the width left after the indent.
    if (this.textAlign === "right") return offset;
    if (this.textAlign === "center") return offset + this.listIndent / 2;
    return offset + this.listIndent;
  }

  enlargeSpaces() {
    // Justified lines fill the width left after the indent.
    const width = this.width;
    this.width = width - (this.listIndent ?? 0);
    super.enlargeSpaces();
    this.width = width;
  }

  /** Lines that start a paragraph, with the paragraph's index. */
  private paragraphStarts(): { line: number; paragraph: number }[] {
    const starts: { line: number; paragraph: number }[] = [];
    for (let i = 0; i < this._textLines.length; i++) {
      const map = this._styleMap?.[i];
      if (!map || map.offset === 0) starts.push({ line: i, paragraph: map ? map.line : i });
    }
    return starts;
  }

  _renderTextCommon(ctx: CanvasRenderingContext2D, method: "fillText" | "strokeText") {
    super._renderTextCommon(ctx, method);
    if (!this.listStyle) return;
    ctx.save();
    const left = this._getLeftOffset();
    const top = this._getTopOffset();
    const font = this.markerFont();
    let lineTop = 0;
    let next = 0;
    const starts = this.paragraphStarts();
    for (let i = 0; i < this._textLines.length; i++) {
      if (starts[next]?.line === i) {
        const marker = this.marker(starts[next].paragraph);
        const x = left + this._getLineLeftOffset(i) - this.fontSize * MARKER_GAP - measure(font, marker);
        // Where Fabric puts the line's baseline (see FabricText._renderTextCommon and _renderChars).
        const own = this.getHeightOfLine(i) / this.lineHeight;
        const baseline = top + lineTop + own - own * this._fontSizeFraction;
        this._renderChar(method, ctx, i, 0, marker, x, baseline);
        next++;
      }
      lineTop += this.getHeightOfLine(i);
    }
    ctx.restore();
  }

  _getSVGTextAndBg(textTopOffset: number, textLeftOffset: number): SvgTextParts {
    const result = (Textbox.prototype as unknown as SvgExport)._getSVGTextAndBg.call(this, textTopOffset, textLeftOffset);
    const background = effectBackground(this.effect);
    if (background) {
      const pad = background.padding / 100 * this.fontSize * 0.6;
      const width = Math.min(this.width, Math.max(1, ...this._textLines.map((_, i) => this.getLineWidth(i))) + pad * 2);
      const radius = Math.min(width / 2, this.height / 2, background.radius / 100 * this.fontSize * 0.65);
      result.textBgRects.unshift(`<rect x="${(-width / 2).toFixed(2)}" y="${(-this.height / 2).toFixed(2)}" width="${width.toFixed(2)}" height="${this.height.toFixed(2)}" rx="${radius.toFixed(2)}" ry="${radius.toFixed(2)}" fill="${svgColor(background.color, "#fef08a")}" fill-opacity="${(1 - background.transparency / 100).toFixed(3)}"/>\n`);
    }
    if (!this.listStyle) return result;
    const font = this.markerFont();
    let height = textTopOffset;
    let next = 0;
    const starts = this.paragraphStarts();
    for (let i = 0; i < this._textLines.length; i++) {
      const lineHeight = this.getHeightOfLine(i);
      if (starts[next]?.line === i) {
        const marker = this.marker(starts[next].paragraph);
        const x = textLeftOffset + this._getLineLeftOffset(i) - this.fontSize * MARKER_GAP - measure(font, marker);
        const y = height + (lineHeight * (1 - this._fontSizeFraction)) / this.lineHeight;
        const style = (this as unknown as SvgExport).getSvgSpanStyles(this.getCompleteStyleDeclaration(i, 0), false);
        result.textSpans.push(`<tspan x="${x.toFixed(2)}" y="${y.toFixed(2)}"${style ? ` style="${style}"` : ""}>${marker}</tspan>`);
        next++;
      }
      height += lineHeight;
    }
    return result;
  }

  _wrapSVGTextAndBg(parts: SvgTextParts): string[] {
    const base = (Textbox.prototype as unknown as SvgExport)._wrapSVGTextAndBg.call(this, parts);
    const overlays = effectOverlayLayers(this.effect, this.fontSize);
    if (!overlays.length) return base;
    const textMarkup = base.slice(1).join("");
    const copies = overlays.map((layer) => {
      const style = layer.stroke
        ? `fill:none;stroke:${svgColor(layer.stroke, "#a855f7")};stroke-width:${layer.strokeWidth};stroke-linejoin:round`
        : `fill:${svgColor(layer.fill ?? "", "#00e5ff")};stroke:none`;
      const text = textMarkup.replace(/style="[^"]*"/, `style="${style}"`);
      return `<g transform="translate(${layer.offsetX} ${layer.offsetY})" opacity="${this.effect?.type === "glitch" ? "0.78" : "1"}">${text}</g>\n`;
    });
    return [base[0], ...copies, ...base.slice(1)];
  }
}

classRegistry.setClass(DesignTextbox);
