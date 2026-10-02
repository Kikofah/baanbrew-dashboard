// Lab 2.2 · กราฟที่ซ่อมแล้ว — FixedChart1 … FixedChart5 รับ props { rows, products } เหมือน BadChart
// ทุกกราฟใช้สีหลักสีเดียว (MAIN) และข้อความสรุปเหนือกราฟคำนวณจากข้อมูลจริงทั้งหมด
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Legend, ReferenceLine,
} from "recharts";
import {
  revenueByProduct, monthlyRevenue, branchPerformance, branchGrowth, daysInMonth, thaiMonth,
} from "./lab2Metrics.js";
import {
  dailySales, formatTHB, formatThaiShortDate, formatThaiLongDate, lineTotal, thaiDateKey, withMovingAverage,
} from "../lib/metrics.js";

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
  if (!first) return <Frame summary="ไม่มีข้อมูลเมนูในช่วงที่เลือก" />;
  const lead = second ? ` มากกว่าอันดับ 2 อย่าง${second.name} ${thb(first.revenue - second.revenue)}` : "";
  const summary = `${first.name} ทำเงินสูงสุด ${thb(first.revenue)} (${pct(first.share)})${lead} · ${Math.min(TOP_N, all.length)} อันดับแรกรวม ${pct(topShare)} จากทั้งหมด ${all.length} เมนู`;
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

/**
 * กราฟ 3: ยอดขายโตหรือลด → ยอดรายวันเส้นจาง + ค่าเฉลี่ยเคลื่อนที่ 7 วันเส้นเข้ม
 * MA7 ตัดวงจรวันธรรมดา/เสาร์-อาทิตย์ออกพอดี แต่ยังเห็นรายวันเป็นฉากหลัง (ต่างจากรายสัปดาห์ที่ต้องทิ้งสัปดาห์ไม่ครบ)
 */
const COMPARE_DAYS = 84; // 12 สัปดาห์
const MA_DAYS = 7;
const SERIES = { sales: "ยอดขายรายวัน", ma7: "ค่าเฉลี่ย 7 วัน" };
export function FixedChart3({ rows }) {
  const data = useMemo(() => withMovingAverage(dailySales(rows), MA_DAYS), [rows]);
  // สาขาที่เปิดหลังวันแรกของข้อมูล ทำให้ยอดรวม "โต" โดยที่สาขาเดิมอาจไม่ได้ขายดีขึ้น
  const { newBranches, sameStoreDaily } = useMemo(() => {
    const firstDay = new Map();
    for (const r of rows) {
      const d = thaiDateKey(r.datetime);
      if (!firstDay.has(r.branch) || d < firstDay.get(r.branch)) firstDay.set(r.branch, d);
    }
    const start = [...firstDay.values()].reduce((a, b) => (a < b ? a : b), "9999");
    const fresh = [...firstDay].filter(([, d]) => d > start).map(([b]) => b);
    return { newBranches: fresh, sameStoreDaily: dailySales(rows.filter((r) => !fresh.includes(r.branch))) };
  }, [rows]);

  if (data.length < MA_DAYS * 2) {
    return <Frame summary={`ช่วงที่เลือกมีข้อมูล ${data.length} วัน — ต้องมีอย่างน้อย ${MA_DAYS * 2} วันจึงจะเห็นแนวโน้มของค่าเฉลี่ย 7 วัน`} />;
  }
  // เทียบยอดเฉลี่ยต่อวัน n วันล่าสุดกับ n วันแรก (n ≤ 12 สัปดาห์ และไม่เกินครึ่งช่วง)
  const n = Math.min(COMPARE_DAYS, Math.floor(data.length / 2));
  const avg = (days) => days.reduce((sum, d) => sum + d.sales, 0) / days.length;
  const growth = (daily) => avg(daily.slice(-n)) / avg(daily.slice(0, n)) - 1;
  const change = growth(data);
  const latestMa = data.at(-1).ma7;
  const sameStore = newBranches.length
    ? ` · ไม่นับ${newBranches.join(", ")}ที่เปิดทีหลัง ${growth(sameStoreDaily) >= 0 ? "โต" : "ลด"} ${pct(Math.abs(growth(sameStoreDaily)))}`
    : "";
  const summary = `ค่าเฉลี่ย 7 วันล่าสุด ${thb(latestMa)}/วัน · ${n} วันล่าสุด${change >= 0 ? "โตขึ้น" : "ลดลง"} ${pct(Math.abs(change))} เทียบกับ ${n} วันแรก${sameStore}`;

  return (
    <Frame summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatThaiShortDate} minTickGap={48} tick={{ fontSize: 11 }} />
          <YAxis domain={[0, "auto"]} tickFormatter={compactTHB} width={56} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v, key) => [thb(v), SERIES[key]]}
            labelFormatter={formatThaiLongDate}
          />
          <Legend formatter={(key) => SERIES[key]} wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="sales" stroke={MAIN} strokeOpacity={0.3} strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line dataKey="ma7" stroke={MAIN} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
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
  const diff = prev ? last.perDay / prev.perDay - 1 : null;
  const days = last.partial ? `${last.label} มีข้อมูล ${last.days} จาก ${last.full} วัน` : `${last.label} ข้อมูลครบ ${last.full} วัน`;
  const vsPrev = prev ? ` ${diff >= 0 ? "สูงกว่า" : "ต่ำกว่า"} ${prev.label} ${pct(Math.abs(diff))}` : "";
  const summary = `${days} · ยอดเฉลี่ยต่อวัน ${thb(last.perDay)}${vsPrev}${last.partial ? " — เทียบต่อวันเพราะวันไม่ครบ" : ""}`;
  return (
    <Frame summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 20, left: 0, bottom: 0 }}>
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

