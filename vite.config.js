import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// ข้อมูลส่วนบุคคล (PDPA): ใช้ได้ตอน dev และใน scripts เท่านั้น ห้ามติดไปกับเว็บที่ deploy
// (ทั้ง Firebase Hosting และ GitHub Pages ใช้ dist/ จาก vite build)
const PRIVATE_FILES = [
  'customers_clean.csv', 'customers.xlsx',
  'sales.csv', 'sales_clean.csv', 'sales.xlsx', 'sales_raw.xlsx',
]

/** ลบไฟล์ข้อมูลส่วนบุคคลออกจาก dist/ หลัง build (public/ ยังอยู่ครบ scripts และ npm run dev จึงใช้ได้ตามเดิม) */
function stripPrivateData() {
  let outDir = 'dist'
  return {
    name: 'strip-private-data',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      for (const file of PRIVATE_FILES) fs.rmSync(path.join(outDir, file), { force: true })
    },
  }
}

// https://vite.dev/config/
// dev (npm run dev) ใช้ base "/" จึงเปิด http://localhost:5173/?demo ได้ตาม CLAUDE.md
// build ใช้ base ของ GitHub Pages (/baanbrew-dashboard/) · Firebase Hosting ใช้ npm run build:hosting (--base=/)
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/baanbrew-dashboard/',
  plugins: [react(), tailwindcss(), stripPrivateData()],
}))
