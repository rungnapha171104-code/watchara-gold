import { test } from "node:test";
import assert from "node:assert/strict";
import { itemsCsv, summaryCsv, csvCell } from "./csv";
import { validateReceipt } from "./validate";
import { classifyMetal, type ReceiptRow, type ReceiptItem } from "./types";

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  no: 1, metal_type: "ทอง", item_name: "ทองหลอม", base_price: null, plus_price: null,
  buy_percent: null, weight: null, price_per_gram: null, amount: null, ...o,
});

// บิลจริงใบที่ 1 และ 3
const bill1 = {
  items: [
    item({ no: 1, weight: 69.77, amount: 269031.07 }),
    item({ no: 2, weight: 15.89, amount: 51523.65 }),
    item({ no: 3, weight: 14.21, amount: 49812.13 }),
    item({ no: 4, weight: 19.9, amount: 26991.86 }),
  ],
  subtotal: 397358.71,
};
const bill3 = {
  items: [
    item({ no: 1, metal_type: "เงิน", item_name: "เงินแท่ง", weight: 7.9, amount: 372.848 }),
    item({ no: 2, weight: 2.34, amount: 6475.57 }),
  ],
  subtotal: 6848.418,
};

test("validate: บิลจริง 1 และ 3 ผ่านโดยไม่เตือน (น้ำหนักปัดเศษไม่ถูกตรวจ)", () => {
  assert.equal(validateReceipt(bill1), null);
  assert.equal(validateReceipt(bill3), null);
});

test("validate: ยอดไม่ตรงเกิน 1 บาทต้องเตือน", () => {
  assert.ok(validateReceipt({ ...bill1, subtotal: 397400 }));
});

test("classifyMetal", () => {
  assert.equal(classifyMetal("ทองหลอม"), "ทอง");
  assert.equal(classifyMetal("เงินแท่ง"), "เงิน");
  assert.equal(classifyMetal("นาค"), "นาค");
  assert.equal(classifyMetal("เพชร"), "อื่นๆ");
});

test("csvCell escaping", () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), "");
});

const row: ReceiptRow = {
  id: "1", created_at: "", image_url: null, date: "2026-11-10", customer_name: "มีชัย ศรีธาตุ",
  phone: "0625294403", total_weight: 10.2, subtotal: 6848.418, other_amount: null, grand_total: 6848.418,
  payment_method: null, payment_detail: null, buyer_name: null, notes: null, receipt_items: bill3.items,
};

test("CSV: BOM + เบอร์โทรเป็นสูตร + หลายโลหะ", () => {
  const a = itemsCsv([row]);
  assert.ok(a.startsWith("\uFEFF"));
  assert.ok(a.includes('="0625294403"'));
  assert.equal(a.split("\r\n").length, 3);
  const b = summaryCsv([row]);
  assert.ok(b.includes("เงิน, ทอง") || b.includes('"เงิน, ทอง"'));
});
