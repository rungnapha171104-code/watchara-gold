"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, Download, Save, Trash2, X } from "lucide-react";
import { ImageViewer, ReviewForm } from "@/components/Review";
import { useToast } from "@/components/Toast";
import { DOC_CATEGORY_META } from "@/lib/tax";
import type { DailyClosingRecord, DailyMetalSummary, Metal, ReceiptData, ReceiptRow } from "@/lib/types";

interface DailyEntry {
  date: string;
  closing: DailyClosingRecord | null;
  live: {
    receipt_count: number;
    total_weight: number;
    grand_total: number;
    metals: Record<Metal, DailyMetalSummary>;
    receipt_ids: string[];
    receipts: ReceiptRow[];
  };
  needs_update: boolean;
}

const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "-" : n.toLocaleString("th-TH", { maximumFractionDigits: d });

function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function fmtThaiDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function splitStats(receipts: ReceiptRow[]) {
  const customer = { count: 0, weight: 0, total: 0, vat: 0 };
  const hq = { count: 0, weight: 0, total: 0, vat: 0 };
  for (const r of receipts) {
    const b = r.doc_category === "hq" ? hq : customer;
    b.count += 1;
    b.weight += r.total_weight ?? 0;
    b.total += r.grand_total ?? 0;
    b.vat += r.vat_amount ?? r.other_amount ?? 0;
  }
  return { customer, hq };
}

