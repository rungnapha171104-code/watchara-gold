"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CalendarCheck, Download, FileSpreadsheet, RotateCcw, Search, Users } from "lucide-react";
import { ImageViewer, ReviewForm } from "@/components/Review";
import { useToast } from "@/components/Toast";
import { DOC_CATEGORY_META, type DocCategory } from "@/lib/tax";
import { METALS, type Metal, type ReceiptData, type ReceiptRow } from "@/lib/types";

const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "-" : n.toLocaleString("th-TH", { maximumFractionDigits: d });

const fmtPlus = (vals: (number | null | undefined)[]) => {
  const uniq = [...new Set(vals.filter((v): v is number => v != null))];
  return uniq.length ? uniq.map((v) => (v > 0 ? `+${fmt(v)}` : fmt(v))).join(", ") : "-";
};

const METAL_BADGE: Record<Metal, string> = {
  ทอง: "bg-amber-100 text-amber-900",
  เงิน: "bg-slate-200 text-slate-800",
  นาค: "bg-rose-100 text-rose-800",
  แพลตตินัม: "bg-indigo-100 text-indigo-800",
  อื่นๆ: "bg-gray-100 text-gray-700",
};

export default function Dashboard() {
  const toast = useToast();
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"active" | "all">("active");
  const [category, setCategory] = useState<"all" | DocCategory>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [metal, setMetal] = useState("");
  const [open, setOpen] = useState<ReceiptRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [closeModal, setCloseModal] = useState(false);
  const [closedBy, setClosedBy] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closing, setClosing] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (scope === "active") p.set("scope", "active");
    if (category !== "all") p.set("category", category);
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (metal) p.set("metal", metal);
    return p;
  }, [scope, category, q, from, to, metal]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/receipts?" + qs.toString(), { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) toast(j.error ?? "โหลดข้อมูลไม่สำเร็จ", "err");
    else setRows(j);
    setLoading(false);
  }, [qs, toast]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const stats = useMemo(() => {
    let weight = 0;
    let subtotal = 0;
    let vat = 0;
    let total = 0;
    const customer = { count: 0, weight: 0, total: 0, vat: 0 };
    const hq = { count: 0, weight: 0, total: 0, vat: 0 };

    for (const r of rows) {
      const w = r.total_weight ?? 0;
      const sub = r.subtotal ?? r.grand_total ?? 0;
      const v = r.vat_amount ?? r.other_amount ?? 0;
      const tot = r.grand_total ?? 0;
      weight += w;
      subtotal += sub;
      vat += v;
      total += tot;
      const bucket = r.doc_category === "hq" ? hq : customer;
      bucket.count += 1;
      bucket.weight += w;
      bucket.total += tot;
      bucket.vat += v;
    }
    return { weight, subtotal, vat, total, customer, hq };
  }, [rows]);

  const activeDates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.date).filter(Boolean) as string[])).sort(),
    [rows]
  );

  async function update(d: ReceiptData) {
    if (!open) return;
    setSaving(true);
    const r = await fetch(`/api/receipts/${open.id}`, { method: "PUT", body: JSON.stringify(d) });
    setSaving(false);
    if (!r.ok) return toast((await r.json()).error ?? "บันทึกไม่สำเร็จ", "err");
    toast("แก้ไขเรียบร้อย");
    setOpen(null);
    load();
  }

  async function remove() {
    if (!open || !confirm("ลบบิลนี้และไฟล์ต้นฉบับ?")) return;
    const r = await fetch(`/api/receipts/${open.id}`, { method: "DELETE" });
    if (!r.ok) return toast("ลบไม่สำเร็จ", "err");
    toast("ลบเรียบร้อย");
    setOpen(null);
    load();
  }

  async function handleCloseAndReset() {
    setClosing(true);
    try {
      const r = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ close_active: true, closed_by: closedBy, notes: closeNotes }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "บันทึกปิดยอดไม่สำเร็จ");
      toast(`บันทึกปิดยอด ${j.count} บิล และรีเซ็ตหน้าหลักเรียบร้อย`);
      setCloseModal(false);
      setClosedBy("");
      setCloseNotes("");
      setQ("");
      setFrom("");
      setTo("");
      setMetal("");
      setCategory("all");
      setScope("active");
      await load();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setClosing(false);
    }
  }

  const taxExportUrl = (cat: DocCategory, allHistory = false) => {
    const p = new URLSearchParams();
    p.set("kind", "tax");
    p.set("category", cat);
    if (allHistory) {
      p.set("all", "1");
    } else {
      if (scope === "active") p.set("scope", "active");
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (q) p.set("q", q);
      if (metal) p.set("metal", metal);
    }
    return `/api/export?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory("all")}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                category === "all"
                  ? "border-gold-500 bg-gold-50 text-gold-600"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              ทุกประเภท
            </button>
            <button
              onClick={() => setCategory("customer")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                category === "customer"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Users size={14} /> ใบเสร็จลูกค้า (ซื้อเข้า)
            </button>
            <button
              onClick={() => setCategory("hq")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                category === "hq"
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Building2 size={14} /> ส่งสำนักงานใหญ่ (ใบกำกับภาษี)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
              <button
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  scope === "active" ? "bg-white text-gold-600 shadow-sm" : "text-gray-600"
                }`}
                onClick={() => setScope("active")}
              >
                รอบปัจจุบัน
              </button>
              <button
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  scope === "all" ? "bg-white text-gold-600 shadow-sm" : "text-gray-600"
                }`}
                onClick={() => setScope("all")}
              >
                ประวัติทั้งหมด
              </button>
            </div>
            <Link href="/daily" className="btn-ghost !py-1.5 text-xs">
              <CalendarCheck size={14} /> สรุปรายวัน
            </Link>
            {scope === "active" && (
              <button
                className="btn-gold !py-1.5 text-xs"
                disabled={loading || rows.length === 0}
                onClick={() => setCloseModal(true)}
              >
                <RotateCcw size={14} /> จบวัน: บันทึกและรีเซ็ต
              </button>
            )}
          </div>
        </div>

        {category === "all" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              onClick={() => setCategory("customer")}
              className="cursor-pointer rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 transition hover:bg-emerald-50"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                <span className="flex items-center gap-1.5">
                  <Users size={14} /> ใบเสร็จลูกค้า (รับซื้อทองเก่าเข้า)
                </span>
                <span>{stats.customer.count} บิล</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-lg font-bold text-emerald-900">{fmt(stats.customer.total)} บาท</span>
                <span className="text-xs text-emerald-700">{fmt(stats.customer.weight)} ก.</span>
              </div>
            </div>
            <div
              onClick={() => setCategory("hq")}
              className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50/50 p-3 transition hover:bg-blue-50"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                <span className="flex items-center gap-1.5">
                  <Building2 size={14} /> ส่งสำนักงานใหญ่ (ใบกำกับภาษี)
                </span>
                <span>{stats.hq.count} บิล</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-lg font-bold text-blue-900">{fmt(stats.hq.total)} บาท</span>
                <span className="text-xs text-blue-700">
                  {fmt(stats.hq.weight)} ก. · VAT {fmt(stats.hq.vat)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="card">
          <div className="text-xs text-gray-500">จำนวนบิล</div>
          <div className="text-2xl font-bold">{rows.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">น้ำหนักรวม (กรัม)</div>
          <div className="text-2xl font-bold">{fmt(stats.weight)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">รวมเงินก่อน VAT</div>
          <div className="text-xl font-bold">{fmt(stats.subtotal)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">ภาษีมูลค่าเพิ่ม (VAT 7%)</div>
          <div className="text-xl font-bold text-blue-700">{fmt(stats.vat)}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">ยอดเงินสุทธิ (บาท)</div>
          <div className="text-2xl font-bold text-gold-600">{fmt(stats.total)}</div>
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <label className="relative min-w-[200px] flex-1 text-xs text-gray-500">
          ค้นหา
          <Search size={14} className="absolute bottom-2.5 left-2 text-gray-400" />
          <input
            className="input mt-0.5 !pl-7"
            placeholder="เลขที่บิล / ชื่อลูกค้า-ผู้ขาย / เลขผู้เสียภาษี / เบอร์โทร"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          ตั้งแต่
          <input type="date" className="input mt-0.5" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-gray-500">
          ถึง
          <input type="date" className="input mt-0.5" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-xs text-gray-500">
          โลหะ
          <select className="input mt-0.5" value={metal} onChange={(e) => setMetal(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {METALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold text-gray-600">
          <FileSpreadsheet size={14} /> ส่งออก CSV ยื่นภาษี:
        </span>
        <a
          className="btn border border-emerald-300 bg-emerald-50 !py-1.5 text-xs text-emerald-900 hover:bg-emerald-100"
          href={taxExportUrl("customer", false)}
        >
          <Download size={14} /> ฝั่งลูกค้า (ซื้อเข้า)
        </a>
        <a
          className="btn border border-blue-300 bg-blue-50 !py-1.5 text-xs text-blue-900 hover:bg-blue-100"
          href={taxExportUrl("hq", false)}
        >
          <Download size={14} /> ฝั่งส่งสำนักงานใหญ่ (ใบกำกับภาษี)
        </a>
        <a className="btn-ghost !py-1.5 text-xs" href={`/api/export?kind=items&${qs.toString()}`}>
          <Download size={14} /> รายรายการ (ตามหน้านี้)
        </a>
        <a className="btn-ghost !py-1.5 text-xs" href="/api/export?kind=tax&all=1">
          <Download size={14} /> ยื่นภาษีทั้งหมด (รวม 2 ฝั่ง)
        </a>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[1060px] text-sm">
          <thead className="bg-gold-50 text-left text-xs text-gray-600">
            <tr>
              <th className="p-3">ประเภท</th>
              <th className="p-3">วันที่</th>
              <th className="p-3">เลขที่บิล</th>
              <th className="p-3">ลูกค้า / ผู้ขาย</th>
              <th className="p-3">โลหะ</th>
              <th className="p-3 text-right">ราคาบวก</th>
              <th className="p-3 text-right">น้ำหนัก (ก.)</th>
              <th className="p-3 text-right">ก่อน VAT</th>
              <th className="p-3 text-right">VAT 7%</th>
              <th className="p-3 text-right">ยอดสุทธิ (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-400">
                  กำลังโหลด...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-400">
                  {scope === "active"
                    ? "ยังไม่มีบิลใหม่ในรอบปัจจุบัน (ดูบิลเก่าได้ที่หน้า สรุปรายวัน หรือกดสลับเป็น ประวัติทั้งหมด)"
                    : "ไม่พบบิล"}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const metals = [...new Set(r.receipt_items.map((i) => i.metal_type))];
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t hover:bg-gold-50/50"
                  onClick={() => setOpen(r)}
                >
                  <td className="p-3">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        r.doc_category === "hq"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {DOC_CATEGORY_META[r.doc_category ?? "customer"].badge}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.date}</td>
                  <td className="p-3 font-mono text-xs">{r.receipt_no || "-"}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.customer_name || "-"}</div>
                    {r.tax_id && <div className="font-mono text-[11px] text-gray-500">Tax: {r.tax_id}</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {metals.length ? (
                        metals.map((m) => (
                          <span
                            key={m}
                            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${METAL_BADGE[m] ?? METAL_BADGE.อื่นๆ}`}
                          >
                            {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right text-xs text-gray-600">
                    {fmtPlus(r.receipt_items.map((i) => i.plus_price))}
                  </td>
                  <td className="p-3 text-right">{fmt(r.total_weight)}</td>
                  <td className="p-3 text-right">{fmt(r.subtotal)}</td>
                  <td className="p-3 text-right text-blue-700">{fmt(r.vat_amount ?? r.other_amount)}</td>
                  <td className="p-3 text-right font-semibold">{fmt(r.grand_total, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {closeModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md space-y-4">
            <div>
              <h3 className="text-base font-bold text-ink">จบวัน: บันทึกปิดยอดและรีเซ็ตหน้าหลัก</h3>
              <p className="mt-1 text-xs text-gray-500">
                ระบบจะบันทึกสรุปยอดทั้ง 2 ฝั่งลงในหน้า <strong>สรุปรายวัน</strong> และล้างหน้าหลักให้เป็น 0 เพื่อเริ่มวันใหม่ (ข้อมูลบิลทั้งหมดยังอยู่ครบ ดูย้อนหลังและออกไฟล์ยื่นภาษีได้ตลอด)
              </p>
            </div>
            <div className="space-y-1 rounded-lg bg-gold-50/70 p-3 text-sm">
              <div>
                บิลลูกค้า (ซื้อเข้า): <strong>{stats.customer.count} บิล</strong> ({fmt(stats.customer.total)} บาท)
              </div>
              <div>
                ส่งสำนักงานใหญ่ (ใบกำกับภาษี): <strong>{stats.hq.count} บิล</strong> ({fmt(stats.hq.total)} บาท)
              </div>
              {activeDates.length > 0 && (
                <div>
                  วันที่บิล: <strong>{activeDates.join(", ")}</strong>
                </div>
              )}
            </div>
            <div className="space-y-2.5">
              <label className="block text-xs text-gray-500">
                ผู้ปิดยอด (ไม่บังคับ)
                <input
                  className="input mt-0.5"
                  placeholder="เช่น ชื่อพนักงาน / เจ้าของร้าน"
                  value={closedBy}
                  onChange={(e) => setClosedBy(e.target.value)}
                />
              </label>
              <label className="block text-xs text-gray-500">
                หมายเหตุประจำวัน (ไม่บังคับ)
                <input
                  className="input mt-0.5"
                  placeholder="เช่น ยอดเงินสดครบ / ส่งทอง สนง.ใหญ่ เรียบร้อย"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" disabled={closing} onClick={() => setCloseModal(false)}>
                ยกเลิก
              </button>
              <button className="btn-gold" disabled={closing} onClick={handleCloseAndReset}>
                {closing ? "กำลังบันทึก..." : "ยืนยันบันทึกและรีเซ็ต"}
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 overflow-auto bg-black/40 p-3">
          <div className="mx-auto max-w-6xl rounded-xl bg-[#fafaf8] p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {open.image_url && (
                <ImageViewer
                  src={`/api/image?path=${encodeURIComponent(open.image_url)}`}
                  isPdf={open.image_url.endsWith(".pdf")}
                />
              )}
              <ReviewForm
                key={open.id}
                initial={{ ...open, items: open.receipt_items }}
                saving={saving}
                saveLabel="บันทึกการแก้ไข"
                onSave={update}
                onCancel={() => setOpen(null)}
                onDelete={remove}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
