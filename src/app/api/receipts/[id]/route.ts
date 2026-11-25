import { NextRequest, NextResponse } from "next/server";
import { admin, BUCKET } from "@/lib/supabase";
import type { ReceiptData } from "@/lib/types";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { items, ...head } = (await req.json()) as ReceiptData;
  const db = admin();
  const { error } = await db.from("receipts").update(head).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from("receipt_items").delete().eq("receipt_id", id);
  if (items.length) {
    const { error: e2 } = await db.from("receipt_items").insert(items.map((i) => ({ ...i, receipt_id: id })));
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();
  const { data } = await db.from("receipts").select("image_url").eq("id", id).single();
  if (data?.image_url) await db.storage.from(BUCKET).remove([data.image_url]);
  const { error } = await db.from("receipts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
