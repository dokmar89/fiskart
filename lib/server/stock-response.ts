import "server-only";
import { NextResponse } from "next/server";
import type { StockError } from "./stock";

const STATUS = { "missing-key": 503, "not-found": 404, unavailable: 502 } as const;

/** A stock failure as JSON the panels understand: `code` says which explanation to show. */
export function stockErrorResponse(error: StockError) {
  return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS[error.code] });
}
