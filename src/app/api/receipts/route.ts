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

  const head = {
    doc_type: data.doc_type?.trim() || "ใบรับสินค้า / ใบเสร็จรับเงิน",
    date: data.date ?? null,
    customer_name: data.customer_name ?? null,
    phone: data.phone ?? null,
    total_weight: data.total_weight ?? null,
    subtotal: data.subtotal ?? null,
    other_amount: data.other_amount ?? null,
    grand_total: data.grand_total ?? null,
    payment_method: data.payment_method ?? null,
    payment_detail: data.payment_detail ?? null,
    buyer_name: data.buyer_name ?? null,
    notes: data.notes ?? null,
    image_url: path,
  };
  const { data: rec, error } = await db.from("receipts").insert(head).select("id").single();
  if (error || !rec) {
    if (path) await db.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error?.message ?? "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
  const items = data.items ?? [];
  if (items.length) {
    const rows = items.map((i, idx) => ({
      receipt_id: rec.id,
      no: i.no ?? idx + 1,
      metal_type: i.metal_type || "อื่นๆ",
      item_name: i.item_name ?? null,
      base_price: i.base_price ?? null,
      plus_price: i.plus_price ?? null,
      buy_percent: i.buy_percent ?? null,
      weight: i.weight ?? null,
      price_per_gram: i.price_per_gram ?? null,
      amount: i.amount ?? null,
    }));
    const { error: e2 } = await db.from("receipt_items").insert(rows);
    if (e2) {
      await db.from("receipts").delete().eq("id", rec.id);
      if (path) await db.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }
  }
  return NextResponse.json({ id: rec.id });
}
