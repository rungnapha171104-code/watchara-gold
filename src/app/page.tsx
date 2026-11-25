"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Download, RotateCcw, Search } from "lucide-react";
import { ImageViewer, ReviewForm } from "@/components/Review";
import { useToast } from "@/components/Toast";
import type { ReceiptData, ReceiptRow } from "@/lib/types";

const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "-" : n.toLocaleString("th-TH", { maximumFractionDigits: d });
const fmtList = (vals: (number | null | undefined)[], suffix = "") => {
  const uniq = [...new Set(vals.filter((v): v is number => v != null))];
  return uniq.length ? uniq.map((v) => fmt(v) + suffix).join(", ") : "-";
};
const METAL_FILTERS = ["", "ทอง", "เงิน", "นาค"];

export default function Dashboard() {
  const toast = useToast();
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"active" | "all">("active");
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
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (metal) p.set("metal", metal);
    return p;
  }, [scope, q, from, to, metal]);

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
    const m: Record<string, { w: number; a: number }> = {
      ทอง: { w: 0, a: 0 },
      เงิน: { w: 0, a: 0 },
      นาค: { w: 0, a: 0 },
    };
    for (const r of rows)
      for (const i of r.receipt_items)
        if (m[i.metal_type]) {
          m[i.metal_type].w += i.weight ?? 0;
          m[i.metal_type].a += i.amount ?? 0;
        }
    return { m, total: rows.reduce((a, r) => a + (r.grand_total ?? 0), 0) };
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
      setScope("active");
      await load();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setClosing(false);
    }
  }

  const exportUrl = (kind: string, all: boolean) => `/api/export?kind=${kind}&${all ? "all=1" : qs.toString()}`;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs">
          <button
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              scope === "active" ? "bg-white text-gold-600 shadow-sm" : "text-gray-600 hover:text-ink"
            }`}
            onClick={() => setScope("active")}
          >
            รอบปัจจุบัน (ยังไม่ปิดยอด)
          </button>
          <button
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              scope === "all" ? "bg-white text-gold-600 shadow-sm" : "text-gray-600 hover:text-ink"
            }`}
            onClick={() => setScope("all")}
          >
            ประวัติทั้งหมด
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/daily" className="btn-ghost !py-2">
            <CalendarCheck size={15} /> ดูสรุปรายวันย้อนหลัง
          </Link>
          {scope === "active" && (
            <button
              className="btn-gold !py-2"
              disabled={loading || rows.length === 0}
              onClick={() => setCloseModal(true)}
            >
              <RotateCcw size={15} /> จบวัน: บันทึกปิดยอดและรีเซ็ต
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="card">
          <div className="text-xs text-gray-500">จำนวนบิล</div>
          <div className="text-2xl font-bold">{rows.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">ยอดรับซื้อรวม (บาท)</div>
          <div className="text-2xl font-bold text-gold-600">{fmt(stats.total)}</div>
        </div>
        {Object.entries(stats.m).map(([k, v]) => (
          <div key={k} className="card">
            <div className="text-xs text-gray-500">{k}</div>
            <div className="font-semibold">{fmt(v.w)} กรัม</div>
            <div className="text-sm text-gray-600">{fmt(v.a)} บาท</div>
          </div>
        ))}
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <label className="relative min-w-[180px] flex-1 text-xs text-gray-500">
          ค้นหา
          <Search size={14} className="absolute bottom-2.5 left-2 text-gray-400" />
          <input
            className="input mt-0.5 !pl-7"
            placeholder="ชื่อลูกค้า / เบอร์โทร"
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
            {METAL_FILTERS.map((m) => (
              <option key={m} value={m}>
                {m || "ทั้งหมด"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card flex flex-wrap gap-2">
        <span className="self-center text-xs text-gray-500">Export CSV:</span>
        <a className="btn-ghost" href={exportUrl("items", false)}>
          <Download size={14} /> รายรายการ (ตามหน้านี้)
        </a>
        <a className="btn-ghost" href={exportUrl("summary", false)}>
          <Download size={14} /> สรุปรายบิล (ตามหน้านี้)
        </a>
        <a className="btn-ghost" href={exportUrl("items", true)}>
          <Download size={14} /> รายรายการ (ทั้งหมด)
        </a>
        <a className="btn-ghost" href={exportUrl("summary", true)}>
          <Download size={14} /> สรุปรายบิล (ทั้งหมด)
        </a>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-gold-50 text-left text-xs text-gray-600">
            <tr>
              <th className="p-3">วันที่</th>
              <th className="p-3">ลูกค้า</th>
              <th className="p-3">เบอร์โทร</th>
              <th className="p-3">โลหะ</th>
              <th className="p-3 text-right">ราคาบวก</th>
              <th className="p-3 text-right">% ซื้อ</th>
              <th className="p-3 text-right">น้ำหนัก (ก.)</th>
              <th className="p-3 text-right">ยอดรวม (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-400">
                  กำลังโหลด...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-400">
                  {scope === "active"
                    ? "ยังไม่มีบิลใหม่ในรอบปัจจุบัน (ดูบิลที่ปิดยอดแล้วได้ที่หน้า สรุปรายวัน หรือกดสลับเป็น ประวัติทั้งหมด)"
                    : "ไม่พบบิล"}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-t hover:bg-gold-50/50"
                onClick={() => setOpen(r)}
              >
                <td className="p-3">{r.date}</td>
                <td className="p-3">{r.customer_name}</td>
                <td className="p-3">{r.phone}</td>
                <td className="p-3">{[...new Set(r.receipt_items.map((i) => i.metal_type))].join(", ")}</td>
                <td className="p-3 text-right">{fmtList(r.receipt_items.map((i) => i.plus_price))}</td>
                <td className="p-3 text-right">{fmtList(r.receipt_items.map((i) => i.buy_percent), "%")}</td>
                <td className="p-3 text-right">{fmt(r.total_weight)}</td>
                <td className="p-3 text-right font-medium">{fmt(r.grand_total, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {closeModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md space-y-4">
            <div>
              <h3 className="text-base font-bold text-ink">จบวัน: บันทึกปิดยอดและรีเซ็ตหน้าหลัก</h3>
              <p className="mt-1 text-xs text-gray-500">
                ระบบจะบันทึกสรุปยอดทั้งหมดลงในหน้า <strong>สรุปรายวัน</strong> และล้างหน้าหลักให้เป็น 0 เพื่อเริ่มรอบวันใหม่ (บิลทั้งหมดยังอยู่ครบ ดูย้อนหลังได้ตลอด)
              </p>
            </div>
            <div className="space-y-1 rounded-lg bg-gold-50/70 p-3 text-sm">
              <div>
                จำนวนบิลที่จะปิดยอด: <strong>{rows.length} บิล</strong>
              </div>
              {activeDates.length > 0 && (
                <div>
                  วันที่บิล: <strong>{activeDates.join(", ")}</strong>
                </div>
              )}
              <div>
                ยอดรับซื้อรวม: <strong className="text-gold-600">{fmt(stats.total, 3)} บาท</strong>
              </div>
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
                  placeholder="เช่น ยอดเงินสดครบ / หมายเหตุเพิ่มเติม"
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
