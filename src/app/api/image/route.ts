import { NextRequest, NextResponse } from "next/server";
import { signPath } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = await signPath(req.nextUrl.searchParams.get("path"));
  if (!url) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(url);
}
