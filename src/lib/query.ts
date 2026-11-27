import { admin } from "./supabase";
import { getClosedReceiptIds } from "./daily";
import { classifyDocCategory, unpackTaxNotes } from "./tax";
import type { ReceiptRow } from "./types";

export interface Filters {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  metal?: string | null;
  scope?: string | null;
  category?: string | null;
}

export function filtersFrom(sp: URLSearchParams): Filters {
  return {
    q: sp.get("q"),
    from: sp.get("from"),
    to: sp.get("to"),
    metal: sp.get("metal"),
    scope: sp.get("scope"),
    category: sp.get("category"),
  };
}

export function hydrateReceipt(raw: Record<string, unknown>): ReceiptRow {
  const r = raw as unknown as ReceiptRow;
  const meta = unpackTaxNotes(r.notes, r.other_amount);
  return {
    ...r,
    doc_category: classifyDocCategory(r.doc_type),
    receipt_no: meta.receipt_no,
    tax_id: meta.tax_id,
    address: meta.address,
    redemption_price: meta.redemption_price,
    tax_base: meta.tax_base,
    vat_amount: meta.vat_amount,
    notes: meta.note_text,
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

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []).map((r) => hydrateReceipt(r as Record<string, unknown>));

  if (f.scope === "active") {
    const closedIds = await getClosedReceiptIds();
    rows = rows.filter((r) => !closedIds.has(r.id));
  }
  if (f.category === "customer" || f.category === "hq") {
    rows = rows.filter((r) => r.doc_category === f.category);
  }
  if (f.q) {
    const needle = f.q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter(
        (r) =>
          (r.customer_name ?? "").toLowerCase().includes(needle) ||
          (r.phone ?? "").toLowerCase().includes(needle) ||
          (r.receipt_no ?? "").toLowerCase().includes(needle) ||
          (r.tax_id ?? "").toLowerCase().includes(needle)
      );
    }
  }
  if (f.metal) rows = rows.filter((r) => r.receipt_items.some((i) => i.metal_type === f.metal));
  return rows;
}
