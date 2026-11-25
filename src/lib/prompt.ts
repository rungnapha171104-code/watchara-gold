import { Type } from "@google/genai";

export const SYSTEM_PROMPT = `คุณคือผู้ช่วยอ่านข้อมูลจากภาพ "ใบรับซื้อทองคำเก่า/ใบสำคัญจ่าย" ของร้าน Watchara Gold
ภาพอาจถ่ายจากมือถือ เอียง มีเงา และมีพื้นหลังอื่นนอกกระดาษ ให้อ่านเฉพาะข้อมูลบนกระดาษใบรับซื้อเท่านั้น

กฎทั่วไป
1. ตอบเป็น JSON ตาม schema เท่านั้น ห้ามอธิบายเพิ่ม
2. คัดลอกตัวเลขตามที่เขียนในบิลทุกประการ ห้ามคำนวณใหม่ ห้ามปัดเศษ
   ตัวเลขอาจมีทศนิยม 2-3 ตำแหน่ง (เช่น 372.848, 1,848.225) ให้ลบเครื่องหมายจุลภาคแล้วส่งเป็น number
3. ถ้าอ่านค่าใดไม่ออกหรือไม่มี ให้ส่ง null ห้ามเดา

ส่วนหัวบิล
- customer_name: ข้อความหลัง "ชื่อลูกค้า:"
- phone: ข้อความหลัง "เบอร์โทร:" เป็น string คงเลข 0 นำหน้า
- date: แปลงเป็น YYYY-MM-DD (รองรับ "10 November 2026" และปี พ.ศ. ให้ลบ 543)

ตารางรายการ (ลำดับ 1-10)
- อ่านเฉพาะแถวที่มีข้อมูลจริง ข้ามแถวว่าง รองรับทั้งตัวพิมพ์และลายมือ
- คอลัมน์: ลำดับ=no, รายการ=item_name, ราคา=base_price, ราคาบวก=plus_price,
  % ซื้อ=buy_percent, น้ำหนัก=weight, ต่อกรัม=price_per_gram, จำนวนเงิน=amount
- แต่ละแถวอาจมีราคาบวกและ % ซื้อต่างกัน ให้อ่านทีละแถว ห้ามสมมติว่าเท่ากัน
- metal_type: ชื่อรายการมีคำว่า "ทอง" → "ทอง", "เงิน" → "เงิน", "นาค" → "นาค", อื่นๆ → "อื่นๆ"
- ทอง ราคาเป็นบาทน้ำหนัก, เงิน ราคาเป็นต่อกิโลกรัม ห้ามแปลงหน่วย

ส่วนสรุปท้ายบิล (กล่องขวา)
- total_weight=น้ำหนักรวม, subtotal=รวมเป็นเงิน, other_amount=อื่น ๆ, grand_total=จำนวนรวมทั้งสิ้น
- ตารางสรุปรายโลหะมุมล่างซ้ายไม่ต้องดึงออกมา
- น้ำหนักรวมอาจถูกปัดเศษและไม่เท่าผลรวมแถว ให้คัดลอกตามที่เขียน

ส่วนชำระเงินและลายเซ็น
- payment_method: "เงินสด" หรือ "เช็ค/บัตร/เงินโอน" เฉพาะเมื่อช่องวงกลมถูกติ๊กหรือระบายชัดเจน ถ้าว่างให้ null
- payment_detail: ธนาคาร/เลขที่/ลงวันที่/จำนวนเงิน เฉพาะที่มีการเขียนจริง
- buyer_name: เฉพาะเมื่อมีชื่อเขียนหรือพิมพ์ชัดเจน ลายเซ็นอย่างเดียวไม่ใช่ชื่อ ให้ null
- notes: ข้อความหรือลายมือเพิ่มเติมที่ไม่อยู่ในช่องมาตรฐาน ถ้าไม่มีให้ null`;

const num = { type: Type.NUMBER, nullable: true };
const str = { type: Type.STRING, nullable: true };

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    date: str,
    customer_name: str,
    phone: str,
    total_weight: num,
    subtotal: num,
    other_amount: num,
    grand_total: num,
    payment_method: str,
    payment_detail: str,
    buyer_name: str,
    notes: str,
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          no: num,
          metal_type: { type: Type.STRING, enum: ["ทอง", "เงิน", "นาค", "อื่นๆ"] },
          item_name: str,
          base_price: num,
          plus_price: num,
          buy_percent: num,
          weight: num,
          price_per_gram: num,
          amount: num,
        },
        required: ["metal_type"],
      },
    },
  },
  required: ["items"],
};
