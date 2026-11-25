"use client";
import { useRef, useState } from "react";
import { Camera, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { ImageViewer, ReviewForm } from "@/components/Review";
import { useToast } from "@/components/Toast";
import { prepareFile } from "@/lib/image";
import type { ReceiptData, ReceiptRow } from "@/lib/types";

interface Job {
  id: number; name: string; file?: File; url?: string;
  status: "scanning" | "ready" | "error" | "saved"; data?: ReceiptData; error?: string;
}

export default function ScanPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<{ job: Job; data: ReceiptData; existing: ReceiptRow } | null>(null);
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const patch = (id: number, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  async function processOne(id: number, raw: File) {
    try {
      const file = await prepareFile(raw);
      patch(id, { file, url: URL.createObjectURL(file) });
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/scan", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "สแกนไม่สำเร็จ");
      patch(id, { status: "ready", data: j });
      toast(`สแกน ${raw.name} สำเร็จ`);
    } catch (e) {
      patch(id, { status: "error", error: (e as Error).message });
      toast((e as Error).message, "err");
    }
  }

  async function handleFiles(list: FileList | File[]) {
    const queue = Array.from(list).map((raw) => ({ id: ++counter.current, raw }));
    if (queue.length === 0) return;
    setJobs((js) => [...js, ...queue.map(({ id, raw }) => ({ id, name: raw.name, status: "scanning" as const }))]);
    setSel((s) => s ?? queue[0].id);
    // สแกนพร้อมกันสูงสุด 3 ไฟล์แทนการรอทีละไฟล์
    const concurrency = Math.min(3, queue.length);
    let idx = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (idx < queue.length) {
          const item = queue[idx++];
          await processOne(item.id, item.raw);
        }
      })
    );
  }

  async function save(job: Job, data: ReceiptData, force = false) {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify(data));
      fd.append("force", String(force));
      if (job.file) fd.append("file", job.file);
      const r = await fetch("/api/receipts", { method: "POST", body: fd });
      const j = await r.json();
      if (r.status === 409) { setDup({ job, data, existing: j.duplicate }); return; }
      if (!r.ok) throw new Error(j.error ?? "บันทึกไม่สำเร็จ");
      patch(job.id, { status: "saved" });
      setDup(null);
      toast("บันทึกบิลเรียบร้อย");
      const next = jobs.find((x) => x.id !== job.id && x.status !== "saved");
      setSel(next?.id ?? null);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setSaving(false);
    }
  }

  const cur = jobs.find((j) => j.id === sel);

  return (
    <div className="space-y-4">
      <div className="card">
        <div
          className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gold-100 bg-gold-50/40 p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <p className="text-sm text-gray-600">ถ่ายรูปบิลหรืออัปโหลดไฟล์ (ลากวางได้ รองรับหลายไฟล์ / HEIC / PDF)</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn-gold" onClick={() => cam.current?.click()}><Camera size={18} /> ถ่ายรูปบิล</button>
            <button className="btn-ghost" onClick={() => pick.current?.click()}><Upload size={18} /> อัปโหลดรูป / ไฟล์ PDF</button>
          </div>
          <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
          <input ref={pick} type="file" multiple accept="image/*,application/pdf,.heic,.heif" className="hidden" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {jobs.map((j) => (
            <button key={j.id} onClick={() => setSel(j.id)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${sel === j.id ? "border-gold-500 bg-gold-50" : "bg-white"}`}>
              {j.status === "scanning" && <Loader2 size={14} className="animate-spin text-gold-500" />}
              {j.status === "saved" && <CheckCircle2 size={14} className="text-emerald-600" />}
              {j.status === "error" && <XCircle size={14} className="text-red-600" />}
              <span className="max-w-[140px] truncate">{j.name}</span>
            </button>
          ))}
        </div>
      )}

      {cur?.status === "scanning" && <div className="card flex items-center gap-2 text-sm"><Loader2 className="animate-spin text-gold-500" size={18} /> กำลังอ่านบิลด้วย AI... (ปกติ 3–8 วินาที ห้ามรีเฟรชหน้า)</div>}
      {cur?.status === "error" && <div className="card text-sm text-red-700">{cur.error}</div>}
      {cur?.status === "saved" && <div className="card text-sm text-emerald-700">บันทึกแล้ว</div>}
      {cur?.status === "ready" && cur.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          {cur.url && <ImageViewer src={cur.url} isPdf={cur.file?.type === "application/pdf"} />}
          <ReviewForm key={cur.id} initial={cur.data} saving={saving} saveLabel="บันทึกบิล" onSave={(d) => save(cur, d)} />
        </div>
      )}

      {dup && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-md space-y-3">
            <h3 className="font-semibold text-yellow-700">พบบิลที่ข้อมูลตรงกันในระบบ</h3>
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <div>วันที่: {dup.existing.date}</div>
              <div>ลูกค้า: {dup.existing.customer_name}</div>
              <div>ยอดรวม: {dup.existing.grand_total?.toLocaleString("th-TH", { maximumFractionDigits: 3 })} บาท</div>
              <div>บันทึกเมื่อ: {new Date(dup.existing.created_at).toLocaleString("th-TH")}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  const skippedId = dup.job.id;
                  setJobs((js) => js.filter((x) => x.id !== skippedId));
                  const next = jobs.find((x) => x.id !== skippedId && x.status !== "saved");
                  setSel(next?.id ?? null);
                  setDup(null);
                  toast("ข้ามบิลซ้ำแล้ว");
                }}
              >
                ไม่บันทึก (ลบทิ้ง)
              </button>
              <button className="btn-gold" onClick={() => save(dup.job, dup.data, true)}>ยืนยันบันทึกซ้ำ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
