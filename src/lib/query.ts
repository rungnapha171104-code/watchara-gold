import { admin } from "./supabase";
import { getClosedReceiptIds } from "./daily";
import type { ReceiptRow } from "./types";

export interface Filters {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  metal?: string | null;
  scope?: string | null;
}

export function filtersFrom(sp: URLSearchParams): Filters {
  return {
    q: sp.get("q"),
    from: sp.get("from"),
    to: sp.get("to"),
    metal: sp.get("metal"),
    scope: sp.get("scope"),
  };
}

export async function queryReceipts(f: Filters): Promise<ReceiptRow[]> {
  let q = admin()
    .from("receipts")
    .select("*, receipt_items(*)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (f.from) q = q.gte("date", f.from);
  if (f.to) q = q.lte("date", f.to);
  if (f.q) {
    const s = f.q.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`customer_name.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as ReceiptRow[];
  if (f.scope === "active") {
    const closedIds = await getClosedReceiptIds();
    rows = rows.filter((r) => !closedIds.has(r.id));
  }
  // ตัวกรองโลหะ: บิลที่มีโลหะนั้นอย่างน้อย 1 แถว
  if (f.metal) rows = rows.filter((r) => r.receipt_items.some((i) => i.metal_type === f.metal));
  return rows;
}
