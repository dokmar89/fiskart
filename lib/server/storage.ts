import "server-only";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** Root for stored files. Paths kept in the database are relative to it. */
export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR ?? "./data");
}

/** Absolute path for a stored relative path; refuses anything that escapes DATA_DIR. */
export function resolveDataPath(relativePath: string): string {
  const root = dataDir();
  const full = path.resolve(root, relativePath);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error(`Path escapes DATA_DIR: ${relativePath}`);
  return full;
}

/** Writes via a temporary file and rename, so a reader never sees a half-written file. */
export async function writeDataFile(relativePath: string, data: Uint8Array) {
  const full = resolveDataPath(relativePath);
  await mkdir(path.dirname(full), { recursive: true });
  const temp = `${full}.${randomUUID()}.tmp`;
  await writeFile(temp, data);
  await rename(temp, full);
}

export async function readDataFile(relativePath: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveDataPath(relativePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Size of a stored file, or null when it is missing. */
export async function dataFileSize(relativePath: string): Promise<number | null> {
  try {
    return (await stat(resolveDataPath(relativePath))).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Bytes `start` to `end` (inclusive) of a stored file, for range requests (video seeking). */
export async function readDataFileRange(relativePath: string, start: number, end: number): Promise<Buffer> {
  const handle = await open(resolveDataPath(relativePath), "r");
  try {
    const buffer = Buffer.alloc(end - start + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function deleteDataFile(relativePath: string) {
  await rm(resolveDataPath(relativePath), { force: true });
}

export async function copyDataFile(from: string, to: string) {
  const target = resolveDataPath(to);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(resolveDataPath(from), target);
}
