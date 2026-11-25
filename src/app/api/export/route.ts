import { NextRequest, NextResponse } from "next/server";
import { filtersFrom, queryReceipts } from "@/lib/query";
import { csvFilename, itemsCsv, summaryCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") === "summary" ? "summary" : "items";
  const rows = await queryReceipts(sp.get("all") === "1" ? {} : filtersFrom(sp));
  const body = kind === "items" ? itemsCsv(rows) : summaryCsv(rows);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(kind)}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
