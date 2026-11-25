import { NextRequest, NextResponse } from "next/server";
import {
  closeActiveReceipts,
  deleteDailyClosing,
  isValidDateStr,
  listDailyClosings,
  saveDailyClosing,
  summarizeReceipts,
} from "@/lib/daily";
import { queryReceipts } from "@/lib/query";
import type { DailyClosingRecord, ReceiptRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface DailyEntry {
  date: string;
  closing: DailyClosingRecord | null;
  live: ReturnType<typeof summarizeReceipts> & { receipts: ReceiptRow[] };
  needs_update: boolean;
}

export async function GET() {
  try {
    const [closings, allReceipts] = await Promise.all([listDailyClosings(), queryReceipts({})]);
    const closingMap = new Map<string, DailyClosingRecord>();
    for (const c of closings) closingMap.set(c.date, c);

    const byDate = new Map<string, ReceiptRow[]>();
    for (const r of allReceipts) {
      const d = r.date ?? "ไม่ระบุวันที่";
      const arr = byDate.get(d) ?? [];
      arr.push(r);
      byDate.set(d, arr);
    }

    const allDates = Array.from(new Set([...closingMap.keys(), ...byDate.keys()])).sort((a, b) =>
      b.localeCompare(a)
    );

    const days: DailyEntry[] = allDates.map((date) => {
      const receipts = byDate.get(date) ?? [];
      const liveSummary = summarizeReceipts(receipts);
      const closing = closingMap.get(date) ?? null;
      const needs_update =
        closing != null &&
        (closing.receipt_count !== liveSummary.receipt_count ||
          Math.abs(closing.grand_total - liveSummary.grand_total) > 0.01);
      return {
        date,
        closing,
        live: { ...liveSummary, receipts },
        needs_update,
      };
    });

    return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      close_active?: boolean;
      date?: string;
      closed_by?: string | null;
      notes?: string | null;
    };
    if (body.close_active) {
      const result = await closeActiveReceipts(body.closed_by ?? null, body.notes ?? null);
      return NextResponse.json({ ok: true, ...result });
    }
    if (!body.date || !isValidDateStr(body.date)) {
      return NextResponse.json({ error: "กรุณาเลือกวันที่ให้ถูกต้อง" }, { status: 400 });
    }
    const closing = await saveDailyClosing(body.date, body.closed_by ?? null, body.notes ?? null);
    return NextResponse.json({ ok: true, closing });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date") ?? "";
    if (!isValidDateStr(date)) {
      return NextResponse.json({ error: "กรุณาระบุวันที่ให้ถูกต้อง" }, { status: 400 });
    }
    await deleteDailyClosing(date);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
