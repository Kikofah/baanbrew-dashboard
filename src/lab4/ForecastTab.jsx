// Lab 4.4–4.5 · พยากรณ์และวันผิดปกติ
// คำนวณในเบราว์เซอร์จาก analytics/daily (ยอดรายวันแยกสาขา ~2,700 แถว) จึงเปลี่ยนสาขาได้ทันทีโดยไม่อ่าน Firestore เพิ่ม
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceDot,
} from "recharts";
import { AnalyticsShell, Card, Pending, Insight, MAIN, GREEN, MUTED, INK, thaiDay } from "./ui.jsx";
import { useAnalytics } from "./useAnalytics.js";
import { toSeries } from "../lib/analytics/daily.js";
import { seasonalForecast, backtest, mape } from "../lib/analytics/forecast.js";
import { addDays } from "../lab3/time.js";
import { scoreAnomalies } from "../lib/analytics/anomaly.js";
import { fmtBaht, fmtShortBaht } from "../lib/metrics.js";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
const HORIZON = 28;
const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const tryRun = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };

// ---------- รวมเป็นรายสัปดาห์ (จันทร์–อาทิตย์) ----------
const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = อาทิตย์
/** วันจันทร์ของสัปดาห์ที่ ymd อยู่ */
const weekStart = (ymd) => addDays(ymd, -((dow(ymd) + 6) % 7));

/**
 * รวมแถวรายวันเป็นรายสัปดาห์ เก็บเฉพาะสัปดาห์ที่ครบ 7 วัน
 * (สัปดาห์ไม่ครบจะดูต่ำกว่าจริง กับดักเดียวกับเดือนไม่ครบใน Lab 2.2)
 * @param rows   [{ date, ...ค่าตัวเลข }]
 * @param fields ชื่อฟิลด์ที่ต้องรวม เช่น ["actual", "seasonal"]
 */
function toWeeks(rows, fields) {
  const weeks = new Map();
  for (const r of rows) {
    const k = weekStart(r.date);
    const w = weeks.get(k) ?? { week: k, days: 0, ...Object.fromEntries(fields.map((f) => [f, 0])) };
    w.days += 1;
    for (const f of fields) w[f] += r[f];
    weeks.set(k, w);
  }
  return [...weeks.values()].filter((w) => w.days === 7).sort((a, b) => a.week.localeCompare(b.week));
}
const weekLabel = (monday) => `${shortDay(monday)}–${shortDay(addDays(monday, 6))}`;

