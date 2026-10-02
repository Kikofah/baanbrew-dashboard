import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { customerStats, homeBranchShare } from '../lib/customerMetrics'
import { formatNumber, formatTHB, formatThaiShortDate } from '../lib/metrics'
import { daysInMonth, thaiMonth } from '../lab2/lab2Metrics'

const MAIN = '#b45309'
const GRID = '#e7e5e4'
const LABEL = { fontSize: 11, fill: '#44403c' }
const pct = (v) => `${(v * 100).toFixed(1)}%`
const thb = (v) => formatTHB(Math.round(v))
// Averages from fewer buyers than this swing a lot between ranges, so the summary says so
const SMALL_GROUP = 30

function Kpi({ label, value, note }) {
  return (
    <div className="card kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {note && <p className="kpi-note">{note}</p>}
    </div>
  )
}

/** Card with a one-line summary computed from the data, above the chart */
function Card({ title, summary, children }) {
  return (
    <section className="card flex flex-col">
      <h2 className="card-title">{title}</h2>
      <p className="card-summary mb-3">{summary}</p>
      <div className="h-60 sm:h-72">{children}</div>
    </section>
  )
}

/**
 * Member insights from customers_clean.csv joined with the filtered sales rows.
 * Aggregates only: no individual customer is shown. Gender is left out on purpose,
 * because profiling found it doesn't match nicknames (see Lab2_1_Customers_Profiling.ipynb).
 */
