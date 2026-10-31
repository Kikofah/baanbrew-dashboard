// Lab 4.4 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.4A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.4 · พยากรณ์ยอดขายแบบอธิบายได้ และวัดความแม่นด้วยการย้อนทดสอบ (backtest)
import { addDays } from "../../lab3/time.js";

const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = อาทิตย์

/** ค่าเฉลี่ยยอดขายวันเดียวกันของสัปดาห์ K ครั้งล่าสุด (ฤดูกาลรายสัปดาห์) */
export function seasonalForecast(series, horizon, K = 8) {
  if (!series.length) throw new Error("ไม่มีข้อมูลสำหรับพยากรณ์");
  // เก็บยอด K ครั้งล่าสุดของแต่ละวันในสัปดาห์ (ไล่จากท้ายอนุกรม หยุดเมื่อครบทุกวัน)
  const recentByDow = Array.from({ length: 7 }, () => []);
  for (let i = series.length - 1; i >= 0; i--) {
    const bucket = recentByDow[dow(series[i].date)];
    if (bucket.length < K) bucket.push(series[i].revenue);
    if (recentByDow.every((b) => b.length >= K)) break;
  }
  const avgByDow = recentByDow.map((b) => (b.length ? b.reduce((a, x) => a + x, 0) / b.length : 0));
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => {
    const date = addDays(last, i + 1);
    return { date, forecast: avgByDow[dow(date)] };
  });
}

/** ค่าเฉลี่ย K วันล่าสุด เส้นตรง (ตัวเปรียบเทียบที่ไม่สนวันในสัปดาห์) */
export function flatForecast(series, horizon, K = 28) {
  const recent = series.slice(-K);
  const avg = recent.reduce((a, s) => a + s.revenue, 0) / recent.length;
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => ({ date: addDays(last, i + 1), forecast: avg }));
}

/** Mean Absolute Percentage Error (%) · ข้ามวันที่ยอดจริงเป็น 0 เพราะหารไม่ได้ */
export function mape(actual, forecast) {
  let sum = 0;
  let n = 0;
  actual.forEach((a, i) => {
    if (a === 0) return; // หารด้วย 0 ไม่ได้ (วันที่ขายไม่ได้เลย)
    sum += Math.abs(a - forecast[i]) / Math.abs(a);
    n += 1;
  });
  return n ? (sum / n) * 100 : NaN; // ไม่มีวันที่คำนวณได้ = ไม่รู้ ไม่ใช่ 0%
}

/**
 * ย้อนทดสอบ: ซ่อน horizon วันสุดท้าย พยากรณ์จากข้อมูลก่อนหน้า แล้วเทียบกับของจริง
 * band = ±1.28 × ส่วนเบี่ยงเบนมาตรฐานของ % ความคลาดเคลื่อน (ช่วงประมาณ 80%)
 */
export function backtest(series, horizon = 28, K = 8) {
  if (series.length <= horizon) {
    throw new Error(`ข้อมูลไม่พอย้อนทดสอบ: มี ${series.length} วัน ต้องมากกว่า ${horizon} วัน`);
  }
  const train = series.slice(0, -horizon);
  const actual = series.slice(-horizon);
  const seasonal = seasonalForecast(train, horizon, K);
  const flat = flatForecast(train, horizon);
  const test = actual.map((x, i) => ({ date: x.date, actual: x.revenue, seasonal: seasonal[i].forecast, flat: flat[i].forecast }));

  const actuals = test.map((t) => t.actual);
  // % ความคลาดเคลื่อนของวิธี seasonal (สัดส่วน เช่น 0.12 = 12%) ข้ามวันที่ยอดจริงเป็น 0 เหมือน mape
  const errors = test.filter((t) => t.actual !== 0).map((t) => (t.actual - t.seasonal) / t.actual);
  const mean = errors.reduce((a, e) => a + e, 0) / (errors.length || 1);
  const sd = errors.length > 1
    ? Math.sqrt(errors.reduce((a, e) => a + (e - mean) ** 2, 0) / (errors.length - 1))
    : 0;

  return {
    test,
    mapeSeasonal: mape(actuals, test.map((t) => t.seasonal)),
    mapeFlat: mape(actuals, test.map((t) => t.flat)),
    band: 1.28 * sd, // ForecastTab ใช้เป็นแถบ forecast × (1 ± band) ≈ ครอบคลุม 80% ของวัน
  };
}
