// Lab 4.5 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.5A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.5 · หาวันที่ยอดขายผิดปกติ
// เทียบกับ "ค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน" ไม่ใช่ค่าเฉลี่ย 28 วัน
// เพราะสาขาออฟฟิศกับห้างขายวันธรรมดาและเสาร์-อาทิตย์ต่างกันมาก
import { addDays } from "../../lab3/time.js";

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * คะแนนความผิดปกติ = ln((จริง + SMOOTH) / (คาดหวัง + SMOOTH))
 * SMOOTH กันไม่ให้วันยอดน้อย ๆ (เช่น 50 บาท เทียบ 100 บาท) ดูผิดปกติเกินจริง
 * @param daily    [{ date, branch, revenue }] จาก dailyByBranch()
 * @param holidays { "YYYY-MM-DD": "ชื่อวันหยุด" } วันหยุดจะไม่ถูกจัดอันดับ แต่ติดป้ายไว้
 * @returns ทุกวันที่คำนวณได้ เรียงจากผิดปกติมากไปน้อย:
 *   { date, branch, actual, expected, change (สัดส่วน เช่น -0.9 = ต่ำกว่าปกติ 90%), score, holiday }
 */
export function scoreAnomalies(daily, holidays = {}, { weeks = 8, minWeeks = 4, smooth = 1000 } = {}) {
  // 1) ยอดรายวันแยกสาขา: Map<สาขา, Map<วันที่, ยอด>> และวันแรกที่สาขานั้นมีข้อมูล
  const byBranch = new Map();
  for (const d of daily) {
    let b = byBranch.get(d.branch);
    if (!b) {
      b = { revenue: new Map(), first: d.date };
      byBranch.set(d.branch, b);
    }
    b.revenue.set(d.date, (b.revenue.get(d.date) ?? 0) + d.revenue);
    if (d.date < b.first) b.first = d.date;
  }

  const out = [];
  for (const [branch, { revenue, first }] of byBranch) {
    for (const [date, actual] of revenue) {
      // 2) ค่าคาดหวัง = ค่ากลางของวันเดียวกันของสัปดาห์ (ย้อนทีละ 7 วัน) ไม่เกิน weeks สัปดาห์
      //    วันที่สาขาเปิดแล้วแต่ไม่มีแถว = ขายไม่ได้ (0) · ก่อนวันแรกของสาขา = ยังไม่มีข้อมูล ไม่นับ
      const history = [];
      for (let k = 1; k <= weeks; k++) {
        const past = addDays(date, -7 * k);
        if (past < first) break;
        history.push(revenue.get(past) ?? 0);
      }
      if (history.length < minWeeks) continue; // ข้อมูลย้อนหลังไม่พอ ยังตัดสินไม่ได้

      const expected = median(history);
      out.push({
        date,
        branch,
        actual,
        expected,
        change: expected ? actual / expected - 1 : 0, // -0.9 = ต่ำกว่าปกติ 90%
        score: Math.log((actual + smooth) / (expected + smooth)),
        holiday: holidays[date] ?? null, // วันหยุดยังคำนวณ แต่ติดป้ายไว้ให้ topAnomalies กรองออก
      });
    }
  }

  // 3) ผิดปกติมาก → น้อย ดูขนาดของคะแนน (ต่ำกว่าปกติหรือสูงกว่าปกติก็นับ)
  return out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || a.date.localeCompare(b.date) || a.branch.localeCompare(b.branch));
}

/** อันดับวันผิดปกติที่ควรตรวจสอบ (ไม่รวมวันหยุด) */
export function topAnomalies(daily, holidays = {}, n = 15, opts) {
  return scoreAnomalies(daily, holidays, opts).filter((a) => !a.holiday).slice(0, n);
}
