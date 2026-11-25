import type { ReceiptData, ReceiptItem } from "./types";

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export function itemsAmountSum(items: ReceiptItem[]) {
  return sum(items.map((i) => i.amount));
}
export function itemsWeightSum(items: ReceiptItem[]) {
  return sum(items.map((i) => i.weight));
}

export const AMOUNT_TOLERANCE = 1; // บาท

/** ตรวจเฉพาะยอดเงิน (น้ำหนักรวมในบิลถูกปัดเศษ จึงไม่ตรวจ) */
export function validateReceipt(r: Pick<ReceiptData, "items" | "subtotal">): string | null {
  if (r.subtotal == null) return null;
  const s = itemsAmountSum(r.items);
  const diff = Math.abs(s - r.subtotal);
  if (diff > AMOUNT_TOLERANCE) {
    return `ยอดรวมจากรายการ (${s.toLocaleString("th-TH", { maximumFractionDigits: 3 })}) ไม่ตรงกับ "รวมเป็นเงิน" ในบิล (${r.subtotal.toLocaleString("th-TH", { maximumFractionDigits: 3 })}) กรุณาตรวจสอบ`;
  }
  return null;
}
