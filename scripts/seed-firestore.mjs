// อัปโหลด public/sales_clean.csv เข้า Firestore collection "sales"
//
//   node --env-file=.env scripts/seed-firestore.mjs [ตั้งแต่วันที่]
//   ค่าเริ่มต้น: 2026-07-01 (3 เดือนล่าสุด ~8.9k แถว — แพ็กเกจฟรีเขียนได้ 20k ครั้ง/วัน)
//
// doc id = order_id + ลำดับบรรทัดใน order จึงรันซ้ำได้โดยไม่เกิดข้อมูลซ้ำ (เขียนทับของเดิม)
import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import { initializeApp } from 'firebase/app'
import { doc, getFirestore, terminate, writeBatch } from 'firebase/firestore'

const FROM = process.argv[2] ?? '2026-07-01'
const BATCH_SIZE = 500 // Firestore limit per batch

const env = process.env
if (!env.VITE_FIREBASE_PROJECT_ID) {
  console.error('ไม่พบค่า Firebase — รันด้วย: node --env-file=.env scripts/seed-firestore.mjs')
  process.exit(1)
}
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

const csv = await readFile(new URL('../public/sales_clean.csv', import.meta.url), 'utf8')
const { data } = Papa.parse(csv.replace(/^﻿/, ''), { header: true, skipEmptyLines: true })

const lineNo = new Map()
const docs = data
  .filter((r) => r.datetime.slice(0, 10) >= FROM)
  .map((r) => {
    const n = (lineNo.get(r.order_id) ?? 0) + 1
    lineNo.set(r.order_id, n)
    return {
      id: `${r.order_id}-${n}`,
      data: {
        order_id: r.order_id,
        datetime: r.datetime,
        date: r.datetime.slice(0, 10),
        branch: r.branch,
        product_id: r.product_id || null,
        qty: Number(r.qty),
        unit_price: Number(r.unit_price),
        customer_id: r.customer_id || null,
        payment_method: r.payment_method,
        channel: r.channel,
        source: 'seed',
      },
    }
  })

console.log(`อัปโหลด ${docs.length.toLocaleString()} แถว ตั้งแต่ ${FROM} → ${env.VITE_FIREBASE_PROJECT_ID}/sales`)
for (let i = 0; i < docs.length; i += BATCH_SIZE) {
  const batch = writeBatch(db)
  for (const d of docs.slice(i, i + BATCH_SIZE)) batch.set(doc(db, 'sales', d.id), d.data)
  await batch.commit()
  process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, docs.length).toLocaleString()} / ${docs.length.toLocaleString()}`)
}
console.log('\nเสร็จแล้ว')
await terminate(db)