/**
 * กราฟ 5: ผลงานผู้จัดการสาขา → ให้แต่ละสาขา "เทียบกับตัวเอง" (ช่วงล่าสุด vs ช่วงก่อนหน้าที่ยาวเท่ากัน)
 * ยอดขายสะท้อนทำเลและอายุสาขาด้วย การเทียบกับตัวเองตัดสองเรื่องนี้ออก เหลือแค่ทิศทางที่สาขากำลังไป
 */
const signedPct = (v) => `${v >= 0 ? "+" : "−"}${pct(Math.abs(v))}`;
export function FixedChart5({ rows }) {
  const result = useMemo(() => branchGrowth(withRevenueAndDate(rows)), [rows]);
  const data = result.branches.filter((b) => b.comparable).sort((a, b) => b.growth - a.growth);
  const notComparable = result.branches.filter((b) => !b.comparable);

  if (result.periodDays === 0) {
    return <Frame summary="ช่วงที่เลือกสั้นกว่า 14 วัน — ต้องมีอย่างน้อย 2 สัปดาห์จึงจะเทียบช่วงล่าสุดกับช่วงก่อนหน้าได้" />;
  }
  const period = `${result.periodDays} วันล่าสุด (${formatThaiShortDate(result.curFrom)}–${formatThaiShortDate(result.curTo)}) เทียบ ${result.periodDays} วันก่อนหน้า`;
  const skipped = notComparable.length
    ? ` · ${notComparable.map((b) => b.branch).join(", ")}เปิดกลางช่วง ยังเทียบไม่ได้`
    : "";
  if (!data.length) return <Frame summary={`${period}${skipped}`} />;

  const best = data[0];
  const worst = data.at(-1);
  const worstText = worst.growth < 0 ? `${worst.branch}ลดมากสุด ${signedPct(worst.growth)}` : `${worst.branch}โตน้อยสุด ${signedPct(worst.growth)}`;
  const summary = data.length > 1
    ? `${period}: ${best.branch}${best.growth >= 0 ? "โต" : "ลด"}มากสุด ${signedPct(best.growth)} · ${worstText}${skipped}`
    : `${period}: ${best.branch} ${signedPct(best.growth)}${skipped}`;
  // แกนสมมาตรรอบ 0 ให้ความยาวแท่งบวก/ลบเทียบกันได้ ปัดขึ้นทีละ 5% ให้ป้ายแกนเป็นเลขกลม
  const reach = Math.ceil((Math.max(...data.map((b) => Math.abs(b.growth))) * 1.1) / 0.05) * 0.05 || 0.05;
  const ticks = [-reach, -reach / 2, 0, reach / 2, reach];

  return (
    <Frame summary={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" domain={[-reach, reach]} ticks={ticks} tickFormatter={(v) => (v === 0 ? "0%" : signedPct(v))} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="branch" width={84} tick={{ fontSize: 12 }} />
          <ReferenceLine x={0} stroke="#78716c" />
          <Tooltip
            formatter={(v, _k, item) => [
              `${signedPct(v)} (${thb(item.payload.prevPerDay)} → ${thb(item.payload.curPerDay)} ต่อวัน)`,
              "เทียบช่วงก่อนหน้า",
            ]}
            cursor={{ fill: "#fef3c7" }}
          />
          <Bar dataKey="growth" fill={MAIN} radius={3} isAnimationActive={false}>
            <LabelList dataKey="growth" position="right" formatter={signedPct} style={{ fontSize: 11, fill: "#44403c" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}
