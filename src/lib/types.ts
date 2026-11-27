import type { DocCategory } from "./tax";

export const METALS = ["ทอง", "เงิน", "นาค", "แพลตตินัม", "อื่นๆ"] as const;
export type Metal = (typeof METALS)[number];

export interface ReceiptItem {
  no: number | null;
  metal_type: Metal;
  item_name: string | null;
  base_price: number | null;
  plus_price: number | null;
  buy_percent: number | null;
  weight: number | null;
  price_per_gram: number | null;
  amount: number | null;
}

export interface ReceiptData {
  doc_category?: DocCategory;
  doc_type?: string | null;
  receipt_no?: string | null;
  date: string | null;
  customer_name: string | null;
  tax_id?: string | null;
  address?: string | null;
  phone: string | null;
  total_weight: number | null;
  subtotal: number | null;
  redemption_price?: number | null;
  tax_base?: number | null;
  vat_amount?: number | null;
  other_amount: number | null;
  grand_total: number | null;
  payment_method: string | null;
  payment_detail: string | null;
  buyer_name: string | null;
  notes: string | null;
  items: ReceiptItem[];
}

export interface ReceiptRow extends Omit<ReceiptData, "items"> {
  id: string;
  created_at: string;
  doc_category?: DocCategory;
  image_url: string | null;
  receipt_items: (ReceiptItem & { id?: string })[];
}

export function classifyMetal(name: string | null | undefined): Metal {
  const n = name ?? "";
  if (/แพลตตินัม|แพลทินัม|platinum|\bpt\d*\b/i.test(n)) return "แพลตตินัม";
  if (n.includes("นาค")) return "นาค";
  if (n.includes("เงิน")) return "เงิน";
  if (n.includes("ทอง")) return "ทอง";
  return "อื่นๆ";
}

export interface DailyMetalSummary {
  weight: number;
  amount: number;
}

export interface DailyClosingRecord {
  date: string;
  closed_at: string;
  closed_by: string | null;
  notes: string | null;
  receipt_count: number;
  total_weight: number;
  grand_total: number;
  metals: Record<Metal, DailyMetalSummary>;
  receipt_ids: string[];
}
