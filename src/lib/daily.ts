import { admin, BUCKET } from "./supabase";
import { METALS, type DailyClosingRecord, type DailyMetalSummary, type Metal, type ReceiptRow } from "./types";

const PREFIX = "daily-closings";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(d: string) {
  return DATE_RE.test(d);
}

export function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export function emptyMetals(): Record<Metal, DailyMetalSummary> {
  return {
    ทอง: { weight: 0, amount: 0 },
    เงิน: { weight: 0, amount: 0 },
    นาค: { weight: 0, amount: 0 },
    แพลตตินัม: { weight: 0, amount: 0 },
    อื่นๆ: { weight: 0, amount: 0 },
  };
}

export function summarizeReceipts(receipts: ReceiptRow[]) {
  const metals = emptyMetals();
  let total_weight = 0;
  let grand_total = 0;

  for (const r of receipts) {
    total_weight += r.total_weight ?? 0;
    grand_total += r.grand_total ?? 0;
    for (const i of r.receipt_items) {
      const m = METALS.includes(i.metal_type) ? i.metal_type : "อื่นๆ";
      metals[m].weight += i.weight ?? 0;
      metals[m].amount += i.amount ?? 0;
    }
  }

  return {
    receipt_count: receipts.length,
    total_weight: Number(total_weight.toFixed(3)),
    grand_total: Number(grand_total.toFixed(3)),
    metals: Object.fromEntries(
      METALS.map((m) => [
        m,
        {
          weight: Number(metals[m].weight.toFixed(3)),
          amount: Number(metals[m].amount.toFixed(3)),
        },
      ])
    ) as Record<Metal, DailyMetalSummary>,
    receipt_ids: receipts.map((r) => r.id),
  };
}

export async function listDailyClosings(): Promise<DailyClosingRecord[]> {
  const db = admin();
  const { data: files, error } = await db.storage.from(BUCKET).list(PREFIX, {
    limit: 1000,
    sortBy: { column: "name", order: "desc" },
  });
  if (error || !files?.length) return [];

  const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
  const records = await Promise.all(
    jsonFiles.map(async (f) => {
      const { data, error: dlErr } = await db.storage.from(BUCKET).download(`${PREFIX}/${f.name}`);
      if (dlErr || !data) return null;
      try {
        return JSON.parse(await data.text()) as DailyClosingRecord;
      } catch {
        return null;
      }
    })
  );

  return records
    .filter((r): r is DailyClosingRecord => r !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getClosedReceiptIds(): Promise<Set<string>> {
  const closings = await listDailyClosings();
  const ids = new Set<string>();
  for (const c of closings) {
    for (const id of c.receipt_ids ?? []) ids.add(id);
  }
  return ids;
}

async function uploadClosing(record: DailyClosingRecord) {
  const db = admin();
  const payload = Buffer.from(JSON.stringify(record, null, 2), "utf-8");
  const { error } = await db.storage.from(BUCKET).upload(`${PREFIX}/${record.date}.json`, payload, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw new Error("บันทึกปิดยอดไม่สำเร็จ: " + error.message);
}

export async function saveDailyClosing(
  date: string,
  closedBy: string | null,
  notes: string | null,
  extraReceipts: ReceiptRow[] = []
): Promise<DailyClosingRecord> {
  if (!isValidDateStr(date)) throw new Error("รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)");
  const { data, error } = await admin()
    .from("receipts")
    .select("*, receipt_items(*)")
    .eq("date", date);
  if (error) throw new Error(error.message);

  const byId = new Map<string, ReceiptRow>();
  for (const r of (data ?? []) as ReceiptRow[]) byId.set(r.id, r);
  for (const r of extraReceipts) byId.set(r.id, r);
  const receipts = Array.from(byId.values());

  const summary = summarizeReceipts(receipts);
  const record: DailyClosingRecord = {
    date,
    closed_at: new Date().toISOString(),
    closed_by: closedBy?.trim() || null,
    notes: notes?.trim() || null,
    ...summary,
  };
  await uploadClosing(record);
  return record;
}

/** ปิดยอดบิลทั้งหมดที่ยังไม่ถูกปิดยอด แยกตามวันที่ของบิล แล้วเก็บลงสรุปรายวันเพื่อให้หน้าหลักรีเซ็ตเป็นรอบใหม่ */
export async function closeActiveReceipts(
  closedBy: string | null,
  notes: string | null
): Promise<{ closed_dates: string[]; count: number }> {
  const [closedIds, res] = await Promise.all([
    getClosedReceiptIds(),
    admin().from("receipts").select("*, receipt_items(*)"),
  ]);
  if (res.error) throw new Error(res.error.message);
  const all = (res.data ?? []) as ReceiptRow[];
  const active = all.filter((r) => !closedIds.has(r.id));
  if (active.length === 0) throw new Error("ไม่มีบิลที่รอปิดยอดในรอบปัจจุบัน");

  const fallbackDate = todayBangkok();
  const byDate = new Map<string, ReceiptRow[]>();
  for (const r of active) {
    const d = r.date && isValidDateStr(r.date) ? r.date : fallbackDate;
    const list = byDate.get(d) ?? [];
    list.push(r);
    byDate.set(d, list);
  }

  const closed_dates: string[] = [];
  for (const [date, list] of byDate.entries()) {
    const extras = list.filter((r) => r.date !== date);
    await saveDailyClosing(date, closedBy, notes, extras);
    closed_dates.push(date);
  }
  closed_dates.sort((a, b) => b.localeCompare(a));
  return { closed_dates, count: active.length };
}

export async function deleteDailyClosing(date: string): Promise<void> {
  if (!isValidDateStr(date)) throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
  const db = admin();
  const { error } = await db.storage.from(BUCKET).remove([`${PREFIX}/${date}.json`]);
  if (error) throw new Error("ลบบันทึกปิดยอดไม่สำเร็จ: " + error.message);
}
