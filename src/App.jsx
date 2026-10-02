import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
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
  prepareRows,
  salesByBranch,
  withMovingAverage,
} from './lib/metrics'
import { latestSaleDate, useSales } from './lib/useSales'
import { addDays, bangkokNowLocal } from './lib/options'
import SalesFilters from './components/SalesFilters.jsx'
import SalesForm from './components/SalesForm.jsx'
import AuthButton from './components/AuthButton.jsx'
import { useAuth } from './lib/useAuth'
import Lab2Page from './lab2/Lab2Page.jsx'
import { FixedChart1, FixedChart3, FixedChart4, FixedChart5 } from './lab2/FixedCharts.jsx'

// Compact axis labels: 1,250,000 -> ฿1.3M
const compactTHB = (value) =>
  `฿${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`

const SERIES_NAMES = { sales: 'ยอดขายรายวัน', ma7: 'ค่าเฉลี่ย 7 วัน' }

async function loadCsv(file) {
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`)
  if (!res.ok) throw new Error(`โหลดไฟล์ ${file} ไม่สำเร็จ (${res.status})`)
  const { data, errors } = Papa.parse(await res.text(), { header: true, skipEmptyLines: true })
  if (errors.length) throw new Error(`อ่านไฟล์ ${file} ไม่สำเร็จ: ${errors[0].message}`)
  return data
}

const PAGES = [
  { hash: '', label: 'Dashboard' },
  { hash: '#lab2', label: 'Lab 2 · ซ่อมกราฟแย่' },
]

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

function Nav({ hash, auth }) {
  return (
    <nav className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center gap-2 sm:mb-6">
      {PAGES.map((p) => (
        <a
          key={p.hash}
          href={p.hash || '#'}
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            hash === p.hash || (!p.hash && hash === '#') ? 'bg-amber-900 text-white' : 'text-amber-900 hover:bg-amber-100'
          }`}
        >
          {p.label}
        </a>
      ))}
      <div className="ml-auto">
        <AuthButton auth={auth} />
      </div>
    </nav>
  )
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


function Notice({ children, tone = 'muted' }) {
  const color = tone === 'error' ? 'text-red-600' : 'text-stone-500'
  return (
    <div className={`rounded-xl border border-amber-100 bg-white p-8 text-center shadow-sm ${color}`} role="status">
      {children}
    </div>
  )
}

/** KPI cards + all charts for rows that are already filtered (rows.length > 0) */
function DashboardCharts({ rows, products }) {
  const kpis = useMemo(() => computeKpis(rows), [rows])
  const daily = useMemo(() => withMovingAverage(dailySales(rows)), [rows])
  const branches = useMemo(() => salesByBranch(rows), [rows])
  const lab2Rows = useMemo(() => prepareRows(rows), [rows])

  return (
    <>
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
            <Bar dataKey="sales" fill="#b45309" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* กราฟที่ซ่อมแล้วจาก Lab 2 (FixedChart2 ซ้ำกับกราฟยอดขายแยกสาขาด้านบน จึงไม่ใส่) */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ChartCard title="เมนูขายดี 10 อันดับแรก">
          <FixedChart1 rows={lab2Rows} products={products} />
        </ChartCard>
        <ChartCard title="ยอดขายรายสัปดาห์">
          <FixedChart3 rows={lab2Rows} />
        </ChartCard>
        <ChartCard title="ยอดเฉลี่ยต่อวัน รายเดือน">
          <FixedChart4 rows={lab2Rows} />
        </ChartCard>
        <ChartCard title="ยอดเฉลี่ยต่อวันที่เปิดขาย แยกสาขา">
          <FixedChart5 rows={lab2Rows} />
        </ChartCard>
      </div>
    </>
  )
}

const rangeLabel = ({ from, to, branch }) =>
  `${formatThaiShortDate(from)} – ${formatThaiShortDate(to)} · ${branch || 'ทุกสาขา'}`

function App() {
  const [products, setProducts] = useState(null)
  const [filters, setFilters] = useState({ from: '', to: '', branch: '' })
  const [setupError, setSetupError] = useState(null)
  const hash = useHash()
  const auth = useAuth()

  useEffect(() => {
    loadCsv('products.csv').then(setProducts).catch((err) => setSetupError(err.message))
  }, [])

  // Default range = the 30 days ending at the latest sale (1 read), or today if the collection is empty
  useEffect(() => {
    let cancelled = false
    latestSaleDate()
      .then((latest) => {
        if (cancelled) return
        const to = latest ?? bangkokNowLocal().slice(0, 10)
        setFilters((f) => ({ ...f, from: addDays(to, -29), to }))
      })
      .catch((err) => !cancelled && setSetupError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  const validRange = Boolean(filters.from && filters.to && filters.from <= filters.to)
  const { rows: rangeRows, loading, error } = useSales(validRange ? filters.from : null, validRange ? filters.to : null)
  // Branch is filtered here, not in the query: equality + range on two fields would need a composite index
  const rows = useMemo(
    () => (rangeRows && filters.branch ? rangeRows.filter((r) => r.branch === filters.branch) : rangeRows),
    [rangeRows, filters.branch],
  )

  const isLab2 = hash === '#lab2'
  const errorMessage = setupError ?? error

  let content
  if (errorMessage) {
    content = <Notice tone="error">เกิดข้อผิดพลาด: {errorMessage}</Notice>
  } else if (!validRange && filters.from && filters.to) {
    content = <Notice>เลือกช่วงวันที่ให้ถูกต้อง</Notice>
  } else if (!rows) {
    content = <Notice>กำลังโหลดข้อมูล…</Notice>
  } else if (rows.length === 0) {
    content = (
      <Notice>
        <p className="font-medium text-stone-700">ไม่มีข้อมูลในช่วงที่เลือก</p>
        <p className="mt-1 text-sm">{rangeLabel(filters)} · ลองเปลี่ยนช่วงวันที่หรือสาขา</p>
      </Notice>
    )
  } else if (isLab2) {
    content = <Lab2Page rows={prepareRows(rows)} products={products} />
  } else {
    content = <DashboardCharts rows={rows} products={products} />
  }

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-6 sm:px-8 sm:py-8">
      <Nav hash={hash} auth={auth} />
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        {!isLab2 && (
          <header>
            <h1 className="text-2xl font-bold text-amber-900 sm:text-3xl">บ้านบรู Dashboard</h1>
            <p className="text-xs text-stone-500 sm:text-sm">
              ข้อมูลจาก Firestore · อัปเดตอัตโนมัติ
              {rows?.length > 0 && <> · {rangeLabel(filters)} · {formatNumber(rows.length)} รายการ</>}
            </p>
          </header>
        )}
        <SalesFilters value={filters} onChange={setFilters} loading={validRange && loading} />
        {!isLab2 && <SalesForm products={products} auth={auth} />}
        {content}
      </div>
    </main>
  )
}

export default App
