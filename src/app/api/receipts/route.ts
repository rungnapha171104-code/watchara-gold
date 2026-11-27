import { NextRequest, NextResponse } from "next/server";
import { admin, BUCKET } from "@/lib/supabase";
import { filtersFrom, queryReceipts } from "@/lib/query";
import { classifyDocCategory, DOC_CATEGORY_META, packTaxNotes, unpackTaxNotes } from "@/lib/tax";
import { classifyMetal, type ReceiptData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normName = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const normPhone = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const normNo = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

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

  const cat = classifyDocCategory(data.doc_type, data.doc_category);
  const docType = DOC_CATEGORY_META[cat].docType;

  if (!force && data.date && data.grand_total != null) {
    const { data: candidates } = await db
      .from("receipts")
      .select("*, receipt_items(*)")
      .eq("date", data.date)
      .eq("grand_total", data.grand_total);
    const targetName = normName(data.customer_name);
    const targetPhone = normPhone(data.phone);
    const targetNo = normNo(data.receipt_no);
    const dup = (candidates ?? []).find((c) => {
      const cCat = classifyDocCategory(c.doc_type);
      if (cCat !== cat) return false;
      const meta = unpackTaxNotes(c.notes, c.other_amount);
      if (targetNo && normNo(meta.receipt_no) === targetNo) return true;
      if (targetName && normName(c.customer_name) === targetName) return true;
      if (targetPhone && normPhone(c.phone) === targetPhone) return true;
      return false;
    });
    if (dup) return NextResponse.json({ duplicate: dup }, { status: 409 });
  }

  let path: string | null = null;
  if (file instanceof File && file.size > 0) {
    const ext = file.type === "application/pdf" ? "pdf" : "jpg";
    path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "image/jpeg",
    });
    if (error) return NextResponse.json({ error: "อัปโหลดไฟล์ไม่สำเร็จ: " + error.message }, { status: 500 });
  }

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
    doc_type: docType,
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
    image_url: path,
  };
  const { data: rec, error } = await db.from("receipts").insert(head).select("id").single();
  if (error || !rec) {
    if (path) await db.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error?.message ?? "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
  const items = data.items ?? [];
  if (items.length) {
    const rows = items.map((i, idx) => {
      const isPt = i.metal_type === "แพลตตินัม";
      const rawName = i.item_name ?? null;
      const itemName = isPt && classifyMetal(rawName) !== "แพลตตินัม" ? (rawName ? `แพลตตินัม (${rawName})` : "แพลตตินัม") : rawName;
      return {
        receipt_id: rec.id,
        no: i.no ?? idx + 1,
        // แปลงแพลตตินัมเป็น 'อื่นๆ' เพื่อผ่าน check constraint เดิมใน DB แล้ว hydrate กลับมาเป็น 'แพลตตินัม' ตอนอ่าน
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
    if (e2) {
      await db.from("receipts").delete().eq("id", rec.id);
      if (path) await db.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }
  }
  return NextResponse.json({ id: rec.id });
}