export default function DailyPage() {
  const toast = useToast();
  const [days, setDays] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selDate, setSelDate] = useState<string>(todayBangkok);
  const [closedBy, setClosedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [openReceipt, setOpenReceipt] = useState<ReceiptRow | null>(null);
  const [savingReceipt, setSavingReceipt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/daily", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "โหลดข้อมูลรายวันไม่สำเร็จ");
      setDays(j.days ?? []);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const currentEntry = useMemo(() => days.find((d) => d.date === selDate) ?? null, [days, selDate]);
  const detailEntry = useMemo(() => days.find((d) => d.date === detailDate) ?? null, [days, detailDate]);

  useEffect(() => {
    setClosedBy(currentEntry?.closing?.closed_by ?? "");
    setNotes(currentEntry?.closing?.notes ?? "");
  }, [selDate, currentEntry?.closing?.closed_at]);

  const unclosedDates = useMemo(
    () =>
      days.filter(
        (d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && (!d.closing || d.needs_update) && d.live.receipt_count > 0
      ),
    [days]
  );

  async function saveClosing() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selDate)) return toast("กรุณาเลือกวันที่", "err");
    setSaving(true);
    try {
      const r = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selDate, closed_by: closedBy, notes }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "บันทึกปิดยอดไม่สำเร็จ");
      toast(`บันทึกปิดยอดวันที่ ${fmtThaiDate(selDate)} เรียบร้อย`);
      await load();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSaving(false);
    }
  }

  async function removeClosing(date: string) {
    if (!confirm(`ลบบันทึกปิดยอดของวันที่ ${fmtThaiDate(date)}? (บิลทั้งหมดจะยังคงอยู่ในระบบ)`)) return;
    const r = await fetch(`/api/daily?date=${encodeURIComponent(date)}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) return toast(j.error ?? "ลบไม่สำเร็จ", "err");
    toast("ลบบันทึกปิดยอดแล้ว");
    if (detailDate === date) setDetailDate(null);
    load();
  }

  async function updateReceipt(d: ReceiptData) {
    if (!openReceipt) return;
    setSavingReceipt(true);
    const r = await fetch(`/api/receipts/${openReceipt.id}`, { method: "PUT", body: JSON.stringify(d) });
    setSavingReceipt(false);
    if (!r.ok) return toast((await r.json()).error ?? "บันทึกไม่สำเร็จ", "err");
    toast("แก้ไขบิลเรียบร้อย");
    setOpenReceipt(null);
    load();
  }

  async function removeReceipt() {
    if (!openReceipt || !confirm("ลบบิลนี้และไฟล์ต้นฉบับ?")) return;
    const r = await fetch(`/api/receipts/${openReceipt.id}`, { method: "DELETE" });
    if (!r.ok) return toast("ลบไม่สำเร็จ", "err");
    toast("ลบบิลเรียบร้อย");
    setOpenReceipt(null);
    load();
  }

  const selReceipts = currentEntry?.live.receipts ?? [];
  const selSplit = useMemo(() => splitStats(selReceipts), [selReceipts]);

  const exportTaxDayUrl = (cat: "customer" | "hq", date: string) =>
    `/api/export?kind=tax&category=${cat}&from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`;

  const statusBadge = (d: DailyEntry) => {
    if (d.closing && d.needs_update) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          <AlertTriangle size={12} /> มีบิลเปลี่ยนแปลง
        </span>
      );
    }
    if (d.closing) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
          <CheckCircle2 size={12} /> ปิดยอดแล้ว
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        <Clock size={12} /> ยังไม่ปิดยอด
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold text-ink">
              <CalendarCheck size={20} className="text-gold-500" /> บันทึกปิดยอดประจำวัน (แยกฝั่งลูกค้า / ส่งสำนักงานใหญ่)
            </h1>
            <p className="text-xs text-gray-500">เลือกวันที่ต้องการสรุปปิดยอดและส่งออกรายงานยื่นภาษีแยกตามวัน</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input !w-auto"
              value={selDate}
              onChange={(e) => setSelDate(e.target.value)}
            />
            {currentEntry && statusBadge(currentEntry)}
          </div>
        </div>

        {unclosedDates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-gold-50/70 px-3 py-2 text-xs text-gray-700">
            <span className="font-medium text-gold-600">วันที่รอปิดยอด / อัปเดต:</span>
            {unclosedDates.slice(0, 7).map((d) => (
              <button
                key={d.date}
                onClick={() => setSelDate(d.date)}
                className={`rounded-md border px-2 py-0.5 transition ${
                  selDate === d.date
                    ? "border-gold-500 bg-gold-500 text-white"
                    : "border-gold-100 bg-white hover:border-gold-400"
                }`}
              >
                {fmtThaiDate(d.date)} ({d.live.receipt_count} บิล)
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
              <span>ใบเสร็จลูกค้า (ซื้อเข้า)</span>
              <span>{selSplit.customer.count} บิล</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold text-emerald-900">{fmt(selSplit.customer.total)} บาท</span>
              <span className="text-xs text-emerald-700">{fmt(selSplit.customer.weight)} ก.</span>
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
              <span>ส่งสำนักงานใหญ่ (ใบกำกับภาษี)</span>
              <span>{selSplit.hq.count} บิล</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-bold text-blue-900">{fmt(selSplit.hq.total)} บาท</span>
              <span className="text-xs text-blue-700">
                {fmt(selSplit.hq.weight)} ก. · VAT {fmt(selSplit.hq.vat)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-xs text-gray-500">
            ผู้ปิดยอด (ไม่บังคับ)
            <input
              className="input mt-0.5"
              placeholder="เช่น ชื่อพนักงาน / เจ้าของร้าน"
              value={closedBy}
              onChange={(e) => setClosedBy(e.target.value)}
            />
          </label>
          <label className="block text-xs text-gray-500 md:col-span-2">
            หมายเหตุประจำวัน (ไม่บังคับ)
            <input
              className="input mt-0.5"
              placeholder="เช่น เงินสดจ่ายออกครบ / ส่งทอง สนง.ใหญ่ แล้ว"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button className="btn-gold" disabled={saving} onClick={saveClosing}>
              <Save size={16} />
              {saving
                ? "กำลังบันทึก..."
                : currentEntry?.closing
                  ? `อัปเดตบันทึกปิดยอด (${fmtThaiDate(selDate)})`
                  : `บันทึกปิดยอดประจำวัน (${fmtThaiDate(selDate)})`}
            </button>
            {selReceipts.length > 0 && (
              <>
                <a
                  className="btn border border-emerald-300 bg-emerald-50 text-xs text-emerald-900 hover:bg-emerald-100"
                  href={exportTaxDayUrl("customer", selDate)}
                >
                  <Download size={14} /> CSV ลูกค้าวันนี้
                </a>
                <a
                  className="btn border border-blue-300 bg-blue-50 text-xs text-blue-900 hover:bg-blue-100"
                  href={exportTaxDayUrl("hq", selDate)}
                >
                  <Download size={14} /> CSV ส่ง สนง.ใหญ่ วันนี้
                </a>
              </>
            )}
          </div>
          {currentEntry?.closing && (
            <span className="text-xs text-gray-500">
              บันทึกล่าสุดเมื่อ {new Date(currentEntry.closing.closed_at).toLocaleString("th-TH")}
            </span>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">ประวัติบันทึกประจำวันย้อนหลัง</h2>
          <span className="text-xs text-gray-500">คลิกที่แต่ละวันเพื่อดูบิลทั้งหมดและดาวน์โหลดไฟล์ยื่นภาษี</span>
        </div>
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-gold-50 text-left text-xs text-gray-600">
            <tr>
              <th className="p-3">วันที่</th>
              <th className="p-3">สถานะ</th>
              <th className="p-3 text-right">ลูกค้า (ซื้อเข้า)</th>
              <th className="p-3 text-right">ส่ง สนง.ใหญ่ (ภาษี)</th>
              <th className="p-3 text-right">VAT 7%</th>
              <th className="p-3 text-right">น้ำหนักรวม (ก.)</th>
              <th className="p-3">ผู้ปิดยอด / หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  กำลังโหลด...
                </td>
              </tr>
            )}
            {!loading && days.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">
                  ยังไม่มีข้อมูลรายวัน
                </td>
              </tr>
            )}
            {days.map((d) => {
              const sp = splitStats(d.live.receipts);
              return (
                <tr
                  key={d.date}
                  className="cursor-pointer border-t hover:bg-gold-50/50"
                  onClick={() => setDetailDate(d.date)}
                >
                  <td className="p-3 font-medium">
                    <div>{fmtThaiDate(d.date)}</div>
                    <div className="text-[11px] text-gray-400">{d.date}</div>
                  </td>
                  <td className="p-3">{statusBadge(d)}</td>
                  <td className="p-3 text-right">
                    <div className="font-semibold text-emerald-800">{fmt(sp.customer.total)}</div>
                    <div className="text-[11px] text-gray-500">{sp.customer.count} บิล</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-semibold text-blue-800">{fmt(sp.hq.total)}</div>
                    <div className="text-[11px] text-gray-500">{sp.hq.count} บิล</div>
                  </td>
                  <td className="p-3 text-right text-blue-700">{fmt(sp.customer.vat + sp.hq.vat)}</td>
                  <td className="p-3 text-right">{fmt(d.live.total_weight)}</td>
                  <td className="p-3 text-xs text-gray-600">
                    {d.closing?.closed_by && <div className="font-medium text-ink">{d.closing.closed_by}</div>}
                    <div className="max-w-[200px] truncate">{d.closing?.notes || "-"}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detailEntry && (() => {
        const sp = splitStats(detailEntry.live.receipts);
        return (
          <div className="fixed inset-0 z-40 overflow-auto bg-black/40 p-3">
            <div className="mx-auto max-w-6xl space-y-4 rounded-xl bg-[#fafaf8] p-4 shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-ink">สรุปบิลประจำวันที่ {fmtThaiDate(detailEntry.date)}</h3>
                    {statusBadge(detailEntry)}
                  </div>
                  {detailEntry.closing && (
                    <p className="mt-1 text-xs text-gray-500">
                      ปิดยอดเมื่อ {new Date(detailEntry.closing.closed_at).toLocaleString("th-TH")}
                      {detailEntry.closing.closed_by ? ` · โดย ${detailEntry.closing.closed_by}` : ""}
                      {detailEntry.closing.notes ? ` · หมายเหตุ: ${detailEntry.closing.notes}` : ""}
                    </p>
                  )}
                </div>
                <button className="btn-ghost !p-2" onClick={() => setDetailDate(null)} aria-label="ปิด">
                  <X size={16} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="card border-emerald-200 bg-emerald-50/40">
                  <div className="text-xs font-semibold text-emerald-800">ใบเสร็จลูกค้า (ซื้อเข้า) · {sp.customer.count} บิล</div>
                  <div className="mt-1 text-xl font-bold text-emerald-900">{fmt(sp.customer.total)} บาท</div>
                  <div className="text-xs text-emerald-700">น้ำหนักรวม {fmt(sp.customer.weight)} ก.</div>
                </div>
                <div className="card border-blue-200 bg-blue-50/40">
                  <div className="text-xs font-semibold text-blue-800">ส่งสำนักงานใหญ่ (ใบกำกับภาษี) · {sp.hq.count} บิล</div>
                  <div className="mt-1 text-xl font-bold text-blue-900">{fmt(sp.hq.total)} บาท</div>
                  <div className="text-xs text-blue-700">น้ำหนักรวม {fmt(sp.hq.weight)} ก. · VAT {fmt(sp.hq.vat)} บาท</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {/^\d{4}-\d{2}-\d{2}$/.test(detailEntry.date) && (
                  <>
                    <button
                      className="btn-gold"
                      onClick={() => {
                        setSelDate(detailEntry.date);
                        setDetailDate(null);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <Save size={14} /> {detailEntry.closing ? "แก้ไข/อัปเดตยอดปิดวัน" : "ปิดยอดวันนี้"}
                    </button>
                    <a
                      className="btn border border-emerald-300 bg-emerald-50 text-xs text-emerald-900 hover:bg-emerald-100"
                      href={exportTaxDayUrl("customer", detailEntry.date)}
                    >
                      <Download size={14} /> CSV ยื่นภาษี (ลูกค้า)
                    </a>
                    <a
                      className="btn border border-blue-300 bg-blue-50 text-xs text-blue-900 hover:bg-blue-100"
                      href={exportTaxDayUrl("hq", detailEntry.date)}
                    >
                      <Download size={14} /> CSV ยื่นภาษี (ส่ง สนง.ใหญ่)
                    </a>
                  </>
                )}
                {detailEntry.closing && (
                  <button className="btn-danger ml-auto" onClick={() => removeClosing(detailEntry.date)}>
                    <Trash2 size={14} /> ลบบันทึกปิดยอด
                  </button>
                )}
              </div>

              <div className="card overflow-x-auto p-0">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-gold-50 text-left text-xs text-gray-600">
                    <tr>
                      <th className="p-3">ประเภท</th>
                      <th className="p-3">เลขที่บิล</th>
                      <th className="p-3">ลูกค้า / ผู้ขาย</th>
                      <th className="p-3">เลขผู้เสียภาษี</th>
                      <th className="p-3 text-right">น้ำหนัก (ก.)</th>
                      <th className="p-3 text-right">ก่อน VAT</th>
                      <th className="p-3 text-right">VAT 7%</th>
                      <th className="p-3 text-right">ยอดสุทธิ (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailEntry.live.receipts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-gray-400">
                          ไม่มีบิลในวันนี้
                        </td>
                      </tr>
                    )}
                    {detailEntry.live.receipts.map((r) => (
                      <tr
                        key={r.id}
                        className="cursor-pointer border-t hover:bg-gold-50/50"
                        onClick={() => setOpenReceipt(r)}
                      >
                        <td className="p-3">
                          <span
                            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              r.doc_category === "hq"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {DOC_CATEGORY_META[r.doc_category ?? "customer"].badge}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">{r.receipt_no || "-"}</td>
                        <td className="p-3 font-medium">{r.customer_name || "-"}</td>
                        <td className="p-3 font-mono text-xs text-gray-600">{r.tax_id || "-"}</td>
                        <td className="p-3 text-right">{fmt(r.total_weight)}</td>
                        <td className="p-3 text-right">{fmt(r.subtotal)}</td>
                        <td className="p-3 text-right text-blue-700">{fmt(r.vat_amount ?? r.other_amount)}</td>
                        <td className="p-3 text-right font-medium">{fmt(r.grand_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {openReceipt && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/50 p-3">
          <div className="mx-auto max-w-6xl rounded-xl bg-[#fafaf8] p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {openReceipt.image_url && (
                <ImageViewer
                  src={`/api/image?path=${encodeURIComponent(openReceipt.image_url)}`}
                  isPdf={openReceipt.image_url.endsWith(".pdf")}
                />
              )}
              <ReviewForm
                key={openReceipt.id}
                initial={{ ...openReceipt, items: openReceipt.receipt_items }}
                saving={savingReceipt}
                saveLabel="บันทึกการแก้ไข"
                onSave={updateReceipt}
                onCancel={() => setOpenReceipt(null)}
                onDelete={removeReceipt}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
