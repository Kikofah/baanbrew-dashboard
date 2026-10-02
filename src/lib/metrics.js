// Pure calculation helpers for the sales dashboard.
// Input `rows` = array of objects, 1 row = 1 line item:
// { order_id, datetime, branch, product_id, qty, unit_price, customer_id, payment_method, channel }

const thbFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const intFormatter = new Intl.NumberFormat('th-TH')

/** 1234567.5 -> "฿1,234,567.5" */
export function formatTHB(value) {
  return `฿${thbFormatter.format(value)}`
}

/** 1234567 -> "1,234,567" */
export function formatNumber(value) {
  return intFormatter.format(value)
}

// th-TH uses the Buddhist calendar, so year "2-digit" gives 68 for 2025.
// timeZone UTC pairs with Date.UTC below so the day never shifts.
const thaiShortDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})
const thaiLongDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function dateKeyToUTC(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** "2025-04-01" -> "1 เม.ย. 68" */
export function formatThaiShortDate(dateKey) {
  return thaiShortDateFormatter.format(dateKeyToUTC(dateKey))
}

/** "2025-04-01" -> "1 เมษายน 2568" */
export function formatThaiLongDate(dateKey) {
  return thaiLongDateFormatter.format(dateKeyToUTC(dateKey))
}

/** Sales of one line item = qty × unit_price */
export function lineTotal(row) {
  return Number(row.qty) * Number(row.unit_price)
}

/** Sum of qty × unit_price over every row */
export function totalSales(rows) {
  return rows.reduce((sum, row) => sum + lineTotal(row), 0)
}

/** Number of distinct order_id (one bill can span many rows) */
export function billCount(rows) {
  return new Set(rows.map((row) => row.order_id)).size
}

/** Total sales ÷ number of distinct bills (0 when there are no bills) */
export function averagePerBill(rows) {
  const bills = billCount(rows)
  return bills === 0 ? 0 : totalSales(rows) / bills
}

/** An empty / blank customer_id means a walk-in (non-member) customer */
export function isMember(row) {
  return row.customer_id != null && String(row.customer_id).trim() !== ''
}

/** Number of distinct non-empty customer_id */
export function uniqueMemberCount(rows) {
  return new Set(rows.filter(isMember).map((row) => String(row.customer_id).trim())).size
}

/**
 * Calendar date in Thai time, taken straight from the ISO string
 * ("2025-04-01T18:48:40+07:00" -> "2025-04-01"). Avoids `new Date()`,
 * which would shift the day into the viewer's browser timezone.
 */
export function thaiDateKey(datetime) {
  return String(datetime).slice(0, 10)
}

/** [{ date: 'YYYY-MM-DD', sales }] sorted by date ascending */
export function dailySales(rows) {
  const byDate = new Map()
  for (const row of rows) {
    const key = thaiDateKey(row.datetime)
    byDate.set(key, (byDate.get(key) ?? 0) + lineTotal(row))
  }
  return [...byDate]
    .map(([date, sales]) => ({ date, sales }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Adds `ma7` = average of the last 7 calendar days (today + 6 days before).
 * Days with no row count as ฿0. The first 6 days get null (window not full yet),
 * so the line starts on day 7 instead of showing a misleading partial average.
 */
export function withMovingAverage(daily, windowDays = 7) {
  const salesByDay = new Map(daily.map((d) => [dateKeyToUTC(d.date), d.sales]))
  const firstDay = daily.length ? dateKeyToUTC(daily[0].date) : 0
  const DAY_MS = 24 * 60 * 60 * 1000

  return daily.map((d) => {
    const today = dateKeyToUTC(d.date)
    if (today - firstDay < (windowDays - 1) * DAY_MS) return { ...d, ma7: null }
    let sum = 0
    for (let i = 0; i < windowDays; i++) sum += salesByDay.get(today - i * DAY_MS) ?? 0
    return { ...d, ma7: sum / windowDays }
  })
}

/** [{ branch, sales }] sorted by sales descending */
export function salesByBranch(rows) {
  const byBranch = new Map()
  for (const row of rows) {
    byBranch.set(row.branch, (byBranch.get(row.branch) ?? 0) + lineTotal(row))
  }
  return [...byBranch]
    .map(([branch, sales]) => ({ branch, sales }))
    .sort((a, b) => b.sales - a.sales)
}

/** All KPI values in one object */
export function computeKpis(rows) {
  return {
    totalSales: totalSales(rows),
    billCount: billCount(rows),
    averagePerBill: averagePerBill(rows),
    uniqueMembers: uniqueMemberCount(rows),
  }
}
