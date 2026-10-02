import { BRANCHES } from '../lib/options'

const inputClass =
  'rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-amber-700 focus:outline-none'

/** Date range + branch filters in one row. `value` = { from, to, branch } ('' branch = all) */
export default function SalesFilters({ value, onChange, loading }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  const invalid = value.from && value.to && value.from > value.to

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-100 bg-white p-3 shadow-sm sm:p-4">
      <label className="flex flex-col gap-1 text-xs text-stone-500">
        ตั้งแต่วันที่
        <input type="date" className={inputClass} value={value.from} max={value.to} onChange={set('from')} required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-stone-500">
        ถึงวันที่
        <input type="date" className={inputClass} value={value.to} min={value.from} onChange={set('to')} required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-stone-500">
        สาขา
        <select className={inputClass} value={value.branch} onChange={set('branch')}>
          <option value="">ทุกสาขา</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <p className="pb-1.5 text-xs" role="status">
        {invalid
          ? <span className="text-red-600">วันเริ่มต้องไม่หลังวันสิ้นสุด</span>
          : loading && <span className="text-stone-500">กำลังโหลด…</span>}
      </p>
    </div>
  )
}