function ForecastCard({ daily, branch, setBranch }) {
  const [view, setView] = useState("day"); // "day" | "week"
  const result = useMemo(() => tryRun(() => {
    const series = toSeries(daily, branch);
    const bt = backtest(series, HORIZON);
    const fc = seasonalForecast(series, HORIZON);
    const recent = series.slice(-56);
    const last = recent[recent.length - 1];
    const chart = [
      ...recent.map((s) => ({ date: s.date, actual: s.revenue })),
      ...fc.map((f) => ({ date: f.date, forecast: f.forecast, band: [f.forecast * (1 - bt.band), f.forecast * (1 + bt.band)] })),
    ];
    chart[recent.length - 1] = { ...chart[recent.length - 1], forecast: last.revenue }; // ต่อเส้นให้ไม่ขาด
    const next7 = fc.slice(0, 7).reduce((s, f) => s + f.forecast, 0);

    // รายสัปดาห์: ใช้ผลย้อนทดสอบ (bt.test) และพยากรณ์ (fc) ชุดเดิม แค่รวมเป็นสัปดาห์แล้ววัดด้วย mape() ตัวเดิม
    const btWeeks = toWeeks(bt.test, ["actual", "seasonal", "flat"]);
    const weekly = {
      mapeSeasonal: btWeeks.length ? mape(btWeeks.map((w) => w.actual), btWeeks.map((w) => w.seasonal)) : NaN,
      mapeFlat: btWeeks.length ? mape(btWeeks.map((w) => w.actual), btWeeks.map((w) => w.flat)) : NaN,
      weeksTested: btWeeks.length,
      chart: [
        ...toWeeks(recent.map((x) => ({ date: x.date, actual: x.revenue })), ["actual"]),
        ...toWeeks(fc.map((f) => ({ date: f.date, forecast: f.forecast })), ["forecast"]),
      ],
    };
    return { bt, chart, next7, lastDate: last.date, weekly };
  }), [daily, branch]);
  const pctText = (x) => (Number.isFinite(x) ? `${x.toFixed(1)}%` : "–");

  const r = result.value;
  return (
    <Card title="พยากรณ์ยอดขาย 28 วัน"
          sub={view === "day"
            ? "ค่าเฉลี่ยวันเดียวกันของสัปดาห์ 8 สัปดาห์ล่าสุด · แถบ = ช่วงที่คาดว่าครอบคลุมราว 80% ของวัน"
            : "ค่าเฉลี่ยวันเดียวกันของสัปดาห์ 8 สัปดาห์ล่าสุด รวมเป็นยอดต่อสัปดาห์ (จันทร์–อาทิตย์)"}
          right={<div className="flex flex-wrap items-center gap-1">
            <div className="mr-2 inline-flex rounded-lg p-0.5 ring-1 ring-stone-200" role="group" aria-label="มุมมอง">
              {[["day", "รายวัน"], ["week", "รายสัปดาห์"]].map(([v, label]) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                        className={`rounded-md px-2.5 py-1 text-sm ${view === v ? "bg-brand-600 text-page" : "text-stone-600"}`}>{label}</button>
              ))}
            </div>
            {[null, ...BRANCHES].map((b) => (
              <button key={b ?? "all"} type="button" onClick={() => setBranch(b)} aria-pressed={branch === b}
                      className={`rounded-lg px-2.5 py-1 text-sm ${branch === b ? "bg-stone-900 text-white" : "text-stone-600 ring-1 ring-stone-200"}`}>{b ?? "รวม"}</button>
            ))}
          </div>}>
      {result.error ? <Pending lab="Lab 4.4" error={result.error} /> : (
        <>
          {view === "day" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
              <Stat label="ย้อนทดสอบ 28 วัน: คลาดเคลื่อนเฉลี่ยต่อวัน" value={`${r.bt.mapeSeasonal.toFixed(1)}%`} note="วิธีดูวันในสัปดาห์" />
              <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง" value={`${r.bt.mapeFlat.toFixed(1)}%`} note="ตัวเปรียบเทียบ" muted />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
              <Stat label={`คลาดเคลื่อนเฉลี่ยต่อสัปดาห์ (ย้อนทดสอบ ${r.weekly.weeksTested} สัปดาห์)`} value={pctText(r.weekly.mapeSeasonal)}
                    note={`รายวัน ${pctText(r.bt.mapeSeasonal)} · วิธีดูวันในสัปดาห์`} />
              <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง (รายสัปดาห์)" value={pctText(r.weekly.mapeFlat)}
                    note={`รายวัน ${pctText(r.bt.mapeFlat)} · ตัวเปรียบเทียบ`} muted />
            </div>
          )}
          {view === "week" ? (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={r.weekly.chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#3a322c" />
                  <XAxis dataKey="week" tickFormatter={shortDay} tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                  <Tooltip labelFormatter={(w) => `สัปดาห์ ${weekLabel(w)}`} formatter={(v, n) => [fmtBaht(v), n]} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Line name="ยอดจริง (รวมทั้งสัปดาห์)" dataKey="actual" stroke={INK} strokeWidth={2} dot isAnimationActive={false} />
                  <Line name="คาดการณ์ (รวมทั้งสัปดาห์)" dataKey="forecast" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={r.chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#3a322c" />
                <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={36} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={thaiDay} formatter={(v, n) => [Array.isArray(v) ? `${fmtBaht(v[0])} – ${fmtBaht(v[1])}` : fmtBaht(v), n]} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <ReferenceLine x={r.lastDate} stroke={MUTED} strokeDasharray="3 3" label={{ value: "ข้อมูลถึง", position: "insideTopLeft", fontSize: 11, fill: INK }} />
                <Area name="ช่วงคาดการณ์" dataKey="band" stroke="none" fill={GREEN[1]} isAnimationActive={false} />
                <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name="คาดการณ์" dataKey="forecast" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          )}
          {view === "day" ? (
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              <b className="font-medium text-stone-600">แถบช่วงคาดการณ์คำนวณอย่างไร:</b> ซ่อนยอด 28 วันล่าสุด แล้วพยากรณ์ด้วยวิธีเดียวกันจากข้อมูลก่อนหน้า
              วัด % ความคลาดเคลื่อนของแต่ละวัน ((ยอดจริง − คาดการณ์) ÷ ยอดจริง) แล้วหาส่วนเบี่ยงเบนมาตรฐาน (SD)
              แถบ = คาดการณ์ × (1 ± 1.28 × SD) ตอนนี้คือ <b className="font-medium text-stone-600">±{(r.bt.band * 100).toFixed(0)}%</b> ·
              1.28 × SD ครอบคลุมราว 80% ของวัน ถ้าความคลาดเคลื่อนกระจายแบบปกติ จึงคาดว่าราว 1 ใน 5 วันจะหลุดแถบ
              และแถบกว้างเท่ากันทุกวัน (ไม่ได้แยกตามวันในสัปดาห์)
            </p>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              แสดงเฉพาะสัปดาห์จันทร์–อาทิตย์ที่ครบ 7 วัน · ความคลาดเคลื่อนรายสัปดาห์มักต่ำกว่ารายวัน เพราะวันที่ขายเกินกับขาดกว่าคาดหักล้างกันในสัปดาห์เดียว
              · ย้อนทดสอบได้ {r.weekly.weeksTested} สัปดาห์ จึงเป็นตัวเลขคร่าว ๆ · มุมมองนี้ไม่แสดงแถบช่วงคาดการณ์
            </p>
          )}
          {view === "week" ? (
            <Insight>
              {`${branch ?? "ภาพรวม"} รายสัปดาห์: วิธีดูวันในสัปดาห์คลาดเคลื่อน ${pctText(r.weekly.mapeSeasonal)} · เส้นตรง ${pctText(r.weekly.mapeFlat)} (รายวัน ${pctText(r.bt.mapeSeasonal)} กับ ${pctText(r.bt.mapeFlat)})`}
              {" "}พอรวมเป็นสัปดาห์ รูปแบบวันธรรมดากับเสาร์-อาทิตย์จะหักล้างกันจนสองวิธีใกล้กัน ข้อดีของการดูวันในสัปดาห์จึงเห็นชัดเฉพาะยอดรายวัน
              {" "}ยอดรายสัปดาห์แม่นกว่ารายวันมาก จึงเหมาะกับการสั่งวัตถุดิบและวางกะพนักงาน · ทดสอบจาก {r.weekly.weeksTested} สัปดาห์ ยังสรุปไม่ได้ว่าวิธีไหนดีกว่ากันจริง
            </Insight>
          ) : (
          <Insight>
            {r.bt.mapeFlat > r.bt.mapeSeasonal * 1.5
              ? `${branch ?? "ภาพรวม"}: การดูวันในสัปดาห์ช่วยลดความคลาดเคลื่อนจาก ${r.bt.mapeFlat.toFixed(0)}% เหลือ ${r.bt.mapeSeasonal.toFixed(0)}% เพราะยอดวันธรรมดากับเสาร์-อาทิตย์ต่างกันมาก`
              : `${branch ?? "ภาพรวม"}: สองวิธีแม่นพอ ๆ กัน (${r.bt.mapeSeasonal.toFixed(0)}% กับ ${r.bt.mapeFlat.toFixed(0)}%) ${branch ? "" : "เพราะสาขาออฟฟิศกับห้างขายดีคนละวัน พอรวมกันรูปแบบรายสัปดาห์จึงหักล้างกัน"}`}
            {" "}ใช้วางแผนสต็อกและกะพนักงานรายสัปดาห์ได้ แต่ไม่ควรใช้ตัดสินยอดรายวันของสาขาเดียว
          </Insight>
          )}
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, note, muted }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${muted ? "text-stone-500" : ""}`}>{value}</div>
      {note && <div className="text-xs text-stone-400">{note}</div>}
    </div>
  );
}

// ---------------- กราฟรอบวันผิดปกติที่คลิก (Lab 4.5B) ----------------
const FOCUS_DAYS = 28;
const LOW = "#f87171";  // ต่ำกว่าปกติ (แดง)
const HIGH = "#fbbf4a"; // สูงกว่าปกติ (ส้ม)

/**
 * ยอดจริงของสาขานั้น ±28 วันรอบวันที่เลือก เทียบเส้นประ "ค่าปกติ"
 * ค่าปกติ = expected จาก scoreAnomalies ชุดเดียวกับตาราง (all) จึงไม่คำนวณซ้ำ
 */
function FocusChart({ focus, daily, all, holidays, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focus]);

  const data = useMemo(() => {
    const from = addDays(focus.date, -FOCUS_DAYS);
    const to = addDays(focus.date, FOCUS_DAYS);
    // toSeries เติมวันที่ไม่มียอดเป็น 0 · ตัดให้อยู่ในช่วง ±28 วัน (ปลายข้อมูลอาจสั้นกว่า)
    const series = toSeries(daily, focus.branch).filter((x) => x.date >= from && x.date <= to);
    const expected = new Map(all.filter((a) => a.branch === focus.branch).map((a) => [a.date, a.expected]));
    return series.map((x) => ({ date: x.date, actual: x.revenue, expected: expected.get(x.date) ?? null }));
  }, [focus, daily, all]);

  const low = focus.change < 0;
  const color = low ? LOW : HIGH;
  const holidaysInRange = data.filter((d) => holidays[d.date]);
  return (
    <div ref={ref} className="mb-4 rounded-lg bg-stone-50 p-4 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {focus.branch} · {thaiDay(focus.date)}{" "}
            <span style={{ color }}>
              {low ? "▼ ต่ำกว่าปกติ" : "▲ สูงกว่าปกติ"} {Math.round(Math.abs(focus.change) * 100)}%
            </span>
          </p>
          <p className="text-sm text-stone-500">
            ยอดจริง {fmtBaht(focus.actual)} · ปกติ {fmtBaht(focus.expected)} · แสดง {FOCUS_DAYS} วันก่อนและหลัง
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onClose} aria-label="ปิดกราฟ">ปิด ✕</button>
      </div>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#3a322c" />
            <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={28} tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={(d) => `${thaiDay(d)}${holidays[d] ? ` · ${holidays[d]}` : ""}`}
                     formatter={(v, n) => [fmtBaht(v), n]} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <ReferenceLine x={focus.date} stroke={color} strokeDasharray="3 3" />
            {holidaysInRange.map((h) => (
              <ReferenceLine key={h.date} x={h.date} stroke={MUTED} strokeDasharray="2 4"
                             label={{ value: "วันหยุด", position: "insideTopRight", fontSize: 10, fill: MUTED }} />
            ))}
            <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="ค่าปกติ" dataKey="expected" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={false}
                  connectNulls isAnimationActive={false} />
            <ReferenceDot x={focus.date} y={focus.actual} r={7} fill={color} stroke="#1f1a17" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        เส้นประ = ค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อนหน้าแต่ละวัน (ช่วงต้นที่ประวัติไม่ถึง 4 สัปดาห์จะไม่มีเส้นประ)
        · วันที่ไม่มียอดขายแสดงเป็น 0
      </p>
    </div>
  );
}

function AnomalyCard({ daily, holidays }) {
  const [focus, setFocus] = useState(null);
  const result = useMemo(() => tryRun(() => scoreAnomalies(daily, holidays)), [daily, holidays]);
  if (result.error) return <Card title="วันที่ยอดขายผิดปกติ"><Pending lab="Lab 4.5" error={result.error} /></Card>;
  const all = result.value;
  const top = all.filter((a) => !a.holiday).slice(0, 15);
  const holidayHits = all.filter((a) => a.holiday).slice(0, 5);
  return (
    <Card title="วันที่ยอดขายผิดปกติ 15 อันดับ"
          sub="เทียบกับค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน · ไม่นับวันหยุดราชการ">
      {/* Lab 4.5B: คลิกแถว = แสดงกราฟยอดจริงเทียบค่าปกติ ±4 สัปดาห์รอบวันนั้น · คลิกแถวเดิมซ้ำหรือกดปิด = ซ่อน */}
      {focus && <FocusChart focus={focus} daily={daily} all={all} holidays={holidays} onClose={() => setFocus(null)} />}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm tabular-nums">
          <thead className="text-left text-stone-500">
            <tr><th className="py-1 font-medium">#</th><th className="font-medium">วันที่</th><th className="font-medium">สาขา</th>
              <th className="text-right font-medium">ยอดจริง</th><th className="text-right font-medium">ปกติ</th><th className="pl-4 font-medium">ต่างจากปกติ</th></tr>
          </thead>
          <tbody>
            {top.map((a, i) => {
              const sel = focus && focus.date === a.date && focus.branch === a.branch;
              return (
                <tr key={a.date + a.branch} onClick={() => setFocus(sel ? null : a)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setFocus(sel ? null : a))}
                    tabIndex={0} aria-selected={!!sel}
                    className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-brand-600 ${sel ? "bg-emerald-50 font-medium" : ""}`}>
                  <td className="py-1.5 text-stone-400">{i + 1}</td>
                  <td>{thaiDay(a.date)} <span className="text-stone-400">{new Date(a.date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short" })}</span></td>
                  <td>{a.branch}</td>
                  <td className="text-right">{fmtBaht(a.actual)}</td>
                  <td className="text-right text-stone-500">{fmtBaht(a.expected)}</td>
                  <td className="pl-4">
                    {a.change < 0
                      ? <span className="font-medium text-red-700">▼ ต่ำกว่าปกติ {Math.round(-a.change * 100)}%</span>
                      : <span className="font-medium text-amber-700">▲ สูงกว่าปกติ {Math.round(a.change * 100)}%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Insight>
        อันดับต้น ๆ คือวันที่ควรโทรถามผู้จัดการสาขาว่าเกิดอะไรขึ้น · ระบบบอกได้ว่า “ผิดปกติ” แต่บอกไม่ได้ว่า “เพราะอะไร”
        {holidayHits.length > 0 && <> · วันหยุดที่ยอดเปลี่ยนมากแต่ไม่นับ เช่น {holidayHits.slice(0, 3).map((h) => `${h.holiday} (${h.branch})`).join(", ")}</>}
      </Insight>
    </Card>
  );
}

// ---------------- ควรเตรียมของเท่าไร ----------------
/**
 * ยอดคาดการณ์ 7 วัน (สาขาที่เลือก) × สัดส่วนยอดขายของเมนูกลุ่ม A (จาก analytics/abc)
 * แปลงเป็นจำนวนแก้ว/ชิ้นด้วยราคาเมนู (products.csv) แล้วปัดขึ้น
 */
function PrepCard({ daily, branch, abc, products }) {
  const result = useMemo(() => tryRun(() => {
    if (abc.error) throw new Error(abc.error);
    const next7 = seasonalForecast(toSeries(daily, branch), 7).reduce((s, f) => s + f.forecast, 0);
    const price = Object.fromEntries((products ?? []).map((p) => [p.product_id, Number(p.price)]));
    const items = abc.items.filter((i) => i.cls === "A").map((i) => {
      const revenue = next7 * i.share;
      const unitPrice = price[i.product_id];
      return { ...i, revenue, unitPrice, units: unitPrice > 0 ? Math.ceil(revenue / unitPrice) : null };
    });
    const shareA = items.reduce((s, i) => s + i.share, 0);
    return { next7, items, shareA, totalUnits: items.reduce((s, i) => s + (i.units ?? 0), 0) };
  }), [daily, branch, abc, products]);

  const r = result.value;
  return (
    <Card title="ควรเตรียมของเท่าไร · 7 วันข้างหน้า"
          sub={`${branch ?? "ทุกสาขารวม"} · ยอดคาดการณ์ 7 วัน × สัดส่วนยอดขายของเมนูกลุ่ม A · เปลี่ยนสาขาได้ที่การ์ดพยากรณ์`}>
      {result.error ? <Pending lab="Lab 4.2 / 4.4" error={result.error} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="ยอดคาดการณ์ 7 วัน" value={fmtBaht(r.next7)} />
            <Stat label={`เมนูกลุ่ม A ${r.items.length} เมนู`} value={fmtBaht(r.next7 * r.shareA)} note={`${(r.shareA * 100).toFixed(1)}% ของยอดขาย`} />
            <Stat label="รวมประมาณ" value={products ? `${r.totalUnits.toLocaleString()} แก้ว/ชิ้น` : "–"} note={products ? "ปัดขึ้นทีละเมนู" : "กำลังโหลดราคาเมนู…"} />
          </div>
          <div className="mt-4 max-h-96 overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 bg-white text-left text-stone-500">
                <tr>
                  <th className="py-1 font-medium">#</th>
                  <th className="font-medium">เมนู</th>
                  <th className="text-right font-medium">สัดส่วนยอด</th>
                  <th className="text-right font-medium">ยอดคาด 7 วัน</th>
                  <th className="text-right font-medium">ราคา</th>
                  <th className="text-right font-medium">ควรเตรียม</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((i) => (
                  <tr key={i.product_id} className="border-t border-stone-100">
                    <td className="py-1.5 text-stone-400 tabular-nums">{i.rank}</td>
                    <td>{i.name} <span className="text-stone-400">{i.category}</span></td>
                    <td className="text-right tabular-nums">{(i.share * 100).toFixed(1)}%</td>
                    <td className="text-right tabular-nums">{fmtBaht(i.revenue)}</td>
                    <td className="text-right tabular-nums text-stone-500">{i.unitPrice ? fmtBaht(i.unitPrice) : "–"}</td>
                    <td className="text-right font-medium tabular-nums">{i.units == null ? "–" : `${i.units.toLocaleString()} แก้ว/ชิ้น`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            <b className="font-medium text-stone-600">ข้อสมมติ:</b> สัดส่วนเมนูมาจากยอดขายทุกสาขาตลอดช่วงข้อมูล
            (สาขาที่เลือกอาจขายเมนูต่างจากภาพรวม) · จำนวน = ยอดคาด ÷ ราคาเต็ม ไม่คิดส่วนลดหรือโปรโมชัน ·
            เป็นตัวเลขตั้งต้นสำหรับสั่งวัตถุดิบ ควรบวกเผื่อตามแถบช่วงคาดการณ์
          </p>
        </>
      )}
    </Card>
  );
}

/** products = แถวจาก products.csv (App โหลดไว้แล้ว) ใช้ราคาในการ์ด "ควรเตรียมของเท่าไร" */
export default function ForecastTab({ source, products }) {
  const state = useAnalytics(source);
  const [branch, setBranch] = useState(null); // ใช้ร่วมกันระหว่างการ์ดพยากรณ์และการ์ดเตรียมของ
  return (
    <AnalyticsShell source={source} state={state} title="พยากรณ์และวันผิดปกติ">
      {(d) => d.daily.error ? <Pending lab="pipeline" error={d.daily.error} /> : (
        <div className="space-y-6">
          {d.meta.alerts?.length > 0 && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              🚨 ยอดวันล่าสุดผิดปกติ: {d.meta.alerts.map((a) => `${a.branch} ${fmtBaht(a.actual)} (ปกติ ${fmtBaht(a.expected)})`).join(", ")}
            </p>
          )}
          <ForecastCard daily={d.daily.rows} branch={branch} setBranch={setBranch} />
          <PrepCard daily={d.daily.rows} branch={branch} abc={d.abc} products={products} />
          <AnomalyCard daily={d.daily.rows} holidays={d.meta.holidays ?? {}} />
        </div>
      )}
    </AnalyticsShell>
  );
}
