import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/server/ai";

/** Which AI tools are set up; never the keys themselves. */
export function GET() {
  return NextResponse.json(aiStatus(), { headers: { "Cache-Control": "no-store" } });
}
