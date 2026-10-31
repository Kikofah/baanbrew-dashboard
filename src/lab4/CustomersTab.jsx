// Lab 4.1–4.2 · ลูกค้าและเมนู: RFM, Cohort, ABC
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, Cell, ReferenceLine,
} from "recharts";
import { AnalyticsShell, Card, Pending, Insight, GREEN, MAIN, MUTED, INK, pct, thaiMonth } from "./ui.jsx";
import { useAnalytics } from "./useAnalytics.js";
import { SEGMENTS } from "../lib/analytics/rfm.js";
import { fmtBaht } from "../lib/metrics.js";

const SEG_TH = Object.fromEntries(SEGMENTS.map((s) => [s.id, s]));

// ---------------- RFM ----------------
function RfmCard({ rfm, onPick, picked }) {
  if (rfm.error) return <Card title="RFM · กลุ่มลูกค้า"><Pending lab="Lab 4.1" error={rfm.error} /></Card>;
  const data = rfm.segments.map((s) => ({ ...s, label: SEG_TH[s.segment].th }));
  const ch = rfm.segments.find((s) => s.segment === "Champions");
  const risk = rfm.segments.find((s) => s.segment === "At Risk");
  return (
    <Card title="RFM · กลุ่มลูกค้าสมาชิก" sub="สัดส่วนจำนวนลูกค้า เทียบกับสัดส่วนยอดซื้อ">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48 }} barGap={2}>
            <CartesianGrid horizontal={false} stroke="#3a322c" />
            <XAxis type="number" tickFormatter={(v) => pct(v)} domain={[0, 0.45]} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 13 }} />
            <Tooltip formatter={(v, n) => [pct(v, 1), n]} cursor={{ fill: "#3a2a1c" }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar name="% ลูกค้า" dataKey="customerShare" fill={MUTED} radius={[0, 4, 4, 0]} isAnimationActive={false}
                 onClick={(d) => onPick?.(d.payload?.segment ?? d.segment)} style={{ cursor: "pointer" }} />
            <Bar name="% ยอดซื้อ" dataKey="revenueShare" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}
                 onClick={(d) => onPick?.(d.payload?.segment ?? d.segment)} style={{ cursor: "pointer" }}>
              {data.map((d) => <Cell key={d.segment} fill={picked && picked !== d.segment ? GREEN[2] : MAIN} />)}
              <LabelList dataKey="revenueShare" position="right" formatter={(v) => pct(v)} style={{ fontSize: 12, fill: INK }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Insight>
        ลูกค้าชั้นยอด {ch.customers.toLocaleString()} คน ({pct(ch.customerShare)} ของสมาชิก) ทำยอด {pct(ch.revenueShare)} ·
        กลุ่มเสี่ยงหาย {risk.customers.toLocaleString()} คน ยังถือยอด {pct(risk.revenueShare)} เป็นเป้าหมายแรกของแคมเปญดึงกลับ
      </Insight>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-stone-500"><tr><th className="py-1 font-medium">กลุ่ม</th><th className="text-right font-medium">ลูกค้า</th><th className="text-right font-medium">ยอดซื้อ</th><th className="pl-4 font-medium">ควรทำอะไร</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.segment} onClick={() => onPick?.(d.segment)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick?.(d.segment))}
                  tabIndex={0} aria-selected={picked === d.segment}
                  className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-brand-600 ${picked === d.segment ? "bg-emerald-50 font-medium" : ""}`}>
                <td className={`py-1.5 pl-2 ${picked === d.segment ? "border-l-4 border-emerald-500" : "border-l-4 border-transparent"}`}>
                  {d.label} <span className="text-stone-400">{d.segment}</span>
                </td>
                <td className="text-right tabular-nums">{d.customers.toLocaleString()}</td>
                <td className="text-right tabular-nums">{fmtBaht(d.revenue)}</td>
                <td className="pl-4 text-stone-600">{SEG_TH[d.segment].action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------- รายชื่อลูกค้าในกลุ่มที่เลือก (Lab 4.1B) ----------------
const TOP_N = 15;

/** ค่า 1 ช่องใน CSV: ครอบด้วย " ถ้ามี , " หรือขึ้นบรรทัดใหม่ */
const csvCell = (v) => {
  const t = String(v ?? "");
  return /[",\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
};

/** ดาวน์โหลดรายชื่อทั้งกลุ่มเป็น CSV · ขึ้นต้นด้วย BOM (\uFEFF) ให้ Excel รู้ว่าเป็น UTF-8 จึงอ่านภาษาไทยได้ */
function downloadCsv(customers, segment, asOf) {
  const header = ["รหัสลูกค้า", "กลุ่ม", "ไม่ได้มา (วัน)", "จำนวนบิล", "ยอดซื้อรวม (บาท)", "คะแนน R", "คะแนน F", "คะแนน M"];
  const lines = customers.map((c) => [c.id, SEG_TH[segment].th, c.R, c.F, Math.round(c.M), c.r, c.f, c.m].map(csvCell).join(","));
  const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rfm-${segment.replaceAll(" ", "-").toLowerCase()}-${asOf}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * คำเตือน PDPA ก่อนดาวน์โหลด: รหัสสมาชิก + พฤติกรรมการซื้อ โยงกลับถึงตัวบุคคลได้ จึงเป็นข้อมูลส่วนบุคคล
 * ต้องติ๊กยอมรับก่อนจึงดาวน์โหลดได้ (ไม่ใช้ window.confirm เพื่อให้อ่านเงื่อนไขครบ)
 */
function PdpaConfirm({ count, onConfirm, onCancel }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div role="alertdialog" aria-labelledby="pdpa-title" className="mb-4 rounded-lg bg-amber-100 p-4 text-sm ring-1 ring-amber-700/40">
      <p id="pdpa-title" className="font-semibold text-amber-800">⚠️ ข้อมูลส่วนบุคคลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
      <p className="mt-1 text-stone-700">
        ไฟล์นี้มีรหัสสมาชิก {count.toLocaleString()} คน พร้อมประวัติการซื้อ ซึ่งระบุตัวบุคคลได้เมื่อใช้คู่กับข้อมูลสมาชิก
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-stone-700">
        <li>ใช้เพื่อดูแลลูกค้าของร้านตามที่ระบุในกลุ่มนี้เท่านั้น</li>
        <li>ห้ามส่งต่อให้บุคคลภายนอก ห้ามอัปโหลดขึ้นที่สาธารณะหรือแชทกลุ่ม</li>
        <li>เก็บในเครื่องที่ปลอดภัย และลบไฟล์เมื่อใช้งานเสร็จ</li>
      </ul>
      <label className="mt-3 flex items-start gap-2 text-stone-800">
        <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        ฉันเข้าใจและจะใช้ข้อมูลนี้ตามเงื่อนไขข้างต้น
      </label>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" disabled={!agreed} onClick={onConfirm}>ยืนยันดาวน์โหลด</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>ยกเลิก</button>
      </div>
    </div>
  );
}

function SegmentCustomersCard({ rfm, segment, onClose }) {
  const ref = useRef(null);
  // เก็บว่ากำลังยืนยันของกลุ่มไหน · เปลี่ยนกลุ่มแล้วต้องยืนยันใหม่โดยอัตโนมัติ
  const [confirmFor, setConfirmFor] = useState(null);
  const confirming = confirmFor === segment;
  // ทั้งกลุ่ม เรียงยอดซื้อรวมมาก → น้อย (ใช้ทั้งตาราง 15 คนแรกและ CSV)
  const members = useMemo(
    () => rfm.customers.filter((c) => c.segment === segment).sort((a, b) => b.M - a.M),
    [rfm.customers, segment],
  );
  // เลื่อนการ์ดเข้ามาในจอเมื่อเลือกกลุ่มใหม่ (กราฟสูง การ์ดอาจอยู่นอกจอ)
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [segment]);

  const info = SEG_TH[segment];
  return (
    <div ref={ref}>
      <Card
        title={`${info.th} (${segment}) · ${members.length.toLocaleString()} คน`}
        sub={`ควรทำ: ${info.action} · แสดง ${Math.min(TOP_N, members.length)} คนแรกที่ยอดซื้อสูงสุด`}
        right={
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={!members.length || confirming}
                    onClick={() => setConfirmFor(segment)}>
              ดาวน์โหลด CSV ({members.length.toLocaleString()} คน)
            </button>
            <button type="button" className="btn-ghost" onClick={onClose} aria-label="ปิดรายชื่อลูกค้า">ปิด ✕</button>
          </div>
        }
      >
        {confirming && (
          <PdpaConfirm
            count={members.length}
            onConfirm={() => { downloadCsv(members, segment, rfm.asOf); setConfirmFor(null); }}
            onCancel={() => setConfirmFor(null)}
          />
        )}
        {members.length === 0 ? (
          <p className="text-sm text-stone-500">ไม่มีลูกค้าในกลุ่มนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-stone-500">
                <tr>
                  <th className="py-1 font-medium">#</th>
                  <th className="font-medium">รหัสลูกค้า</th>
                  <th className="text-right font-medium">ไม่ได้มา</th>
                  <th className="text-right font-medium">จำนวนบิล</th>
                  <th className="text-right font-medium">ยอดซื้อรวม</th>
                  <th className="text-center font-medium">คะแนน R-F-M</th>
                </tr>
              </thead>
              <tbody>
                {members.slice(0, TOP_N).map((c, i) => (
                  <tr key={c.id} className="border-t border-stone-100">
                    <td className="py-1.5 text-stone-400 tabular-nums">{i + 1}</td>
                    <td className="font-medium tabular-nums">{c.id}</td>
                    <td className="text-right tabular-nums">{c.R.toLocaleString()} วัน</td>
                    <td className="text-right tabular-nums">{c.F.toLocaleString()}</td>
                    <td className="text-right tabular-nums">{fmtBaht(c.M)}</td>
                    <td className="text-center tabular-nums text-stone-600">{c.r}-{c.f}-{c.m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------- Cohort ----------------
function CohortCard({ cohort }) {
  if (cohort.error) return <Card title="Cohort · การกลับมาซื้อซ้ำ"><Pending lab="Lab 4.2" error={cohort.error} /></Card>;
  const MAXK = 12;
  const shade = (v) => GREEN[Math.min(5, Math.floor(v * 6))];
  const avg1 = (() => {
    const xs = cohort.cohorts.filter((c) => c.retention.length > 2).map((c) => c.retention[1]);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  })();
  return (
    <Card title="Cohort · การกลับมาซื้อซ้ำ" sub="แถว = เดือนแรกที่ซื้อ · คอลัมน์ = เดือนที่เท่าไรหลังจากนั้น · ช่องลายขีด = เดือนล่าสุดที่ข้อมูลยังไม่ครบ">
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[2px] text-xs tabular-nums" style={{ gridTemplateColumns: `72px 44px repeat(${MAXK + 1}, 40px)` }}>
          <div className="font-medium text-stone-500">เดือนแรก</div><div className="text-right font-medium text-stone-500">คน</div>
          {Array.from({ length: MAXK + 1 }, (_, k) => <div key={k} className="text-center font-medium text-stone-500">{k}</div>)}
          {cohort.cohorts.map((c) => (
            <Row key={c.cohort} c={c} MAXK={MAXK} shade={shade} partial={cohort.lastMonthPartial} />
          ))}
        </div>
      </div>
      <Insight>
        โดยเฉลี่ยลูกค้าใหม่กลับมาซื้อในเดือนถัดไป {pct(avg1)} · ช่องแนวทแยงล่างขวาดูต่ำผิดปกติเพราะ{thaiMonth(cohort.lastMonth)}มีข้อมูล{" "}
        {cohort.daysInLastMonth} จาก {cohort.daysInMonth} วัน (กับดักเดียวกับกราฟ 4 ใน Lab 2.2)
      </Insight>
    </Card>
  );
}
function Row({ c, MAXK, shade, partial }) {
  const last = c.retention.length - 1;
  return (
    <>
      <div className="py-1">{thaiMonth(c.cohort)}</div>
      <div className="py-1 text-right text-stone-500">{c.size}</div>
      {Array.from({ length: MAXK + 1 }, (_, k) => {
        const v = c.retention[k];
        if (v === undefined) return <div key={k} />;
        const isPartial = partial && k === last && k > 0;
        return (
          <div key={k} title={`${thaiMonth(c.cohort)} เดือนที่ ${k}: ${pct(v, 1)}${isPartial ? " (เดือนไม่ครบ)" : ""}`}
               className="flex h-7 items-center justify-center rounded-[3px]"
               style={{
                 background: isPartial ? `repeating-linear-gradient(45deg, ${shade(v)}, ${shade(v)} 4px, #1f1a17 4px, #1f1a17 6px)` : shade(v),
                 color: v >= 0.5 ? "#fff" : "#1c1917", // ช่องสีเขียวอ่อนต้องใช้ตัวอักษรเข้ม
               }}>
            {k === 0 ? "" : Math.round(v * 100)}
          </div>
        );
      })}
    </>
  );
}

