"use client";
import { useState } from "react";
import { AlertTriangle, Plus, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { classifyDocCategory, DOC_CATEGORY_META, type DocCategory } from "@/lib/tax";
import { METALS, type Metal, type ReceiptData, type ReceiptItem } from "@/lib/types";
import { validateReceipt } from "@/lib/validate";

const emptyItem = (no: number): ReceiptItem => ({
  no,
  metal_type: "ทอง",
  item_name: "",
  base_price: null,
  plus_price: null,
  buy_percent: null,
  weight: null,
  price_per_gram: null,
  amount: null,
});

const numVal = (v: string) => (v.trim() === "" ? null : Number(v));

export function ImageViewer({ src, isPdf }: { src: string; isPdf?: boolean }) {
  const [zoom, setZoom] = useState(1);
  if (isPdf) return <iframe src={src} className="h-[70vh] w-full rounded-lg border bg-white" />;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-1">
        <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
        <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
          <ZoomIn size={16} />
        </button>
      </div>
      <div className="max-h-[72vh] overflow-auto rounded-lg border bg-gray-100 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="ใบเสร็จ"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          className="max-w-full"
        />
      </div>
    </div>
  );
}

export function ReviewForm({
  initial,
  onSave,
  onCancel,
  onDelete,
  saving,
  saveLabel = "บันทึกบิล",
}: {
  initial: ReceiptData;
  onSave: (d: ReceiptData) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  saving?: boolean;
  saveLabel?: string;
}) {
  const initCat = classifyDocCategory(initial.doc_type, initial.doc_category);
  const [d, setD] = useState<ReceiptData>({
    ...initial,
    doc_category: initCat,
    doc_type: DOC_CATEGORY_META[initCat].docType,
    vat_amount: initial.vat_amount ?? initial.other_amount ?? null,
    items: initial.items?.length ? initial.items : [emptyItem(1)],
  });

  const cat: DocCategory = d.doc_category ?? initCat;
  const warning = validateReceipt(d);
  const set = <K extends keyof ReceiptData>(k: K, v: ReceiptData[K]) => setD((p) => ({ ...p, [k]: v }));
  const setCategory = (next: DocCategory) =>
    setD((p) => ({ ...p, doc_category: next, doc_type: DOC_CATEGORY_META[next].docType }));
  const setItem = <K extends keyof ReceiptItem>(i: number, k: K, v: ReceiptItem[K]) =>
    setD((p) => ({ ...p, items: p.items.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)) }));

  const text = (
    k: "receipt_no" | "customer_name" | "tax_id" | "address" | "phone" | "payment_method" | "payment_detail" | "buyer_name" | "notes",
    label: string,
    placeholder?: string
  ) => (
    <label className="block text-xs text-gray-500">
      {label}
      <input
        className="input mt-0.5"
        placeholder={placeholder}
        value={d[k] ?? ""}
        onChange={(e) => set(k, e.target.value === "" ? null : e.target.value)}
      />
    </label>
  );

  const num = (
    k: "total_weight" | "subtotal" | "redemption_price" | "tax_base" | "vat_amount" | "grand_total",
    label: string
  ) => (
    <label className="block text-xs text-gray-500">
      {label}
      <input
        type="number"
        step="any"
        className="input mt-0.5 text-right"
        value={d[k] ?? ""}
        onChange={(e) => {
          const val = numVal(e.target.value);
          if (k === "vat_amount") {
            setD((p) => ({ ...p, vat_amount: val, other_amount: val }));
          } else {
            set(k, val);
          }
        }}
      />
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
      className="space-y-4"
    >
      {warning && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      <div className="card space-y-2">
        <div className="text-xs font-medium text-gray-500">ประเภทใบเสร็จ (สำหรับแยกยื่นภาษี)</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCategory("customer")}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              cat === "customer"
                ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 ring-1 ring-emerald-500"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <div>ใบเสร็จลูกค้า (ซื้อเข้า)</div>
            <div className="text-[11px] font-normal opacity-80">ใบรับสินค้า / ใบเสร็จรับเงิน</div>
          </button>
          <button
            type="button"
            onClick={() => setCategory("hq")}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
              cat === "hq"
                ? "border-blue-500 bg-blue-50 font-semibold text-blue-900 ring-1 ring-blue-500"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <div>ส่งสำนักงานใหญ่ (ใบกำกับภาษี)</div>
            <div className="text-[11px] font-normal opacity-80">ใบส่งของ / ใบกำกับภาษี / ใบเสร็จรับเงิน</div>
          </button>
        </div>
      </div>

      <div className="card grid grid-cols-2 gap-3">
        {text("receipt_no", "เลขที่บิล (No.)", "เช่น 6811001")}
        <label className="block text-xs text-gray-500">
          วันที่
          <input
            type="date"
            className="input mt-0.5"
            value={d.date ?? ""}
            onChange={(e) => set("date", e.target.value || null)}
          />
        </label>
        {text("customer_name", DOC_CATEGORY_META[cat].partyLabel)}
        {text("tax_id", "เลขประจำตัวผู้เสียภาษี (Tax ID)", "13 หลัก (ถ้ามี)")}
        {text("phone", "เบอร์โทร")}
        {text("buyer_name", cat === "hq" ? "ผู้รับเงิน / ผู้ส่งสินค้า" : "ผู้รับเงิน / ผู้ซื้อ")}
        <div className="col-span-2">{text("address", "ที่อยู่")}</div>
      </div>

      <div className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">รายการสินค้า</h3>
            <p className="text-[11px] text-gray-500">ช่อง &quot;ราคาบวก&quot; ใช้บันทึกตัวบวกของทอง/เงินตามบิล (ไม่นำไปบวกรวมกับยอดท้ายบิล)</p>
          </div>
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-1 text-xs"
            onClick={() => set("items", [...d.items, emptyItem(d.items.length + 1)])}
          >
            <Plus size={14} /> เพิ่มแถว
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="text-gray-500">
              <tr>
                {["#", "โลหะ", "รายการ", "น้ำหนัก (ก.)", "ราคา/หน่วย", "ราคาบวก", "จำนวนเงิน", ""].map((h) => (
                  <th key={h} className="px-1 py-1 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="w-8 px-1 py-1 text-gray-400">{i + 1}</td>
                  <td className="w-24 px-1 py-1">
                    <select
                      className="input !px-1 !py-1 text-xs"
                      value={it.metal_type}
                      onChange={(e) => setItem(i, "metal_type", e.target.value as Metal)}
                    >
                      {METALS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      className="input !px-1.5 !py-1 text-xs"
                      value={it.item_name ?? ""}
                      onChange={(e) => setItem(i, "item_name", e.target.value || null)}
                    />
                  </td>
                  {(["weight", "base_price", "plus_price", "amount"] as const).map((k) => (
                    <td key={k} className="w-24 px-1 py-1">
                      <input
                        type="number"
                        step="any"
                        placeholder={k === "plus_price" ? "+/-" : undefined}
                        className="input !px-1.5 !py-1 text-right text-xs"
                        value={it[k] ?? ""}
                        onChange={(e) => setItem(i, k, numVal(e.target.value))}
                      />
                    </td>
                  ))}
                  <td className="w-7 px-1 py-1">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => set("items", d.items.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="text-xs font-semibold text-gray-600">สรุปยอดและภาษี</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {num("total_weight", "น้ำหนักรวม (กรัม)")}
          {num("subtotal", "รวมเงิน (ไม่รวม VAT)")}
          {num("redemption_price", "หัก ราคาทองรูปพรรณซื้อคืน")}
          {num("tax_base", "จำนวนส่วนต่างฐานภาษี")}
          {num("vat_amount", "ภาษีมูลค่าเพิ่ม (VAT 7%)")}
          {num("grand_total", "ยอดเงินสุทธิ (Net Amount)")}
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-500">
          ช่องทางชำระเงิน
          <select
            className="input mt-0.5"
            value={d.payment_method ?? ""}
            onChange={(e) => set("payment_method", e.target.value || null)}
          >
            <option value="">ไม่ระบุ</option>
            <option value="เงินสด">เงินสด</option>
            <option value="เงินโอน">เงินโอน</option>
            <option value="เช็ค">เช็ค</option>
            <option value="บัตรเครดิต">บัตรเครดิต</option>
          </select>
        </label>
        {text("payment_detail", "รายละเอียดธนาคาร / เลขเช็ค / วันที่")}
        <div className="sm:col-span-2">{text("notes", "หมายเหตุเพิ่มเติม")}</div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onDelete && (
          <button type="button" className="btn-danger mr-auto" onClick={onDelete}>
            ลบบิลนี้
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            ยกเลิก
          </button>
        )}
        <button type="submit" className="btn-gold" disabled={saving}>
          {saving ? "กำลังบันทึก..." : saveLabel}
        </button>
      </div>
    </form>
  );
}
