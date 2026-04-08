import { NextResponse } from "next/server";
import { getDnsPolicy, updateDnsPolicy, deleteDnsPolicy } from "@/lib/unifi";
import { buildAndValidateDnsBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getDnsPolicy(id);
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("[api/dns/:id] GET error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const raw = await request.json();
    const result = buildAndValidateDnsBody(raw);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = await updateDnsPolicy(id, result.body);
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("[api/dns/:id] PUT error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await deleteDnsPolicy(id);
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error("[api/dns/:id] DELETE error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
