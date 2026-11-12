import "server-only";
import { NextResponse } from "next/server";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Parses a JSON request body; null when it is not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export const MAX_TITLE_LENGTH = 200;

/** Trimmed title, or null when the value is not a usable title. */
export function parseTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim().slice(0, MAX_TITLE_LENGTH);
  return title.length > 0 ? title : null;
}
