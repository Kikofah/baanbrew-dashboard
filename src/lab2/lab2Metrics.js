// ฟังก์ชันคำนวณสำหรับ Lab 2.2 · ใช้ร่วมกันทั้งกราฟแย่และกราฟที่ซ่อมแล้ว
// rows มาจาก prepareRows() ใน src/lib/metrics.js (มี revenue, date, hour แล้ว)

/** ยอดขายต่อเมนู เรียงมากไปน้อย พร้อมสัดส่วน */
export function revenueByProduct(rows, products) {
  const name = Object.fromEntries((products ?? []).map((p) => [p.product_id, p.product_name]));
  const map = new Map();
  // ข้าม 15 แถวที่ product_id ว่าง (ระบุเมนูไม่ได้ตอนทำความสะอาด) ไม่งั้นจะกลายเป็น "เมนูที่ 41"
  for (const r of rows) {
    if (!r.product_id) continue;
    map.set(r.product_id, (map.get(r.product_id) ?? 0) + r.revenue);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([id, revenue]) => ({ id, name: name[id] ?? id, revenue, share: revenue / total }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** ยอดขายรายเดือน พร้อมจำนวนวันที่มีข้อมูล และยอดเฉลี่ยต่อวัน */
export function monthlyRevenue(rows) {
  const map = new Map();
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    const cur = map.get(m) ?? { month: m, revenue: 0, days: new Set() };
    cur.revenue += r.revenue;
    cur.days.add(r.date);
    map.set(m, cur);
  }
  return [...map.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ month: m.month, revenue: m.revenue, days: m.days.size, perDay: m.revenue / m.days.size }));
}

/** จำนวนวันในเดือนตามปฏิทิน ใช้ตรวจว่าเดือนไหนข้อมูลไม่ครบ */
export const daysInMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

/** ยอดขายต่อสาขา: ยอดรวม, จำนวนวันที่เปิดขาย, ยอดเฉลี่ยต่อวัน */
export function branchPerformance(rows) {
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.branch) ?? { branch: r.branch, revenue: 0, days: new Set() };
    cur.revenue += r.revenue;
    cur.days.add(r.date);
    map.set(r.branch, cur);
  }
  return [...map.values()].map((b) => ({
    branch: b.branch, revenue: b.revenue, days: b.days.size, perDay: b.revenue / b.days.size,
  }));
}

/** ยอดขายรายสัปดาห์ (เริ่มวันจันทร์) ตัดสัปดาห์ที่มีข้อมูลไม่ครบ 7 วันออก */
export function weeklyRevenue(rows) {
  const map = new Map();
  for (const r of rows) {
    const d = new Date(r.date + "T00:00:00");
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const cur = map.get(key) ?? { week: key, revenue: 0, days: new Set() };
    cur.revenue += r.revenue;
    cur.days.add(r.date);
    map.set(key, cur);
  }
  return [...map.values()]
    .filter((w) => w.days.size === 7)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((w) => ({ week: w.week, revenue: w.revenue }));
}

// 'YYYY-MM-DD' + n วัน (คำนวณใน UTC เพื่อไม่ให้วันเลื่อนตามเขตเวลาของเครื่อง)
const shiftDate = (key, n) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const daySpan = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;

/**
 * แต่ละสาขาเทียบกับตัวเอง: ยอดเฉลี่ยต่อวันช่วงล่าสุด vs ช่วงก่อนหน้าที่ยาวเท่ากัน
 * ความยาวช่วงปัดเป็นสัปดาห์เต็ม (วันธรรมดา/เสาร์-อาทิตย์เท่ากันทั้งสองช่วง) และไม่เกินครึ่งของข้อมูล
 * สาขาที่เปิดหลังวันแรกของช่วงก่อนหน้า → comparable = false (ไม่มีฐานให้เทียบ)
 */
export function branchGrowth(rows) {
  if (!rows.length) return { periodDays: 0, branches: [] };
  let start = rows[0].date;
  let end = rows[0].date;
  for (const r of rows) {
    if (r.date < start) start = r.date;
    if (r.date > end) end = r.date;
  }
  const periodDays = Math.floor(daySpan(start, end) / 14) * 7;
  if (periodDays === 0) return { periodDays: 0, branches: [] };

  const curFrom = shiftDate(end, -(periodDays - 1));
  const prevFrom = shiftDate(curFrom, -periodDays);
  const prevTo = shiftDate(curFrom, -1);
  const map = new Map();
  for (const r of rows) {
    const b = map.get(r.branch) ?? { branch: r.branch, firstDate: r.date, prev: 0, cur: 0 };
    if (r.date < b.firstDate) b.firstDate = r.date;
    if (r.date >= curFrom) b.cur += r.revenue;
    else if (r.date >= prevFrom) b.prev += r.revenue;
    map.set(r.branch, b);
  }
  const branches = [...map.values()].map((b) => {
    const comparable = b.firstDate <= prevFrom && b.prev > 0;
    return {
      branch: b.branch,
      firstDate: b.firstDate,
      prevPerDay: b.prev / periodDays,
      curPerDay: b.cur / periodDays,
      comparable,
      growth: comparable ? b.cur / b.prev - 1 : null,
    };
  });
  return { periodDays, prevFrom, prevTo, curFrom, curTo: end, branches };
}

export const thaiMonth = (ym) =>
  new Date(ym + "-01T00:00:00").toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
