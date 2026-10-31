// Lab 4.1 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.1A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.1 · RFM: แบ่งกลุ่มลูกค้าสมาชิกด้วย Recency, Frequency, Monetary
// rows = ผลจาก prepareRows() (มี order_id, date, revenue, customer_id)
import { daysBetween } from "../../lab3/time.js";

/**
 * คะแนน 1–5 ตามตำแหน่งเปอร์เซ็นไทล์ (ค่ามาก = คะแนนสูง)
 * ค่าที่เท่ากันต้องได้คะแนนเท่ากันเสมอ: score = 1 + floor(5 × จำนวนค่าที่ "น้อยกว่า" / n)
 */
export function percentileScores(values) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  // นับจำนวนค่าที่ "น้อยกว่า" x ด้วย binary search (ตำแหน่งแรกที่ sorted[i] >= x) → O(n log n)
  const countLess = (x) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  // ค่าที่เท่ากันมีจำนวนค่าที่น้อยกว่าเท่ากัน จึงได้คะแนนเท่ากันเสมอ · คืนผลตามลำดับข้อมูลเข้า
  return values.map((x) => 1 + Math.floor((5 * countLess(x)) / n));
}

/** กติกาตั้งชื่อกลุ่ม ตรวจจากบนลงล่าง ข้อแรกที่ตรงคือคำตอบ */
export function segmentOf(r, f) {
  if (r >= 4 && f >= 4) return "Champions";      // มาเร็ว ๆ นี้ และมาบ่อย
  if (r >= 3 && f >= 4) return "Loyal";          // มาบ่อย แต่ห่างไปนิด
  if (r >= 4 && f <= 2) return "New";            // เพิ่งมา แต่ยังมาไม่กี่ครั้ง
  if (r <= 2 && f >= 3) return "At Risk";        // เคยมาบ่อย แต่หายไปนาน
  if (r <= 2 && f <= 2) return "Lost";           // นานแล้ว และมาน้อย
  return "Need Attention";                       // กลาง ๆ ที่เหลือทั้งหมด
}

export const SEGMENTS = [
  { id: "Champions", th: "ลูกค้าชั้นยอด", action: "ให้สิทธิพิเศษ ชวนลองเมนูใหม่ก่อนใคร" },
  { id: "Loyal", th: "ลูกค้าประจำ", action: "สะสมแต้ม/ขยับขึ้นเป็นชั้นยอด" },
  { id: "New", th: "ลูกค้าใหม่", action: "คูปองครั้งที่ 2 ภายใน 14 วัน" },
  { id: "Need Attention", th: "ต้องดูแล", action: "โปรฯ ตามเมนูที่เคยซื้อ" },
  { id: "At Risk", th: "เสี่ยงหาย", action: "ดึงกลับด่วน: เคยซื้อบ่อยแต่หายไปนาน" },
  { id: "Lost", th: "หายไปแล้ว", action: "ใช้งบน้อย ส่งข้อความครั้งเดียว" },
];

/**
 * @param rows   แถวยอดขาย (ไม่นับแถวที่ customer_id ว่าง)
 * @param asOf   วันที่วิเคราะห์ YYYY-MM-DD (ใช้วันล่าสุดของข้อมูล ไม่ใช่วันนี้)
 * @returns {{ customers: object[], segments: object[], asOf: string }}
 *   customers: { id, R (วันที่ไม่ได้มา), F (จำนวนบิล), M (ยอดซื้อรวม), r, f, m, segment }
 *   segments:  { segment, customers, revenue, revenueShare, customerShare } เรียงตาม SEGMENTS
 */
export function computeRfm(rows, asOf) {
  // 1) รวมต่อสมาชิก: วันล่าสุดที่มา, บิลไม่ซ้ำ, ยอดรวม (walk-in = customer_id ว่าง ไม่นับ)
  const byCustomer = new Map();
  for (const row of rows) {
    const id = row.customer_id == null ? "" : String(row.customer_id).trim();
    if (!id) continue;
    let c = byCustomer.get(id);
    if (!c) {
      c = { id, last: row.date, bills: new Set(), M: 0 };
      byCustomer.set(id, c);
    }
    if (row.date > c.last) c.last = row.date;
    c.bills.add(row.order_id); // F นับบิล ไม่ใช่แถว (1 บิลมีหลายเมนูได้)
    c.M += Number(row.revenue);
  }

  // 2) R = จำนวนวันจากครั้งล่าสุดถึง asOf (วันสุดท้ายของข้อมูล)
  const list = [...byCustomer.values()].map((c) => ({ id: c.id, R: daysBetween(c.last, asOf), F: c.bills.size, M: c.M }));

  // 3) คะแนน 1–5 · R น้อย (เพิ่งมา) ต้องได้คะแนนสูง จึงให้คะแนนจาก −R
  const rScores = percentileScores(list.map((c) => -c.R));
  const fScores = percentileScores(list.map((c) => c.F));
  const mScores = percentileScores(list.map((c) => c.M));
  const customers = list.map((c, i) => ({
    ...c,
    r: rScores[i],
    f: fScores[i],
    m: mScores[i],
    segment: segmentOf(rScores[i], fScores[i]),
  }));

  // 4) สรุปต่อกลุ่ม เรียงตาม SEGMENTS (กลุ่มที่ไม่มีใครก็ยังแสดง ค่าเป็น 0)
  const totalRevenue = customers.reduce((sum, c) => sum + c.M, 0);
  const segments = SEGMENTS.map(({ id }) => {
    const members = customers.filter((c) => c.segment === id);
    const revenue = members.reduce((sum, c) => sum + c.M, 0);
    return {
      segment: id,
      customers: members.length,
      revenue,
      revenueShare: totalRevenue ? revenue / totalRevenue : 0,
      customerShare: customers.length ? members.length / customers.length : 0,
    };
  });

  return { customers, segments, asOf };
}
