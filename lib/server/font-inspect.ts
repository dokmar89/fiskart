import { brotliDecompressSync } from "node:zlib";

export type InspectedFont = {
  family: string;
  weight: 400 | 700;
  style: "normal" | "italic";
  mimeType: string;
  extension: string;
};

type Tables = Map<string, Uint8Array>;

const WOFF2_KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ",
  "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS",
  "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc",
  "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
  "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

const tagAt = (view: DataView, offset: number) =>
  String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));

/** Tables of a TrueType or CFF-flavoured OpenType file. */
function sfntTables(data: Uint8Array): Tables {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = view.getUint16(4);
  const tables: Tables = new Map();
  for (let i = 0; i < count; i++) {
    const record = 12 + i * 16;
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (offset + length > data.byteLength) throw new Error("Table outside the file");
    tables.set(tagAt(view, record), data.subarray(offset, offset + length));
  }
  return tables;
}

/**
 * Tables of a WOFF2 file. All table data sits in one Brotli stream, in directory order; only
 * glyf, loca and hmtx may be transformed, and the name and OS/2 tables read here never are.
 */
function woff2Tables(data: Uint8Array): Tables {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (tagAt(view, 4) === "ttcf") throw new Error("Font collections are not supported");
  const count = view.getUint16(12);
  const compressedLength = view.getUint32(20);
  let pos = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = view.getUint8(pos++);
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error("Bad UIntBase128");
  };
  const entries: { tag: string; length: number }[] = [];
  for (let i = 0; i < count; i++) {
    const flags = view.getUint8(pos++);
    let tag: string;
    if ((flags & 0x3f) === 0x3f) {
      tag = tagAt(view, pos);
      pos += 4;
    } else {
      tag = WOFF2_KNOWN_TAGS[flags & 0x3f];
    }
    const origLength = base128();
    const version = flags >> 6;
    const transformed = tag === "glyf" || tag === "loca" ? version !== 3 : version !== 0;
    entries.push({ tag, length: transformed ? base128() : origLength });
  }
  const stream = new Uint8Array(brotliDecompressSync(data.subarray(pos, pos + compressedLength)));
  const tables: Tables = new Map();
  let offset = 0;
  for (const { tag, length } of entries) {
    tables.set(tag, stream.subarray(offset, offset + length));
    offset += length;
  }
  return tables;
}

/** The legacy family (name id 1) and subfamily (name id 2), preferring the Windows English names. */
function readNames(name: Uint8Array): { family: string; subfamily: string } {
  const view = new DataView(name.buffer, name.byteOffset, name.byteLength);
  const count = view.getUint16(2);
  const storage = view.getUint16(4);
  const found: Record<number, { score: number; value: string }> = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const platform = view.getUint16(r);
    const encoding = view.getUint16(r + 2);
    const language = view.getUint16(r + 4);
    const id = view.getUint16(r + 6);
    if (id !== 1 && id !== 2) continue;
    const bytes = name.subarray(storage + view.getUint16(r + 10), storage + view.getUint16(r + 10) + view.getUint16(r + 8));
    let value: string;
    let score: number;
    if (platform === 3 && (encoding === 1 || encoding === 0)) {
      value = new TextDecoder("utf-16be").decode(bytes);
      score = language === 0x409 ? 3 : 2;
    } else if (platform === 0) {
      value = new TextDecoder("utf-16be").decode(bytes);
      score = 2;
    } else if (platform === 1 && encoding === 0) {
      value = new TextDecoder("latin1").decode(bytes);
      score = 1;
    } else {
      continue;
    }
    if (!found[id] || found[id].score < score) found[id] = { score, value: value.trim() };
  }
  return { family: found[1]?.value ?? "", subfamily: found[2]?.value ?? "" };
}

const FORMATS = {
  ttf: { mimeType: "font/ttf", extension: "ttf" },
  otf: { mimeType: "font/otf", extension: "otf" },
  woff2: { mimeType: "font/woff2", extension: "woff2" },
};

/**
 * Identifies a TTF, OTF or WOFF2 font by its content and reads the face it declares. Bold and
 * italic come from the OS/2 selection flags (the style-linking a word processor uses), so a
 * "Light" or "Black" cut is its own family with a regular face, as it is in other apps.
 * Returns null for anything else or for a font without a family name.
 */
export function inspectFont(data: Uint8Array): InspectedFont | null {
  if (data.byteLength < 48) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const signature = view.getUint32(0);
  const format =
    signature === 0x00010000 || signature === 0x74727565 ? FORMATS.ttf
    : signature === 0x4f54544f ? FORMATS.otf
    : signature === 0x774f4632 ? FORMATS.woff2
    : null;
  if (!format) return null;
  try {
    const tables = format === FORMATS.woff2 ? woff2Tables(data) : sfntTables(data);
    const name = tables.get("name");
    if (!name) return null;
    const { family, subfamily } = readNames(name);
    if (!family) return null;
    const os2 = tables.get("OS/2");
    const selection = os2 && os2.byteLength >= 64 ? new DataView(os2.buffer, os2.byteOffset, os2.byteLength).getUint16(62) : null;
    const sub = subfamily.toLowerCase();
    const italic = selection === null ? /italic|oblique/.test(sub) : Boolean(selection & 0x01);
    const bold = selection === null ? sub.includes("bold") : Boolean(selection & 0x20);
    return { family: family.slice(0, 100), weight: bold ? 700 : 400, style: italic ? "italic" : "normal", ...format };
  } catch {
    return null;
  }
}
