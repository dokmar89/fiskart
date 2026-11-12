import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inspectFont } from "./font-inspect";

const fontFile = (name: string) =>
  new Uint8Array(readFileSync(join(process.cwd(), "node_modules/@fontsource/lora/files", name)));

/** Unpacks a WOFF 1.0 file into the plain TrueType file it wraps, to test the TTF path on a real font. */
function woffToTtf(woff: Uint8Array): Uint8Array {
  const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  const count = view.getUint16(12);
  const tables = Array.from({ length: count }, (_, i) => {
    const r = 44 + i * 20;
    const offset = view.getUint32(r + 4);
    const compressed = view.getUint32(r + 8);
    const original = view.getUint32(r + 12);
    const raw = woff.subarray(offset, offset + compressed);
    return { tag: woff.subarray(r, r + 4), checksum: view.getUint32(r + 16), data: compressed < original ? new Uint8Array(inflateSync(raw)) : raw };
  });
  let offset = 12 + count * 16;
  const placed = tables.map((t) => {
    const at = offset;
    offset += Math.ceil(t.data.byteLength / 4) * 4;
    return at;
  });
  const out = new Uint8Array(offset);
  const o = new DataView(out.buffer);
  o.setUint32(0, view.getUint32(4));
  o.setUint16(4, count);
  tables.forEach((t, i) => {
    out.set(t.tag, 12 + i * 16);
    o.setUint32(12 + i * 16 + 4, t.checksum);
    o.setUint32(12 + i * 16 + 8, placed[i]);
    o.setUint32(12 + i * 16 + 12, t.data.byteLength);
    out.set(t.data, placed[i]);
  });
  return out;
}

describe("inspectFont", () => {
  it("reads family, weight and style from WOFF2", () => {
    expect(inspectFont(fontFile("lora-latin-400-normal.woff2"))).toEqual({
      family: "Lora",
      weight: 400,
      style: "normal",
      mimeType: "font/woff2",
      extension: "woff2",
    });
    expect(inspectFont(fontFile("lora-latin-700-italic.woff2"))).toMatchObject({ family: "Lora", weight: 700, style: "italic" });
  });

  it("reads TrueType", () => {
    const ttf = woffToTtf(fontFile("lora-latin-700-italic.woff"));
    expect(inspectFont(ttf)).toEqual({ family: "Lora", weight: 700, style: "italic", mimeType: "font/ttf", extension: "ttf" });
  });

  it("refuses anything else", () => {
    expect(inspectFont(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>".padEnd(100)))).toBeNull();
    expect(inspectFont(fontFile("lora-latin-400-normal.woff"))).toBeNull();
    const broken = fontFile("lora-latin-400-normal.woff2").slice(0, 200);
    expect(inspectFont(broken)).toBeNull();
  });
});
