import type { PageTiming } from "./animation";
import type { Guides } from "./guides";

/**
 * Shape of a stored page, shared by the editor and the route handlers. No Fabric imports here, so
 * server code can use it.
 */

/**
 * Version of the page JSON format. Bump it, and add a migration to `migratePage`, whenever the
 * stored shape changes. 2 (phase 16): objects may carry `animation`, pages `timing`.
 */
export const SCHEMA_VERSION = 2;

export type CanvasData = {
  /** Fabric object JSON, serialized with the custom properties from lib/canvas/serialize.ts. */
  objects: Record<string, unknown>[];
  /** Ruler guides (phase 12), only when the page has any. Optional, so older pages need no migration. */
  guides?: Guides;
  /** Page duration, transition and page animation (phase 16), only when not the defaults. */
  timing?: PageTiming;
};

export type PageData = {
  schemaVersion: number;
  canvasData: CanvasData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates an incoming page body. Returns an error message, or null when valid. */
export function validatePageData(value: unknown): string | null {
  if (!isRecord(value)) return "Tělo požadavku musí být objekt";
  if (typeof value.schemaVersion !== "number" || !Number.isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion > SCHEMA_VERSION) {
    return `schemaVersion musí být mezi 1 a ${SCHEMA_VERSION}`;
  }
  const data = value.canvasData;
  if (!isRecord(data)) return "canvasData musí být objekt";
  if (!Array.isArray(data.objects) || !data.objects.every(isRecord)) return "canvasData.objects musí být pole objektů";
  return null;
}

export const EMPTY_CANVAS_DATA: CanvasData = { objects: [] };

/**
 * Brings a stored page up to the current format. Version 1 pages are already valid version 2 pages
 * (animations and timing are optional and default to none), so only the number changes; the content
 * is left exactly as it was. Newer versions than this code knows are refused.
 */
export function migratePage<T extends { schemaVersion: number; canvasData: unknown }>(page: T): T & { schemaVersion: typeof SCHEMA_VERSION } {
  if (page.schemaVersion > SCHEMA_VERSION || page.schemaVersion < 1) throw new Error(`Nepodporovaná verze stránky (schemaVersion ${page.schemaVersion})`);
  return { ...page, schemaVersion: SCHEMA_VERSION };
}
