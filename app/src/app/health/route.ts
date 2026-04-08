import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /health — lightweight liveness endpoint for container health checks */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}