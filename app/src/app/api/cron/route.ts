import { NextResponse } from "next/server";
import { executeJob, getLastRun } from "@/lib/cron";

export const dynamic = "force-dynamic";

/** GET /api/cron — returns last run status */
export async function GET() {
  try {
    return NextResponse.json(getLastRun());
  } catch (e: unknown) {
    console.error("[api/cron] GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/cron — manually trigger the job */
export async function POST() {
  try {
    const result = await executeJob();
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("[api/cron] POST error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
