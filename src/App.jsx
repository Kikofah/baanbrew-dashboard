import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  computeKpis,
  dailySales,
  formatNumber,
  formatTHB,
  formatThaiLongDate,
  formatThaiShortDate,
  salesByBranch,
  withMovingAverage,
} from './lib/metrics'

// Compact axis labels: 1,250,000 -> ฿1.3M
const compactTHB = (value) =>
  `฿${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`

const SERIES_NAMES = { sales: 'ยอดขายรายวัน', ma7: 'ค่าเฉลี่ย 7 วัน' }

async function loadSales() {
  const res = await fetch('/sales.xlsx')
  if (!res.ok) throw new Error(`โหลดไฟล์ไม่สำเร็จ (${res.status})`)
  const workbook = XLSX.read(await res.arrayBuffer())
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: null })
}

function KpiCard({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-amber-100 bg-white p-3 shadow-sm sm:p-5">
      <p className="text-xs text-stone-500 sm:text-sm">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-stone-900 sm:mt-2 sm:text-2xl">
        {value}
      </p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <section className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-stone-800 sm:mb-4 sm:text-base">{title}</h2>
      <div className="h-64 sm:h-80">{children}</div>
    </section>
  )
}

function App() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadSales().then(setRows).catch((err) => setError(err.message))
  }, [])

  const kpis = useMemo(() => (rows ? computeKpis(rows) : null), [rows])
  const daily = useMemo(() => (rows ? withMovingAverage(dailySales(rows)) : []), [rows])
  const branches = useMemo(() => (rows ? salesByBranch(rows) : []), [rows])

  if (error) {
    return <p className="p-8 text-red-600">เกิดข้อผิดพลาด: {error}</p>
  }
  if (!rows) {
    return <p className="p-8 text-stone-500">กำลังโหลดข้อมูล…</p>
  }

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-amber-900 sm:text-3xl">บ้านบรู Dashboard</h1>
          <p className="text-xs text-stone-500 sm:text-sm">
            ข้อมูล {formatThaiShortDate(daily[0].date)} – {formatThaiShortDate(daily.at(-1).date)} ·{' '}
            {formatNumber(rows.length)} รายการ
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard label="ยอดขายรวม" value={formatTHB(kpis.totalSales)} />
          <KpiCard label="จำนวนบิล" value={formatNumber(kpis.billCount)} />
          <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatTHB(kpis.averagePerBill)} />
          <KpiCard label="ลูกค้าสมาชิก (ไม่ซ้ำ)" value={formatNumber(kpis.uniqueMembers)} />
        </div>

        <ChartCard title="ยอดขายรายวัน">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatThaiShortDate}
                tick={{ fontSize: 11 }}
                minTickGap={48}
              />
              <YAxis tickFormatter={compactTHB} tick={{ fontSize: 11 }} width={52} />
              <Tooltip
                formatter={(v, key) => [formatTHB(Math.round(v)), SERIES_NAMES[key]]}
                labelFormatter={formatThaiLongDate}
              />
              <Legend formatter={(key) => SERIES_NAMES[key]} wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#b45309"
                strokeOpacity={0.25}
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ma7"
                stroke="#78350f"
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ยอดขายแยกสาขา (มาก → น้อย)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={branches} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
              <XAxis type="number" tickFormatter={compactTHB} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="branch" tick={{ fontSize: 12 }} width={84} />
              <Tooltip formatter={(v) => [formatTHB(v), 'ยอดขาย']} cursor={{ fill: '#fef3c7' }} />
              <Bar dataKey="sales" fill="#b45309" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </main>
  )
}

export default App
