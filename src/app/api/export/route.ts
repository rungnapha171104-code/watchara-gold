import { NextRequest, NextResponse } from "next/server";
import { filtersFrom, queryReceipts } from "@/lib/query";
import { csvFilename, itemsCsv, summaryCsv, taxCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawKind = sp.get("kind");
  const kind = rawKind === "summary" ? "summary" : rawKind === "tax" ? "tax" : "items";
  const category = sp.get("category");
  const filters = sp.get("all") === "1" ? { category } : filtersFrom(sp);
  const rows = await queryReceipts(filters);
  const body = kind === "tax" ? taxCsv(rows) : kind === "summary" ? summaryCsv(rows) : itemsCsv(rows);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(kind, category)}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
