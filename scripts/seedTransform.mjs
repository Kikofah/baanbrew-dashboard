// Lab 3.1 · แปลงแถวจาก sales.csv (ผลลัพธ์ Lab 2.1) เป็นเอกสาร Firestore
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.1 ใน PROMPTS_LAB3.md) จนกว่า npm test จะผ่านทุกข้อ
// scripts/seed.mjs เรียกใช้ฟังก์ชันเหล่านี้ ไม่ต้องแก้ seed.mjs
import { addDays, daysBetween } from "../src/lab3/time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];

/**
 * เลือกเฉพาะ N วันล่าสุดของข้อมูล นับจากวันล่าสุดในไฟล์ (ไม่ใช่วันนี้) รวมวันสุดท้ายด้วย
 * @returns {{ rows: object[], start: string, end: string }}  start/end เป็น YYYY-MM-DD
 */
export function selectLastDays(rows, days) {
  // datetime เป็นเวลาไทยอยู่แล้ว ตัด 10 ตัวแรกได้วันที่ไทยตรง ๆ (ไม่ผ่าน Date จึงไม่กลายเป็น UTC)
  const dateOf = (r) => String(r.datetime).slice(0, 10);
  let end = "";
  for (const r of rows) if (dateOf(r) > end) end = dateOf(r);
  const start = addDays(end, -(days - 1));
  return { rows: rows.filter((r) => dateOf(r) >= start && dateOf(r) <= end), start, end };
}

/** จำนวนวันที่ต้องเลื่อน ให้วันล่าสุดของข้อมูลกลายเป็น "เมื่อวาน" ของ today · ห้ามติดลบ */
export function computeShift(lastDataDate, today) {
  // ให้ lastDataDate + shift = today − 1
  return Math.max(0, daysBetween(lastDataDate, addDays(today, -1)));
}

/** เลื่อนวันที่ใน datetime ("2026-09-20T16:05:09+07:00") ไป days วัน โดยคงเวลาและ +07:00 */
export function shiftDateTime(iso, days) {
  // เลื่อนเฉพาะส่วนวันที่ ส่วน "THH:MM:SS+07:00" ต่อท้ายเดิมทุกตัวอักษร
  return addDays(iso.slice(0, 10), days) + iso.slice(10);
}

/**
 * แปลง 1 แถว CSV (ทุกค่าเป็นข้อความ) เป็น { id, data }
 * id = order_id + "-" + product_id
 * data มีฟิลด์: order_id, datetime, date, hour, branch, product_id, qty, unit_price, revenue,
 *               customer_id (ว่าง = null), payment_method, channel, source = "import"
 * ต้อง throw Error ถ้าข้อมูลยังไม่สะอาด: qty ไม่ใช่จำนวนเต็มบวก, ราคาไม่ใช่ตัวเลขบวก,
 * สาขาไม่อยู่ใน BRANCHES, datetime ไม่ใช่ 20YY-MM-DDTHH:MM:SS+07:00
 */
const DATETIME_RE = /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/;
const INT_RE = /^\d+$/;
const NUM_RE = /^\d+(\.\d+)?$/;

export function toSaleDoc(row, shiftDays = 0) {
  const s = (v) => (v == null ? "" : String(v).trim());
  const orderId = s(row.order_id);
  const productId = s(row.product_id);
  const branch = s(row.branch);
  const rawDatetime = s(row.datetime);
  const qtyText = s(row.qty);
  const priceText = s(row.unit_price);
  const where = `แถว ${orderId || "?"}-${productId || "?"}`;

  if (!orderId || !productId) throw new Error(`${where}: ไม่มี order_id หรือ product_id`);
  if (!DATETIME_RE.test(rawDatetime))
    throw new Error(`${where}: datetime "${rawDatetime}" ไม่ใช่รูปแบบ 20YY-MM-DDTHH:MM:SS+07:00`);
  if (!BRANCHES.includes(branch)) throw new Error(`${where}: สาขา "${branch}" ไม่อยู่ใน BRANCHES`);

  const qty = Number(qtyText);
  if (!INT_RE.test(qtyText) || !Number.isInteger(qty) || qty <= 0)
    throw new Error(`${where}: qty "${qtyText}" ไม่ใช่จำนวนเต็มบวก`);
  const unit_price = Number(priceText);
  if (!NUM_RE.test(priceText) || !(unit_price > 0))
    throw new Error(`${where}: unit_price "${priceText}" ไม่ใช่ตัวเลขบวก`);

  const datetime = shiftDays ? shiftDateTime(rawDatetime, shiftDays) : rawDatetime;
  const customerId = s(row.customer_id);

  return {
    id: `${orderId}-${productId}`,
    data: {
      order_id: orderId,
      datetime,
      date: datetime.slice(0, 10),            // วันที่ไทย ตัดจากสตริงตรง ๆ
      hour: Number(datetime.slice(11, 13)),   // ชั่วโมงไทย 0–23
      branch,
      product_id: productId,
      qty,
      unit_price,
      revenue: Math.round(qty * unit_price * 100) / 100,
      customer_id: customerId === "" ? null : customerId,
      payment_method: s(row.payment_method),
      channel: s(row.channel),
      source: "import",
    },
  };
}

/** สรุป: { docs, bills (นับ order_id ไม่ซ้ำ), revenue, byBranch: {สาขา: ยอด}, start, end } */
export function summarize(docs) {
  const bills = new Set();
  const byBranch = {};
  let revenue = 0;
  let start = null;
  let end = null;
  for (const { data } of docs) {
    bills.add(data.order_id);
    revenue += data.revenue;
    byBranch[data.branch] = (byBranch[data.branch] ?? 0) + data.revenue;
    if (start === null || data.date < start) start = data.date;
    if (end === null || data.date > end) end = data.date;
  }
  return { docs: docs.length, bills: bills.size, revenue, byBranch, start, end };
}
