import { NextRequest, NextResponse } from "next/server";
import { admin, BUCKET } from "@/lib/supabase";
import { filtersFrom, queryReceipts } from "@/lib/query";
import type { ReceiptData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normName = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const normPhone = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await queryReceipts(filtersFrom(req.nextUrl.searchParams)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const data = JSON.parse(String(form.get("data"))) as ReceiptData;
  const force = form.get("force") === "true";
  const file = form.get("file");
  const db = admin();

  if (!force && data.date && data.grand_total != null) {
    const { data: candidates } = await db
      .from("receipts")
      .select("*, receipt_items(*)")
      .eq("date", data.date)
      .eq("grand_total", data.grand_total);
    const targetName = normName(data.customer_name);
    const targetPhone = normPhone(data.phone);
    const dup = (candidates ?? []).find(
      (c) =>
        (targetName && normName(c.customer_name) === targetName) ||
        (targetPhone && normPhone(c.phone) === targetPhone)
    );
    if (dup) return NextResponse.json({ duplicate: dup }, { status: 409 });
  }

  let path: string | null = null;
  if (file instanceof File && file.size > 0) {
    const ext = file.type === "application/pdf" ? "pdf" : "jpg";
    path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "image/jpeg" });
    if (error) return NextResponse.json({ error: "อัปโหลดไฟล์ไม่สำเร็จ: " + error.message }, { status: 500 });
  }

  const { items, ...head } = data;
  const { data: rec, error } = await db.from("receipts").insert({ ...head, image_url: path }).select("id").single();
  if (error || !rec) {
    if (path) await db.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error?.message ?? "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
  if (items.length) {
    const { error: e2 } = await db.from("receipt_items").insert(items.map((i) => ({ ...i, receipt_id: rec.id })));
    if (e2) {
      await db.from("receipts").delete().eq("id", rec.id);
      if (path) await db.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }
  }
  return NextResponse.json({ id: rec.id });
}
