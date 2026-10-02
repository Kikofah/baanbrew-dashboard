import { useMemo, useState } from 'react'
import { addDoc, serverTimestamp } from 'firebase/firestore'
import { SALES } from '../lib/useSales'
import { formatTHB } from '../lib/metrics'
import { BRANCHES, CHANNELS, PAYMENT_METHODS, bangkokNowLocal } from '../lib/options'
import { signIn } from '../lib/useAuth'

const inputClass = 'input'

function Field({ label, children }) {
  return (
    <label className="field">
      {label}
      {children}
    </label>
  )
}

const emptyForm = () => ({
  datetime: bangkokNowLocal(),
  branch: BRANCHES[0],
  product_id: '',
  qty: 1,
  channel: CHANNELS[0],
  payment_method: PAYMENT_METHODS[CHANNELS[0]][0],
  customer_id: '',
})

/**
 * Records one line item into Firestore "sales". Price comes from products.csv, not typed in.
 * Signed-in users only; each sale stores who entered it. `auth` = result of useAuth()
 */
export default function SalesForm({ products, auth }) {
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState({ saving: false, message: null, error: false })

  // Group menus by category so the long list is easier to scan
  const byCategory = useMemo(() => {
    const groups = new Map()
    for (const p of products ?? []) groups.set(p.category, [...(groups.get(p.category) ?? []), p])
    return [...groups]
  }, [products])
  const product = (products ?? []).find((p) => p.product_id === form.product_id)
  const unitPrice = product ? Number(product.price) : null
  const qty = Number(form.qty)
  const validQty = Number.isInteger(qty) && qty >= 1

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setChannel = (e) => {
    const channel = e.target.value
    setForm((f) => ({ ...f, channel, payment_method: PAYMENT_METHODS[channel][0] }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!auth.user || !product || !validQty || !form.datetime) return
    setStatus({ saving: true, message: null, error: false })
    const datetime = `${form.datetime}:00+07:00`
    try {
      await addDoc(SALES, {
        order_id: `WEB${Date.now()}`,
        datetime,
        date: datetime.slice(0, 10),
        branch: form.branch,
        product_id: product.product_id,
        qty,
        unit_price: unitPrice,
        customer_id: form.customer_id.trim() || null,
        payment_method: form.payment_method,
        channel: form.channel,
        source: 'form',
        created_at: serverTimestamp(),
        created_by: { uid: auth.user.uid, email: auth.user.email ?? null },
      })
      setStatus({ saving: false, error: false, message: `บันทึก ${product.product_name} × ${qty} = ${formatTHB(unitPrice * qty)} แล้ว` })
      setForm((f) => ({ ...emptyForm(), branch: f.branch, channel: f.channel, payment_method: f.payment_method }))
    } catch (err) {
      setStatus({ saving: false, error: true, message: `บันทึกไม่สำเร็จ: ${err.message}` })
    }
  }

  if (!auth.user) {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="card-title">บันทึกยอดขาย</h2>
          <p className="card-summary">
            {auth.ready ? 'เข้าสู่ระบบก่อนจึงจะบันทึกยอดขายได้' : 'กำลังตรวจสอบการเข้าสู่ระบบ…'}
          </p>
        </div>
        {auth.ready && (
          <button type="button" onClick={() => signIn().catch((err) => setStatus({ saving: false, error: true, message: err.message }))}
                  className="btn-primary">
            เข้าสู่ระบบด้วย Google
          </button>
        )}
        {status.error && <p role="alert" className="w-full text-sm text-red-600">{status.message}</p>}
      </section>
    )
  }

  return (
    // Folded by default so the charts come first
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="card-title block">บันทึกยอดขาย</span>
          <span className="card-summary block">เลือกเมนูแล้วราคาจะใส่ให้อัตโนมัติ · บันทึกแล้วกราฟอัปเดตทันที</span>
        </span>
        <span className="btn-ghost shrink-0">
          <span className="group-open:hidden">+ เพิ่มรายการ</span>
          <span className="hidden group-open:inline">ซ่อน</span>
        </span>
      </summary>
      <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 lg:grid-cols-4">
        <Field label="วันที่และเวลา">
          <input type="datetime-local" className={inputClass} value={form.datetime} onChange={set('datetime')} required />
        </Field>
        <Field label="สาขา">
          <select className={inputClass} value={form.branch} onChange={set('branch')}>
            {BRANCHES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="เมนู">
            <select className={inputClass} value={form.product_id} onChange={set('product_id')} required disabled={!products}>
              <option value="">{products ? '— เลือกเมนู —' : 'กำลังโหลดเมนู…'}</option>
              {byCategory.map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} · {formatTHB(Number(p.price))}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>
        <Field label="ราคาต่อหน่วย (อัตโนมัติ)">
          <input className={inputClass} value={unitPrice == null ? '' : formatTHB(unitPrice)} placeholder="เลือกเมนูก่อน" readOnly disabled />
        </Field>
        <Field label="จำนวน">
          <input type="number" min="1" step="1" className={inputClass} value={form.qty} onChange={set('qty')} required />
        </Field>
        <Field label="ช่องทาง">
          <select className={inputClass} value={form.channel} onChange={setChannel}>
            {CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="ชำระเงิน">
          <select className={inputClass} value={form.payment_method} onChange={set('payment_method')}>
            {PAYMENT_METHODS[form.channel].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="รหัสสมาชิก (ไม่บังคับ)">
          <input className={inputClass} value={form.customer_id} onChange={set('customer_id')} placeholder="เช่น C01069" />
        </Field>
        <div className="col-span-2 flex flex-wrap items-center gap-3 lg:col-span-3">
          <button
            type="submit"
            disabled={status.saving || !product || !validQty}
            className="btn-primary"
          >
            {status.saving ? 'กำลังบันทึก…' : `บันทึก${product && validQty ? ` · ${formatTHB(unitPrice * qty)}` : ''}`}
          </button>
          {status.message && (
            <p role="status" className={`text-sm ${status.error ? 'text-red-600' : 'text-emerald-700'}`}>{status.message}</p>
          )}
        </div>
      </form>
    </details>
  )
}
