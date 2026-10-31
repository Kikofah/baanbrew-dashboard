// Lab 3.2 · ฟอร์มบันทึกยอดขาย (วางคอลัมน์ขวาของ LiveTab)
// ตรวจด้วย validateSaleForm และสร้างเอกสารด้วย buildSale → โครงสร้างเดียวกับข้อมูลที่ import (Lab 3.1)
// บันทึกแล้ว onSnapshot ใน LiveTab จะเห็นเอกสารใหม่เองโดยไม่ต้องรีเฟรช
import { useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRANCHES, MAX_QTY, PAYMENTS, buildSale, validateSaleForm } from "./saleModel.js";
import { formatTHB } from "../lib/metrics.js";

const emptyForm = () => ({ branch: BRANCHES[0], product_id: "", qty: "1", payment_method: PAYMENTS[0], customer_id: "" });

function Field({ label, error, hint, children }) {
  return (
    <label className="field">
      {label}
      {children}
      {error ? <span className="text-xs font-normal text-red-700">{error}</span>
        : hint && <span className="text-xs font-normal text-stone-400">{hint}</span>}
    </label>
  );
}

/**
 * props: products = [{ product_id, product_name, category, price }] (โหลดครั้งเดียวจาก LiveTab),
 *        productsError = ข้อความ, uid = user.uid ของผู้ที่ล็อกอิน (เก็บใน created_by)
 */
export default function SaleForm({ products, productsError, uid }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { ok: true, text } | { ok: false, text }

  const list = useMemo(() => products ?? [], [products]);
  const byCategory = useMemo(() => {
    const groups = new Map();
    for (const p of list) groups.set(p.category ?? "อื่น ๆ", [...(groups.get(p.category ?? "อื่น ๆ") ?? []), p]);
    return [...groups];
  }, [list]);

  const product = list.find((p) => p.product_id === form.product_id);
  // ยอดรวมก่อนบันทึก: แสดงเมื่อเลือกเมนูแล้วและจำนวนถูกต้อง (ใช้ validateSaleForm ตัวเดียวกับตอนบันทึก)
  const preview = product && !validateSaleForm(form, list).qty ? Number(form.qty) * Number(product.price) : null;

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => {
      if (!errs[key]) return errs;
      const { [key]: _removed, ...rest } = errs;
      return rest;
    });
    setResult(null);
  };

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const errs = validateSaleForm(form, list);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setResult({ ok: false, text: "กรุณาแก้ไขช่องที่มีข้อผิดพลาด" });
      return;
    }

    setSaving(true);
    setResult(null);
    try {
      const { id, data } = buildSale(form, product, { uid });
      await setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() });
      setResult({ ok: true, text: `บันทึกแล้ว · บิล ${data.order_id} · ${formatTHB(data.revenue)}` });
      // เก็บสาขาและวิธีชำระเงินไว้ บันทึกรายการถัดไปได้เร็วขึ้น
      setForm((f) => ({ ...emptyForm(), branch: f.branch, payment_method: f.payment_method }));
    } catch (err) {
      setResult({
        ok: false,
        text: err.code === "permission-denied" ? "ถูกปฏิเสธโดย Security Rules · ตรวจว่าบัญชีได้รับสิทธิ์พนักงานแล้ว (npm run grant-staff)" : `บันทึกไม่สำเร็จ: ${err.message}`,
      });
    } finally {
      setSaving(false);
    }
  }

  const disabled = saving || !db || !uid || list.length === 0;

  return (
    <form onSubmit={submit} noValidate className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <h2 className="font-semibold">บันทึกยอดขาย</h2>
      <p className="mt-0.5 text-xs text-stone-400">ราคามาจากเมนู · เวลาบันทึกเป็นเวลาไทยขณะกดบันทึก</p>

      {productsError && <p className="mt-3 text-sm text-red-700">❌ {productsError}</p>}
      {!productsError && products == null && <p className="mt-3 text-sm text-stone-500">กำลังโหลดเมนู…</p>}

      <fieldset disabled={disabled} className="mt-4 space-y-3">
        <Field label="สาขา" error={errors.branch}>
          <select className="input" value={form.branch} onChange={set("branch")} aria-invalid={!!errors.branch}>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>

        <Field label="เมนู" error={errors.product_id}>
          <select className="input" value={form.product_id} onChange={set("product_id")} aria-invalid={!!errors.product_id}>
            <option value="">— เลือกเมนู —</option>
            {byCategory.map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((p) => (
                  <option key={p.product_id} value={p.product_id}>{p.product_name} · {formatTHB(Number(p.price))}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="จำนวน" error={errors.qty} hint={`1–${MAX_QTY} แก้ว/ชิ้น`}>
          <input
            className="input tabular-nums" type="number" inputMode="numeric" min="1" max={MAX_QTY} step="1"
            value={form.qty} onChange={set("qty")} aria-invalid={!!errors.qty}
          />
        </Field>

        <Field label="วิธีชำระเงิน" error={errors.payment_method} hint={["LINE MAN", "Grab"].includes(form.payment_method) ? "ช่องทาง: เดลิเวอรี" : "ช่องทาง: หน้าร้าน"}>
          <select className="input" value={form.payment_method} onChange={set("payment_method")} aria-invalid={!!errors.payment_method}>
            {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="รหัสสมาชิก (ไม่บังคับ)" error={errors.customer_id} hint="เช่น C01234 · เว้นว่างถ้าไม่ใช่สมาชิก">
          <input
            className="input uppercase" value={form.customer_id} onChange={set("customer_id")}
            placeholder="C01234" autoComplete="off" aria-invalid={!!errors.customer_id}
          />
        </Field>
      </fieldset>

      <div className="mt-4 flex items-baseline justify-between border-t border-stone-100 pt-3">
        <span className="text-sm text-stone-500">ยอดรวม</span>
        <span className="text-2xl font-semibold tabular-nums">
          {preview == null ? "—" : formatTHB(preview)}
        </span>
      </div>
      {product && preview != null && (
        <p className="text-right text-xs text-stone-400">{form.qty} × {formatTHB(Number(product.price))}</p>
      )}

      <button type="submit" className="btn-primary mt-4 w-full" disabled={disabled}>
        {saving ? "กำลังบันทึก…" : "บันทึกยอดขาย"}
      </button>

      {result && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {result.ok ? "✅ " : "❌ "}{result.text}
        </p>
      )}
    </form>
  );
}
