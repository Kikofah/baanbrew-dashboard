import { BRANCHES } from '../lib/options'

/** Date range + branch filters as one compact toolbar row. `value` = { from, to, branch } ('' branch = all) */
export default function SalesFilters({ value, onChange, loading }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  const invalid = value.from && value.to && value.from > value.to

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="text-xs font-medium text-stone-500">ช่วงวันที่</span>
      <div className="flex items-center gap-1.5">
        <input type="date" aria-label="ตั้งแต่วันที่" className="input w-auto py-1.5" value={value.from} max={value.to} onChange={set('from')} required />
        <span className="text-stone-400">–</span>
        <input type="date" aria-label="ถึงวันที่" className="input w-auto py-1.5" value={value.to} min={value.from} onChange={set('to')} required />
      </div>
      <span className="ml-1 text-xs font-medium text-stone-500">สาขา</span>
      <select aria-label="สาขา" className="input w-auto py-1.5" value={value.branch} onChange={set('branch')}>
        <option value="">ทุกสาขา</option>
        {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      <p className="text-xs" role="status">
        {invalid
          ? <span className="text-red-600">วันเริ่มต้องไม่หลังวันสิ้นสุด</span>
          : loading && (
            <span className="inline-flex items-center gap-1.5 text-stone-500">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
              กำลังโหลด…
            </span>
          )}
      </p>
    </div>
  )
}
