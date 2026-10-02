// Calculations for the customers page. Input:
// - customers: rows of public/customers_clean.csv (all strings from PapaParse)
// - sales: line items already filtered by date range (and branch, if selected)
import { lineTotal } from './metrics'

/** Parse the CSV strings once: numbers and booleans become real types */
export function prepareCustomers(raw) {
  return raw.map((c) => ({
    customer_id: c.customer_id,
    age_group: c.age_group,
    age_group_order: Number(c.age_group_order),
    is_minor: c.is_minor === 'True',
    home_branch: c.home_branch,
    joined_date: c.joined_date,
  }))
}

/**
 * Member KPIs and breakdowns for one date range.
 * "Active" = bought at least once in `sales`; spend = their qty × unit_price in `sales`.
 */
export function customerStats(customers, sales, { from, to }) {
  const spend = new Map()
  for (const row of sales) {
    if (!row.customer_id) continue
    spend.set(row.customer_id, (spend.get(row.customer_id) ?? 0) + lineTotal(row))
  }

  const byAge = new Map()
  const byBranch = new Map()
  const byMonth = new Map()
  let active = 0
  let activeSpend = 0
  let joinedInRange = 0
  let minors = 0

  for (const c of customers) {
    const spent = spend.get(c.customer_id)
    const isActive = spent != null
    if (isActive) {
      active += 1
      activeSpend += spent
    }
    if (c.joined_date >= from && c.joined_date <= to) joinedInRange += 1
    if (c.is_minor) minors += 1

    const age = byAge.get(c.age_group_order) ?? { age_group: c.age_group, order: c.age_group_order, members: 0, active: 0, spend: 0 }
    age.members += 1
    if (isActive) {
      age.active += 1
      age.spend += spent
    }
    byAge.set(c.age_group_order, age)

    const branch = byBranch.get(c.home_branch) ?? { branch: c.home_branch, members: 0, active: 0 }
    branch.members += 1
    if (isActive) branch.active += 1
    byBranch.set(c.home_branch, branch)

    const month = c.joined_date.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
  }

  return {
    members: customers.length,
    active,
    activeRate: customers.length ? active / customers.length : 0,
    avgSpend: active ? activeSpend / active : 0,
    joinedInRange,
    minors,
    byAge: [...byAge.values()]
      .sort((a, b) => a.order - b.order)
      .map((a) => ({ ...a, activeRate: a.members ? a.active / a.members : 0, avgSpend: a.active ? a.spend / a.active : 0 })),
    byBranch: [...byBranch.values()]
      .map((b) => ({ ...b, activeRate: b.members ? b.active / b.members : 0 }))
      .sort((a, b) => b.members - a.members),
    byMonth: [...byMonth].map(([month, members]) => ({ month, members })).sort((a, b) => a.month.localeCompare(b.month)),
  }
}

/** Share of member line items bought at the member's home branch */
export function homeBranchShare(customers, sales) {
  const home = new Map(customers.map((c) => [c.customer_id, c.home_branch]))
  let member = 0
  let atHome = 0
  for (const row of sales) {
    const h = home.get(row.customer_id)
    if (!h) continue
    member += 1
    if (row.branch === h) atHome += 1
  }
  return member ? atHome / member : null
}
