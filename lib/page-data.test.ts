import { describe, expect, it } from "vitest";
import { migratePage, SCHEMA_VERSION, validatePageData } from "./page-data";

describe("validatePageData", () => {
  it("accepts a well-formed page", () => {
    expect(validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData: { objects: [{ type: "Rect" }] } })).toBeNull();
  });

  it("rejects other versions and malformed data", () => {
    expect(validatePageData({ schemaVersion: SCHEMA_VERSION + 1, canvasData: { objects: [] } })).toMatch(/schemaVersion/);
    expect(validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData: { objects: "x" } })).toMatch(/objects/);
    expect(validatePageData({ schemaVersion: SCHEMA_VERSION, canvasData: { objects: [1] } })).toMatch(/objects/);
    expect(validatePageData([])).toMatch(/objekt/);
    expect(validatePageData(null)).toMatch(/objekt/);
  });
});

describe("migratePage", () => {
  it("brings version 1 pages to the current version without touching their content", () => {
    const canvasData = { objects: [{ type: "Rect", left: 1 }] };
    const migrated = migratePage({ id: "p", schemaVersion: 1, canvasData });
    expect(migrated).toEqual({ id: "p", schemaVersion: SCHEMA_VERSION, canvasData });
    expect(migrated.canvasData).toBe(canvasData);
    expect(validatePageData({ schemaVersion: 1, canvasData })).toBeNull();
  });

  it("refuses versions it does not know", () => {
    expect(() => migratePage({ schemaVersion: SCHEMA_VERSION + 1, canvasData: {} })).toThrow(/schemaVersion/);
    expect(() => migratePage({ schemaVersion: 0, canvasData: {} })).toThrow(/schemaVersion/);
  });
});
