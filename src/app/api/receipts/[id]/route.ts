import { NextRequest, NextResponse } from "next/server";
import { admin, BUCKET } from "@/lib/supabase";
import { classifyDocCategory, DOC_CATEGORY_META, packTaxNotes } from "@/lib/tax";
import { classifyMetal, type ReceiptData } from "@/lib/types";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = (await req.json()) as ReceiptData;
  const cat = classifyDocCategory(data.doc_type, data.doc_category);
  const packedNotes = packTaxNotes({
    receipt_no: data.receipt_no,
    tax_id: data.tax_id,
    address: data.address,
    redemption_price: data.redemption_price,
    tax_base: data.tax_base,
    vat_amount: data.vat_amount ?? data.other_amount,
    note_text: data.notes,
  });

  const head = {
    doc_type: DOC_CATEGORY_META[cat].docType,
    date: data.date ?? null,
    customer_name: data.customer_name ?? null,
    phone: data.phone ?? null,
    total_weight: data.total_weight ?? null,
    subtotal: data.subtotal ?? null,
    other_amount: data.vat_amount ?? data.other_amount ?? null,
    grand_total: data.grand_total ?? null,
    payment_method: data.payment_method ?? null,
    payment_detail: data.payment_detail ?? null,
    buyer_name: data.buyer_name ?? null,
    notes: packedNotes,
  };
  const db = admin();
  const { error } = await db.from("receipts").update(head).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from("receipt_items").delete().eq("receipt_id", id);
  const items = data.items ?? [];
  if (items.length) {
    const rows = items.map((i, idx) => {
      const isPt = i.metal_type === "แพลตตินัม";
      const rawName = i.item_name ?? null;
      const itemName = isPt && classifyMetal(rawName) !== "แพลตตินัม" ? (rawName ? `แพลตตินัม (${rawName})` : "แพลตตินัม") : rawName;
      return {
        receipt_id: id,
        no: i.no ?? idx + 1,
        metal_type: isPt ? "อื่นๆ" : i.metal_type || "อื่นๆ",
        item_name: itemName,
        base_price: i.base_price ?? null,
        plus_price: i.plus_price ?? null,
        buy_percent: i.buy_percent ?? null,
        weight: i.weight ?? null,
        price_per_gram: i.price_per_gram ?? null,
        amount: i.amount ?? null,
      };
    });
    const { error: e2 } = await db.from("receipt_items").insert(rows);
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