export default function CustomersPage({ customers, rows, filters }) {
  const scoped = useMemo(
    () => (filters.branch ? customers.filter((c) => c.home_branch === filters.branch) : customers),
    [customers, filters.branch],
  )
  const stats = useMemo(() => customerStats(scoped, rows, filters), [scoped, rows, filters])
  const atHome = useMemo(() => homeBranchShare(customers, rows), [customers, rows])

  // The newest join month is partial unless members joined up to its last day
  const months = useMemo(() => {
    const lastJoin = scoped.reduce((max, c) => (c.joined_date > max ? c.joined_date : max), '')
    return stats.byMonth.map((m) => ({
      ...m,
      label: thaiMonth(m.month),
      partial: m.month === lastJoin.slice(0, 7) && Number(lastJoin.slice(8, 10)) < daysInMonth(m.month),
      lastDay: lastJoin.slice(8, 10),
    }))
  }, [stats.byMonth, scoped])

  if (!scoped.length) {
    return <p className="card py-12 text-center text-stone-500">ไม่มีสมาชิกที่มีสาขาประจำเป็น{filters.branch}</p>
  }

  const range = `${formatThaiShortDate(filters.from)} – ${formatThaiShortDate(filters.to)}`
  const scope = filters.branch ? `สมาชิกสาขาประจำ${filters.branch}` : 'สมาชิกทั้งหมด'

  const biggestAge = stats.byAge.reduce((m, a) => (a.members > m.members ? a : m))
  const spenders = stats.byAge.filter((a) => a.active > 0)
  const topSpender = spenders.reduce((m, a) => (a.avgSpend > m.avgSpend ? a : m), spenders[0] ?? null)

  const full = months.filter((m) => !m.partial)
  const recent = full.slice(-3)
  const early = full.slice(0, 3)
  const avgOf = (arr) => arr.reduce((s, m) => s + m.members, 0) / (arr.length || 1)
  const monthTrend = full.length >= 6
    ? ` · 3 เดือนล่าสุดเฉลี่ย ${formatNumber(Math.round(avgOf(recent)))} คน/เดือน เทียบ 3 เดือนแรก ${formatNumber(Math.round(avgOf(early)))} คน/เดือน`
    : ''
  const partialMonth = months.find((m) => m.partial)

  const lowestActive = stats.byBranch.reduce((m, b) => (b.activeRate < m.activeRate ? b : m))

  return (
    <div className="space-y-5 sm:space-y-6">
      <header>
        <h1 className="page-title">ลูกค้าสมาชิก</h1>
        <p className="page-subtitle">
          {scope} · ยอดซื้อนับจากช่วง {range} · แสดงเฉพาะตัวเลขรวม ไม่แสดงข้อมูลรายคน
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="สมาชิก" value={formatNumber(stats.members)} note={`อายุต่ำกว่า 18 ปี ${formatNumber(stats.minors)} คน`} />
        <Kpi label="ซื้อในช่วงนี้" value={formatNumber(stats.active)} note={`${pct(stats.activeRate)} ของสมาชิก`} />
        <Kpi label="ยอดซื้อเฉลี่ยต่อคน" value={thb(stats.avgSpend)} note="เฉพาะสมาชิกที่ซื้อในช่วงนี้" />
        <Kpi label="สมัครใหม่ในช่วงนี้" value={formatNumber(stats.joinedInRange)} note={range} />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card
          title="สมาชิกตามช่วงอายุ"
          summary={`กลุ่ม ${biggestAge.age_group} มากที่สุด ${formatNumber(biggestAge.members)} คน (${pct(biggestAge.members / stats.members)})`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.byAge} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="age_group" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={formatNumber} width={44} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, _k, item) => [`${formatNumber(v)} คน · ซื้อในช่วงนี้ ${pct(item.payload.activeRate)}`, 'สมาชิก']}
                cursor={{ fill: '#fef3c7' }}
              />
              <Bar dataKey="members" fill={MAIN} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="members" position="top" formatter={formatNumber} style={LABEL} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="ยอดซื้อเฉลี่ยต่อคน ตามช่วงอายุ"
          summary={topSpender
            ? `กลุ่ม ${topSpender.age_group} จ่ายเฉลี่ยสูงสุด ${thb(topSpender.avgSpend)}/คน จาก ${formatNumber(topSpender.active)} คนที่ซื้อในช่วงนี้${
              topSpender.active < SMALL_GROUP ? ' · กลุ่มเล็ก ค่าเฉลี่ยแกว่งได้ง่าย' : ''
            }`
            : `ไม่มีสมาชิกซื้อในช่วง ${range}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.byAge} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="age_group" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tickFormatter={(v) => formatTHB(v)} width={56} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, _k, item) => [`${thb(v)}/คน (${formatNumber(item.payload.active)} คนที่ซื้อ)`, 'ยอดซื้อเฉลี่ย']}
                cursor={{ fill: '#fef3c7' }}
              />
              <Bar dataKey="avgSpend" fill={MAIN} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                <LabelList dataKey="avgSpend" position="top" formatter={thb} style={LABEL} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="สมาชิกใหม่รายเดือน"
          summary={`สมัครทั้งหมด ${formatNumber(stats.members)} คน ตั้งแต่ ${months[0]?.label ?? '-'}${monthTrend}${
            partialMonth ? ` · ${partialMonth.label} มีข้อมูลถึงวันที่ ${Number(partialMonth.lastDay)}` : ''
          }`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={8} />
              <YAxis tickFormatter={formatNumber} width={44} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, _k, item) => [
                  `${formatNumber(v)} คน${item.payload.partial ? ` (ข้อมูลถึงวันที่ ${Number(item.payload.lastDay)})` : ''}`,
                  'สมัครใหม่',
                ]}
                cursor={{ fill: '#fef3c7' }}
              />
              <Bar dataKey="members" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                {months.map((m) => <Cell key={m.month} fill={MAIN} fillOpacity={m.partial ? 0.4 : 1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="สมาชิกตามสาขาประจำ"
          summary={`${stats.byBranch[0].branch}มีสมาชิกมากที่สุด ${formatNumber(stats.byBranch[0].members)} คน · ${lowestActive.branch}มีสัดส่วนคนที่ซื้อในช่วงนี้ต่ำสุด ${pct(lowestActive.activeRate)}${
            atHome == null ? '' : ` · การซื้อของสมาชิก ${pct(atHome)} เกิดที่สาขาประจำ`
          }`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.byBranch} layout="vertical" margin={{ top: 0, right: 110, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tickFormatter={formatNumber} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="branch" width={84} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v, _k, item) => [`${formatNumber(v)} คน · ซื้อในช่วงนี้ ${formatNumber(item.payload.active)} คน`, 'สมาชิก']}
                cursor={{ fill: '#fef3c7' }}
              />
              <Bar dataKey="members" fill={MAIN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="members"
                  position="right"
                  content={({ x, y, width, height, index }) => {
                    const b = stats.byBranch[index]
                    return (
                      <text x={x + width + 6} y={y + height / 2 + 4} style={LABEL}>
                        {formatNumber(b.members)} คน · ซื้อ {pct(b.activeRate)}
                      </text>
                    )
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <p className="text-xs text-stone-400">
        ไม่แสดงข้อมูลแยกตามเพศ เพราะตอน profiling พบว่าเพศไม่สอดคล้องกับชื่อเล่น (ทุกชื่อมีหญิง 47–65%) จึงยังเชื่อถือไม่ได้
      </p>
    </div>
  )
}
