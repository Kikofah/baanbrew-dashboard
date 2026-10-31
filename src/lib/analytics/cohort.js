// Lab 4.2 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.2A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.2 · Cohort retention รายเดือน
import { daysBetween } from "../../lab3/time.js";

// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  // คำนวณจากตัวเลขปี/เดือนในสตริงตรง ๆ ไม่ผ่าน Date จึงไม่เพี้ยนเพราะ timezone
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** เดือนถัดไป เช่น "2026-12" → "2027-01" */
function nextMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  const lastMonth = asOf.slice(0, 7);

  // 1) เดือนที่ลูกค้าแต่ละคนมาซื้อ (Set จึงนับซ้ำในเดือนเดียวกันครั้งเดียว) · walk-in ไม่นับ
  const monthsByCustomer = new Map();
  for (const row of rows) {
    const id = row.customer_id == null ? "" : String(row.customer_id).trim();
    if (!id || row.date > asOf) continue;
    let months = monthsByCustomer.get(id);
    if (!months) {
      months = new Set();
      monthsByCustomer.set(id, months);
    }
    months.add(row.date.slice(0, 7));
  }

  // 2) cohort = เดือนแรกที่ซื้อ · นับว่าเดือนที่ k หลังจากนั้นมีกี่คนกลับมา
  const byCohort = new Map(); // cohort → { size, active: number[] }
  for (const months of monthsByCustomer.values()) {
    const first = [...months].reduce((min, ym) => (ym < min ? ym : min));
    let c = byCohort.get(first);
    if (!c) {
      c = { size: 0, active: new Array(monthIndex(first, lastMonth) + 1).fill(0) };
      byCohort.set(first, c);
    }
    c.size += 1;
    for (const ym of months) c.active[monthIndex(first, ym)] += 1;
  }

  // 3) retention[k] = สัดส่วนที่กลับมาในเดือนที่ k (k=0 = 100%) ยาวถึง lastMonth · เรียงตามเดือน
  const cohorts = [...byCohort.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, { size, active }]) => ({ cohort, size, retention: active.map((n) => n / size) }));

  // 4) เดือนสุดท้ายครบหรือไม่: เทียบวันของ asOf กับจำนวนวันในเดือนนั้น
  const daysInMonth = daysBetween(`${lastMonth}-01`, `${nextMonth(lastMonth)}-01`);
  const daysInLastMonth = Number(asOf.slice(8, 10));

  return {
    cohorts,
    lastMonth,
    lastMonthPartial: daysInLastMonth < daysInMonth,
    daysInLastMonth,
    daysInMonth, // CustomersTab ใช้แสดง "มีข้อมูล X จาก Y วัน"
  };
}
