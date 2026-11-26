"use client";
import { useState } from "react";
import { Plus, Trash2, ZoomIn, ZoomOut, AlertTriangle } from "lucide-react";
import { classifyMetal, METALS, type ReceiptData, type ReceiptItem } from "@/lib/types";
import { itemsAmountSum, itemsWeightSum, validateReceipt } from "@/lib/validate";

const emptyItem = (no: number): ReceiptItem => ({
  no, metal_type: "ทอง", item_name: "", base_price: null, plus_price: null,
  buy_percent: null, weight: null, price_per_gram: null, amount: null,
});

export function ImageViewer({ src, isPdf }: { src: string; isPdf: boolean }) {
  const [zoom, setZoom] = useState(1);
  if (isPdf) return <iframe src={src} className="h-[70vh] w-full rounded-lg border" />;
  return (
    <div className="card p-2">
      <div className="mb-2 flex gap-2">
        <button className="btn-ghost !px-2 !py-1" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut size={16} /></button>
        <button className="btn-ghost !px-2 !py-1" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn size={16} /></button>
        <span className="self-center text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded border bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="บิล" style={{ width: `${zoom * 100}%`, maxWidth: "none" }} />
      </div>
    </div>
  );
}

const numVal = (v: number | null) => (v === null || Number.isNaN(v) ? "" : String(v));
const parse = (s: string): number | null => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s));

export function ReviewForm({
  initial, saving, onSave, onCancel, onDelete, saveLabel = "บันทึก",
}: {
  initial: ReceiptData; saving: boolean; saveLabel?: string;
  onSave: (d: ReceiptData) => void; onCancel?: () => void; onDelete?: () => void;
}) {
  const [d, setD] = useState<ReceiptData>(initial);
  const set = <K extends keyof ReceiptData>(k: K, v: ReceiptData[K]) => setD((p) => ({ ...p, [k]: v }));
  const setItem = (idx: number, patch: Partial<ReceiptItem>) =>
    setD((p) => ({ ...p, items: p.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const warn = validateReceipt(d);
  const text = (k: "doc_type" | "customer_name" | "phone" | "payment_method" | "payment_detail" | "buyer_name" | "notes", label: string) => (
    <label className="block text-xs text-gray-500">{label}
      <input className="input mt-0.5" value={d[k] ?? ""} onChange={(e) => set(k, e.target.value === "" ? null : e.target.value)} />
    </label>
  );
  const numField = (k: "total_weight" | "subtotal" | "other_amount" | "grand_total", label: string) => (
    <label className="block text-xs text-gray-500">{label}
      <input className="input mt-0.5" inputMode="decimal" value={numVal(d[k])} onChange={(e) => set(k, parse(e.target.value))} />
    </label>
  );

  return (
    <div className="space-y-3">
      {warn && (
        <div className="flex gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> <span>{warn} (ยังบันทึกได้)</span>
        </div>
      )}
      <div className="card grid grid-cols-2 gap-3">
        <div className="col-span-2">{text("doc_type", "ประเภทเอกสาร")}</div>
        {text("customer_name", "ชื่อลูกค้า / ผู้ขาย")}
        {text("phone", "เบอร์โทร")}
        <label className="block text-xs text-gray-500">วันที่
          <input type="date" className="input mt-0.5" value={d.date ?? ""} onChange={(e) => set("date", e.target.value || null)} />
        </label>
        {text("buyer_name", "ผู้ซื้อ / ผู้รับเงิน")}
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">รายการ</h3>
          <button className="btn-ghost !px-2 !py-1" onClick={() => set("items", [...d.items, emptyItem(d.items.length + 1)])}><Plus size={14} /> เพิ่มแถว</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="text-gray-500">
              <tr>{["#", "โลหะ", "รายการ", "ราคา/หน่วย", "ราคาบวก", "% ซื้อ", "น้ำหนัก (ก.)", "ต่อกรัม", "จำนวนเงิน", ""].map((h) => <th key={h} className="px-1 py-1 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {d.items.map((it, i) => (
                <tr key={i}>
                  <td className="px-1">{i + 1}</td>
                  <td className="px-1"><select className="input" value={it.metal_type} onChange={(e) => setItem(i, { metal_type: e.target.value as ReceiptItem["metal_type"] })}>{METALS.map((m) => <option key={m}>{m}</option>)}</select></td>
                  <td className="px-1"><input className="input" value={it.item_name ?? ""} onChange={(e) => setItem(i, { item_name: e.target.value, metal_type: classifyMetal(e.target.value) })} /></td>
                  {(["base_price", "plus_price", "buy_percent", "weight", "price_per_gram", "amount"] as const).map((k) => (
                    <td key={k} className="px-1"><input className="input" inputMode="decimal" value={numVal(it[k])} onChange={(e) => setItem(i, { [k]: parse(e.target.value) })} /></td>
                  ))}
                  <td className="px-1"><button className="p-1 text-red-600" onClick={() => set("items", d.items.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          ผลรวมจากแถว: น้ำหนัก {itemsWeightSum(d.items).toLocaleString("th-TH", { maximumFractionDigits: 3 })} ก. · จำนวนเงิน {itemsAmountSum(d.items).toLocaleString("th-TH", { maximumFractionDigits: 3 })} บาท
        </p>
      </div>

      <div className="card grid grid-cols-2 gap-3">
        {numField("total_weight", "น้ำหนักรวม (ตามบิล)")}
        {numField("subtotal", "รวมเป็นเงิน")}
        {numField("other_amount", "อื่นๆ")}
        {numField("grand_total", "จำนวนรวมทั้งสิ้น")}
        {text("payment_method", "ช่องทางชำระเงิน")}
        {text("payment_detail", "รายละเอียดการชำระ")}
        <div className="col-span-2">{text("notes", "หมายเหตุ")}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-gold" disabled={saving} onClick={() => onSave(d)}>{saving ? "กำลังบันทึก..." : saveLabel}</button>
        {onCancel && <button className="btn-ghost" onClick={onCancel}>ยกเลิก</button>}
        {onDelete && <button className="btn-danger ml-auto" onClick={onDelete}><Trash2 size={14} /> ลบบิล</button>}
      </div>
    </div>
  );
}
