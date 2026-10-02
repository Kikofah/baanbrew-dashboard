import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  computeKpis,
  formatNumber,
  formatTHB,
  formatThaiShortDate,
  prepareRows,
  thaiDateKey,
} from './lib/metrics'
import { latestSaleDate, useSales } from './lib/useSales'
import { addDays, bangkokNowLocal } from './lib/options'
import SalesFilters from './components/SalesFilters.jsx'
import SalesForm from './components/SalesForm.jsx'
import AuthButton from './components/AuthButton.jsx'
import { useAuth } from './lib/useAuth'
import Lab2Page from './lab2/Lab2Page.jsx'
import CustomersPage from './components/CustomersPage.jsx'
import { prepareCustomers } from './lib/customerMetrics'
import { FixedChart1, FixedChart2, FixedChart3, FixedChart4, FixedChart5 } from './lab2/FixedCharts.jsx'

async function loadCsv(file) {
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`)
  if (!res.ok) throw new Error(`โหลดไฟล์ ${file} ไม่สำเร็จ (${res.status})`)
  const { data, errors } = Papa.parse(await res.text(), { header: true, skipEmptyLines: true })
  if (errors.length) throw new Error(`อ่านไฟล์ ${file} ไม่สำเร็จ: ${errors[0].message}`)
  return data
}

const PAGES = [
  { hash: '', label: 'ภาพรวม' },
  { hash: '#customers', label: 'ลูกค้า' },
  { hash: '#lab2', label: 'Lab 2.2 · ซ่อมกราฟ' },
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

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-brand-700" />
      <path d="M9 13h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-5Z" fill="#fff" />
      <path d="M20 14.5h1.5a2.5 2.5 0 0 1 0 5H20" fill="none" stroke="#fff" strokeWidth="1.8" />
      <path d="M12.5 8.5c0 1.2 1.5 1.3 1.5 2.5M16 8.5c0 1.2 1.5 1.3 1.5 2.5" fill="none" stroke="#f6ead8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Sticky top bar: brand, page tabs, sign-in; filters on a second row (sticky from sm up) */
function TopBar({ hash, auth, children }) {
  const isActive = (p) => hash === p.hash || (!p.hash && (hash === '' || hash === '#'))
  return (
    <header className="z-20 border-b border-stone-200/70 bg-page/90 backdrop-blur sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <a href="#" className="flex items-center gap-2.5">
          <Logo />
          <span className="leading-tight">
            <span className="block text-base font-bold text-brand-900">บ้านบรู</span>
            <span className="block text-xs text-stone-500">Sales Dashboard</span>
          </span>
        </a>
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto rounded-xl bg-stone-200/50 p-1 sm:order-none sm:mx-0 sm:w-auto">
          {PAGES.map((p) => (
            <a key={p.hash} href={p.hash || '#'} className={`tab ${isActive(p) ? 'tab-active' : ''}`} aria-current={isActive(p) ? 'page' : undefined}>
              {p.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto">
          <AuthButton auth={auth} />
        </div>
      </div>
      <div className="border-t border-stone-200/60">
        <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">{children}</div>
      </div>
    </header>
  )
}

function KpiCard({ label, value, note }) {
  return (
    <div className="card kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {note && <p className="kpi-note">{note}</p>}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <section className="card">
      <h2 className="card-title mb-2">{title}</h2>
      <div className="h-64 sm:h-80">{children}</div>
    </section>
  )
}

function Notice({ children, tone = 'muted' }) {
  const color = tone === 'error' ? 'text-red-600' : 'text-stone-500'
  return (
    <div className={`card py-12 text-center ${color}`} role="status">
      {children}
    </div>
  )
}

/** KPI cards + all charts for rows that are already filtered (rows.length > 0) */
function DashboardCharts({ rows, products }) {
  const kpis = useMemo(() => computeKpis(rows), [rows])
  const lab2Rows = useMemo(() => prepareRows(rows), [rows])
  const days = useMemo(() => new Set(rows.map((r) => thaiDateKey(r.datetime))).size, [rows])

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="ยอดขายรวม" value={formatTHB(kpis.totalSales)} note={`เฉลี่ย ${formatTHB(Math.round(kpis.totalSales / days))}/วัน · ${formatNumber(days)} วัน`} />
        <KpiCard label="จำนวนบิล" value={formatNumber(kpis.billCount)} note={`เฉลี่ย ${formatNumber(Math.round(kpis.billCount / days))} บิล/วัน`} />
        <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatTHB(kpis.averagePerBill)} note="ยอดขายรวม ÷ จำนวนบิล" />
        <KpiCard label="ลูกค้าสมาชิก (ไม่ซ้ำ)" value={formatNumber(kpis.uniqueMembers)} note="ไม่นับลูกค้าทั่วไป" />
      </div>

      <ChartCard title="ยอดขายรายวัน · ค่าเฉลี่ย 7 วัน">
        <FixedChart3 rows={lab2Rows} />
      </ChartCard>

      {/* แถวแรก: เรื่องสาขา 2 มุม (ยอดรวม และเทียบกับตัวเอง) · แถวสอง: เมนู และรายเดือน */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        <ChartCard title="ยอดขายแยกสาขา">
          <FixedChart2 rows={lab2Rows} />
        </ChartCard>
        <ChartCard title="แต่ละสาขาเทียบกับตัวเอง">
          <FixedChart5 rows={lab2Rows} />
        </ChartCard>
        <ChartCard title="เมนูขายดี 10 อันดับแรก">
          <FixedChart1 rows={lab2Rows} products={products} />
        </ChartCard>
        <ChartCard title="ยอดเฉลี่ยต่อวัน รายเดือน">
          <FixedChart4 rows={lab2Rows} />
        </ChartCard>
      </div>
    </>
  )
}

const rangeLabel = ({ from, to, branch }) =>
  `${formatThaiShortDate(from)} – ${formatThaiShortDate(to)} · ${branch || 'ทุกสาขา'}`

function App() {
  const [products, setProducts] = useState(null)
  const [customers, setCustomers] = useState(null)
  const [filters, setFilters] = useState({ from: '', to: '', branch: '' })
  const [setupError, setSetupError] = useState(null)
  const hash = useHash()
  const auth = useAuth()

  useEffect(() => {
    loadCsv('products.csv').then(setProducts).catch((err) => setSetupError(err.message))
    loadCsv('customers_clean.csv')
      .then((raw) => setCustomers(prepareCustomers(raw)))
      .catch((err) => setSetupError(err.message))
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
  const isCustomers = hash === '#customers'
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
  } else if (isCustomers) {
    content = customers
      ? <CustomersPage customers={customers} rows={rows} filters={filters} />
      : <Notice>กำลังโหลดข้อมูลลูกค้า…</Notice>
  } else if (isLab2) {
    content = <Lab2Page rows={prepareRows(rows)} products={products} />
  } else {
    content = <DashboardCharts rows={rows} products={products} />
  }

  return (
    <div className="min-h-screen">
      <TopBar hash={hash} auth={auth}>
        <SalesFilters value={filters} onChange={setFilters} loading={validRange && loading} />
      </TopBar>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8">
        {!isLab2 && !isCustomers && (
          <div>
            <h1 className="page-title">ภาพรวมยอดขาย</h1>
            <p className="page-subtitle">
              ข้อมูลจาก Firestore · อัปเดตอัตโนมัติ
              {rows?.length > 0 && <> · {rangeLabel(filters)} · {formatNumber(rows.length)} รายการ</>}
            </p>
          </div>
        )}
        {!isLab2 && !isCustomers && <SalesForm products={products} auth={auth} />}
        {content}
      </main>
    </div>
  )
}

export default App
