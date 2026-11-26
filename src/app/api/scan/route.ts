import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { RESPONSE_SCHEMA, SYSTEM_PROMPT } from "@/lib/prompt";
import { classifyMetal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash"];

let cachedAi: GoogleGenAI | null = null;
function getAi(apiKey: string) {
  return (cachedAi ??= new GoogleGenAI({ apiKey }));
}

function thinkingLevelFor(model: string) {
  // flash-lite รองรับ MINIMAL ทำให้ตัดเวลาคิดและตอบเร็วขึ้นมาก ส่วนรุ่นอื่นใช้ LOW
  return /flash-lite/i.test(model) ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
}

/** 503/429/500/504 ถือเป็นปัญหาชั่วคราวของ Google: ลองซ้ำโมเดลละ 2 ครั้ง แล้วสลับไปโมเดลสำรองอัตโนมัติ */
function isTransient(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return /"code":\s*(429|500|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|timeout|timed out|aborted|DEADLINE_EXCEEDED/i.test(m);
}

function isModelNotFound(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return /"code":\s*404|NOT_FOUND|no longer available/i.test(m);
}

async function runWithFallback<T>(models: string[], run: (model: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const model of models) {
    for (let i = 0; i < 2; i++) {
      try {
        return await run(model);
      } catch (e) {
        last = e;
        if (isModelNotFound(e)) {
          console.warn(`[scan] model ${model} unavailable (404), trying next model`);
          break;
        }
        if (!isTransient(e)) throw e;
        console.warn(`[scan] ${model} transient error, retry ${i + 1}/2`);
        if (i < 1) await new Promise((r) => setTimeout(r, 800));
      }
    }
    console.warn(`[scan] switching from ${model} to next fallback model`);
  }
  throw last;
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY" }, { status: 500 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const ai = getAi(key);
    const call = (model: string) =>
      ai.models.generateContent({
        model,
        contents: [
          { role: "user", parts: [{ inlineData: { mimeType: file.type || "image/jpeg", data: bytes } }, { text: "อ่านใบรับซื้อนี้" }] },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingLevel: thinkingLevelFor(model) },
          // ตัดรอบที่ 20 วินาทีเพื่อสลับโมเดลสำรองเร็วขึ้นแทนการรอค้าง
          httpOptions: { timeout: 20000 },
        },
      });
    const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const envFallback = process.env.GEMINI_FALLBACK_MODEL;
    const models = Array.from(
      new Set([primary, ...(envFallback ? [envFallback] : []), ...DEFAULT_FALLBACK_MODELS])
    );
    const resp = await runWithFallback(models, call);
    const data = JSON.parse(resp.text ?? "{}");
    data.items = (data.items ?? []).map((i: Record<string, unknown>, idx: number) => ({
      no: idx + 1,
      ...i,
      metal_type: i.metal_type ?? classifyMetal(i.item_name as string),
    }));
    // บิลแบบใหม่ไม่มีช่องน้ำหนักรวมแยก ให้รวมจากน้ำหนักแต่ละรายการอัตโนมัติ
    if (data.total_weight == null && data.items.length > 0) {
      const weights = data.items
        .map((i: Record<string, unknown>) => i.weight)
        .filter((w: unknown): w is number => typeof w === "number" && !Number.isNaN(w));
      if (weights.length > 0) {
        data.total_weight = Number(weights.reduce((a: number, b: number) => a + b, 0).toFixed(3));
      }
    }
    if (data.phone != null) data.phone = String(data.phone);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[scan] Gemini error:", e);
    return NextResponse.json({ error: "สแกนไม่สำเร็จ: " + (e instanceof Error ? e.message : "unknown") }, { status: 502 });
  }
}
