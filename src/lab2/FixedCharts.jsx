// Lab 2.2 · กราฟที่ซ่อมแล้ว — FixedChart1 … FixedChart5 รับ props { rows, products } เหมือน BadChart
// ทุกกราฟใช้สีหลักสีเดียว (MAIN) และข้อความสรุปเหนือกราฟคำนวณจากข้อมูลจริงทั้งหมด
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import {
  revenueByProduct, monthlyRevenue, branchPerformance, weeklyRevenue, daysInMonth, thaiMonth,
} from "./lab2Metrics.js";
import { formatTHB, formatThaiShortDate, formatThaiLongDate, lineTotal, thaiDateKey } from "../lib/metrics.js";

const MAIN = "#b45309";
const GRID = "#e7e5e4";

const thb = (v) => formatTHB(Math.round(v));
const pct = (v) => `${(v * 100).toFixed(1)}%`;
// แกนแบบย่อ: 1,250,000 -> ฿1.3M
const compactTHB = (v) =>
  `฿${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;

// lab2Metrics ต้องการ r.revenue และ r.date — เติมให้ถ้า rows ยังเป็นข้อมูลดิบจาก sales.xlsx
const withRevenueAndDate = (rows) =>
  rows.map((r) => (r.revenue != null && r.date ? r : {
    ...r, revenue: r.revenue ?? lineTotal(r), date: r.date ?? thaiDateKey(r.datetime),
  }));

function Frame({ summary, children }) {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-1 text-sm font-medium text-stone-800">{summary}</p>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** กราฟ 1: เมนูไหนทำเงินมากที่สุด → bar แนวนอน เรียงมาก→น้อย 10 อันดับแรก */
const TOP_N = 10;
export function FixedChart1({ rows, products }) {
  const all = useMemo(() => revenueByProduct(withRevenueAndDate(rows), products), [rows, products]);
  const data = all.slice(0, TOP_N);
  const [first, second] = all;
  const topShare = data.reduce((s, d) => s + d.share, 0);
  const summary = `${first.name} ทำเงินสูงสุด ${thb(first.revenue)} (${pct(first.share)}) มากกว่าอันดับ 2 อย่าง${second.name} ${thb(first.revenue - second.revenue)} · ${TOP_N} อันดับแรกรวม ${pct(topShare)} จากทั้งหมด ${all.length} เมนู`;
  return (
    <Frame summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} interval={0} />
          <Tooltip formatter={(v, _k, item) => [`${thb(v)} (${pct(item.payload.share)})`, "ยอดขาย"]} cursor={{ fill: "#fef3c7" }} />
          <Bar dataKey="revenue" fill={MAIN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="revenue" position="right" formatter={thb} style={{ fontSize: 11, fill: "#44403c" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/** กราฟ 2: สาขาต่างกันมากแค่ไหน → bar แนวนอนเริ่มที่ 0 เรียงมาก→น้อย */
export function FixedChart2({ rows }) {
  const data = useMemo(
    () => branchPerformance(withRevenueAndDate(rows)).sort((a, b) => b.revenue - a.revenue),
    [rows]
  );
  const top = data[0];
  const bottom = data[data.length - 1];
  const summary = `${top.branch}ขายได้มากที่สุด ${thb(top.revenue)} เป็น ${(top.revenue / bottom.revenue).toFixed(1)} เท่าของ${bottom.branch} (${thb(bottom.revenue)}) ซึ่งน้อยที่สุด`;
  return (
    <Frame summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 84, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" domain={[0, "auto"]} tickFormatter={compactTHB} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="branch" width={84} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [thb(v), "ยอดขายรวม"]} cursor={{ fill: "#fef3c7" }} />
          <Bar dataKey="revenue" fill={MAIN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="revenue" position="right" formatter={thb} style={{ fontSize: 11, fill: "#44403c" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/** กราฟ 3: ยอดขายโตหรือลด → เส้นยอดรายสัปดาห์ (เฉพาะสัปดาห์ครบ 7 วัน) ลดความยุ่งของรายวัน */
const COMPARE_WEEKS = 12;
export function FixedChart3({ rows }) {
  const data = useMemo(() => weeklyRevenue(withRevenueAndDate(rows)), [rows]);
  const n = Math.min(COMPARE_WEEKS, Math.floor(data.length / 2));
  const avg = (arr) => arr.reduce((s, d) => s + d.revenue, 0) / arr.length;
  const firstAvg = avg(data.slice(0, n));
  const lastAvg = avg(data.slice(-n));
  const change = lastAvg / firstAvg - 1;
  const summary = `ยอดขายเฉลี่ยต่อสัปดาห์ช่วง ${n} สัปดาห์ล่าสุด ${thb(lastAvg)} ${change >= 0 ? "โตขึ้น" : "ลดลง"} ${pct(Math.abs(change))} เทียบกับ ${n} สัปดาห์แรก (${thb(firstAvg)})`;
  return (
    <Frame summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="week" tickFormatter={formatThaiShortDate} minTickGap={40} tick={{ fontSize: 11 }} />
          <YAxis domain={[0, "auto"]} tickFormatter={compactTHB} width={56} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [thb(v), "ยอดขายสัปดาห์นี้"]} labelFormatter={(w) => `สัปดาห์เริ่ม ${formatThaiLongDate(w)}`} />
          <Line dataKey="revenue" stroke={MAIN} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/** กราฟ 4: เดือนล่าสุดยอดตกจริงไหม → เทียบ "ยอดเฉลี่ยต่อวัน" แทนยอดรวม และบอกจำนวนวันที่มีข้อมูล */
export function FixedChart4({ rows }) {
  const data = useMemo(
    () => monthlyRevenue(withRevenueAndDate(rows)).map((m) => ({
      ...m, label: thaiMonth(m.month), full: daysInMonth(m.month), partial: m.days < daysInMonth(m.month),
    })),
    [rows]
  );
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const diff = last.perDay / prev.perDay - 1;
  const summary = `${last.label} มีข้อมูลแค่ ${last.days} จาก ${last.full} วัน · ยอดเฉลี่ยต่อวัน ${thb(last.perDay)} ${diff >= 0 ? "สูงกว่า" : "ต่ำกว่า"} ${prev.label} ${pct(Math.abs(diff))} — ยอดรวมดูต่ำเพราะวันไม่ครบ`;
  return (
    <Frame summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={4} />
          <YAxis tickFormatter={compactTHB} width={52} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v, _k, item) => [`${thb(v)} / วัน (ข้อมูล ${item.payload.days}/${item.payload.full} วัน)`, "ยอดเฉลี่ยต่อวัน"]}
            cursor={{ fill: "#fef3c7" }}
          />
          <Bar dataKey="perDay" isAnimationActive={false}>
            {data.map((d) => <Cell key={d.month} fill={MAIN} fillOpacity={d.partial ? 0.4 : 1} />)}
            <LabelList
              dataKey="perDay"
              content={({ x, y, width, index }) => data[index]?.partial ? (
                <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fill="#57534e">
                  {data[index].days}/{data[index].full} วัน
                </text>
              ) : null}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/** กราฟ 5: ผลงานผู้จัดการสาขา → จัดอันดับด้วย "ยอดเฉลี่ยต่อวันที่เปิดขาย" ให้ยุติธรรมกับสาขาที่เพิ่งเปิด */
export function FixedChart5({ rows }) {
  const data = useMemo(
    () => branchPerformance(withRevenueAndDate(rows))
      .map((b) => ({ ...b, label: `${b.branch} · ${b.days} วัน` }))
      .sort((a, b) => b.perDay - a.perDay),
    [rows]
  );
  const lowest = data[data.length - 1];
  const fewestDays = data.reduce((m, b) => (b.days < m.days ? b : m));
  const byTotal = [...data].sort((a, b) => a.revenue - b.revenue)[0];
  const summary = `วัดด้วยยอดเฉลี่ยต่อวัน ${lowest.branch}ต่ำสุด ${thb(lowest.perDay)}/วัน${
    byTotal.branch !== lowest.branch
      ? ` ไม่ใช่${byTotal.branch}ที่ยอดรวมน้อยสุด (${byTotal.branch}เปิดขายเพียง ${byTotal.days} วัน)`
      : ` · ${fewestDays.branch}เปิดขายน้อยสุด ${fewestDays.days} วัน`
  }`;
  return (
    <Frame summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 84, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" domain={[0, "auto"]} tickFormatter={compactTHB} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v, _k, item) => [`${thb(v)} / วัน (ยอดรวม ${thb(item.payload.revenue)})`, "ยอดเฉลี่ยต่อวัน"]}
            cursor={{ fill: "#fef3c7" }}
          />
          <Bar dataKey="perDay" fill={MAIN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="perDay" position="right" formatter={(v) => `${thb(v)}/วัน`} style={{ fontSize: 11, fill: "#44403c" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}
