import type { ReceiptRow } from "./types";

/** ค่าที่เขียนลง CSV ตามตัวอักษร ไม่ผ่านการ escape (ใช้กับสูตรเบอร์โทร) */
class Raw {
  constructor(public v: string) {}
}

export function csvCell(v: unknown): string {
  if (v instanceof Raw) return v.v;
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** ฟอร์แมตเบอร์โทรไม่ให้ Excel ตัดเลข 0 หน้า */
export const phoneCell = (p: string | null): Raw => new Raw(p ? `="${p}"` : "");

export function toCsv(rows: unknown[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function itemsCsv(receipts: ReceiptRow[]): string {
  const rows: unknown[][] = [
    ["วันที่", "ชื่อลูกค้า", "เบอร์โทร", "ประเภทโลหะ", "ลำดับ", "รายการ", "ราคา", "ราคาบวก", "% ซื้อ", "น้ำหนัก(กรัม)", "ต่อกรัม", "จำนวนเงิน", "ช่องทางชำระเงิน", "รายละเอียดการชำระ", "ผู้ซื้อ"],
  ];
  for (const r of receipts) {
    const items = [...r.receipt_items].sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
    for (const i of items) {
      rows.push([r.date, r.customer_name, phoneCell(r.phone), i.metal_type, i.no, i.item_name, i.base_price, i.plus_price, i.buy_percent, i.weight, i.price_per_gram, i.amount, r.payment_method, r.payment_detail, r.buyer_name]);
    }
  }
  return toCsv(rows);
}

export function summaryCsv(receipts: ReceiptRow[]): string {
  const rows: unknown[][] = [
    ["วันที่", "ชื่อลูกค้า", "เบอร์โทร", "ประเภทโลหะที่รับซื้อ", "น้ำหนักรวม(กรัม)", "รวมเป็นเงิน", "อื่นๆ", "จำนวนรวมทั้งสิ้น", "ช่องทางชำระเงิน", "รายละเอียดการชำระ", "ผู้ซื้อ"],
  ];
  for (const r of receipts) {
    const metals = [...new Set(r.receipt_items.map((i) => i.metal_type))].join(", ");
    rows.push([r.date, r.customer_name, phoneCell(r.phone), metals, r.total_weight, r.subtotal, r.other_amount, r.grand_total, r.payment_method, r.payment_detail, r.buyer_name]);
  }
  return toCsv(rows);
}

export function csvFilename(kind: "items" | "summary", d = new Date()) {
  return `watchara-gold-${kind}-${d.toISOString().slice(0, 10)}.csv`;
}
