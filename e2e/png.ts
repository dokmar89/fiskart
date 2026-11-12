import { randomBytes } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * A real, decodable RGB PNG. `fill: "noise"` makes random pixels stored without compression,
 * so the file is as large as the raw image (about width × height × 3 bytes).
 */
export function makePng(width: number, height: number, fill: [number, number, number] | "noise"): Buffer {
  const rowLength = 1 + width * 3;
  let raw: Buffer;
  if (fill === "noise") {
    raw = randomBytes(rowLength * height);
    for (let y = 0; y < height; y++) raw[y * rowLength] = 0;
  } else {
    raw = Buffer.alloc(rowLength * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) raw.set(fill, y * rowLength + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: fill === "noise" ? 0 : 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** An RGB PNG whose pixels come from a function, for pictures with a shape in them. */
export function makePngFrom(width: number, height: number, colour: (x: number, y: number) => [number, number, number]): Buffer {
  const rowLength = 1 + width * 3;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(colour(x, y), y * rowLength + 1 + x * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
