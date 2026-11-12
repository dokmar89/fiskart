/**
 * Downloads the background removal model and WASM runtime once and puts them in
 * public/bg-removal/, so the editor serves them itself and never asks the IMG.LY CDN at run time.
 * Only the files the editor uses are kept (the "medium" model and the CPU runtime). Skipped when
 * the files for the installed library version are already there.
 *
 *   pnpm bg-removal:fetch
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/** Resource keys the editor loads; see lib/bg-removal-config.ts. */
const KEYS = ["/models/isnet_fp16", "/onnxruntime-web/ort-wasm-simd-threaded.wasm", "/onnxruntime-web/ort-wasm-simd-threaded.mjs"];

type Resources = Record<string, { chunks: { name: string; hash?: string; offsets: [number, number] }[]; size: number; mime: string }>;

const root = path.resolve(__dirname, "..");
const target = path.join(root, "public", "bg-removal");

/** Files of a .tar archive by name. Enough of the format for npm packages (ustar, plain files). */
function untar(data: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start: number, length: number) => header.subarray(start, start + length).toString("utf8").split("\0")[0];
    const prefix = field(345, 155);
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1);
    offset += 512;
    if (type === "0" || type === "") files.set(name, data.subarray(offset, offset + size));
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

async function main() {
  const { version } = JSON.parse(await readFile(path.join(root, "node_modules/@imgly/background-removal/package.json"), "utf8")) as { version: string };
  const stamp = path.join(target, "VERSION");
  if (existsSync(stamp) && (await readFile(stamp, "utf8")).trim() === version) {
    console.log(`Background removal files ${version} are already in public/bg-removal.`);
    return;
  }
  const url = `https://staticimgly.com/@imgly/background-removal-data/${version}/package.tgz`;
  console.log(`Downloading ${url} …`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const files = untar(gunzipSync(Buffer.from(await res.arrayBuffer())));
  const resources = JSON.parse(files.get("package/dist/resources.json")!.toString("utf8")) as Resources;

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const kept: Resources = {};
  for (const key of KEYS) {
    const entry = resources[key];
    if (!entry) throw new Error(`The data package has no ${key}`);
    kept[key] = entry;
    for (const chunk of entry.chunks) {
      const file = files.get(`package/dist/${chunk.name}`);
      if (!file) throw new Error(`The data package has no chunk ${chunk.name}`);
      if (chunk.hash && createHash("sha256").update(file).digest("hex") !== chunk.hash) throw new Error(`Chunk ${chunk.name} is damaged`);
      await writeFile(path.join(target, chunk.name), file);
    }
  }
  await writeFile(path.join(target, "resources.json"), JSON.stringify(kept));
  await writeFile(stamp, `${version}\n`);
  console.log(`Saved ${KEYS.length} resources to public/bg-removal.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
