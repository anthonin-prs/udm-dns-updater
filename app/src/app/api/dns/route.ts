import { NextResponse } from "next/server";
import { listDnsPolicies, createDnsPolicy } from "@/lib/unifi";
import { buildAndValidateDnsBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listDnsPolicies();
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("[api/dns] GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const result = buildAndValidateDnsBody(raw);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = await createDnsPolicy(result.body);
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("[api/dns] POST error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
