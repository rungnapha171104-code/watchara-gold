import { DOC_CATEGORY_META } from "./tax";
import type { ReceiptRow } from "./types";

/** ค่าที่เขียนลง CSV ตามตัวอักษร ไม่ผ่านการ escape (ใช้กับสูตรเบอร์โทร/เลขผู้เสียภาษี) */
class Raw {
  constructor(public v: string) {}
}

export function csvCell(v: unknown): string {
  if (v instanceof Raw) return v.v;
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** ฟอร์แมตเลขที่ขึ้นต้นด้วย 0 (เบอร์โทร / เลขประจำตัวผู้เสียภาษี) ไม่ให้ Excel ตัดเลข 0 หน้า */
export const phoneCell = (p: string | null | undefined): Raw => new Raw(p ? `="${p}"` : "");

export function toCsv(rows: unknown[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** ไฟล์ CSV รูปแบบสำหรับยื่นภาษี (แยกฝั่งลูกค้าซื้อเข้า / ฝั่งส่งสำนักงานใหญ่ใบกำกับภาษี) */
export function taxCsv(receipts: ReceiptRow[]): string {
  const rows: unknown[][] = [
    [
      "ลำดับ",
      "ประเภทบิล",
      "ชื่อเอกสาร",
      "วันที่",
      "เลขที่ใบเสร็จ/ใบกำกับภาษี",
      "ชื่อลูกค้า/ผู้ขาย",
      "เลขประจำตัวผู้เสียภาษี",
      "ที่อยู่",
      "รายการสินค้า",
      "น้ำหนักทอง(กรัม)",
      "รวมเงิน(ก่อน VAT)",
      "หักราคาทองรูปพรรณซื้อคืน",
      "ส่วนต่างฐานภาษี",
      "ภาษีมูลค่าเพิ่ม(VAT 7%)",
      "ยอดเงินสุทธิ",
      "ช่องทางชำระเงิน",
      "รายละเอียดการชำระ",
      "ผู้รับเงิน/ผู้ซื้อ",
      "หมายเหตุ",
    ],
  ];
  receipts.forEach((r, idx) => {
    const cat = r.doc_category ?? "customer";
    const itemDesc = r.receipt_items
      .map((i) => i.item_name || i.metal_type)
      .filter(Boolean)
      .join(" / ");
    rows.push([
      idx + 1,
      DOC_CATEGORY_META[cat].short,
      r.doc_type ?? DOC_CATEGORY_META[cat].docType,
      r.date,
      phoneCell(r.receipt_no),
      r.customer_name,
      phoneCell(r.tax_id),
      r.address,
      itemDesc,
      r.total_weight,
      r.subtotal,
      r.redemption_price,
      r.tax_base,
      r.vat_amount ?? r.other_amount,
      r.grand_total,
      r.payment_method,
      r.payment_detail,
      r.buyer_name,
      r.notes,
    ]);
  });
  return toCsv(rows);
}

export function itemsCsv(receipts: ReceiptRow[]): string {
  const rows: unknown[][] = [
    [
      "ประเภทบิล",
      "วันที่",
      "เลขที่บิล",
      "ชื่อลูกค้า/ผู้ขาย",
      "เลขประจำตัวผู้เสียภาษี",
      "เบอร์โทร",
      "ประเภทโลหะ",
      "ลำดับ",
      "รายการ",
      "ราคา/หน่วย",
      "ราคาบวก",
      "% ซื้อ",
      "น้ำหนัก(กรัม)",
      "ต่อกรัม",
      "จำนวนเงิน",
      "VAT 7%",
      "ช่องทางชำระเงิน",
      "รายละเอียดการชำระ",
      "ผู้รับเงิน/ผู้ซื้อ",
    ],
  ];
  for (const r of receipts) {
    const cat = r.doc_category ?? "customer";
    const items = [...r.receipt_items].sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
    for (const i of items) {
      rows.push([
        DOC_CATEGORY_META[cat].short,
        r.date,
        phoneCell(r.receipt_no),
        r.customer_name,
        phoneCell(r.tax_id),
        phoneCell(r.phone),
        i.metal_type,
        i.no,
        i.item_name,
        i.base_price,
        i.plus_price,
        i.buy_percent,
        i.weight,
        i.price_per_gram,
        i.amount,
        r.vat_amount ?? r.other_amount,
        r.payment_method,
        r.payment_detail,
        r.buyer_name,
      ]);
    }
  }
  return toCsv(rows);
}

export function summaryCsv(receipts: ReceiptRow[]): string {
  const rows: unknown[][] = [
    [
      "ประเภทบิล",
      "วันที่",
      "เลขที่บิล",
      "ชื่อลูกค้า/ผู้ขาย",
      "เลขประจำตัวผู้เสียภาษี",
      "เบอร์โทร",
      "ประเภทโลหะ",
      "น้ำหนักรวม(กรัม)",
      "รวมเงิน(ก่อน VAT)",
      "หักราคาทองซื้อคืน",
      "ส่วนต่างฐานภาษี",
      "ภาษีมูลค่าเพิ่ม(VAT 7%)",
      "ยอดเงินสุทธิ",
      "ช่องทางชำระเงิน",
      "รายละเอียดการชำระ",
      "ผู้รับเงิน/ผู้ซื้อ",
    ],
  ];
  for (const r of receipts) {
    const cat = r.doc_category ?? "customer";
    const metals = [...new Set(r.receipt_items.map((i) => i.metal_type))].join(", ");
    rows.push([
      DOC_CATEGORY_META[cat].short,
      r.date,
      phoneCell(r.receipt_no),
      r.customer_name,
      phoneCell(r.tax_id),
      phoneCell(r.phone),
      metals,
      r.total_weight,
      r.subtotal,
      r.redemption_price,
      r.tax_base,
      r.vat_amount ?? r.other_amount,
      r.grand_total,
      r.payment_method,
      r.payment_detail,
      r.buyer_name,
    ]);
  }
  return toCsv(rows);
}

export function csvFilename(kind: "items" | "summary" | "tax", category?: string | null, d = new Date()) {
  const catPart = category === "customer" ? "-customer" : category === "hq" ? "-hq" : "";
  return `watchara-gold-${kind}${catPart}-${d.toISOString().slice(0, 10)}.csv`;
}
