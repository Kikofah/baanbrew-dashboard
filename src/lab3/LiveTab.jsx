// Lab 3.2 · Dashboard ยอดขายแบบ real-time จาก Firestore (collection "sales")
// - ฟังด้วย onSnapshot ตามช่วงวันที่ (เวลาไทย) และยกเลิกการฟังใน cleanup ทุกครั้ง
// - กรองสาขาฝั่งเบราว์เซอร์ ไม่เพิ่ม where จึงไม่ต้องสร้าง composite index และไม่อ่านเอกสารซ้ำเมื่อเปลี่ยนสาขา
// - ตัวเลขทุกตัวคำนวณด้วยฟังก์ชันจาก ../lib/metrics.js
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import { db, projectId } from "./firebase.js";
import { addDays, todayBangkok } from "./time.js";
import { BRANCHES } from "./saleModel.js";
import {
  computeKpis, dailyRevenue, formatNumber, formatTHB, formatThaiShortDate, hourlyRevenue, prepareRows, revenueByBranch,
} from "../lib/metrics.js";
import KpiCard from "../components/KpiCard.jsx";
import SaleForm from "./SaleForm.jsx";
import { SignInCard, UserMenu } from "./LiveAuth.jsx";
import { useAuthUser } from "./useAuthUser.js";

const MAIN = "#e0893a";
const MUTED = "#4a4039";
const GRID = "#3a322c";
const HIGHLIGHT_MS = 4000;
const RECENT_N = 8;

const RANGES = [
  { key: "today", label: "วันนี้", days: 1 },
  { key: "7d", label: "7 วัน", days: 7 },
  { key: "30d", label: "30 วัน", days: 30 },
];

