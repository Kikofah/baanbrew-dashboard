// Data source ของแท็บ Day 4 (CustomersTab, ForecastTab) · รูปแบบที่ src/lab4/useAnalytics.js ต้องการ:
//   onAuth(cb) → unsubscribe · signIn() · signOut() · loadAnalytics() → { reads, meta, daily, rfm, cohort, abc }
// - firebaseSource: อ่านเอกสารสรุป 5 ชิ้นใน collection "analytics" (ไม่อ่านยอดขายดิบจาก sales ตาม CLAUDE.md)
// - demoSource (?demo): ไม่ต้องล็อกอิน คำนวณจาก CSV ในเบราว์เซอร์ด้วยฟังก์ชันชุดเดียวกับ pipeline
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import Papa from 'papaparse'
import { auth, db } from './firebase'
import { signIn, signOutUser } from './useAuth'
import { prepareRows } from './metrics'
import { buildDemoAnalytics } from '../lab4/demoAnalytics.js'

const ANALYTICS_DOCS = ['meta', 'daily', 'rfm', 'cohort', 'abc']

/** อ่าน analytics/{meta,daily,rfm,cohort,abc} พร้อมกัน = 5 reads ต่อการเปิดแท็บ */
async function loadAnalytics() {
  const snaps = await Promise.all(ANALYTICS_DOCS.map((id) => getDoc(doc(db, 'analytics', id))))
  const missing = ANALYTICS_DOCS.filter((id, i) => !snaps[i].exists())
  if (missing.length) {
    throw new Error(`ยังไม่มีผลวิเคราะห์ใน Firestore (ขาด analytics/${missing.join(', ')}) — รัน npm run analytics ก่อน หรือเปิดโหมดสาธิตด้วย ?demo`)
  }
  const data = Object.fromEntries(ANALYTICS_DOCS.map((id, i) => [id, snaps[i].data()]))
  // builtAt เป็น Firestore Timestamp → แปลงเป็น Date ให้ ui.jsx แสดงเวลาอัปเดตได้
  const builtAt = data.meta.builtAt?.toDate ? data.meta.builtAt.toDate() : data.meta.builtAt ?? null
  return { reads: ANALYTICS_DOCS.length, ...data, meta: { ...data.meta, builtAt } }
}

export const firebaseSource = {
  onAuth: (cb) => onAuthStateChanged(auth, cb),
  signIn,
  signOut: signOutUser,
  loadAnalytics,
}

async function loadCsv(file) {
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`)
  if (!res.ok) throw new Error(`โหลดไฟล์ ${file} ไม่สำเร็จ (${res.status})`)
  return Papa.parse((await res.text()).replace(/^﻿/, ''), { header: true, skipEmptyLines: true }).data
}

const DEMO_USER = { uid: 'demo', displayName: 'โหมดสาธิต', demo: true }

export const demoSource = {
  onAuth: (cb) => {
    cb(DEMO_USER) // โหมดสาธิตไม่ต้องล็อกอิน
    return () => {}
  },
  signIn: async () => {},
  signOut: async () => {},
  loadAnalytics: async () => {
    const [sales, products, holidays] = await Promise.all([
      loadCsv('sales.csv'), loadCsv('products.csv'), loadCsv('thai_holidays.csv'),
    ])
    const holidayMap = Object.fromEntries(holidays.map((h) => [h.date, h.holiday]))
    return buildDemoAnalytics(prepareRows(sales), products, holidayMap)
  },
}

/**
 * เติม ?demo ท้าย URL เพื่อใช้โหมดสาธิต · ใช้ได้เฉพาะ npm run dev
 * (โหมดสาธิตต้องโหลด sales.csv ซึ่งมีรหัสสมาชิก จึงไม่ติดไปกับเว็บที่ deploy ดู vite.config.js)
 */
export const isDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')
export const analyticsSource = isDemo ? demoSource : firebaseSource
