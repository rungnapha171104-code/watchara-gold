export type DocCategory = "customer" | "hq";

export const DOC_CATEGORY_META: Record<
  DocCategory,
  { short: string; badge: string; docType: string; partyLabel: string }
> = {
  customer: {
    short: "ใบเสร็จลูกค้า (ซื้อเข้า)",
    badge: "ลูกค้า (ซื้อเข้า)",
    docType: "ใบรับสินค้า / ใบเสร็จรับเงิน",
    partyLabel: "ชื่อผู้ขาย (ลูกค้า)",
  },
  hq: {
    short: "ส่งสำนักงานใหญ่ (ใบกำกับภาษี)",
    badge: "ส่ง สนง.ใหญ่ (ภาษี)",
    docType: "ใบส่งของ / ใบกำกับภาษี / ใบเสร็จรับเงิน",
    partyLabel: "ชื่อลูกค้า / สำนักงานใหญ่",
  },
};

export function classifyDocCategory(docType: string | null | undefined, explicit?: string | null): DocCategory {
  if (explicit === "hq" || explicit === "customer") return explicit;
  const s = docType ?? "";
  if (/ส่งของ|กำกับภาษี|delivery|tax invoice|สำนักงานใหญ่|ขาย/i.test(s)) return "hq";
  return "customer";
}

export interface TaxMeta {
  receipt_no: string | null;
  tax_id: string | null;
  address: string | null;
  redemption_price: number | null;
  tax_base: number | null;
  vat_amount: number | null;
  note_text: string | null;
}

const TAX_PREFIX = "<!--TAX:";
const TAX_SUFFIX = "-->";

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

/** เก็บข้อมูลภาษีแบบมีโครงสร้างไว้ในคอลัมน์ notes เดิม โดยไม่ต้องแก้ตาราง Supabase */
export function packTaxNotes(meta: Partial<TaxMeta>): string | null {
  const payload = {
    receipt_no: toStr(meta.receipt_no),
    tax_id: toStr(meta.tax_id),
    address: toStr(meta.address),
    redemption_price: toNum(meta.redemption_price),
    tax_base: toNum(meta.tax_base),
    vat_amount: toNum(meta.vat_amount),
  };
  const hasMeta = Object.values(payload).some((v) => v !== null);
  const noteText = toStr(meta.note_text);
  if (!hasMeta) return noteText;
  const header = `${TAX_PREFIX}${JSON.stringify(payload)}${TAX_SUFFIX}`;
  return noteText ? `${header}\n${noteText}` : header;
}

export function unpackTaxNotes(rawNotes: string | null | undefined, otherAmount?: number | null): TaxMeta {
  const s = rawNotes ?? "";
  if (s.startsWith(TAX_PREFIX)) {
    const end = s.indexOf(TAX_SUFFIX);
    if (end > TAX_PREFIX.length) {
      try {
        const parsed = JSON.parse(s.slice(TAX_PREFIX.length, end)) as Record<string, unknown>;
        const rest = s.slice(end + TAX_SUFFIX.length).trim();
        return {
          receipt_no: toStr(parsed.receipt_no),
          tax_id: toStr(parsed.tax_id),
          address: toStr(parsed.address),
          redemption_price: toNum(parsed.redemption_price),
          tax_base: toNum(parsed.tax_base),
          vat_amount: toNum(parsed.vat_amount) ?? toNum(otherAmount),
          note_text: rest || null,
        };
      } catch {
        // fallback below
      }
    }
  }
  const m = s.match(/เลขที่[:\s]*([A-Za-z0-9\-/]+)/);
  return {
    receipt_no: m ? m[1] : null,
    tax_id: null,
    address: null,
    redemption_price: null,
    tax_base: null,
    vat_amount: toNum(otherAmount),
    note_text: toStr(s),
  };
}