const thb = (v) => formatTHB(Math.round(v));
const compactTHB = (v) => `฿${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;

const ERROR_TEXT = {
  "permission-denied": "Security Rules ไม่อนุญาตให้อ่าน collection sales — ตรวจ Rules หรือเข้าสู่ระบบก่อน",
  unauthenticated: "ต้องเข้าสู่ระบบก่อนจึงจะอ่านข้อมูลได้",
  "failed-precondition": "Query นี้ต้องใช้ index — เปิดลิงก์ใน Console ของเบราว์เซอร์เพื่อสร้าง index",
  unavailable: "เชื่อมต่อ Firestore ไม่ได้ (ออฟไลน์?) ระบบจะลองเชื่อมต่อใหม่เอง",
  "resource-exhausted": "ใช้โควตา Firestore ของวันนี้หมดแล้ว",
};
const thaiError = (e) => ERROR_TEXT[e.code] ?? `เกิดข้อผิดพลาด: ${e.message}`;

/** ฟัง sales ในช่วง [start, end] แบบ real-time */
function useLiveSales(start, end) {
  const key = `${start}|${end}`;
  const [state, setState] = useState({ key: null, status: "loading", docs: [], error: null });
  const [reads, setReads] = useState(0);
  const [freshIds, setFreshIds] = useState(() => new Set());
  const timers = useRef(new Set());

  useEffect(() => {
    if (!db) return undefined;
    const key = `${start}|${end}`;
    let first = true;

    const q = query(collection(db, "sales"), where("date", ">=", start), where("date", "<=", end), orderBy("date"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges();
        setReads((n) => n + changes.length);

        // ไฮไลต์เฉพาะเอกสารที่เพิ่มเข้ามาหลัง snapshot แรก (snapshot แรกคือข้อมูลเดิมทั้งหมด)
        if (first) {
          setFreshIds(new Set()); // ล้างไฮไลต์ที่ค้างจากช่วงเวลาก่อนหน้า
        } else {
          const added = changes.filter((c) => c.type === "added").map((c) => c.doc.id);
          if (added.length) {
            setFreshIds((prev) => new Set([...prev, ...added]));
            const t = setTimeout(() => {
              timers.current.delete(t);
              setFreshIds((prev) => {
                const next = new Set(prev);
                added.forEach((id) => next.delete(id));
                return next;
              });
            }, HIGHLIGHT_MS);
            timers.current.add(t);
          }
        }
        first = false;
        setState({ key, status: "ready", docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null });
      },
      (error) => setState({ key, status: "error", docs: [], error }),
    );

    const pending = timers.current;
    return () => {
      unsubscribe();
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [start, end]);

  // ข้อมูลของช่วงเก่ายังไม่ถูกแทนที่ = กำลังโหลดช่วงใหม่
  if (state.key !== key) return { status: "loading", docs: [], error: null, reads, freshIds };
  return { ...state, reads, freshIds };
}

/** เมนูจาก collection "products" อ่านครั้งเดียว (40 เอกสาร) ไม่ต้องฟังแบบ real-time เพราะแทบไม่เปลี่ยน */
function useProducts() {
  const [state, setState] = useState({ products: null, error: null });
  useEffect(() => {
    if (!db) return undefined;
    let cancelled = false;
    getDocs(collection(db, "products"))
      .then((snap) => {
        if (cancelled) return;
        const products = snap.docs.map((d) => d.data()).sort((a, b) => String(a.product_id).localeCompare(String(b.product_id)));
        setState({ products, error: products.length ? null : "ไม่พบเมนูใน collection products — รัน npm run seed แล้วหรือยัง" });
      })
      .catch((e) => !cancelled && setState({ products: [], error: `โหลดเมนูไม่สำเร็จ: ${thaiError(e)}` }));
    return () => { cancelled = true; };
  }, []);
  return state;
}

/**
 * ตรวจการล็อกอินก่อน: Dashboard (และ onSnapshot/getDocs ข้างใน) จะ mount เฉพาะเมื่อล็อกอินแล้ว
 * ออกจากระบบ → Dashboard unmount → cleanup ของ useEffect ยกเลิก onSnapshot เอง
 */
export default function LiveTab() {
  const { status, user } = useAuthUser();
  if (status === "checking") return <p className="text-sm text-stone-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (status === "signed-out") return <SignInCard />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <UserMenu user={user} />
      </div>
      <LiveDashboard key={user.uid} user={user} />
    </div>
  );
}

function LiveDashboard({ user }) {
  const [rangeKey, setRangeKey] = useState("7d");
  const [branch, setBranch] = useState("");
  const range = RANGES.find((r) => r.key === rangeKey);

  // วันที่ไทย ไม่ใช่ UTC · คำนวณใหม่ทุก render จึงขึ้นวันใหม่เองหลังเที่ยงคืน
  const end = todayBangkok();
  const start = addDays(end, -(range.days - 1));
  const { status, docs, error, reads, freshIds } = useLiveSales(start, end);
  const { products, error: productsError } = useProducts();
  const productName = useMemo(() => new Map((products ?? []).map((p) => [p.product_id, p.product_name])), [products]);

  const allRows = useMemo(() => prepareRows(docs), [docs]);
  const rows = useMemo(() => (branch ? allRows.filter((r) => r.branch === branch) : allRows), [allRows, branch]);
  const kpis = useMemo(() => computeKpis(rows), [rows]);
  const byBranch = useMemo(() => revenueByBranch(allRows), [allRows]);
  const trend = useMemo(
    () => (rangeKey === "today" ? hourlyRevenue(rows, 7, 21) : dailyRevenue(rows)),
    [rows, rangeKey],
  );
  const recent = useMemo(
    () => [...rows].sort((a, b) => String(b.datetime).localeCompare(String(a.datetime))).slice(0, RECENT_N),
    [rows],
  );

  if (!db) {
    return (
      <div className="card max-w-2xl">
        <h1 className="text-2xl font-bold">ยอดขายสด</h1>
        <p className="mt-3 text-red-700">ยังไม่ได้ตั้งค่า Firebase — คัดลอก .env.example เป็น .env แล้วใส่ค่าโปรเจกต์</p>
      </div>
    );
  }

  const rangeText = start === end ? formatThaiShortDate(end) : `${formatThaiShortDate(start)} – ${formatThaiShortDate(end)}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            ยอดขายสด
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              {status === "ready" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status === "ready" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-stone-300"}`} />
            </span>
          </h1>
          <p className="text-sm text-stone-500">
            {rangeText}{branch && ` · สาขา${branch}`} · โปรเจกต์ {projectId} · อ่านเอกสารไปแล้ว{" "}
            <span className="font-medium tabular-nums text-stone-700">{formatNumber(reads)}</span> ครั้ง
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-white p-1 ring-1 ring-stone-200" role="group" aria-label="ช่วงเวลา">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRangeKey(r.key)}
                aria-pressed={r.key === rangeKey}
                className={`rounded-md px-3 py-1.5 text-sm ${r.key === rangeKey ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="สาขา"
            className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-200"
          >
            <option value="">ทุกสาขา</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
      {status === "error" && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
          ❌ {thaiError(error)}
        </div>
      )}
      {status === "loading" && <p className="text-sm text-stone-500">กำลังโหลดข้อมูล…</p>}

      {status === "ready" && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="ยอดขายรวม" value={thb(kpis.totalSales)} note={`${formatNumber(rows.length)} รายการ`} />
            <KpiCard label="จำนวนบิล" value={formatNumber(kpis.billCount)} />
            <KpiCard label="ยอดเฉลี่ยต่อบิล" value={thb(kpis.averagePerBill)} />
            <KpiCard label="สมาชิกที่ซื้อ" value={formatNumber(kpis.uniqueMembers)} note="นับรหัสสมาชิกไม่ซ้ำ" />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-xl bg-white p-5 ring-1 ring-stone-200 xl:col-span-2">
              <h2 className="font-semibold">{rangeKey === "today" ? "ยอดขายรายชั่วโมง (วันนี้)" : `ยอดขายรายวัน (${range.label}ล่าสุด)`}</h2>
              <div className="mt-3 h-64">
                {rows.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-stone-400">ยังไม่มียอดขายในช่วงนี้</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {rangeKey === "today" ? (
                      <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={GRID} />
                        <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={compactTHB} tick={{ fontSize: 11 }} width={56} />
                        <Tooltip formatter={(v) => [thb(v), "ยอดขาย"]} labelFormatter={(h) => `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59 น.`} cursor={{ fill: "#3a2a1c" }} />
                        <Bar dataKey="revenue" fill={MAIN} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    ) : (
                      <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={GRID} />
                        <XAxis dataKey="date" tickFormatter={formatThaiShortDate} tick={{ fontSize: 11 }} minTickGap={24} />
                        <YAxis tickFormatter={compactTHB} tick={{ fontSize: 11 }} width={56} />
                        <Tooltip formatter={(v) => [thb(v), "ยอดขาย"]} labelFormatter={formatThaiShortDate} />
                        <Line type="monotone" dataKey="revenue" stroke={MAIN} strokeWidth={2} dot={trend.length <= 7} isAnimationActive={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
              <h2 className="font-semibold">ยอดขายตามสาขา</h2>
              <div className="mt-3 h-64">
                {byBranch.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-stone-400">ยังไม่มีข้อมูล</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byBranch} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="branch" width={84} tick={{ fontSize: 12 }} interval={0} />
                      <Tooltip formatter={(v) => [thb(v), "ยอดขาย"]} cursor={{ fill: "#3a2a1c" }} />
                      <Bar dataKey="revenue" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                        {byBranch.map((d) => <Cell key={d.branch} fill={!branch || d.branch === branch ? MAIN : MUTED} />)}
                        <LabelList dataKey="revenue" position="right" formatter={compactTHB} style={{ fontSize: 11, fill: "#d9d0c7" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
            <h2 className="font-semibold">รายการล่าสุด</h2>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-stone-400">ยังไม่มีรายการ</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-stone-500">
                    <tr className="border-b border-stone-200">
                      <th className="py-2 pr-3 font-medium">เวลา</th>
                      <th className="py-2 pr-3 font-medium">สาขา</th>
                      <th className="py-2 pr-3 font-medium">เมนู</th>
                      <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
                      <th className="py-2 pr-3 text-right font-medium">ยอด</th>
                      <th className="py-2 font-medium">ช่องทาง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr
                        key={r.id}
                        className={`border-b border-stone-100 transition-colors duration-700 ${freshIds.has(r.id) ? "bg-amber-100" : ""}`}
                      >
                        <td className="py-2 pr-3 tabular-nums">
                          {formatThaiShortDate(r.date)} {String(r.datetime).slice(11, 16)}
                          {freshIds.has(r.id) && <span className="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">ใหม่</span>}
                        </td>
                        <td className="py-2 pr-3">{r.branch}</td>
                        <td className="py-2 pr-3">{productName.get(r.product_id) ?? r.product_id}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(r.qty)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{thb(r.revenue)}</td>
                        <td className="py-2 text-stone-600">
                          {r.channel}
                          {r.source === "web" && <span className="ml-2 text-xs text-brand-700">· บันทึกจากเว็บ</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      </div>

      <aside className="lg:sticky lg:top-24">
        <SaleForm products={products} productsError={productsError} uid={user.uid} />
      </aside>
      </div>
    </div>
  );
}