// ---------------- ABC ----------------
function AbcCard({ abc }) {
  if (abc.error) return <Card title="Pareto · ABC ของเมนู"><Pending lab="Lab 4.2" error={abc.error} /></Card>;
  const items = abc.items;
  const nA = items.filter((i) => i.cls === "A").length;
  const C = items.filter((i) => i.cls === "C");
  const fill = { A: MAIN, B: GREEN[2], C: "#4a4039" };
  return (
    <Card title="Pareto · ABC ของเมนู" sub="แท่ง = สัดส่วนยอดขายแต่ละเมนู · เส้น = ยอดสะสม · แกนเดียวกันเป็น %">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#3a322c" />
            <XAxis dataKey="rank" tick={{ fontSize: 11 }} interval={4} label={{ value: "อันดับเมนู", position: "insideBottomRight", offset: -2, fontSize: 12 }} />
            <YAxis tickFormatter={(v) => pct(v)} domain={[0, 1]} width={44} tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={(r) => { const it = items[r - 1]; return `#${r} ${it.name} · กลุ่ม ${it.cls}`; }}
                     formatter={(v, n) => [pct(v, 1), n]} />
            <ReferenceLine y={0.8} stroke={MUTED} strokeDasharray="4 4" label={{ value: "80%", position: "right", fontSize: 11, fill: INK }} />
            <Bar name="สัดส่วนยอดขาย" dataKey="share" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {items.map((i) => <Cell key={i.product_id} fill={fill[i.cls]} />)}
            </Bar>
            <Line name="ยอดสะสม" dataKey="cumShare" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-600">
        {["A", "B", "C"].map((k) => (
          <span key={k}><i className="mr-1.5 inline-block h-3 w-3 rounded-sm align-[-1px]" style={{ background: fill[k] }} />
            กลุ่ม {k} {items.filter((i) => i.cls === k).length} เมนู</span>
        ))}
      </div>
      <Insight>
        {nA} เมนูจาก {items.length} ทำยอด 80% · กลุ่ม C ({C.map((i) => i.name).join(", ")}) รวมกันแค่ {pct(C.reduce((s, i) => s + i.share, 0), 1)} ควรทบทวนก่อนเพิ่มเมนูใหม่
      </Insight>
    </Card>
  );
}

export default function CustomersTab({ source }) {
  const state = useAnalytics(source);
  const [picked, setPicked] = useState(null);
  return (
    <AnalyticsShell source={source} state={state} title="ลูกค้าและเมนู">
      {(d) => (
        <div className="space-y-6">
          <RfmCard rfm={d.rfm} picked={picked} onPick={(s) => setPicked((p) => (p === s ? null : s))} />
          {/* Lab 4.1B: รายชื่อลูกค้าในกลุ่มที่คลิก · คลิกกลุ่มเดิมซ้ำหรือกดปิด = ซ่อน */}
          {picked && !d.rfm.error && (
            <SegmentCustomersCard rfm={d.rfm} segment={picked} onClose={() => setPicked(null)} />
          )}
          <CohortCard cohort={d.cohort} />
          <AbcCard abc={d.abc} />
        </div>
      )}
    </AnalyticsShell>
  );
}
